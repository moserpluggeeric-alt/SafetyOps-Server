'use strict';
// ── SafetyOps Analysis Engine — index.js ──────────────────────────────────────
// Orquestador principal. Equivalente exacto de _handleApiReport() en SafetyOps_v2.html
// con dos diferencias de interfaz (no de algoritmo):
//   1. lang    → parámetro en lugar de variable global _lang
//   2. nextId  → parámetro en lugar de leer S.ocurrencias
// El resultado es byte-a-byte idéntico al de _handleApiReport() para los mismos inputs.
//
// LEXICON V2: Este módulo usa clasificarV2 (que incluye el feature flag USE_LEXICON_V2).
//   USE_LEXICON_V2=false (o ausente) → clasificarV2 es passthrough exacto a clasificar (V1).
//   USE_LEXICON_V2=true              → clasificarV2 activa el pipeline Lexicon 2.0.
//   El clasificador V1 (classifier.js) no es modificado. Rollback = eliminar la variable.

const { clasificarV2: clasificar }            = require('./classifier-v2');  // Edit B — Phase 2 activation prep
const { scoreKW, SEV_KW, PROB_KW,
        CAT_ARMS_DEFAULT }                    = require('./score');
const { nerExtract }                          = require('./ner');
const { MATRIZ }                              = require('./matrix');
const { HAZARDS_MAP }                         = require('./hazards');

/**
 * Analiza un reporte de seguridad operacional.
 *
 * @param {object} payload
 * @param {string}  payload.texto      - Texto del reporte (ya trimmeado)
 * @param {string}  payload.area       - Área operacional
 * @param {string}  [payload.identidad='anonimo']
 * @param {string}  [payload.lang='es']     - 'es' | 'en'
 * @param {number}  [payload.nextId=1]      - ID del próximo registro (el caller mantiene el contador)
 * @param {string}  [payload.timestamp]     - ISO timestamp del reporte original
 * @param {object}  [payload.geo]           - { lat, lon, acc } opcional
 *
 * @returns {object} Resultado idéntico al schema POST /api/v1/reports
 */
function analyzeReport(payload) {
  const texto     = (payload.texto || '').trim();
  const area      = payload.area      || 'Otro';
  const identidad = payload.identidad || 'anonimo';
  const lang      = payload.lang      || 'es';
  const nextId    = payload.nextId    != null ? payload.nextId : 1;

  // ── Classify ────────────────────────────────────────────────────────────────
  const clf = clasificar(texto, lang);
  const categoria = (clf && clf.categoria) ? clf.categoria : 'Falla Técnica';
  const confianza = clf ? clf.confianza : 0.30;

  // ── ARMS severity + probability ──────────────────────────────────────────────
  const sevKWScore  = scoreKW(texto, SEV_KW);
  const probKWScore = scoreKW(texto, PROB_KW);
  const catDefaults = CAT_ARMS_DEFAULT[categoria] || { sev: 2, prob: 2 };
  const sev  = (sevKWScore  > 1) ? sevKWScore  : catDefaults.sev;
  const prob = (probKWScore > 1) ? probKWScore : catDefaults.prob;
  const nivel_riesgo = MATRIZ[sev + ',' + prob] || 'Medio';

  // ── Hazards ──────────────────────────────────────────────────────────────────
  const hazards = HAZARDS_MAP[categoria] ? HAZARDS_MAP[categoria].slice(0, 3) : [];

  // ── Validation flag ──────────────────────────────────────────────────────────
  const needsVal = confianza < 0.60 || nivel_riesgo === 'Alto' || nivel_riesgo === 'Crítico';

  // ── Folio ────────────────────────────────────────────────────────────────────
  const folioStr = 'OCC-' + (1000 + nextId);

  // ── NER ──────────────────────────────────────────────────────────────────────
  const ner = nerExtract(texto);

  // ── Return (idéntico al schema de _handleApiReport) ──────────────────────────
  return {
    folio:               folioStr,
    categoria:           categoria,
    nivel_riesgo:        nivel_riesgo,
    severidad:           sev,
    probabilidad:        prob,
    hazards:             hazards,
    confianza:           +confianza.toFixed(3),
    requiere_validacion: needsVal,
    recomendaciones:     [],
    timestamp:           payload.timestamp || new Date().toISOString(),
    // Campos extra (no en el schema público, útiles para el servidor)
    _ner:                ner,
    _area:               area,
    _identidad:          identidad,
  };
}

module.exports = { analyzeReport, clasificar, scoreKW, nerExtract, MATRIZ, HAZARDS_MAP };
