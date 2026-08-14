'use strict';
/**
 * GEMINI-SCHEMA.JS — SafetyOps Gemini Response Schema
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines the JSON Schema used in Gemini's generationConfig.responseSchema.
 * Gemini requires UPPERCASE type names (STRING, NUMBER, BOOLEAN, ARRAY, OBJECT)
 * unlike OpenAI which uses lowercase.
 *
 * Categories are the EXACT 29 taxonomy names from analysis-engine/keywords.js.
 * DO NOT add, remove, or rename categories here without updating keywords.js.
 *
 * Safety flags are derived from Lexicon V2 concept IDs (lexicon-v2.js).
 * DO NOT modify without cross-checking HARD_NEGATIVE_IDS in classifier-v2.js.
 *
 * USAGE:
 *   const { GEMINI_RESPONSE_SCHEMA, SAFETYOPS_CATEGORIES } = require('./gemini-schema');
 *   generationConfig.responseSchema = GEMINI_RESPONSE_SCHEMA;
 *   generationConfig.responseMimeType = 'application/json';
 *
 * VALIDATION:
 *   const { validateAIResponse } = require('./gemini-schema');
 *   const { valid, errors } = validateAIResponse(parsed);
 */

// ── 29 SafetyOps categories — exact strings from analysis-engine/keywords.js ──
// Order matches KW dict insertion order (preserved in V8 since Node 12).
const SAFETYOPS_CATEGORIES = [
  'TCAS RA',
  'Bird Strike',
  'Runway Excursion',
  'Unstable Approach',
  'Hard Landing',
  'GPWS',
  'Turbulencia',
  'Meteorología Adversa',
  'Mercancías Peligrosas',
  'Incidencia ATC',
  'Incendio',
  'Estela Turbulenta',
  'Iluminación Láser',
  'Fatiga de Tripulación',
  'Error de Navegación',
  'Ground Damage',
  'Incursión de Pista',
  'Factores Humanos',
  'Falla Técnica',
  'Seguridad Aeroportuaria',
  'Interferencia Ilícita',
  'Demora Operacional',
  'CFIT',
  'Emergencia Médica',
  'Smoke / Humo a Bordo',
  'Pérdida de Control',
  'Presurización',
  'Fuel / Combustible',
  'FOD',
];

// ── Safety flags — subset of Lexicon V2 concept IDs that require escalation ──
// Source: HARD_NEGATIVE_IDS + SAFETY_CRITICAL_CONCEPTS in classifier-v2.js
// + FIREARM (priority 100, weight 5.0) from lexicon-v2.js
const SAFETY_FLAG_IDS = [
  'FIREARM',               // Priority 100 — overrides all other categories
  'FIRE',                  // Safety-critical — hypothetical check applies
  'SMOKE',                 // Safety-critical — negation cross-suppression
  'ENGINE_FAILURE',        // Safety-critical — hypothetical check applies
  'FUEL_EMERGENCY',        // Negation suppressor for Falla Técnica
  'DANGEROUS_GOODS',       // Mercancías Peligrosas signal
  'DEPRESSURIZATION',      // Presurización signal
  'UNLAWFUL_INTERFERENCE', // Interferencia Ilícita — high priority
];

// ── Allowed output fields — the COMPLETE contract for Gemini responses ─────────
// validateAIResponse() rejects any key not in this set.
// Observability fields (_gemini_model, etc.) are added by gemini-client.js AFTER
// validation runs, so they never appear in the parsed object at validation time.
const ALLOWED_OUTPUT_FIELDS = new Set([
  'categoria',
  'confianza',
  'justificacion',
  'categorias_alternativas',
  'flags_seguridad',
  'requiere_revision',
]);

// ── Gemini response schema ─────────────────────────────────────────────────────
// Gemini uses UPPERCASE type names. The `enum` field constrains string values.
// Field name: `confianza` (NOT `confianza_openai` — this is a Gemini-native schema).
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {

    // Primary classification — must be one of the 29 taxonomy names
    categoria: {
      type:        'STRING',
      enum:        SAFETYOPS_CATEGORIES,
      description: 'Categoría principal del reporte según taxonomía ICAO/SMS SafetyOps (29 categorías).',
    },

    // Model confidence — independent of local engine confidence
    confianza: {
      type:        'NUMBER',
      description: 'Confianza del modelo en la clasificación (0.0–1.0). ' +
                   'Basada en la claridad del texto y la evidencia conceptual disponible.',
    },

    // Short Spanish justification sentence (max 120 chars)
    justificacion: {
      type:        'STRING',
      description: 'Una oración en español que explica por qué se eligió esta categoría ' +
                   'sobre las alternativas. Máximo 120 caracteres.',
    },

    // Up to 3 alternative categories with relative scores
    categorias_alternativas: {
      type:  'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          categoria: { type: 'STRING', enum: SAFETYOPS_CATEGORIES },
          peso:      { type: 'NUMBER', description: 'Score relativo (0–1)' },
        },
        required: ['categoria', 'peso'],
      },
      description: 'Hasta 3 categorías alternativas ordenadas por peso descendente. ' +
                   'Array vacío si la clasificación es unívoca.',
    },

    // Active Lexicon V2 safety signals detected in the text
    flags_seguridad: {
      type:  'ARRAY',
      items: { type: 'STRING', enum: SAFETY_FLAG_IDS },
      description: 'Conceptos de seguridad detectados en el texto (de Lexicon V2). ' +
                   'Array vacío si no hay señales de seguridad activas.',
    },

    // Whether the model recommends human review
    requiere_revision: {
      type:        'BOOLEAN',
      description: 'true si el modelo considera que el reporte requiere revisión manual ' +
                   '(ambigüedad alta, múltiples categorías competidoras, negaciones, hipotéticos).',
    },

  },
  required: [
    'categoria',
    'confianza',
    'justificacion',
    'categorias_alternativas',
    'flags_seguridad',
    'requiere_revision',
  ],
};

// ── Validation helper ──────────────────────────────────────────────────────────
/**
 * Validate a parsed Gemini response against the SafetyOps output contract.
 * Does NOT call any API — purely structural validation.
 * Run AFTER JSON.parse(), BEFORE using any field from the response.
 *
 * Gemini Structured Output is the first barrier; this is the second.
 * Never trust a response solely because Gemini produced it via responseSchema.
 *
 * Checks (15 total):
 *  1.  parsed is a non-null, non-array object
 *  2.  no unknown properties (only ALLOWED_OUTPUT_FIELDS permitted)
 *  3.  categoria is present
 *  4.  categoria is one of the 29 taxonomy names
 *  5.  confianza is present
 *  6.  confianza is a finite number (rejects NaN, Infinity, -Infinity)
 *  7.  confianza is in range 0–1 inclusive
 *  8.  justificacion is present
 *  9.  justificacion is a non-empty string
 *  10. categorias_alternativas is an array
 *  11. each categorias_alternativas[i].categoria is a valid taxonomy name
 *  12. each categorias_alternativas[i].peso is a finite number
 *  13. flags_seguridad is an array
 *  14. each flags_seguridad[i] is a valid SAFETY_FLAG_ID
 *  15. requiere_revision is a boolean
 *
 * @param {*}      parsed - Value from JSON.parse() of Gemini response content
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAIResponse(parsed) {
  const errors = [];

  // Check 1 — base type (rejects null, arrays, primitives)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Response must be a non-null, non-array object'] };
  }

  // Check 2 — no unknown properties
  const unknownKeys = Object.keys(parsed).filter(k => !ALLOWED_OUTPUT_FIELDS.has(k));
  if (unknownKeys.length > 0) {
    errors.push(`Unknown properties not allowed: [${unknownKeys.map(k => '"' + k + '"').join(', ')}]`);
  }

  // Check 3-4 — categoria
  if (parsed.categoria === undefined || parsed.categoria === null) {
    errors.push('categoria is missing.');
  } else if (!SAFETYOPS_CATEGORIES.includes(parsed.categoria)) {
    errors.push(`Invalid categoria: "${parsed.categoria}". Must be one of the 29 taxonomy names.`);
  }

  // Check 5-7 — confianza
  // Number.isFinite() returns false for NaN, Infinity, -Infinity, and non-numbers.
  // The < 0 || > 1 range check is then safe because isFinite already excluded NaN/Infinity.
  if (parsed.confianza === undefined || parsed.confianza === null) {
    errors.push('confianza is missing.');
  } else if (!Number.isFinite(parsed.confianza)) {
    errors.push(`confianza must be a finite number, got: ${parsed.confianza} (type: ${typeof parsed.confianza})`);
  } else if (parsed.confianza < 0 || parsed.confianza > 1) {
    errors.push(`confianza out of range: ${parsed.confianza}. Must be 0–1 inclusive.`);
  }

  // Check 8-9 — justificacion
  if (parsed.justificacion === undefined || parsed.justificacion === null) {
    errors.push('justificacion is missing.');
  } else if (typeof parsed.justificacion !== 'string' || parsed.justificacion.trim().length === 0) {
    errors.push('justificacion must be a non-empty string.');
  }

  // Check 10-12 — categorias_alternativas
  if (!Array.isArray(parsed.categorias_alternativas)) {
    errors.push('categorias_alternativas must be an array.');
  } else {
    parsed.categorias_alternativas.forEach((alt, i) => {
      if (!SAFETYOPS_CATEGORIES.includes(alt.categoria)) {
        errors.push(`categorias_alternativas[${i}].categoria invalid: "${alt.categoria}"`);
      }
      if (!Number.isFinite(alt.peso)) {
        errors.push(`categorias_alternativas[${i}].peso must be a finite number, got: ${alt.peso}`);
      }
    });
  }

  // Check 13-14 — flags_seguridad
  if (!Array.isArray(parsed.flags_seguridad)) {
    errors.push('flags_seguridad must be an array.');
  } else {
    parsed.flags_seguridad.forEach((flag, i) => {
      if (!SAFETY_FLAG_IDS.includes(flag)) {
        errors.push(`flags_seguridad[${i}] invalid: "${flag}". Must be one of SAFETY_FLAG_IDS.`);
      }
    });
  }

  // Check 15 — requiere_revision
  if (typeof parsed.requiere_revision !== 'boolean') {
    errors.push(`requiere_revision must be boolean, got: ${typeof parsed.requiere_revision}`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  SAFETYOPS_CATEGORIES,
  SAFETY_FLAG_IDS,
  ALLOWED_OUTPUT_FIELDS,
  GEMINI_RESPONSE_SCHEMA,
  validateAIResponse,
};
