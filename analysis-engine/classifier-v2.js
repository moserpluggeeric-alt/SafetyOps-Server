'use strict';
/**
 * CLASSIFIER V2 — SafetyOps Classifier v2 / Phase 1
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the existing 7-layer classifier pipeline (classifier.js) and adds
 * Lexicon 2.0 concept scoring on top, controlled by feature flag USE_LEXICON_V2.
 *
 * WHEN USE_LEXICON_V2=false (or unset):
 *   → Pure passthrough to classifier.js (identical behavior, zero risk)
 *
 * WHEN USE_LEXICON_V2=true:
 *   → Runs classifier.js pipeline first (produces base scores)
 *   → Runs concept-extractor + context-engine in parallel
 *   → Concept scores are ADDED to the base category scores
 *   → Hard-negative concepts (ENGINE_NORMAL, ROUTINE_MAINTENANCE,
 *     OUT_OF_SCOPE_CATERING) can override / cancel base classifier output
 *   → _revisarManualmente is re-evaluated incorporating concept evidence
 *   → Result includes extra _lexiconV2 field with concept details
 *
 * DESIGN:
 *   - classifier.js is NEVER modified (rollback = just disable flag)
 *   - No production files modified
 *   - All concept scoring is additive over the existing score object
 *
 * FEATURE FLAG:
 *   process.env.USE_LEXICON_V2 = 'true'  → V2 active
 *   process.env.USE_LEXICON_V2 = 'false' → V1 passthrough (default)
 *
 * USAGE:
 *   const { clasificarV2 } = require('./classifier-v2');
 *   const result = clasificarV2(text, lang);
 *   // result has same shape as classifier.js output + optional _lexiconV2 field
 */

const { clasificar }          = require('./classifier');
const { extractConcepts }     = require('./concept-extractor');
const {
  analyzeContext,
  buildCategoryScores,
  getBestConcept,
  hasOutOfScopeSignal,
}                             = require('./context-engine');

// ── Hard-negative concept IDs (categories=[], weight=0) ──────────────────────
// These concepts cancel base classifier output when active
const HARD_NEGATIVE_IDS = new Set([
  'ENGINE_NORMAL',
  'ROUTINE_MAINTENANCE',
  'OUT_OF_SCOPE_CATERING',
]);

// ── Categories that hard-negative concepts can cancel ────────────────────────
// If hard negative is active and winner is in this set → _revisarManualmente
const HARD_NEG_CANCELLABLE = {
  ENGINE_NORMAL:          new Set(['Falla Técnica']),
  ROUTINE_MAINTENANCE:    new Set(['Falla Técnica', 'Ground Damage', 'FOD']),
  OUT_OF_SCOPE_CATERING:  new Set(['Falla Técnica', 'Ground Damage']),
};

/**
 * Check if USE_LEXICON_V2 feature flag is enabled.
 * @returns {boolean}
 */
function isLexiconV2Enabled() {
  return process.env.USE_LEXICON_V2 === 'true';
}

/**
 * Main classifier entry point. Compatible signature with classifier.js.
 *
 * @param {string} text - Incident description text
 * @param {string} [lang='es'] - Language ('es'|'en')
 * @returns {Object|null} Same shape as clasificar(), with optional _lexiconV2 field
 */
function clasificarV2(text, lang) {
  // ── FLAG OFF: Pure passthrough ────────────────────────────────────────────
  if (!isLexiconV2Enabled()) {
    return clasificar(text, lang);
  }

  // ── FLAG ON: Lexicon 2.0 pipeline ─────────────────────────────────────────

  // Step 1: Run base classifier (7-layer pipeline) — do NOT modify its result yet
  const baseResult = clasificar(text, lang);

  // Step 2: Extract concepts from text
  let rawMatches;
  try {
    rawMatches = extractConcepts(text);
  } catch (err) {
    // If concept extractor fails, fall back to base result safely
    console.error('[classifier-v2] extractConcepts error:', err.message);
    return baseResult;
  }

  // Step 3: Context analysis (negation, hypothetical, conflicts, hard negatives)
  let enrichedMatches;
  try {
    enrichedMatches = analyzeContext(rawMatches, text);
  } catch (err) {
    console.error('[classifier-v2] analyzeContext error:', err.message);
    return baseResult;
  }

  // Step 4: Build concept category scores
  const conceptScores = buildCategoryScores(enrichedMatches);
  const bestConcept   = getBestConcept(enrichedMatches);
  const outOfScope    = hasOutOfScopeSignal(enrichedMatches);

  // Step 5: Check for active hard-negative concepts
  const activeHardNegs = enrichedMatches.filter(m =>
    m.active && HARD_NEGATIVE_IDS.has(m.conceptId),
  );

  // ── Build lexicon V2 debug info ───────────────────────────────────────────
  const _lexiconV2 = {
    enabled:        true,
    rawMatches:     rawMatches.length,
    enrichedMatches: enrichedMatches.map(m => ({
      id:           m.conceptId,
      text:         m.matchText,
      type:         m.matchType,
      active:       m.active,
      negated:      m.negated,
      hypothetical: m.hypothetical,
      contextOk:    m.contextSatisfied,
      score:        +m.finalScore.toFixed(3),
      cancelReason: m.cancelReason || null,
    })),
    conceptScores,
    bestConcept: bestConcept ? {
      id:         bestConcept.conceptId,
      categories: bestConcept.categories,
      score:      +bestConcept.finalScore.toFixed(3),
    } : null,
    hardNegatives: activeHardNegs.map(m => m.conceptId),
    outOfScope,
  };

  // ── CASE A: No base result and no concept scores → null ───────────────────
  if (!baseResult && Object.keys(conceptScores).length === 0) {
    return null;
  }

  // ── CASE B: No base result but we have concept scores → use concept result ─
  if (!baseResult && bestConcept) {
    const topCat = bestConcept.categories[0];
    return {
      categoria:          topCat || null,
      confianza:          Math.min(0.85, bestConcept.finalScore / 10),
      alternativas:       [],
      _lexiconV2,
      _revisarManualmente: outOfScope || !topCat,
      _trazas: [{
        capa: 'LEXICON_V2',
        termino: bestConcept.conceptId,
        categoria: topCat,
        peso: bestConcept.finalScore,
        info: `Lexicon V2 concept: ${bestConcept.conceptId} → ${topCat}`,
      }],
    };
  }

  // ── CASE C: Base result exists — merge concept scores ─────────────────────
  if (!baseResult) return null; // No concept evidence either

  // Clone base score details so we can add concept boosts
  const mergedScores = Object.assign(
    {},
    baseResult._scoreDetalle || {},
  );

  // Add concept scores to merged scores
  for (const [cat, score] of Object.entries(conceptScores)) {
    mergedScores[cat] = (mergedScores[cat] || 0) + score;
  }

  // Re-sort after adding concept scores
  const sorted = Object.entries(mergedScores)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return baseResult;

  const [topCat, topScore] = sorted[0];
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const ratio = topScore / total;

  // Recalculate confidence using same sigmoid as classifier.js
  const conf = Math.min(0.94, Math.max(0.22, 1 / (1 + Math.exp(-9 * (ratio - 0.38)))));

  // ── Hard-negative override ────────────────────────────────────────────────
  // If an active hard-negative concept covers the winner category,
  // override to _revisarManualmente=true and reduce confidence
  let hardNegOverride = false;
  for (const hn of activeHardNegs) {
    const cancelSet = HARD_NEG_CANCELLABLE[hn.conceptId];
    if (cancelSet && cancelSet.has(topCat)) {
      hardNegOverride = true;
      break;
    }
  }

  // ── Negation suppression ──────────────────────────────────────────────────
  // If a concept was detected but negated, and the top category from base
  // classifier matches that concept's category, we must not output that
  // category confidently — set _revisarManualmente.
  //
  // Cross-suppression: some concepts share linguistic signals with other categories.
  // E.g. SMOKE negated: "sin humo en cabina" also triggers V1 Incendio anchor.
  // FIRE negated: "no se detectó fuego" — suppress Incendio.
  // FUEL_EMERGENCY negated: "no hubo derrame de combustible" — V1 keywords map fuel
  //   terms (derrame, combustible, abastecimiento) to Falla Técnica; suppress that
  //   winner when the fuel event itself is negated (Fix N03-B, Phase 1.8).
  const NEGATION_CROSS_SUPPRESS = {
    SMOKE:          ['Smoke / Humo a Bordo', 'Incendio'],
    FIRE:           ['Incendio'],
    FUEL_EMERGENCY: ['Falla Técnica'],
  };

  const negationSuppressedCategories = new Set();
  for (const m of enrichedMatches.filter(em => em.negated && em.cancelReason === 'negation')) {
    for (const cat of m.categories) negationSuppressedCategories.add(cat);
    for (const cat of (NEGATION_CROSS_SUPPRESS[m.conceptId] || [])) {
      negationSuppressedCategories.add(cat);
    }
  }
  const negationSuppressesWinner = negationSuppressedCategories.has(topCat);

  // ── Rebuild _trazas with concept layer appended ───────────────────────────
  const v2Trazas = (baseResult._trazas || []).slice();
  for (const m of enrichedMatches.filter(em => em.active)) {
    v2Trazas.push({
      capa:      'LEXICON_V2',
      termino:   m.matchText,
      categoria: m.categories[0] || '—',
      peso:      +m.finalScore.toFixed(3),
      info:      `Lexicon V2 · ${m.conceptId} (${m.matchType}) → ${m.categories.join(', ')||'—'} score=${m.finalScore.toFixed(2)}`,
    });
  }

  // ── MEJORA 6 re-evaluation ────────────────────────────────────────────────
  // Concept evidence counts as "anchor-like" support — if a concept is active,
  // it provides the same signal as the existing anchor override.
  const hasConceptEvidence = enrichedMatches.some(m => m.active && m.finalScore > 0 && m.categories.length > 0);
  const baseRevision = baseResult._revisarManualmente;

  // FIX 3 (Phase 1.6): Raise threshold 2.0 → 5.0.
  // Only high-weight concept matches (e.g. phrase match with weight ≥5) can relax
  // _revisarManualmente set by V1. Low-weight matches (2–4) no longer override review.
  const conceptSupportsWinner = enrichedMatches.some(m =>
    m.active && m.categories.includes(topCat) && m.finalScore >= 5.0,
  );

  // FIX 6 (Phase 1.6): Low confidence + no concept evidence → force review.
  // When V2 has zero concept signal AND base confidence < 0.35, the classification
  // is too uncertain to auto-accept. Conservative rule — does not affect high-conf results.
  const lowConfidenceNoEvidence = (
    Object.keys(conceptScores).length === 0 &&
    conf < 0.35 &&
    !hardNegOverride
  );

  // Phase 1.7: Extended safety-concept hypothetical override.
  // If any of FIRE, SMOKE, or ENGINE_FAILURE was detected as TRULY HYPOTHETICAL
  // (hypothetical=true from conditional markers like "si hubiera", "en caso de",
  // "si se detectara") and the winner category is a safety-critical category,
  // force _revisarManualmente=true regardless of V1 confidence.
  //
  // IMPORTANT: Only checks m.hypothetical (conditional sentence detection).
  // Does NOT check !m.contextSatisfied — a missing location context makes a match
  // weak but not hypothetical; that case is handled by the lower conceptSupportsWinner
  // threshold. This distinction prevents "No se encontró arma, pero hubo un incendio"
  // (FIRE contextSatisfied=false, hypothetical=false) from being incorrectly forced
  // into review mode.
  const SAFETY_CRITICAL_CONCEPTS = new Set(['FIRE', 'SMOKE', 'ENGINE_FAILURE']);
  const SAFETY_CRITICAL_CATEGORIES = new Set(['Incendio', 'Smoke / Humo a Bordo', 'Falla Técnica']);

  const safetyConceptHypothetical = enrichedMatches.some(m =>
    SAFETY_CRITICAL_CONCEPTS.has(m.conceptId) &&
    m.hypothetical === true &&   // ONLY conditional markers — not missing context
    !m.negated,
  );
  const fireHypotheticalOverride = safetyConceptHypothetical && SAFETY_CRITICAL_CATEGORIES.has(topCat);

  const revisarManualmente = hardNegOverride
    || outOfScope
    || negationSuppressesWinner
    || fireHypotheticalOverride
    || lowConfidenceNoEvidence
    || (baseRevision && !conceptSupportsWinner);

  // Build final result
  const result = Object.assign({}, baseResult, {
    categoria:    topCat,
    confianza:    conf,
    alternativas: sorted.slice(1, 4)
      .filter(([, v]) => v > 0)
      .map(([c, sc]) => ({ cat: c, prob: Math.min(0.85, sc / total) })),
    _revisarManualmente: revisarManualmente,
    _trazas:     v2Trazas,
    _scoreDetalle: Object.fromEntries(sorted),
    _lexiconV2,
  });

  return result;
}

module.exports = { clasificarV2, isLexiconV2Enabled };
