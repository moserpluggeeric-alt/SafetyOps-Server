'use strict';
/**
 * AI-CONTEXT.JS — SafetyOps Provider-Neutral Context Builder
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts the output of the real SafetyOps local classifier into a structured
 * JSON payload for AI providers (Gemini, OpenAI, etc.).
 *
 * REAL ENTRY POINT:
 *   const { clasificarV2 } = require('./analysis-engine/classifier-v2');
 *   const localResult = clasificarV2(texto, 'es');
 *   const ctx = buildStructuredContext(localResult, texto);
 *
 * REAL OUTPUT FIELDS (verified against classifier.js + classifier-v2.js):
 *
 *   LOCAL ENGINE REAL SHAPE (from clasificarV2 / clasificar):
 *     .categoria           — winning category string (null when _noClasificable)
 *     .confianza           — 0–1 sigmoid confidence
 *     ._revisarManualmente — boolean (MEJORA 6 flag)
 *     ._tiebreaker         — boolean (top-1 and top-2 within 5%)
 *     ._topCapas           — string (natural language summary of contributing layers)
 *     ._noClasificable     — boolean (ratio < 0.18 — text has no classifiable vocabulary)
 *     ._catchAll           — boolean (generic aviation text, low confidence)
 *     .adrep               — string | undefined (ICAO ADREP code if detected)
 *     ._scoreDetalle       — Record<cat, score> sorted desc (ABSENT when _noClasificable)
 *     ._trazas             — [{capa, termino, categoria?, peso?, info}]
 *       capa values: 'RAE','KW','STEM','ADREP','CONCEPT','NB','FASE','ANCHOR','TIE','MEJORA6','LEXICON_V2'
 *       NB ranking trace: {capa:'NB', termino:'ranking NB', categoria: <nb_top1>}
 *       ANCHOR traces:    {capa:'ANCHOR', termino: <category>, peso: <boost>}
 *     ._lexiconV2          — present only when USE_LEXICON_V2=true:
 *       .enrichedMatches   — [{id, text, type, active, negated, hypothetical, score, ...}]
 *       .hardNegatives     — string[] — active hard-negative concept IDs
 *
 * OUTPUT: exactly 8 fields (no more, no less):
 *   texto_normalizado   — string (trim + collapse whitespace + 1500 char limit)
 *   local_confidence    — number | null   (clf.confianza)
 *   nb_winner           — string | null   (NB ranking trace top-1 category)
 *   top_candidates      — Array<{categoria, score}>  (from _scoreDetalle, max 4, score>0)
 *   lexicon_concepts    — Array<{id, type, score, negated, hypothetical}>  (V2 only)
 *   anchors_active      — Array<{termino, categoria, peso}>   (capa ANCHOR or MEJORA6)
 *   hard_negatives      — Array<string>   (from _lexiconV2.hardNegatives, V2 only)
 *   context_signals     — Object | null   (classifier metadata signals)
 *     .local_categoria       — string|null  (final winner, null when noClasificable)
 *     .revisarManualmente    — boolean
 *     .tiebreaker            — boolean
 *     .topCapas              — string|null  (natural language layer summary)
 *     .noClasificable        — boolean      (ratio < 0.18 — no aeronautical vocabulary)
 *     .catchAll              — boolean      (generic aviation catch-all path)
 *     .adrep                 — string|null  (ICAO ADREP code)
 *
 * IMPORTANT — anchor.categoria note:
 *   ANCHOR trazas from classifier.js have structure {capa:'ANCHOR', termino:<category>, peso}
 *   WITHOUT a separate `categoria` field. The category name IS the `termino`.
 *   The mapping `t.categoria || t.termino` handles both ANCHOR (no categoria) and
 *   MEJORA6/LEXICON_V2 (may have categoria) shapes safely.
 *
 * IMPORTANT — _noClasificable case:
 *   When the text has no aeronautical vocabulary (ratio < 0.18), classifier.js
 *   returns early WITHOUT _scoreDetalle. In this case top_candidates = [].
 *   The nb_winner is still available from the NB ranking trace in _trazas.
 *   context_signals.noClasificable = true signals this to the AI provider.
 *
 * NO side effects. NO API calls. NO file I/O. Pure function.
 */

/**
 * Convert the local engine result into a structured JSON payload for AI providers.
 *
 * @param {Object|null} localResult - Output of clasificarV2(texto, lang)
 * @param {string}      texto       - Original incident description text
 * @returns {Object}    8-field context object (safe to JSON.stringify)
 */
function buildStructuredContext(localResult, texto) {
  // ── texto_normalizado ─────────────────────────────────────────────────────
  // Trim, collapse internal whitespace, cap at 1500 chars
  const textoNorm = (texto || '').trim().replace(/\s+/g, ' ').slice(0, 1500);

  // ── local_confidence ──────────────────────────────────────────────────────
  // The classifier's sigmoid confidence (0–1).
  // Note: when _noClasificable=true, confianza is the raw ratio (e.g. 0.177),
  // still useful as a signal to the AI provider.
  const localConfidence = localResult
    ? (typeof localResult.confianza === 'number' ? localResult.confianza : null)
    : null;

  // ── nb_winner ─────────────────────────────────────────────────────────────
  // The Naive Bayes layer's top-1 category BEFORE anchor overrides.
  // Source: _trazas entry where capa='NB' and termino='ranking NB'.
  // NB is heavily biased toward 'Factores Humanos' in SafetyOps corpus;
  // anchor overrides are what actually drive most correct classifications.
  // Exposing nb_winner separately lets the AI distinguish NB signal from
  // the final anchor-overridden result.
  let nbWinner = null;
  if (localResult && Array.isArray(localResult._trazas)) {
    const nbRankTrace = localResult._trazas.find(
      t => t.capa === 'NB' && t.termino === 'ranking NB'
    );
    nbWinner = nbRankTrace ? (nbRankTrace.categoria || null) : null;
  }

  // ── top_candidates ────────────────────────────────────────────────────────
  // Top 4 categories by combined score from _scoreDetalle.
  // ABSENT (empty array) when _noClasificable=true — classifier returns early
  // without building _scoreDetalle in that case.
  let topCandidates = [];
  if (localResult && localResult._scoreDetalle &&
      typeof localResult._scoreDetalle === 'object') {
    topCandidates = Object.entries(localResult._scoreDetalle)
      .filter(([, v]) => v > 0)
      .slice(0, 4)
      .map(([cat, score]) => ({ categoria: cat, score: +score.toFixed(3) }));
  }

  // ── lexicon_concepts ──────────────────────────────────────────────────────
  // Active Lexicon V2 concept matches. Only present when USE_LEXICON_V2=true.
  // 'active' means the concept was detected, not negated, and context was satisfied.
  let lexiconConcepts = [];
  if (localResult && localResult._lexiconV2 &&
      Array.isArray(localResult._lexiconV2.enrichedMatches)) {
    lexiconConcepts = localResult._lexiconV2.enrichedMatches
      .filter(m => m.active && m.score > 0)
      .map(m => ({
        id:           m.id,
        type:         m.type,
        score:        m.score,
        negated:      m.negated      || false,
        hypothetical: m.hypothetical || false,
      }));
  }

  // ── anchors_active ────────────────────────────────────────────────────────
  // ANCHOR and MEJORA6 layer traces — high-confidence override signals.
  // ANCHOR trazas: {capa:'ANCHOR', termino:<category>, peso:<boost>}
  //   NOTE: ANCHOR trazas have NO `categoria` field — termino IS the category.
  //   The mapping t.categoria || t.termino handles both ANCHOR and MEJORA6 shapes.
  let anchorsActive = [];
  if (localResult && Array.isArray(localResult._trazas)) {
    anchorsActive = localResult._trazas
      .filter(t => t.capa === 'ANCHOR' || t.capa === 'MEJORA6')
      .map(t => ({
        termino:  t.termino,
        categoria: t.categoria || t.termino,   // ANCHOR has no categoria field
        peso:     t.peso,
      }));
  }

  // ── hard_negatives ────────────────────────────────────────────────────────
  // Active hard-negative concept IDs that can cancel the base classifier output.
  // Only present when USE_LEXICON_V2=true.
  // Source: _lexiconV2.hardNegatives — already filtered to active hard-neg concepts.
  const hardNegatives = (localResult && localResult._lexiconV2)
    ? (localResult._lexiconV2.hardNegatives || [])
    : [];

  // ── context_signals ───────────────────────────────────────────────────────
  // Classifier metadata signals — the decision context beyond the score.
  // Null when localResult is null (no engine result available).
  const contextSignals = localResult ? {
    // Final winner category (post-anchor override, null when noClasificable)
    local_categoria:    localResult.categoria     || null,
    // MEJORA 6 flag — true when the server should flag for manual review
    revisarManualmente: Boolean(localResult._revisarManualmente),
    // MEJORA 4 — top-1 and top-2 within 5% of total score
    tiebreaker:         Boolean(localResult._tiebreaker),
    // MEJORA 5 — which layers drove the classification (natural language)
    topCapas:           localResult._topCapas     || null,
    // MEJORA 2 — ratio < 0.18, text lacks aeronautical vocabulary
    noClasificable:     Boolean(localResult._noClasificable),
    // Catch-all path — generic aviation text, minimal vocabulary
    catchAll:           Boolean(localResult._catchAll),
    // ICAO ADREP taxonomy code if detected (e.g. 'SEC', 'GCOL', 'WILD')
    adrep:              localResult.adrep         || null,
  } : null;

  return {
    texto_normalizado: textoNorm,
    local_confidence:  localConfidence,
    nb_winner:         nbWinner,
    top_candidates:    topCandidates,
    lexicon_concepts:  lexiconConcepts,
    anchors_active:    anchorsActive,
    hard_negatives:    hardNegatives,
    context_signals:   contextSignals,
  };
}

module.exports = { buildStructuredContext };
