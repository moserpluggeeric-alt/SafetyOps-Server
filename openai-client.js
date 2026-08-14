'use strict';
/**
 * OPENAI-CLIENT.JS — SafetyOps OpenAI Isolated HTTP Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides server-side OpenAI classification as a shadow layer over the local
 * classification engine. Designed to be ADDITIVE ONLY — never modifies the
 * local engine result, never exposes credentials to the frontend.
 *
 * ARCHITECTURE:
 *   Local engine (classifier-v2.js) → buildStructuredContext() → openaiClassify()
 *                                                                       ↓
 *                                                          shadow result (logged only)
 *
 * FEATURE FLAGS (Railway environment variables):
 *   OPENAI_API_KEY       — required; if absent, all functions return null safely
 *   OPENAI_MODEL         — default: 'gpt-4o-mini'
 *   OPENAI_ENABLED       — 'true' | 'false' (default: 'false')
 *   OPENAI_SHADOW_MODE   — 'true' | 'false' (default: 'true')
 *                          When true: OpenAI runs but result does NOT affect production output
 *                          When false (future): OpenAI result participates in ensemble decision
 *
 * DESIGN CONSTRAINTS:
 *   - NO business logic — does not decide which category wins
 *   - NO local engine modification — returns a separate result object
 *   - NO API key in code — exclusively from process.env
 *   - NO frontend exposure — module is server-only
 *   - Timeout: 10 000 ms (explicit socket destroy)
 *   - Retry: up to 2 attempts, only on JSON extraction failures
 *
 * USAGE (shadow mode, fire-and-forget from handleSyncReport):
 *   const { openaiClassify, buildStructuredContext, isOpenAIEnabled } = require('./openai-client');
 *   if (isOpenAIEnabled()) {
 *     const ctx = buildStructuredContext(localResult, texto);
 *     Promise.resolve().then(() => openaiClassify(ctx))   // non-blocking
 *       .then(r => shadowComparator.record(localResult, r, texto))
 *       .catch(err => console.warn('[openai] shadow error:', err.message));
 *   }
 */

const https = require('https');
const { OPENAI_OUTPUT_SCHEMA, validateOpenAIResponse } = require('./openai-schema');

// ── Feature flag readers ───────────────────────────────────────────────────────
// Read at call time (not at module load) so Railway hot-changes take effect
// without a server restart during development/testing.

/** Returns true only when OPENAI_ENABLED=true AND OPENAI_API_KEY is set. */
function isOpenAIEnabled() {
  return process.env.OPENAI_ENABLED === 'true' && Boolean(process.env.OPENAI_API_KEY);
}

/** Returns true when OPENAI_SHADOW_MODE=true (or unset — default is shadow). */
function isShadowMode() {
  return process.env.OPENAI_SHADOW_MODE !== 'false'; // default: true
}

/** Returns the configured model, falling back to gpt-4o-mini. */
function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

// ── buildStructuredContext ─────────────────────────────────────────────────────
/**
 * Convert the local engine result into a structured JSON payload for OpenAI.
 * OpenAI receives structured signals — NOT raw text piped into a generic LLM.
 * This is the key architectural difference from the Groq integration.
 *
 * @param {Object|null} localResult - Output of analysis-engine/index.js
 * @param {string}      texto       - Original incident description text
 * @returns {Object}    Structured context object (safe to JSON.stringify)
 */
function buildStructuredContext(localResult, texto) {
  // ── Normalize text: trim, collapse whitespace ──────────────────────────────
  const textoNorm = (texto || '').trim().replace(/\s+/g, ' ').slice(0, 1500);

  // ── Extract top candidates from _scoreDetalle ─────────────────────────────
  // _scoreDetalle is a Record<categoria, score> sorted desc by classifier-v2.js
  let topCandidates = [];
  if (localResult && localResult._scoreDetalle) {
    topCandidates = Object.entries(localResult._scoreDetalle)
      .filter(([, v]) => v > 0)
      .slice(0, 4)
      .map(([cat, score]) => ({ categoria: cat, score: +score.toFixed(3) }));
  }

  // ── Extract active Lexicon V2 concepts ────────────────────────────────────
  // Only include active (non-negated, non-hypothetical) concepts with score > 0
  let lexiconConcepts = [];
  if (localResult && localResult._lexiconV2 && localResult._lexiconV2.enrichedMatches) {
    lexiconConcepts = localResult._lexiconV2.enrichedMatches
      .filter(m => m.active && m.score > 0)
      .map(m => ({
        id:         m.id,
        type:       m.type,
        score:      m.score,
        negated:    m.negated    || false,
        hypothetical: m.hypothetical || false,
      }));
  }

  // ── Extract active hard-negative signals ─────────────────────────────────
  const hardNegatives = (localResult && localResult._lexiconV2)
    ? (localResult._lexiconV2.hardNegatives || [])
    : [];

  // ── Extract anchor hits from _trazas (MEJORA 6 layer) ────────────────────
  let anchorsActive = [];
  if (localResult && Array.isArray(localResult._trazas)) {
    anchorsActive = localResult._trazas
      .filter(t => t.capa === 'ANCHOR' || t.capa === 'MEJORA6')
      // ANCHOR trazas use termino as the category name (no separate categoria field)
      .map(t => ({ termino: t.termino, categoria: t.categoria || t.termino, peso: t.peso }));
  }

  return {
    // ── Primary text ────────────────────────────────────────────────────────
    texto_normalizado: textoNorm,

    // ── Local engine signals ─────────────────────────────────────────────────
    local_categoria:   localResult ? (localResult.categoria || null) : null,
    local_confianza:   localResult ? (localResult.confianza  || null) : null,
    local_revisa:      localResult ? Boolean(localResult._revisarManualmente) : null,

    // ── Top category candidates with scores ──────────────────────────────────
    top_candidates: topCandidates,

    // ── Lexicon V2 semantic concepts ─────────────────────────────────────────
    lexicon_concepts: lexiconConcepts,

    // ── Hard-negative concepts active ────────────────────────────────────────
    hard_negatives: hardNegatives,

    // ── MEJORA 6 anchor overrides ─────────────────────────────────────────────
    anchors_active: anchorsActive,
  };
}

// ── System prompt ─────────────────────────────────────────────────────────────
/**
 * Build the system prompt. Static — does not vary per request.
 * Separated here so it can be unit-tested and versioned independently.
 */
function _buildSystemPrompt() {
  return `Sos un experto en Gestión de Seguridad Operacional (SMS) aeronáutico, especializado en la taxonomía ICAO Anexo 19, EVAIR (EUROCONTROL) y el sistema de clasificación SafetyOps de la ANAC Argentina.

Tu rol es asistir a un motor de clasificación local que ya procesó el reporte con técnicas determinísticas (keywords, Naive Bayes, Lexicon semántico). Recibirás el texto del reporte MÁS las señales que el motor local ya extrajo. Tu tarea es evaluar si la clasificación local es correcta, proporcionar tu propia clasificación independiente, y detectar casos ambiguos.

REGLAS CRÍTICAS DE SEGURIDAD (NO negociables):
1. Si el texto contiene arma, pistola, cuchillo u objeto amenazante → categoria SIEMPRE "Interferencia Ilícita" o "Seguridad Aeroportuaria". NUNCA "Falla Técnica" ni "Incendio".
2. Si el texto contiene fuego, incendio, humo a bordo, smoke → "Incendio" o "Smoke / Humo a Bordo". NUNCA "Falla Técnica" a menos que sea la falla que causó el fuego.
3. Si el motor local activó un anchor con peso ≥ 3.5 → respetalo salvo evidencia textual clara en contrario.
4. Si el texto contiene negaciones explícitas (no hubo, sin, no se detectó) → NO clasificar por el concepto negado.
5. Si el texto contiene hipotéticos (si hubiera, en caso de, podría) → requiere_revision: true.

TAXONOMÍA (exactamente estas 29 categorías — no uses otras):
TCAS RA | Bird Strike | Runway Excursion | Unstable Approach | Hard Landing | GPWS | Turbulencia | Meteorología Adversa | Mercancías Peligrosas | Incidencia ATC | Incendio | Estela Turbulenta | Iluminación Láser | Fatiga de Tripulación | Error de Navegación | Ground Damage | Incursión de Pista | Factores Humanos | Falla Técnica | Seguridad Aeroportuaria | Interferencia Ilícita | Demora Operacional | CFIT | Emergencia Médica | Smoke / Humo a Bordo | Pérdida de Control | Presurización | Fuel / Combustible | FOD

Responde ÚNICAMENTE con el JSON estructurado. Sin texto adicional.`;
}

// ── User prompt ───────────────────────────────────────────────────────────────
/**
 * Build the per-request user prompt from a structured context object.
 * @param {Object} ctx - Output of buildStructuredContext()
 * @returns {string}
 */
function _buildUserPrompt(ctx) {
  const parts = [];

  parts.push(`TEXTO DEL REPORTE:\n"${ctx.texto_normalizado}"`);

  if (ctx.local_categoria) {
    parts.push(
      `\nMOTOR LOCAL:\n` +
      `  Categoría sugerida: ${ctx.local_categoria}\n` +
      `  Confianza: ${ctx.local_confianza !== null ? (ctx.local_confianza * 100).toFixed(0) + '%' : 'N/A'}\n` +
      `  Requiere revisión: ${ctx.local_revisa ? 'SÍ' : 'NO'}`
    );
  }

  if (ctx.top_candidates.length > 0) {
    const cands = ctx.top_candidates
      .map(c => `  ${c.categoria}: ${c.score}`)
      .join('\n');
    parts.push(`\nCANDIDATOS POR SCORE:\n${cands}`);
  }

  if (ctx.anchors_active.length > 0) {
    const anchors = ctx.anchors_active
      .map(a => `  ${a.termino} → ${a.categoria} (peso=${a.peso})`)
      .join('\n');
    parts.push(`\nANCHORS ACTIVOS (alta confianza):\n${anchors}`);
  }

  if (ctx.lexicon_concepts.length > 0) {
    const concepts = ctx.lexicon_concepts
      .map(c => `  ${c.id} (${c.type}, score=${c.score}${c.negated ? ', NEGADO' : ''}${c.hypothetical ? ', HIPOTÉTICO' : ''})`)
      .join('\n');
    parts.push(`\nCONCEPTOS LEXICON V2 ACTIVOS:\n${concepts}`);
  }

  if (ctx.hard_negatives.length > 0) {
    parts.push(`\nCONCEPTOS HARD-NEGATIVE ACTIVOS: ${ctx.hard_negatives.join(', ')}`);
  }

  parts.push('\nClasificá este reporte y respondé con el JSON estructurado.');

  return parts.join('\n');
}

// ── openaiClassify ─────────────────────────────────────────────────────────────
/**
 * Call OpenAI API with a structured context and return the classification result.
 * Returns null on any failure — never throws, never crashes the calling context.
 *
 * @param {Object} structuredContext - Output of buildStructuredContext()
 * @returns {Promise<Object|null>}   Parsed OpenAI result, or null on failure
 */
async function openaiClassify(structuredContext) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = getModel();

  const requestBody = {
    model,
    messages: [
      { role: 'system', content: _buildSystemPrompt() },
      { role: 'user',   content: _buildUserPrompt(structuredContext) },
    ],
    max_tokens:      400,
    temperature:     0.1,
    response_format: OPENAI_OUTPUT_SCHEMA,
  };

  const body = JSON.stringify(requestBody);

  // Up to 2 attempts — retry only on JSON extraction/parse failures,
  // not on timeout or API-level errors (same policy as groqClassify).
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const _t0 = Date.now();

      const result = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.openai.com',
          path:     '/v1/chat/completions',
          method:   'POST',
          headers: {
            'Authorization':  'Bearer ' + apiKey,
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error('OpenAI parse error: ' + data.slice(0, 200))); }
          });
        });

        req.on('error', reject);

        // Hard 10s timeout — OpenAI latency is typically 400–1200ms for gpt-4o-mini
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('OpenAI timeout (10s)'));
        });

        req.write(body);
        req.end();
      });

      const latencyMs = Date.now() - _t0;

      // API-level error (rate limit, model not found, quota exceeded, etc.)
      if (result && result.error) {
        throw new Error('OpenAI API error: ' + (result.error.message || JSON.stringify(result.error)));
      }

      const content = result?.choices?.[0]?.message?.content || '';
      if (!content) {
        throw new Error('OpenAI empty content in response');
      }

      // With Structured Outputs (strict:true), content IS the JSON — no regex needed.
      const parsed = JSON.parse(content);

      // Validate against schema before returning
      const { valid, errors } = validateOpenAIResponse(parsed);
      if (!valid) {
        throw new Error('OpenAI schema validation failed: ' + errors.join('; '));
      }

      // Observability fields — internal only, never forwarded to frontend
      parsed._openai_model      = model;
      parsed._openai_latency_ms = latencyMs;
      parsed._openai_attempt    = attempt;
      parsed._openai_shadow     = isShadowMode();

      console.log('[openai] model=' + model +
        ' shadow=' + isShadowMode() +
        ' attempt=' + attempt +
        ' latency=' + latencyMs + 'ms' +
        ' categoria=' + parsed.categoria +
        ' confianza=' + (parsed.confianza_openai * 100).toFixed(0) + '%' +
        ' revisa=' + parsed.requiere_revision +
        ' flags=' + (parsed.flags_seguridad.join(',') || '—'));

      return parsed;

    } catch (err) {
      // Only retry on JSON parse/extraction failures — not timeout or API errors
      const isRetryable =
        !err.message.includes('timeout') &&
        !err.message.includes('OpenAI API error') &&
        (err.message.includes('JSON') || err.message.includes('parse') || err.message.includes('schema'));

      if (attempt === 1 && isRetryable) {
        console.warn('[openai] attempt=1 retryable error — retrying: ' + err.message);
        continue;
      }

      console.warn('[openai] Error (attempt=' + attempt + ') — shadow classification skipped:', err.message);
      return null;
    }
  }
  return null;
}

// ── Module exports ─────────────────────────────────────────────────────────────
module.exports = {
  // Feature flag readers
  isOpenAIEnabled,
  isShadowMode,
  getModel,

  // Context builder (local engine output → OpenAI input)
  buildStructuredContext,

  // HTTP client
  openaiClassify,

  // Prompt builders (exported for unit testing)
  _buildSystemPrompt,
  _buildUserPrompt,
};
