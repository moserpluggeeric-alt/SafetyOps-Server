'use strict';
/**
 * CONCEPT EXTRACTOR — SafetyOps Classifier v2 / Phase 1
 * ─────────────────────────────────────────────────────────────────────────────
 * Sliding-window phrase matcher over normalized text using Lexicon 2.0.
 *
 * Algorithm:
 *   1. Normalize input text (same pipeline as norm.js)
 *   2. Build token array from normalized text
 *   3. For each concept, try all phrase/stem/colloquial/misspelling lists
 *      using a greedy longest-match strategy (longer phrases win)
 *   4. Return list of RawMatch objects (position, length, whether negated
 *      or hypothetical is handled by context-engine.js)
 *
 * NO PRODUCTION FILES MODIFIED.
 * Phase 1 only — does not import or modify classifier.js / keywords.js.
 */

const { LEXICON } = require('./lexicon-v2');

// ── Normalization (mirrors norm.js — no circular dep) ────────────────────────
function _n(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''´`]/g, "'");
}

/**
 * Tokenize normalized text into an array of word tokens.
 * Keeps punctuation as separate tokens so negation detection can work on it.
 * @param {string} normText
 * @returns {string[]}
 */
function tokenize(normText) {
  // Split on whitespace, then strip leading/trailing punctuation from each token
  // so "cabina," → "cabina", allowing phrase matches across punctuation boundaries.
  return normText.split(/\s+/)
    .map(tok => tok.replace(/^[.,;:!?¿¡()\[\]"']+|[.,;:!?¿¡()\[\]"']+$/g, ''))
    .filter(Boolean);
}

/**
 * @typedef {Object} RawMatch
 * @property {string}   conceptId      - Concept ID (e.g. 'FIRE')
 * @property {string}   matchText      - The matched phrase / stem / token(s)
 * @property {string}   matchType      - 'phrase_es'|'phrase_en'|'stem_es'|'stem_en'|
 *                                       'abbrev'|'colloquial_es'|'colloquial_en'|
 *                                       'misspelling'
 * @property {number}   startToken     - Token index (inclusive) of match start
 * @property {number}   endToken       - Token index (exclusive) of match end
 * @property {string[]} categories     - From concept definition
 * @property {number}   baseWeight     - confidence_weight from concept
 * @property {number}   priority       - priority from concept
 * @property {boolean}  requiresContext- Whether context_required_after must match
 * @property {string[]} contextRequired- context_required_after list from concept
 * @property {boolean}  negationInvalidates - Whether negation cancels this match
 * @property {number}   hypotheticalReduces - Multiplier if hypothetical
 * @property {string[]} conflictsWith  - IDs of conflicting concepts
 */

/**
 * Build a flattened lookup structure for fast matching.
 * Returns array of { phrase, conceptId, matchType, tokenCount }
 * sorted by tokenCount DESC (longest-match-first).
 * @returns {Array}
 */
function _buildPhraseIndex() {
  const entries = [];

  for (const concept of LEXICON) {
    const id = concept.id;

    const addPhrases = (list, type) => {
      for (const phrase of list) {
        const norm = _n(phrase);
        const tokens = tokenize(norm);
        if (tokens.length === 0) continue;
        entries.push({
          phrase: norm,
          tokens,
          tokenCount: tokens.length,
          conceptId: id,
          matchType: type,
        });
      }
    };

    addPhrases(concept._phrases_es   || [], 'phrase_es');
    addPhrases(concept._phrases_en   || [], 'phrase_en');
    addPhrases(concept._abbrev       || [], 'abbrev');
    addPhrases(concept._colloquial_es|| [], 'colloquial_es');
    addPhrases(concept._colloquial_en|| [], 'colloquial_en');
    addPhrases(concept._misspellings || [], 'misspelling');
  }

  // Sort longest-first so greedy matching picks longest match
  entries.sort((a, b) => b.tokenCount - a.tokenCount);

  return entries;
}

// Build index once at module load
const PHRASE_INDEX = _buildPhraseIndex();

// Build stem index (separate — stem matching is prefix-based, not exact)
function _buildStemIndex() {
  const stems = [];
  for (const concept of LEXICON) {
    const id = concept.id;
    for (const stem of (concept._stems_es || [])) {
      stems.push({ stem: _n(stem), conceptId: id, matchType: 'stem_es' });
    }
    for (const stem of (concept._stems_en || [])) {
      stems.push({ stem: _n(stem), conceptId: id, matchType: 'stem_en' });
    }
  }
  return stems;
}

const STEM_INDEX = _buildStemIndex();

// Build concept map for quick lookup
const CONCEPT_MAP = {};
for (const c of LEXICON) {
  CONCEPT_MAP[c.id] = c;
}

/**
 * Try to match a phrase starting at tokenIndex.
 * Returns { matched: true, endToken } or { matched: false }.
 */
function _tryMatchPhrase(tokens, tokenIndex, phraseTokens) {
  if (tokenIndex + phraseTokens.length > tokens.length) return { matched: false };
  for (let i = 0; i < phraseTokens.length; i++) {
    if (tokens[tokenIndex + i] !== phraseTokens[i]) return { matched: false };
  }
  return { matched: true, endToken: tokenIndex + phraseTokens.length };
}

/**
 * Build a RawMatch from a concept and match metadata.
 */
function _buildMatch(concept, matchText, matchType, startToken, endToken) {
  return {
    conceptId:          concept.id,
    matchText,
    matchType,
    startToken,
    endToken,
    categories:         concept.categories,
    baseWeight:         concept.confidence_weight,
    priority:           concept.priority,
    requiresContext:    concept.requires_context || false,
    contextRequired:    concept._context_after   || [],
    negationInvalidates:concept.negation_invalidates !== false,
    hypotheticalReduces:typeof concept.hypothetical_reduces === 'number'
                          ? concept.hypothetical_reduces : 0.5,
    conflictsWith:      concept.conflicting_concepts || [],
  };
}

/**
 * Core extraction: extract all concept matches from a text.
 *
 * Strategy:
 *   1. Exact phrase matching (longest-first)
 *   2. Stem prefix matching (1 token per stem, only if not already covered by phrase match)
 *
 * @param {string} text - Raw incident text (any case, accents OK)
 * @returns {RawMatch[]}
 */
function extractConcepts(text) {
  if (!text || typeof text !== 'string') return [];

  const normText = _n(text);
  const tokens = tokenize(normText);
  if (tokens.length === 0) return [];

  // Track which token positions are already consumed by a phrase match
  // (for longest-match: once a phrase is matched, shorter overlapping matches are skipped)
  const consumed = new Set();
  const matches = [];

  // Pass 1: Exact phrase matches (longest-first due to sorted PHRASE_INDEX)
  for (let ti = 0; ti < tokens.length; ti++) {
    // Skip if this position already consumed
    if (consumed.has(ti)) continue;

    for (const entry of PHRASE_INDEX) {
      // Optimization: skip if first token doesn't match
      if (tokens[ti] !== entry.tokens[0]) continue;

      const result = _tryMatchPhrase(tokens, ti, entry.tokens);
      if (!result.matched) continue;

      // Check if any position in this span is already consumed
      let overlap = false;
      for (let k = ti; k < result.endToken; k++) {
        if (consumed.has(k)) { overlap = true; break; }
      }
      if (overlap) continue;

      const concept = CONCEPT_MAP[entry.conceptId];
      if (!concept) continue;

      // Mark consumed
      for (let k = ti; k < result.endToken; k++) consumed.add(k);

      matches.push(_buildMatch(
        concept,
        tokens.slice(ti, result.endToken).join(' '),
        entry.matchType,
        ti,
        result.endToken,
      ));

      // Move to end of match (outer loop will increment ti)
      ti = result.endToken - 1;
      break;
    }
  }

  // Pass 2: Stem prefix matches (only for unconsumed positions)
  for (let ti = 0; ti < tokens.length; ti++) {
    if (consumed.has(ti)) continue;

    const tok = tokens[ti];
    for (const entry of STEM_INDEX) {
      if (!tok.startsWith(entry.stem)) continue;

      // Avoid duplicate concept matches from stem when same concept already phrase-matched
      const alreadyMatched = matches.some(m =>
        m.conceptId === entry.conceptId &&
        m.startToken <= ti && ti < m.endToken,
      );
      if (alreadyMatched) continue;

      const concept = CONCEPT_MAP[entry.conceptId];
      if (!concept) continue;

      consumed.add(ti);
      matches.push(_buildMatch(
        concept,
        tok,
        entry.matchType,
        ti,
        ti + 1,
      ));
      break; // first stem match wins for this token
    }
  }

  // Sort by position
  matches.sort((a, b) => a.startToken - b.startToken);

  return matches;
}

/**
 * Get the token array for a given text (used by context-engine).
 * @param {string} text
 * @returns {string[]}
 */
function getTokens(text) {
  return tokenize(_n(text));
}

module.exports = { extractConcepts, getTokens, tokenize, _n };
