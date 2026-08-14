'use strict';
/**
 * CONTEXT ENGINE — SafetyOps Classifier v2 / Phase 1
 * ─────────────────────────────────────────────────────────────────────────────
 * Enriches raw concept matches from concept-extractor.js with:
 *   1. Negation detection    (window ±NEGATION_WINDOW_TOKENS before phrase)
 *   2. Hypothetical detection (window before/after phrase)
 *   3. Context validation    (requires_context → must find location word after)
 *   4. Hard-negative cancellation (ENGINE_NORMAL cancels ENGINE_FAILURE, etc.)
 *   5. Priority-based conflict resolution (FIREARM beats FIRE, etc.)
 *   6. Final score computation (baseWeight × score_multiplier)
 *
 * Exports:
 *   analyzeContext(rawMatches, text) → EnrichedMatch[]
 *
 * NO PRODUCTION FILES MODIFIED.
 * Phase 1 only — does not modify classifier.js / keywords.js.
 */

const { getTokens } = require('./concept-extractor');
const { LEXICON }   = require('./lexicon-v2');

// ── Configuration ─────────────────────────────────────────────────────────────
const NEGATION_WINDOW_TOKENS  = 3;   // tokens to check BEFORE match start
const CONTEXT_WINDOW_TOKENS   = 10;  // tokens to check AFTER match end for context
const HYPOTHETICAL_WINDOW     = 6;   // tokens around match to check hypothetical

// ── Negation tokens (normalized, no accents) ──────────────────────────────────
const NEGATION_TOKENS = new Set([
  'no', 'sin', 'ninguno', 'ninguna', 'nunca', 'jamas',
  'sin', 'ausencia', 'descartado', 'descartada',
  'no se detecto', 'no hubo', 'no hay', 'no se observo',
  'no se registro', 'negativo', 'negativa',
  'not', 'no', 'without', 'none', 'neither', 'never',
  'absent', 'absent of', 'ruled out', 'no evidence',
]);

// Multi-token negation phrases (normalized), sorted longest-first
const NEGATION_PHRASES = [
  'no se detecto', 'no se registro', 'no se observo',
  'no hubo', 'no hay', 'no evidence of', 'ruled out',
  'ausencia de', 'sin evidencia',
].sort((a, b) => b.split(' ').length - a.split(' ').length);

// ── Hypothetical markers (normalized) ────────────────────────────────────────
const HYPOTHETICAL_TOKENS = new Set([
  'si', 'hipotetico', 'hipotetica', 'simulacro', 'simulacion',
  'ejercicio', 'entrenamiento', 'capacitacion', 'adiestramiento',
  'potencial', 'posible', 'eventual', 'riesgo de',
  'if', 'hypothetical', 'simulation', 'drill', 'training',
  'potential', 'possible', 'scenario',
]);

// Multi-token conditional/hypothetical phrases (FIX 1 — Phase 1.6)
// Sorted longest-first for greedy matching on the window string.
const HYPOTHETICAL_PHRASES = [
  'si se detectara', 'si hubiera', 'en caso de que', 'en el supuesto de',
  'en caso de', 'de ocurrir', 'si ocurriera', 'ante una eventual',
  'en el caso de que', 'en caso que', 'si llegara a',
  'in case of', 'in the event of', 'should there be',
].sort((a, b) => b.length - a.length);

// Post-match window for concept-specific neg_triggers (FIX 5 — Phase 1.6)
// NEGATION_AFTER_TOKENS: how many tokens AFTER match end to check custom triggers
const NEGATION_AFTER_TOKENS = 8;

// ── Hard-negative concept IDs (cancel other concepts, not themselves) ─────────
// Format: { hardNegativeId → [conceptIds it cancels] }
const HARD_NEGATIVE_CANCELS = {
  ENGINE_NORMAL:          ['ENGINE_FAILURE'],
  ROUTINE_MAINTENANCE:    ['ENGINE_FAILURE', 'GROUND_DAMAGE', 'FOD'],
  OUT_OF_SCOPE_CATERING:  ['ENGINE_FAILURE', 'GROUND_DAMAGE'],
};

// Build concept lookup map
const CONCEPT_MAP = {};
for (const c of LEXICON) {
  CONCEPT_MAP[c.id] = c;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a string (mirrors norm.js / lexicon-v2 inline helper)
 */
function _n(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''´`]/g, "'");
}

/**
 * Check whether any negation signal appears in a window of tokens
 * before the match start, or (for custom triggers only) after match end.
 *
 * FIX 5 (Phase 1.6): concept-specific neg_triggers are also checked in
 * a post-match window of NEGATION_AFTER_TOKENS tokens, to handle cases
 * like "Aves en el aeropuerto; ninguna colisionó con la aeronave" where
 * the negation comes after the subject noun.
 *
 * @param {string[]} tokens            Full token array
 * @param {number}   start             Match start token index
 * @param {number}   end               Match end token index
 * @param {string[]} customNegTriggers Additional negators from concept definition
 * @returns {boolean}
 */
function _isNegated(tokens, start, end, customNegTriggers) {
  const windowStart = Math.max(0, start - NEGATION_WINDOW_TOKENS);
  const preWindow  = tokens.slice(windowStart, start);
  const preWindowStr = preWindow.join(' ');

  // Check single-token negators (pre-match only)
  for (const tok of preWindow) {
    if (NEGATION_TOKENS.has(tok)) return true;
  }

  // Check multi-token negation phrases (pre-match only)
  for (const phrase of NEGATION_PHRASES) {
    if (preWindowStr.includes(phrase)) return true;
  }

  // Check concept-specific negative triggers in BOTH pre- and post-match windows (FIX 5)
  if (customNegTriggers && customNegTriggers.length) {
    const postEnd = Math.min(tokens.length, end + NEGATION_AFTER_TOKENS);
    const postWindow = tokens.slice(end, postEnd);
    const postWindowStr = postWindow.join(' ');
    const combinedStr = preWindowStr + ' ' + postWindowStr;

    for (const trigger of customNegTriggers) {
      const normTrigger = _n(trigger);
      if (combinedStr.includes(normTrigger)) return true;
    }
  }

  return false;
}

/**
 * Check whether any hypothetical marker appears near the match.
 * FIX 1 (Phase 1.6): Also checks multi-token conditional phrases like
 * "si hubiera", "en caso de", "si se detectara" in the window string.
 *
 * @param {string[]} tokens  Full token array
 * @param {number}   start   Match start token index
 * @param {number}   end     Match end token index
 * @returns {boolean}
 */
function _isHypothetical(tokens, start, end) {
  const winStart = Math.max(0, start - HYPOTHETICAL_WINDOW);
  const winEnd   = Math.min(tokens.length, end + HYPOTHETICAL_WINDOW);
  const window = tokens.slice(winStart, winEnd);

  // Single-token check
  for (const tok of window) {
    if (HYPOTHETICAL_TOKENS.has(tok)) return true;
  }

  // Multi-token phrase check (FIX 1)
  const windowStr = window.join(' ');
  for (const phrase of HYPOTHETICAL_PHRASES) {
    if (windowStr.includes(phrase)) return true;
  }

  return false;
}

/**
 * Check context_required_after: at least one context word must appear
 * within CONTEXT_WINDOW_TOKENS after the end of the match.
 *
 * @param {string[]} tokens
 * @param {number}   end            Match end token index
 * @param {string[]} contextRequired List of required context words (normalized)
 * @returns {boolean} true if context satisfied (or no context required)
 */
function _hasContext(tokens, end, contextRequired) {
  if (!contextRequired || contextRequired.length === 0) return true;

  const winEnd = Math.min(tokens.length, end + CONTEXT_WINDOW_TOKENS);
  const afterStr = tokens.slice(end, winEnd).join(' ');

  // Also check BEFORE match (fire "en el motor" — location may precede)
  // Use entire text (tokens) if contextRequired is strict
  const fullStr = tokens.join(' ');

  for (const ctx of contextRequired) {
    if (afterStr.includes(_n(ctx))) return true;
    if (fullStr.includes(_n(ctx)))  return true;
  }
  return false;
}

// ── EnrichedMatch schema ──────────────────────────────────────────────────────
/**
 * @typedef {Object} EnrichedMatch
 * @property {string}   conceptId
 * @property {string}   matchText
 * @property {string}   matchType
 * @property {number}   startToken
 * @property {number}   endToken
 * @property {string[]} categories
 * @property {number}   baseWeight
 * @property {number}   priority
 * @property {boolean}  active          - false if cancelled by negation/context/conflict
 * @property {boolean}  negated         - detected negation
 * @property {boolean}  hypothetical    - detected hypothetical marker
 * @property {boolean}  contextSatisfied- context_required_after check result
 * @property {number}   scoreMultiplier - final multiplier (0 if cancelled)
 * @property {number}   finalScore      - baseWeight × scoreMultiplier
 * @property {string}   [cancelReason]  - Why active=false, if applicable
 */

/**
 * Main entry point: enrich raw matches with context analysis.
 *
 * @param {import('./concept-extractor').RawMatch[]} rawMatches
 * @param {string} text   Original incident text
 * @returns {EnrichedMatch[]}
 */
function analyzeContext(rawMatches, text) {
  if (!rawMatches || rawMatches.length === 0) return [];

  const tokens = getTokens(text);
  const enriched = [];

  // ── Step 1: Enrich each match individually ────────────────────────────────
  for (const match of rawMatches) {
    const concept = CONCEPT_MAP[match.conceptId];

    // Negation check (FIX 5: pass end token so post-match window works for custom triggers)
    const negTriggers = concept ? (concept._neg_triggers || []) : [];
    const negated = _isNegated(tokens, match.startToken, match.endToken, negTriggers);

    // Hypothetical check
    const hypothetical = _isHypothetical(tokens, match.startToken, match.endToken);

    // Context check (for requires_context concepts)
    const contextSatisfied = match.requiresContext
      ? _hasContext(tokens, match.endToken, match.contextRequired)
      : true;

    // Determine cancellation
    let active = true;
    let cancelReason = null;
    let scoreMultiplier = 1.0;

    if (negated && match.negationInvalidates) {
      active = false;
      cancelReason = 'negation';
      scoreMultiplier = 0;
    } else if (match.requiresContext && !contextSatisfied) {
      active = false;
      cancelReason = 'missing_context';
      scoreMultiplier = 0;
    } else {
      // Apply hypothetical reduction (doesn't cancel, just reduces)
      if (hypothetical) {
        scoreMultiplier *= match.hypotheticalReduces;
      }
    }

    const finalScore = match.baseWeight * scoreMultiplier;

    enriched.push({
      conceptId:          match.conceptId,
      matchText:          match.matchText,
      matchType:          match.matchType,
      startToken:         match.startToken,
      endToken:           match.endToken,
      categories:         match.categories,
      baseWeight:         match.baseWeight,
      priority:           match.priority,
      active,
      negated,
      hypothetical,
      contextSatisfied,
      scoreMultiplier,
      finalScore,
      cancelReason,
    });
  }

  // ── Step 2: Hard-negative concept cancellation ────────────────────────────
  // Find which hard-negative concepts are active
  const activeHardNegs = enriched.filter(m =>
    m.active && HARD_NEGATIVE_CANCELS[m.conceptId],
  );

  for (const hardNeg of activeHardNegs) {
    const cancelTargets = HARD_NEGATIVE_CANCELS[hardNeg.conceptId];
    for (const target of enriched) {
      if (!target.active) continue;
      if (cancelTargets.includes(target.conceptId)) {
        target.active = false;
        target.scoreMultiplier = 0;
        target.finalScore = 0;
        target.cancelReason = `hard_negative:${hardNeg.conceptId}`;
      }
    }
  }

  // ── Step 3: Priority-based conflict resolution ────────────────────────────
  // For each active match, check if any conflicting concept has higher priority
  const activeCandidates = enriched.filter(m => m.active);

  for (const match of activeCandidates) {
    if (!match.active) continue; // may have been cancelled in earlier iteration

    for (const conflictId of (CONCEPT_MAP[match.conceptId]?.conflicting_concepts || [])) {
      const conflicting = activeCandidates.find(m => m.active && m.conceptId === conflictId);
      if (!conflicting) continue;

      // Higher priority wins; tie goes to higher baseWeight
      if (match.priority > conflicting.priority) {
        conflicting.active = false;
        conflicting.scoreMultiplier = 0;
        conflicting.finalScore = 0;
        conflicting.cancelReason = `priority_conflict:${match.conceptId}`;
      } else if (conflicting.priority > match.priority) {
        match.active = false;
        match.scoreMultiplier = 0;
        match.finalScore = 0;
        match.cancelReason = `priority_conflict:${conflicting.conceptId}`;
      } else {
        // Same priority: higher baseWeight wins
        if (match.baseWeight >= conflicting.baseWeight) {
          conflicting.active = false;
          conflicting.scoreMultiplier = 0;
          conflicting.finalScore = 0;
          conflicting.cancelReason = `weight_conflict:${match.conceptId}`;
        } else {
          match.active = false;
          match.scoreMultiplier = 0;
          match.finalScore = 0;
          match.cancelReason = `weight_conflict:${conflicting.conceptId}`;
        }
      }
    }
  }

  return enriched;
}

/**
 * Build a category→score map from enriched matches.
 * Used by classifier-v2.js to merge concept scores into the classifier pipeline.
 *
 * @param {EnrichedMatch[]} enrichedMatches
 * @returns {Object.<string, number>}  category → cumulative score
 */
function buildCategoryScores(enrichedMatches) {
  const scores = {};
  for (const match of enrichedMatches) {
    if (!match.active || match.finalScore <= 0) continue;
    for (const cat of match.categories) {
      scores[cat] = (scores[cat] || 0) + match.finalScore;
    }
  }
  return scores;
}

/**
 * Get the best active concept (highest finalScore, ties broken by priority).
 * Returns null if no active concepts.
 *
 * @param {EnrichedMatch[]} enrichedMatches
 * @returns {EnrichedMatch|null}
 */
function getBestConcept(enrichedMatches) {
  const active = enrichedMatches.filter(m => m.active && m.finalScore > 0);
  if (active.length === 0) return null;
  return active.sort((a, b) =>
    b.finalScore - a.finalScore || b.priority - a.priority,
  )[0];
}

/**
 * Check if any hard-negative concept was detected (active or not).
 * Useful for _revisarManualmente logic in classifier-v2.
 *
 * @param {EnrichedMatch[]} enrichedMatches
 * @returns {boolean}
 */
function hasOutOfScopeSignal(enrichedMatches) {
  return enrichedMatches.some(m =>
    ['ROUTINE_MAINTENANCE', 'OUT_OF_SCOPE_CATERING'].includes(m.conceptId) && m.active,
  );
}

module.exports = {
  analyzeContext,
  buildCategoryScores,
  getBestConcept,
  hasOutOfScopeSignal,
  // Exported for testing
  _isNegated,
  _isHypothetical,
  _hasContext,
  NEGATION_WINDOW_TOKENS,
  CONTEXT_WINDOW_TOKENS,
};
