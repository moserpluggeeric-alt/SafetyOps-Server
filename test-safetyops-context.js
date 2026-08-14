'use strict';
/**
 * TEST-SAFETYOPS-CONTEXT.JS — Prueba local del pipeline motor + buildStructuredContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifica el pipeline REAL de SafetyOps SIN llamadas externas:
 *   clasificarV2() [motor real] → buildStructuredContext() → validación de 8 campos
 *
 * REGLAS DE ORO:
 *   - Si el motor real NO puede cargarse → process.exit(1). SIN MOCK. SIN FALLBACK.
 *   - Si clasificarV2 no es una función → process.exit(1).
 *   - Si buildStructuredContext falla → process.exit(1).
 *   - Si los 8 campos no están presentes → process.exit(1).
 *   - NO hay datos hardcodeados. NO hay resultados simulados.
 *   - NO llama a Gemini. NO llama a OpenAI. NO llama a ninguna API externa.
 *   - NO usa GEMINI_API_KEY ni OPENAI_API_KEY.
 *   - NO modifica ningún archivo del motor.
 *
 * USO:
 *   node test-safetyops-context.js
 *   (desde ~/Desktop/veridan-main2/safetyops-server/)
 *
 * SALIDA ESPERADA:
 *   [1/5] Loading real SafetyOps engine...    PASS
 *   [2/5] Executing real classifier...         PASS
 *   [3/5] Real analysis result obtained...     PASS
 *   [4/5] Building structured context...       PASS
 *   [5/5] Validating 8-field context...        PASS
 */

// ── Helpers de output ─────────────────────────────────────────────────────────
function pass(label) { console.log(`  ${label}   \x1b[32mPASS\x1b[0m`); }
function fail(label, reason) {
  console.log(`  ${label}   \x1b[31mFAIL\x1b[0m`);
  console.error(`  → ${reason}`);
  process.exit(1);
}
function section(title) {
  console.log('');
  console.log('══════════════════════════════════════════════════════════');
  console.log(' ' + title);
  console.log('══════════════════════════════════════════════════════════');
}
function subsection(title) {
  console.log('');
  console.log('──────────────────────────────────────────────────────────');
  console.log(' ' + title);
  console.log('──────────────────────────────────────────────────────────');
}

// ── Activar USE_LEXICON_V2=false — passthrough V1 (no modifica motor) ────────
process.env.USE_LEXICON_V2 = 'false';

section('SafetyOps — Prueba Local Motor + buildStructuredContext');
console.log(' Sin API externa. Sin mock. Motor real obligatorio.');

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Cargar motor real
// ─────────────────────────────────────────────────────────────────────────────
console.log('');
console.log('[1/5] Loading real SafetyOps engine...');

let clasificarV2;
const ENGINE_PATH = './analysis-engine/classifier-v2';
try {
  const engine = require(ENGINE_PATH);
  if (typeof engine.clasificarV2 !== 'function') {
    fail('[1/5] Loading real SafetyOps engine...',
      `engine.clasificarV2 is not a function — got: ${typeof engine.clasificarV2}`);
  }
  clasificarV2 = engine.clasificarV2;
} catch (err) {
  fail('[1/5] Loading real SafetyOps engine...', `require('${ENGINE_PATH}') threw: ${err.message}`);
}

pass('[1/5] Loading real SafetyOps engine...');
console.log(`  ENGINE_USED  = ${ENGINE_PATH}`);
console.log(`  FUNCTION_USED = clasificarV2`);

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Cargar buildStructuredContext
// ─────────────────────────────────────────────────────────────────────────────
let buildStructuredContext;
const CTX_PATH = './ai-context';
try {
  const m = require(CTX_PATH);
  if (typeof m.buildStructuredContext !== 'function') {
    fail('[load]', `buildStructuredContext is not a function in ${CTX_PATH}`);
  }
  buildStructuredContext = m.buildStructuredContext;
} catch (err) {
  fail('[load]', `require('${CTX_PATH}') threw: ${err.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Casos de prueba — textos reales, sin datos hardcodeados
// ─────────────────────────────────────────────────────────────────────────────
const CASOS = [
  {
    id:    'CASO 1 — Humo en motor (sin clasificar por vocabulario)',
    texto: 'Salía un humo denso del motor número dos durante la carrera de despegue, tuvimos que abortar.',
    nota:  'Se espera _noClasificable=true con el motor V1 (sin vocabulario aeronáutico suficiente)',
  },
  {
    id:    'CASO 2 — Fuego cerca de motor (anchor Incendio)',
    texto: 'Un pasajero informó que vio fuego cerca de un motor.',
    nota:  'Se espera anchor "Incendio" activo',
  },
  {
    id:    'CASO 3 — TCAS RA (anchor TCAS RA)',
    texto: 'TCAS RA climb fue activado a FL350 con otro tráfico a 300 pies.',
    nota:  'Se espera anchor "TCAS RA" activo',
  },
  {
    id:    'CASO 4 — Falla del motor (anchor Falla Técnica)',
    texto: 'Falla del motor número 1 durante el ascenso inicial.',
    nota:  'Se espera anchor "Falla Técnica" activo',
  },
  {
    id:    'CASO 5 — Negación explícita (no se detectó humo)',
    texto: 'El piloto reportó un olor inusual pero no se detectó humo ni fuego en ningún sector de la aeronave.',
    nota:  'Negación explícita — no debe clasificar como Incendio',
  },
];

// Los 8 campos requeridos exactos (NO agregar ninguno)
const REQUIRED_FIELDS = [
  'texto_normalizado',
  'local_confidence',
  'nb_winner',
  'top_candidates',
  'lexicon_concepts',
  'anchors_active',
  'hard_negatives',
  'context_signals',
];

// context_signals sub-campos requeridos (cuando no es null)
const REQUIRED_CONTEXT_SIGNALS = [
  'local_categoria',
  'revisarManualmente',
  'tiebreaker',
  'topCapas',
  'noClasificable',
  'catchAll',
  'adrep',
];

let allPassed = true;

for (const caso of CASOS) {
  subsection(caso.id);
  console.log(`  Texto: "${caso.texto}"`);
  console.log(`  Nota:  ${caso.nota}`);

  // ── STEP 2: Ejecutar clasificador real ──────────────────────────────────
  console.log('');
  console.log('[2/5] Executing real classifier...');
  let localResult;
  try {
    localResult = clasificarV2(caso.texto, 'es');
  } catch (err) {
    fail('[2/5] Executing real classifier...', `clasificarV2() threw: ${err.message}`);
  }
  pass('[2/5] Executing real classifier...');

  // ── STEP 3: Verificar que el resultado es un objeto real ──────────────
  console.log('[3/5] Real analysis result obtained...');
  // null es válido (texto sin señal aeronáutica en ciertos paths)
  // pero si lanza una excepción eso es distinto — ya verificado arriba
  if (localResult !== null && typeof localResult !== 'object') {
    fail('[3/5] Real analysis result obtained...',
      `Expected object or null, got: ${typeof localResult}`);
  }
  pass('[3/5] Real analysis result obtained...');

  // Mostrar resultado real del motor
  if (localResult) {
    const nbRank = Array.isArray(localResult._trazas)
      ? localResult._trazas.find(t => t.capa === 'NB' && t.termino === 'ranking NB')
      : null;
    const anchors = Array.isArray(localResult._trazas)
      ? localResult._trazas.filter(t => t.capa === 'ANCHOR')
      : [];
    console.log('');
    console.log('  === RESULTADO REAL DEL MOTOR ===');
    console.log(`  categoria:           ${localResult.categoria}`);
    console.log(`  confianza:           ${localResult.confianza}`);
    console.log(`  _revisarManualmente: ${localResult._revisarManualmente}`);
    console.log(`  _noClasificable:     ${localResult._noClasificable || false}`);
    console.log(`  _catchAll:           ${localResult._catchAll || false}`);
    console.log(`  _tiebreaker:         ${localResult._tiebreaker || false}`);
    console.log(`  _topCapas:           ${localResult._topCapas || '(none)'}`);
    console.log(`  adrep:               ${localResult.adrep || '(none)'}`);
    console.log(`  nb_winner (trace):   ${nbRank ? nbRank.categoria : '(none)'}`);
    console.log(`  anchors activos:     ${anchors.map(a => a.termino + '(' + a.peso + ')').join(', ') || '(ninguno)'}`);
    const scoreKeys = Object.keys(localResult._scoreDetalle || {}).length;
    console.log(`  _scoreDetalle keys:  ${scoreKeys}`);
    if (scoreKeys > 0) {
      const top3 = Object.entries(localResult._scoreDetalle).slice(0, 3);
      top3.forEach(([k, v]) => console.log(`    ${k}: ${v}`));
    }
  } else {
    console.log('  localResult = null (texto completamente fuera de scope aeronáutico)');
  }

  // ── STEP 4: buildStructuredContext ────────────────────────────────────
  console.log('');
  console.log('[4/5] Building structured context...');
  let ctx;
  try {
    ctx = buildStructuredContext(localResult, caso.texto);
  } catch (err) {
    fail('[4/5] Building structured context...', `buildStructuredContext() threw: ${err.message}`);
  }
  if (!ctx || typeof ctx !== 'object') {
    fail('[4/5] Building structured context...', `Expected object, got: ${typeof ctx}`);
  }
  pass('[4/5] Building structured context...');

  // ── STEP 5: Validar exactamente los 8 campos ──────────────────────────
  console.log('[5/5] Validating 8-field context...');
  const errors = [];

  // Check no extra fields and no missing fields
  const actualFields = Object.keys(ctx).sort();
  const expectedFields = [...REQUIRED_FIELDS].sort();
  for (const f of expectedFields) {
    if (!(f in ctx)) errors.push(`Missing required field: "${f}"`);
  }
  for (const f of actualFields) {
    if (!REQUIRED_FIELDS.includes(f)) errors.push(`Unexpected extra field: "${f}"`);
  }

  // Type checks on each field
  if (typeof ctx.texto_normalizado !== 'string') {
    errors.push(`texto_normalizado must be string, got ${typeof ctx.texto_normalizado}`);
  }
  if (ctx.texto_normalizado.length === 0) {
    errors.push('texto_normalizado must be non-empty');
  }
  if (ctx.local_confidence !== null && typeof ctx.local_confidence !== 'number') {
    errors.push(`local_confidence must be number or null, got ${typeof ctx.local_confidence}`);
  }
  if (ctx.nb_winner !== null && typeof ctx.nb_winner !== 'string') {
    errors.push(`nb_winner must be string or null, got ${typeof ctx.nb_winner}`);
  }
  if (!Array.isArray(ctx.top_candidates)) {
    errors.push(`top_candidates must be array, got ${typeof ctx.top_candidates}`);
  }
  if (!Array.isArray(ctx.lexicon_concepts)) {
    errors.push(`lexicon_concepts must be array, got ${typeof ctx.lexicon_concepts}`);
  }
  if (!Array.isArray(ctx.anchors_active)) {
    errors.push(`anchors_active must be array, got ${typeof ctx.anchors_active}`);
  }
  if (!Array.isArray(ctx.hard_negatives)) {
    errors.push(`hard_negatives must be array, got ${typeof ctx.hard_negatives}`);
  }
  // context_signals: object (when localResult != null) or null
  if (ctx.context_signals !== null) {
    if (typeof ctx.context_signals !== 'object') {
      errors.push(`context_signals must be object or null, got ${typeof ctx.context_signals}`);
    } else {
      for (const sf of REQUIRED_CONTEXT_SIGNALS) {
        if (!(sf in ctx.context_signals)) {
          errors.push(`context_signals.${sf} is missing`);
        }
      }
      if (typeof ctx.context_signals.revisarManualmente !== 'boolean') {
        errors.push('context_signals.revisarManualmente must be boolean');
      }
      if (typeof ctx.context_signals.tiebreaker !== 'boolean') {
        errors.push('context_signals.tiebreaker must be boolean');
      }
      if (typeof ctx.context_signals.noClasificable !== 'boolean') {
        errors.push('context_signals.noClasificable must be boolean');
      }
      if (typeof ctx.context_signals.catchAll !== 'boolean') {
        errors.push('context_signals.catchAll must be boolean');
      }
    }
  }

  if (errors.length > 0) {
    fail('[5/5] Validating 8-field context...', errors.join('\n  → '));
    allPassed = false;
    continue;
  }
  pass('[5/5] Validating 8-field context...');

  // Mostrar el contexto real construido
  console.log('');
  console.log('  === CONTEXTO REAL buildStructuredContext() ===');
  console.log(`  texto_normalizado:  "${ctx.texto_normalizado.slice(0, 60)}..."`);
  console.log(`  local_confidence:   ${ctx.local_confidence}`);
  console.log(`  nb_winner:          ${ctx.nb_winner}`);
  console.log(`  top_candidates:     [${ctx.top_candidates.map(c=>c.categoria+'('+c.score+')').join(', ')||'—'}]`);
  console.log(`  lexicon_concepts:   [${ctx.lexicon_concepts.map(c=>c.id).join(', ')||'—'}]`);
  console.log(`  anchors_active:     [${ctx.anchors_active.map(a=>a.categoria+'('+a.peso+')').join(', ')||'—'}]`);
  console.log(`  hard_negatives:     [${ctx.hard_negatives.join(', ')||'—'}]`);
  if (ctx.context_signals) {
    const s = ctx.context_signals;
    console.log('  context_signals:');
    console.log(`    local_categoria:   ${s.local_categoria}`);
    console.log(`    revisarManualmente: ${s.revisarManualmente}`);
    console.log(`    tiebreaker:        ${s.tiebreaker}`);
    console.log(`    noClasificable:    ${s.noClasificable}`);
    console.log(`    catchAll:          ${s.catchAll}`);
    console.log(`    topCapas:          ${s.topCapas || '(none)'}`);
    console.log(`    adrep:             ${s.adrep || '(none)'}`);
  } else {
    console.log('  context_signals:    null');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESUMEN FINAL
// ─────────────────────────────────────────────────────────────────────────────
section('Resumen Final');
if (allPassed) {
  console.log(' \x1b[32m✅ TODOS LOS CASOS PASARON\x1b[0m');
  console.log(' Motor real: CARGADO');
  console.log(' Función real: clasificarV2(texto, lang)');
  console.log(' Context builder: buildStructuredContext(localResult, texto)');
  console.log(' Mock: NINGUNO');
  console.log(' Fallback artificial: NINGUNO');
  console.log(' Llamadas externas: NINGUNA');
  console.log('');
  console.log(' Listo para conectar con Gemini (test-gemini-client.js).');
} else {
  console.log(' \x1b[31m❌ HUBO FALLAS — ver detalles arriba\x1b[0m');
  process.exit(1);
}
console.log('══════════════════════════════════════════════════════════\n');
