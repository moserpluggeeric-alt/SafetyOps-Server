'use strict';
/**
 * TEST-GEMINI-CLIENT.JS — Prueba de extremo a extremo del pipeline Gemini
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifica el pipeline completo:
 *   clasificarV2() [motor real] → buildStructuredContext → geminiClassify → validateAIResponse
 *
 * REQUISITO PREVIO:
 *   Ejecutar primero test-safetyops-context.js para verificar el motor local.
 *   Si el motor local no funciona, este test falla inmediatamente.
 *
 * REGLAS DE ORO:
 *   - Si el motor real no puede cargarse → process.exit(1). SIN MOCK. SIN FALLBACK.
 *   - Si clasificarV2 no es función → process.exit(1).
 *   - NO hay datos hardcodeados. NO hay resultados simulados.
 *   - Si el motor devuelve null → se muestra claramente (texto fuera de scope).
 *   - NO modifica ningún archivo del motor.
 *   - NO guarda resultados en disco.
 *   - NO imprime la API key.
 *
 * USO (desde ~/Desktop/veridan-main2/safetyops-server/):
 *   GEMINI_API_KEY=AIza... node test-gemini-client.js
 *
 * La variable GEMINI_API_KEY es solo para esta ejecución — no persiste.
 */

// ── 1. Verificar API key ──────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error('\n[ERROR] Falta GEMINI_API_KEY.');
  console.error('Ejecutá el test así:');
  console.error('  GEMINI_API_KEY=AIza... node test-gemini-client.js\n');
  process.exit(1);
}

// Activar Gemini para esta ejecución (no afecta Railway)
process.env.GEMINI_ENABLED     = 'true';
process.env.GEMINI_SHADOW_MODE = 'true';
process.env.USE_LEXICON_V2     = 'false';   // V1 passthrough — sin modificar motor

// ── 2. Cargar motor real — SIN FALLBACK ───────────────────────────────────────
// Si el motor no puede cargarse → process.exit(1). NO hay mock ni fallback.
let clasificarLocal;
const ENGINE_PATH = './analysis-engine/classifier-v2';
try {
  const engine = require(ENGINE_PATH);
  if (typeof engine.clasificarV2 !== 'function') {
    console.error(`\n[FATAL] engine.clasificarV2 no es una función — got: ${typeof engine.clasificarV2}`);
    console.error(`        Verificar que ${ENGINE_PATH} exporte clasificarV2.`);
    process.exit(1);
  }
  clasificarLocal = (texto) => engine.clasificarV2(texto, 'es');
} catch (err) {
  console.error(`\n[FATAL] No se pudo cargar el motor real: require('${ENGINE_PATH}')`);
  console.error(`        Error: ${err.message}`);
  console.error('        Verificar que analysis-engine/classifier-v2.js existe y no tiene errores de sintaxis.');
  process.exit(1);
}

// ── 3. Importar módulos Gemini ────────────────────────────────────────────────
const { buildStructuredContext, geminiClassify, getModel, isGeminiEnabled } = require('./gemini-client');
const { validateAIResponse } = require('./gemini-schema');

// ── 4. Casos de prueba ────────────────────────────────────────────────────────
const CASOS = [
  {
    id:    'CASO 1 — Humo denso en motor (caso principal del Sprint)',
    texto: 'Salía un humo denso del motor número dos durante la carrera de despegue, tuvimos que abortar.',
  },
  {
    id:    'CASO 2 — Humo observado en vuelo',
    texto: 'Se observó humo proveniente de uno de los motores y la tripulación inició el procedimiento de extinción de incendios.',
  },
  {
    id:    'CASO 3 — Fuego reportado por pasajero (anchor Incendio)',
    texto: 'Un pasajero informó que vio fuego cerca de un motor.',
  },
  {
    id:    'CASO 4 — Negación explícita (no debe clasificar como incendio)',
    texto: 'El piloto reportó un olor inusual pero no se detectó humo ni fuego en ningún sector de la aeronave.',
  },
];

// ── 5. Ejecutar prueba ────────────────────────────────────────────────────────
async function runTest() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(' SafetyOps — Prueba E2E Gemini Client');
  console.log('══════════════════════════════════════════════════════════');
  console.log(' Modelo:    ', getModel());
  console.log(' Enabled:   ', isGeminiEnabled());
  console.log(' Shadow:    ', process.env.GEMINI_SHADOW_MODE);
  console.log(' Key:        AIza***' + process.env.GEMINI_API_KEY.slice(-4));
  console.log(' ENGINE:     clasificarV2 [real — sin mock]');
  console.log('──────────────────────────────────────────────────────────\n');

  for (const caso of CASOS) {
    console.log(`▶ ${caso.id}`);
    console.log(`  Texto: "${caso.texto}"`);

    // Correr motor real — nunca usa mock ni fallback
    const localResult = clasificarLocal(caso.texto);
    if (localResult) {
      const nbRank = Array.isArray(localResult._trazas)
        ? localResult._trazas.find(t => t.capa === 'NB' && t.termino === 'ranking NB')
        : null;
      const anchors = Array.isArray(localResult._trazas)
        ? localResult._trazas.filter(t => t.capa === 'ANCHOR')
        : [];
      console.log(`  Motor local: ${localResult.categoria || '(sin categoría)'} (conf=${(localResult.confianza * 100).toFixed(0)}%)`);
      console.log(`  NB winner:   ${nbRank ? nbRank.categoria : '(none)'}`);
      console.log(`  Anchors:     ${anchors.map(a => a.termino + '(' + a.peso + ')').join(', ') || '(ninguno)'}`);
      if (localResult._noClasificable) {
        console.log('  ⚠ _noClasificable=true — vocabulario aeronáutico insuficiente');
      }
    } else {
      console.log('  Motor local: null (texto fuera de scope aeronáutico)');
    }

    // Construir contexto estructurado usando ai-context.js (motor real → ctx)
    const ctx = buildStructuredContext(localResult, caso.texto);

    // Llamar a Gemini
    const t0 = Date.now();
    let result;
    try {
      result = await geminiClassify(ctx);
    } catch (err) {
      // Mostrar error sin exponer key
      const msg = err.message.replace(process.env.GEMINI_API_KEY, 'AIza***REDACTED***');
      console.error(`  [ERROR] ${msg}`);
      console.log('');
      continue;
    }

    const latencia = Date.now() - t0;

    if (!result) {
      console.log('  [RESULTADO] null — ver logs de [gemini] arriba para causa');
      console.log('');
      continue;
    }

    // Validar estructura
    const { valid, errors } = validateAIResponse(result);

    console.log('');
    console.log(`  Modelo:             ${getModel()}`);
    console.log(`  Latencia:           ${latencia} ms`);
    console.log(`  categoria:          ${result.categoria}`);
    console.log(`  confianza:          ${(result.confianza * 100).toFixed(0)}%`);
    console.log(`  flags_seguridad:    [${result.flags_seguridad.join(', ') || '—'}]`);
    console.log(`  requiere_revision:  ${result.requiere_revision}`);
    console.log(`  validateAIResponse(): ${valid ? '✅ válido' : '❌ inválido — ' + errors.join('; ')}`);

    if (result.categorias_alternativas && result.categorias_alternativas.length > 0) {
      const alts = result.categorias_alternativas
        .map(a => `${a.categoria} (${(a.peso * 100).toFixed(0)}%)`)
        .join(', ');
      console.log(`  alternativas:       ${alts}`);
    }

    if (result.justificacion) {
      console.log(`  justificacion:      ${result.justificacion}`);
    }

    console.log('');
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(' Prueba finalizada. Sin cambios en Railway, Netlify ni motor.');
  console.log('══════════════════════════════════════════════════════════\n');
}

runTest().catch(err => {
  const msg = err.message.replace(process.env.GEMINI_API_KEY || '', 'AIza***REDACTED***');
  console.error('\n[FATAL]', msg);
  process.exit(1);
});
