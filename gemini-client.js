'use strict';
/**
 * GEMINI-CLIENT.JS — SafetyOps Gemini Isolated HTTP Client
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides server-side Gemini classification as a shadow layer over the local
 * classification engine. Designed to be ADDITIVE ONLY — never modifies the
 * local engine result, never exposes credentials to the frontend.
 *
 * ARCHITECTURE:
 *   Local engine (classifier-v2.js)
 *       ↓
 *   buildStructuredContext()   [from ai-context.js]
 *       ↓
 *   geminiClassify()
 *       ↓
 *   shadow result (logged only — does NOT affect production output)
 *
 * FEATURE FLAGS (Railway environment variables):
 *   GEMINI_API_KEY       — required; if absent, all functions return null safely
 *   GEMINI_MODEL         — default: 'gemini-2.0-flash'
 *   GEMINI_ENABLED       — 'true' | 'false' (default: 'false')
 *   GEMINI_SHADOW_MODE   — 'true' | 'false' (default: 'true')
 *                          When true: Gemini runs but result does NOT affect production output
 *
 * DESIGN CONSTRAINTS:
 *   - NO business logic — does not decide which category wins
 *   - NO local engine modification — returns a separate result object
 *   - NO API key in code — exclusively from process.env
 *   - NO frontend exposure — module is server-only
 *   - Auth: x-goog-api-key header (NOT URL parameter)
 *   - Timeout: 4 000 ms (AbortController)
 *   - Retry: up to 2 attempts, only on JSON extraction/parse failures
 *   - Structured output: responseMimeType='application/json' + responseSchema
 *
 * USAGE (shadow mode, fire-and-forget from handleSyncReport):
 *   const { geminiClassify, isGeminiEnabled } = require('./gemini-client');
 *   const { buildStructuredContext }           = require('./ai-context');
 *   if (isGeminiEnabled()) {
 *     const ctx = buildStructuredContext(localResult, texto);
 *     Promise.resolve().then(() => geminiClassify(ctx))   // non-blocking
 *       .then(r => shadowComparator.record(localResult, r, texto))
 *       .catch(err => console.warn('[gemini] shadow error:', err.message));
 *   }
 */

const https = require('https');
const { GEMINI_RESPONSE_SCHEMA, validateAIResponse } = require('./gemini-schema');
const { buildStructuredContext } = require('./ai-context');

// ── Feature flag readers ───────────────────────────────────────────────────────
// Read at call time (not at module load) so Railway hot-changes take effect.

/** Returns true only when GEMINI_ENABLED=true AND GEMINI_API_KEY is set. */
function isGeminiEnabled() {
  return process.env.GEMINI_ENABLED === 'true' && Boolean(process.env.GEMINI_API_KEY);
}

/** Returns true when GEMINI_SHADOW_MODE=true (or unset — default is shadow). */
function isShadowMode() {
  return process.env.GEMINI_SHADOW_MODE !== 'false'; // default: true
}

/** Returns the configured model, falling back to gemini-2.0-flash. */
function getModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash';
}

// ── System prompt ─────────────────────────────────────────────────────────────
/**
 * Build the system prompt. Static — does not vary per request.
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

Respondé ÚNICAMENTE con el JSON estructurado. Sin texto adicional.`;
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

  // Motor local signals — use new field names from ai-context.js
  const sig = ctx.context_signals;
  if (sig) {
    const catLabel  = sig.local_categoria || (sig.noClasificable ? '(sin categoría — texto sin vocabulario aeronáutico)' : 'N/A');
    const confLabel = ctx.local_confidence !== null ? (ctx.local_confidence * 100).toFixed(0) + '%' : 'N/A';
    const revLabel  = sig.revisarManualmente ? 'SÍ' : 'NO';
    parts.push(
      `\nMOTOR LOCAL:\n` +
      `  Categoría sugerida: ${catLabel}\n` +
      `  NB top-1:           ${ctx.nb_winner || 'N/A'}\n` +
      `  Confianza:          ${confLabel}\n` +
      `  Requiere revisión:  ${revLabel}` +
      (sig.tiebreaker     ? '\n  ⚠ Empate cercano entre top-1 y top-2' : '') +
      (sig.noClasificable ? '\n  ⚠ _noClasificable=true (ratio<0.18 — vocabulario insuficiente)' : '') +
      (sig.topCapas       ? `\n  Capas activas: ${sig.topCapas}` : '') +
      (sig.adrep          ? `\n  ADREP: ${sig.adrep}` : '')
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

// ── geminiClassify ─────────────────────────────────────────────────────────────
/**
 * Call Gemini API with a structured context and return the classification result.
 * Returns null on any failure — never throws, never crashes the calling context.
 *
 * Auth: x-goog-api-key header (NOT a URL parameter).
 * Timeout: 4 000 ms via AbortController.
 *
 * @param {Object} structuredContext - Output of buildStructuredContext()
 * @returns {Promise<Object|null>}   Parsed Gemini result, or null on failure
 */
async function geminiClassify(structuredContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = getModel();

  // Gemini endpoint — model in path, no key in URL
  const path = `/v1beta/models/${model}:generateContent`;

  const requestBody = {
    system_instruction: {
      parts: [{ text: _buildSystemPrompt() }],
    },
    contents: [
      {
        role:  'user',
        parts: [{ text: _buildUserPrompt(structuredContext) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema:   GEMINI_RESPONSE_SCHEMA,
      temperature:      0.1,
      maxOutputTokens:  400,
    },
  };

  const body = JSON.stringify(requestBody);

  // Up to 2 attempts — retry on transient failures: timeout, HTTP 503/UNAVAILABLE,
  // and JSON extraction/parse/schema errors. Terminal errors (quota, auth, model
  // not found, finishReason) fail immediately. A short backoff separates attempts.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const _t0 = Date.now();

      const result = await new Promise((resolve, reject) => {
        // [DIAG] Reference timestamp for all diagnostic logs in this request
        const _tPromise     = Date.now();
        let   _bytesReceived  = 0;
        let   _headersReceived = false;

        const controller = new AbortController();
        const timeoutId  = setTimeout(() => {
          console.warn('[gemini-diag] TIMEOUT fired at T+' + (Date.now() - _tPromise) + 'ms' +
            ' — bytes_received=' + _bytesReceived +
            ' headers_received=' + _headersReceived);
          controller.abort();
          reject(new Error('Gemini timeout (15s)'));
        }, 15000);

        const req = https.request({
          hostname: 'generativelanguage.googleapis.com',
          path,
          method:  'POST',
          headers: {
            'x-goog-api-key': apiKey,       // Auth: header, not URL param
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          signal: controller.signal,
        }, (res) => {
          _headersReceived = true;
          console.warn('[gemini-diag] HEADERS at T+' + (Date.now() - _tPromise) + 'ms' +
            ' — HTTP ' + res.statusCode);
          let data = '';
          res.on('data', chunk => {
            _bytesReceived += chunk.length;
            console.warn('[gemini-diag] CHUNK at T+' + (Date.now() - _tPromise) + 'ms' +
              ' — bytes_this=' + chunk.length + ' total=' + _bytesReceived);
            data += chunk;
          });
          res.on('end', () => {
            console.warn('[gemini-diag] END at T+' + (Date.now() - _tPromise) + 'ms' +
              ' — total_bytes=' + _bytesReceived);
            clearTimeout(timeoutId);
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error('Gemini parse error: ' + data.slice(0, 200))); }
          });
        });

        req.on('error', (err) => {
          clearTimeout(timeoutId);
          if (err.name === 'AbortError') {
            console.warn('[gemini-diag] ABORT at T+' + (Date.now() - _tPromise) + 'ms' +
              ' — bytes_received=' + _bytesReceived);
            reject(new Error('Gemini timeout (15s)'));
          } else {
            reject(err);
          }
        });

        req.write(body);
        console.warn('[gemini-diag] REQUEST_SENT at T+' + (Date.now() - _tPromise) + 'ms' +
          ' — body_bytes=' + body.length);
        req.end();
      });

      const latencyMs = Date.now() - _t0;

      // API-level error — distinguish transient (503/UNAVAILABLE) from terminal.
      if (result && result.error) {
        const errCode   = result.error.code;
        const errStatus = result.error.status || '';
        if (errCode === 503 || errStatus === 'UNAVAILABLE') {
          throw new Error('Gemini transient error (503/UNAVAILABLE): ' +
            (result.error.message || JSON.stringify(result.error)));
        }
        // Terminal: quota, invalid key, model not found, etc. — do not retry.
        throw new Error('Gemini API error: ' + (result.error.message || JSON.stringify(result.error)));
      }

      // Extract content from Gemini response shape:
      // { candidates: [{ content: { parts: [{ text: "..." }] } }] }
      const content = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!content) {
        // Safety / finish reason check
        const finishReason = result?.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          throw new Error(`Gemini non-STOP finishReason: ${finishReason}`);
        }
        throw new Error('Gemini empty content in response');
      }

      // With responseMimeType='application/json', content IS the JSON string
      const parsed = JSON.parse(content);

      // Validate against schema before returning
      const { valid, errors } = validateAIResponse(parsed);
      if (!valid) {
        throw new Error('Gemini schema validation failed: ' + errors.join('; '));
      }

      // Observability — logged only. NOT added to parsed so validateAIResponse
      // remains callable on the returned object without seeing unknown fields.
      console.log('[gemini] model=' + model +
        ' shadow=' + isShadowMode() +
        ' attempt=' + attempt +
        ' latency=' + latencyMs + 'ms' +
        ' categoria=' + parsed.categoria +
        ' confianza=' + (parsed.confianza * 100).toFixed(0) + '%' +
        ' revisa=' + parsed.requiere_revision +
        ' flags=' + (parsed.flags_seguridad.join(',') || '—'));

      return parsed;

    } catch (err) {
      // Retryable: timeout, 503/UNAVAILABLE, JSON parse/extraction/schema failures.
      // Terminal (no retry): quota, auth, model-not-found, non-STOP finishReason.
      const isRetryable =
        !err.message.includes('Gemini API error') &&   // terminal API errors
        !err.message.includes('finishReason') &&        // safety block / non-STOP
        (
          err.message.includes('timeout') ||
          err.message.includes('transient error') ||
          err.message.includes('JSON') ||
          err.message.includes('parse') ||
          err.message.includes('schema')
        );

      if (attempt === 1 && isRetryable) {
        // Short backoff: 500 ms after timeout (already waited 15 s), 1000 ms for 503.
        const backoffMs = err.message.includes('timeout') ? 500 : 1000;
        console.warn('[gemini] attempt=1 retryable — backoff ' + backoffMs + 'ms — ' + err.message);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      console.warn('[gemini] Error (attempt=' + attempt + ') — shadow classification skipped:', err.message);
      return null;
    }
  }
  return null;
}

// ── Module exports ─────────────────────────────────────────────────────────────
module.exports = {
  // Feature flag readers
  isGeminiEnabled,
  isShadowMode,
  getModel,

  // Context builder re-exported for convenience (canonical source: ai-context.js)
  buildStructuredContext,

  // HTTP client
  geminiClassify,

  // Prompt builders (exported for unit testing)
  _buildSystemPrompt,
  _buildUserPrompt,
};
