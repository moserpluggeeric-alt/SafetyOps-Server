'use strict';
/**
 * OPENAI-SCHEMA.JS — SafetyOps OpenAI Structured Output Schema
 * ─────────────────────────────────────────────────────────────────────────────
 * Defines the JSON Schema used as `response_format` for OpenAI chat completions.
 * Compatible with OpenAI Structured Outputs (strict:true).
 *
 * Categories are the EXACT 29 taxonomy names from analysis-engine/keywords.js.
 * DO NOT add, remove, or rename categories here without updating keywords.js.
 *
 * Safety flags are derived from Lexicon V2 concept IDs (lexicon-v2.js).
 * DO NOT modify without cross-checking HARD_NEGATIVE_IDS in classifier-v2.js.
 *
 * USAGE:
 *   const { OPENAI_OUTPUT_SCHEMA, SAFETYOPS_CATEGORIES } = require('./openai-schema');
 *   requestBody.response_format = OPENAI_OUTPUT_SCHEMA;
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
  'FIREARM',           // Priority 100 — overrides all other categories
  'FIRE',              // Safety-critical — hypothetical check applies
  'SMOKE',             // Safety-critical — negation cross-suppression
  'ENGINE_FAILURE',    // Safety-critical — hypothetical check applies
  'FUEL_EMERGENCY',    // Negation suppressor for Falla Técnica
  'DANGEROUS_GOODS',   // Mercancías Peligrosas signal
  'DEPRESSURIZATION',  // Presurización signal
  'UNLAWFUL_INTERFERENCE', // Interferencia Ilícita — high priority
];

// ── Alternative category object schema (inline — strict mode needs no $ref) ──
const ALTERNATIVE_CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    categoria: { type: 'string', enum: SAFETYOPS_CATEGORIES },
    peso:      { type: 'number', description: 'Score relativo (0–1)' },
  },
  required:             ['categoria', 'peso'],
  additionalProperties: false,
};

// ── Main JSON Schema — used as response_format.json_schema.schema ─────────────
const OPENAI_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {

    // Primary classification — must be one of the 29 taxonomy names
    categoria: {
      type:        'string',
      enum:        SAFETYOPS_CATEGORIES,
      description: 'Categoría principal del reporte según taxonomía ICAO/SMS SafetyOps (29 categorías).',
    },

    // OpenAI's own confidence — independent of local engine confidence
    confianza_openai: {
      type:        'number',
      description: 'Confianza de OpenAI en la clasificación (0.0–1.0). ' +
                   'Basada en la claridad del texto y la evidencia conceptual disponible.',
    },

    // Short Spanish justification sentence
    justificacion: {
      type:        'string',
      description: 'Una oración en español que explica por qué se eligió esta categoría ' +
                   'sobre las alternativas. Máximo 120 caracteres.',
    },

    // Up to 3 alternatives with relative scores
    categorias_alternativas: {
      type:  'array',
      items: ALTERNATIVE_CATEGORY_SCHEMA,
      description: 'Hasta 3 categorías alternativas ordenadas por peso descendente. ' +
                   'Array vacío si la clasificación es unívoca.',
    },

    // Active Lexicon V2 safety signals detected in the text
    flags_seguridad: {
      type:  'array',
      items: { type: 'string', enum: SAFETY_FLAG_IDS },
      description: 'Conceptos de seguridad detectados en el texto (de Lexicon V2). ' +
                   'Array vacío si no hay señales de seguridad activas.',
    },

    // Whether OpenAI recommends human review (independent of local engine flag)
    requiere_revision: {
      type:        'boolean',
      description: 'true si OpenAI considera que el reporte requiere revisión manual ' +
                   '(ambigüedad alta, múltiples categorías competidoras, negaciones, hipotéticos).',
    },

  },
  required: [
    'categoria',
    'confianza_openai',
    'justificacion',
    'categorias_alternativas',
    'flags_seguridad',
    'requiere_revision',
  ],
  additionalProperties: false,
};

// ── response_format object — passed directly to OpenAI API requestBody ────────
const OPENAI_OUTPUT_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name:   'safetyops_classification_v2',
    strict: true,
    schema: OPENAI_RESPONSE_SCHEMA,
  },
};

// ── Validation helper — check an OpenAI response object against this schema ──
/**
 * Validate a parsed OpenAI response against OPENAI_RESPONSE_SCHEMA.
 * Does NOT call the API — purely structural validation.
 *
 * @param {Object} parsed - Parsed JSON from OpenAI response content
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateOpenAIResponse(parsed) {
  const errors = [];

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Response is not an object'] };
  }

  // categoria
  if (!SAFETYOPS_CATEGORIES.includes(parsed.categoria)) {
    errors.push(`Invalid categoria: "${parsed.categoria}". Must be one of 29 taxonomy names.`);
  }

  // confianza_openai
  if (typeof parsed.confianza_openai !== 'number' ||
      parsed.confianza_openai < 0 || parsed.confianza_openai > 1) {
    errors.push(`Invalid confianza_openai: "${parsed.confianza_openai}". Must be number 0–1.`);
  }

  // justificacion
  if (typeof parsed.justificacion !== 'string' || parsed.justificacion.trim().length === 0) {
    errors.push('justificacion must be a non-empty string.');
  }

  // categorias_alternativas
  if (!Array.isArray(parsed.categorias_alternativas)) {
    errors.push('categorias_alternativas must be an array.');
  } else {
    parsed.categorias_alternativas.forEach((alt, i) => {
      if (!SAFETYOPS_CATEGORIES.includes(alt.categoria)) {
        errors.push(`categorias_alternativas[${i}].categoria invalid: "${alt.categoria}"`);
      }
      if (typeof alt.peso !== 'number') {
        errors.push(`categorias_alternativas[${i}].peso must be a number`);
      }
    });
  }

  // flags_seguridad
  if (!Array.isArray(parsed.flags_seguridad)) {
    errors.push('flags_seguridad must be an array.');
  } else {
    parsed.flags_seguridad.forEach((flag, i) => {
      if (!SAFETY_FLAG_IDS.includes(flag)) {
        errors.push(`flags_seguridad[${i}] invalid: "${flag}". Must be one of SAFETY_FLAG_IDS.`);
      }
    });
  }

  // requiere_revision
  if (typeof parsed.requiere_revision !== 'boolean') {
    errors.push(`requiere_revision must be boolean, got: ${typeof parsed.requiere_revision}`);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  SAFETYOPS_CATEGORIES,
  SAFETY_FLAG_IDS,
  OPENAI_OUTPUT_SCHEMA,
  OPENAI_RESPONSE_SCHEMA,
  validateOpenAIResponse,
};
