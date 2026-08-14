'use strict';
/**
 * TEST-OPENAI-CLIENT.JS — Prueba aislada de la infraestructura OpenAI
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifica el pipeline completo:
 *   analysis-engine → buildStructuredContext → openaiClassify → validateOpenAIResponse
 *
 * NO modifica ningún archivo de SafetyOps.
 * NO activa OPENAI_ENABLED en producción.
 * NO guarda resultados en disco.
 * NO imprime la API key.
 *
 * USO (desde ~/Desktop/veridan-main2/safetyops-server/):
 *   OPENAI_API_KEY=sk-... node test-openai-client.js
 *
 * La variable OPENAI_API_KEY es solo para esta ejecución — no persiste.
 */

// ── 1. Verificar API key ──────────────────────────────────────────────────────
if (!process.env.OPENAI_API_KEY) {
  console.error('\n[ERROR] Falta OPENAI_API_KEY.');
  console.error('Ejecutá el test así:');
  console.error('  OPENAI_API_KEY=sk-... node test-openai-client.js\n');
  process.exit(1);
}

// Activar OpenAI para esta ejecución de test (no afecta Railway)
process.env.OPENAI_ENABLED    = 'true';
process.env.OPENAI_SHADOW_MODE = 'true';
process.env.USE_LEXICON_V2    = 'false';  // V1 passthrough — sin modificar motor

// ── 2. Importar módulos ───────────────────────────────────────────────────────
const { buildStructuredContext, openaiClassify, getModel, isOpenAIEnabled } = require('./openai-client');
const { validateOpenAIResponse } = require('./openai-schema');

// ── 3. Importar motor local (read-only — no modifica estado) ──────────────────
let clasificarLocal;
try {
  const engine = require('./analysis-engine/classifier-v2');
  clasificarLocal = (texto) => engine.clasificarV2(texto, 'es');
} catch (err) {
  console.warn('[WARN] No se pudo cargar analysis-engine:', err.message);
  clasificarLocal = () => null;
}

// ── 4. Casos de prueba ────────────────────────────────────────────────────────
const CASOS = [
  {
    id:    'CASO 1',
    texto: 'Durante el vuelo se observó humo proveniente de uno de los motores y la tripulación inició el procedimiento correspondiente.',
  },
  {
    id:    'CASO 2',
    texto: 'Un pasajero informó que vio fuego cerca de un motor.',
  },
];

// ── 5. Ejecutar prueba ────────────────────────────────────────────────────────
async function runTest() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log(' SafetyOps — Prueba Aislada OpenAI Client');
  console.log('══════════════════════════════════════════════════════════');
  console.log(' Modelo:    ', getModel());
  console.log(' Enabled:   ', isOpenAIEnabled());
  console.log(' Shadow:    ', process.env.OPENAI_SHADOW_MODE);
  console.log(' Key:        sk-***' + process.env.OPENAI_API_KEY.slice(-4));
  console.log('──────────────────────────────────────────────────────────\n');

  for (const caso of CASOS) {
    console.log(`▶ ${caso.id}`);
    console.log(`  Texto: "${caso.texto}"`);

    // Correr motor local (sin modificar nada)
    const localResult = clasificarLocal(caso.texto);
    if (localResult) {
      console.log(`  Motor local: ${localResult.categoria} (conf=${(localResult.confianza * 100).toFixed(0)}%)`);
    } else {
      console.log(`  Motor local: (sin resultado)`);
    }

    // Construir contexto estructurado
    const ctx = buildStructuredContext(localResult, caso.texto);

    // Llamar a OpenAI
    const t0 = Date.now();
    let result;
    try {
      result = await openaiClassify(ctx);
    } catch (err) {
      // Mostrar error sin exponer key
      const msg = err.message.replace(process.env.OPENAI_API_KEY, 'sk-***REDACTED***');
      console.error(`  [ERROR] ${msg}`);
      console.log('');
      continue;
    }

    const latencia = Date.now() - t0;

    if (!result) {
      console.log(`  [RESULTADO] null — ver logs de [openai] arriba para causa`);
      console.log('');
      continue;
    }

    // Validar estructura
    const { valid, errors } = validateOpenAIResponse(result);

    console.log('');
    console.log(`  Modelo:             ${result._openai_model}`);
    console.log(`  Latencia:           ${latencia} ms`);
    console.log(`  categoria:          ${result.categoria}`);
    console.log(`  confianza_openai:   ${(result.confianza_openai * 100).toFixed(0)}%`);
    console.log(`  flags_seguridad:    [${result.flags_seguridad.join(', ') || '—'}]`);
    console.log(`  requiere_revision:  ${result.requiere_revision}`);
    console.log(`  validateOpenAIResponse(): ${valid ? '✅ válido' : '❌ inválido — ' + errors.join('; ')}`);

    if (result.categorias_alternativas && result.categorias_alternativas.length > 0) {
      const alts = result.categorias_alternativas
        .map(a => `${a.categoria} (${(a.peso * 100).toFixed(0)}%)`)
        .join(', ');
      console.log(`  alternativas:       ${alts}`);
    }
    console.log('');
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log(' Prueba finalizada. Sin cambios en Railway, Netlify ni motor.');
  console.log('══════════════════════════════════════════════════════════\n');
}

runTest().catch(err => {
  const msg = err.message.replace(process.env.OPENAI_API_KEY || '', 'sk-***REDACTED***');
  console.error('\n[FATAL]', msg);
  process.exit(1);
});
