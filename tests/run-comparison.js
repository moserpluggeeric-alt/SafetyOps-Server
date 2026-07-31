#!/usr/bin/env node
'use strict';
/**
 * SafetyOps — Comparación de equivalencia: motor LOCAL vs motor WebSocket
 * =========================================================================
 *
 * REQUISITOS para ejecutar la comparación completa WS+LOCAL:
 *   1. Iniciar el servidor:  node safetyops-server.js
 *      (con USE_LOCAL_ENGINE=false y COMPARE_MODE=false — defaults)
 *   2. Abrir SafetyOps_v2.html en el navegador y esperar que conecte al server.
 *   3. Ejecutar este script:  node tests/run-comparison.js
 *
 * MODO SOLO LOCAL (sin SafetyOps_v2.html):
 *   node tests/run-comparison.js --local-only
 *
 * SALIDA:
 *   - Reporte en consola con tabla de resultados y diferencias.
 *   - Archivo comparison-report-<timestamp>.json en tests/reports/
 */

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const engine  = require('../analysis-engine');
const { CASES } = require('./cases');

// ── Config ────────────────────────────────────────────────────────────────────
const SERVER_URL      = process.env.SERVER_URL    || 'http://localhost:3001';
const WS_TIMEOUT_MS   = parseInt(process.env.WS_TIMEOUT || '35000', 10);
const DELAY_BETWEEN   = parseInt(process.env.DELAY_MS   || '800',   10); // ms entre requests al server WS
const LOCAL_ONLY      = process.argv.includes('--local-only');
const REPORT_DIR      = path.join(__dirname, 'reports');

// Campos a comparar
const COMPARE_FIELDS = ['categoria', 'nivel_riesgo', 'severidad', 'probabilidad', 'confianza'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function postToServer(caso) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      texto:     caso.texto,
      area:      caso.area,
      identidad: 'anonimo',
      lang:      caso.lang || 'es',
    });
    const opts = {
      hostname: 'localhost',
      port:     parseInt((SERVER_URL.split(':')[2] || '3001'), 10),
      path:     '/api/v1/reports',
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    });
    req.on('error', reject);
    const timer = setTimeout(() => { req.destroy(new Error('WS timeout')); }, WS_TIMEOUT_MS);
    req.on('close', () => clearTimeout(timer));
    req.write(body);
    req.end();
  });
}

function runLocal(caso, nextId) {
  return engine.analyzeReport({
    texto:     caso.texto,
    area:      caso.area,
    identidad: 'anonimo',
    lang:      caso.lang || 'es',
    nextId,
    timestamp: new Date().toISOString(),
  });
}

function compareResults(local, ws) {
  const diffs = [];
  for (const field of COMPARE_FIELDS) {
    const lv = local  ? local[field]  : undefined;
    const wv = ws     ? ws[field]     : undefined;
    if (field === 'confianza') {
      // Tolerancia ±0.05 en confianza — diferencias de normalización flotante son esperables
      if (Math.abs((lv || 0) - (wv || 0)) > 0.05) {
        diffs.push({ field, local: lv, ws: wv });
      }
    } else {
      if (String(lv) !== String(wv)) {
        diffs.push({ field, local: lv, ws: wv });
      }
    }
  }
  // Comparar hazards (como set)
  const lh = (local && local.hazards) ? [...local.hazards].sort().join('|') : '';
  const wh = (ws    && ws.hazards)    ? [...ws.hazards].sort().join('|')    : '';
  if (lh !== wh) {
    diffs.push({ field: 'hazards', local: local && local.hazards, ws: ws && ws.hazards });
  }
  return diffs;
}

function pad(s, n) {
  s = String(s || '');
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

function fmt(v) { return v === undefined || v === null ? '—' : String(v); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   SafetyOps — Comparación LOCAL vs WS · ' + new Date().toISOString().slice(0,19) + '   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (LOCAL_ONLY) {
    console.log('⚠  Modo --local-only: el motor WebSocket no se consultará.\n');
  }

  const results = [];
  let wsOk = 0, wsErr = 0, localOk = 0, localErr = 0;
  let identical = 0, divergent = 0;

  // ── Verificar salud del server (sólo si no es local-only) ─────────────────
  if (!LOCAL_ONLY) {
    try {
      await new Promise((resolve, reject) => {
        http.get(SERVER_URL + '/api/v1/health', res => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            const health = JSON.parse(Buffer.concat(chunks).toString());
            if (health.engine !== 'connected') {
              reject(new Error('SafetyOps_v2.html no está conectada al servidor. Ábrela primero.\n  (health.engine = "' + health.engine + '")'));
            } else {
              console.log('✅ Server conectado · engine=' + health.engine + ' · uptime=' + health.uptime + 's\n');
              resolve();
            }
          });
        }).on('error', err => reject(new Error('No se puede conectar al servidor en ' + SERVER_URL + '\n  ' + err.message)));
      });
    } catch (err) {
      console.error('❌ ' + err.message);
      console.error('\n   Opciones:\n   1. Inicia el servidor y abre SafetyOps_v2.html, luego vuelve a correr.\n   2. Usa --local-only para validar solo el motor local.\n');
      process.exit(1);
    }
  }

  // ── Tabla header ─────────────────────────────────────────────────────────
  const COL = [4, 28, 22, 22, 6, 6, 6, 9, 6];
  const HDR = ['ID', 'Categoría LOCAL', 'Categoría WS', 'Nivel Riesgo', 'Sev L', 'Sev W', 'Pro L', 'Conf L', 'Match'];
  console.log(HDR.map((h,i) => pad(h, COL[i])).join(' │ '));
  console.log(COL.map(n => '─'.repeat(n)).join('─┼─'));

  // ── Correr casos ──────────────────────────────────────────────────────────
  for (let i = 0; i < CASES.length; i++) {
    const caso = CASES[i];
    const nextId = i + 1;

    // Motor local
    let localResult = null, localError = null;
    try {
      localResult = runLocal(caso, nextId);
      localOk++;
    } catch (e) {
      localError = e.message;
      localErr++;
    }

    // Motor WS
    let wsResult = null, wsError = null;
    if (!LOCAL_ONLY) {
      try {
        wsResult = await postToServer(caso);
        if (wsResult.error) { wsError = wsResult.error + ': ' + wsResult.message; wsResult = null; wsErr++; }
        else wsOk++;
      } catch (e) {
        wsError = e.message;
        wsErr++;
      }
      await sleep(DELAY_BETWEEN);
    }

    // Comparar
    const diffs = (!LOCAL_ONLY && localResult && wsResult) ? compareResults(localResult, wsResult) : [];
    const isMatch = !LOCAL_ONLY ? (localResult && wsResult && diffs.length === 0) : null;
    if (!LOCAL_ONLY) { if (isMatch) identical++; else divergent++; }

    // Fila de tabla
    const catL   = localResult ? localResult.categoria   : ('ERR: ' + localError);
    const catW   = LOCAL_ONLY  ? '(skip)' : (wsResult ? wsResult.categoria : ('ERR: ' + wsError));
    const rlL    = localResult ? localResult.nivel_riesgo : '—';
    const sevL   = localResult ? localResult.severidad    : '—';
    const sevW   = (!LOCAL_ONLY && wsResult) ? wsResult.severidad    : '—';
    const proL   = localResult ? localResult.probabilidad : '—';
    const confL  = localResult ? localResult.confianza.toFixed(3) : '—';
    const match  = LOCAL_ONLY  ? '—' : (isMatch ? '✅' : '❌');

    console.log([
      pad(caso.id, COL[0]),
      pad(catL,   COL[1]),
      pad(catW,   COL[2]),
      pad(rlL,    COL[3]),
      pad(sevL,   COL[4]),
      pad(sevW,   COL[5]),
      pad(proL,   COL[6]),
      pad(confL,  COL[7]),
      match,
    ].join(' │ '));

    results.push({
      id: caso.id, area: caso.area, lang: caso.lang,
      categoria_esperada: caso.categoria_esperada,
      texto_preview: caso.texto.slice(0, 80) + '...',
      local: localResult ? {
        categoria: localResult.categoria, nivel_riesgo: localResult.nivel_riesgo,
        severidad: localResult.severidad, probabilidad: localResult.probabilidad,
        confianza: localResult.confianza, hazards: localResult.hazards,
        recomendaciones: localResult.recomendaciones || [],
        requiere_validacion: localResult.requiere_validacion,
        folio: localResult.folio,
      } : { error: localError },
      ws: LOCAL_ONLY ? null : (wsResult ? {
        categoria: wsResult.categoria, nivel_riesgo: wsResult.nivel_riesgo,
        severidad: wsResult.severidad, probabilidad: wsResult.probabilidad,
        confianza: wsResult.confianza, hazards: wsResult.hazards,
        recomendaciones: wsResult.recomendaciones || [],
        requiere_validacion: wsResult.requiere_validacion,
        folio: wsResult.folio,
      } : { error: wsError }),
      diffs,
      match: LOCAL_ONLY ? null : isMatch,
    });
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('RESUMEN GENERAL');
  console.log('═'.repeat(70));
  console.log('  Total casos:          ' + CASES.length);
  console.log('  Motor local OK:       ' + localOk + ' / ' + CASES.length + (localErr > 0 ? '  ⚠ ' + localErr + ' errores' : ''));
  if (!LOCAL_ONLY) {
    console.log('  Motor WS OK:          ' + wsOk + ' / ' + CASES.length + (wsErr > 0 ? '  ⚠ ' + wsErr + ' errores' : ''));
    console.log('');
    console.log('  Casos IDÉNTICOS:      ' + identical + ' / ' + CASES.length + ' (' + Math.round(identical/CASES.length*100) + '%)');
    console.log('  Casos DIVERGENTES:    ' + divergent + ' / ' + CASES.length + ' (' + Math.round(divergent/CASES.length*100) + '%)');
  }

  // ── Detalle de divergencias ────────────────────────────────────────────────
  const divergentes = results.filter(r => r.diffs && r.diffs.length > 0);
  if (!LOCAL_ONLY && divergentes.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('DETALLE DE DIVERGENCIAS (' + divergentes.length + ' casos)');
    console.log('─'.repeat(70));
    for (const r of divergentes) {
      console.log('\n  Caso #' + r.id + ' [' + r.categoria_esperada + '] — área: ' + r.area);
      console.log('  Texto: "' + r.texto_preview + '"');
      for (const d of r.diffs) {
        console.log('    ⚠  ' + pad(d.field + ':', 18) + ' LOCAL=' + JSON.stringify(d.local) + '  WS=' + JSON.stringify(d.ws));
      }
    }
  }

  // ── Casos con error ────────────────────────────────────────────────────────
  const errLocal = results.filter(r => r.local && r.local.error);
  const errWs    = results.filter(r => r.ws    && r.ws.error);
  if (errLocal.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('ERRORES MOTOR LOCAL (' + errLocal.length + ')');
    for (const r of errLocal) console.log('  Caso #' + r.id + ': ' + r.local.error);
  }
  if (!LOCAL_ONLY && errWs.length > 0) {
    console.log('\n' + '─'.repeat(70));
    console.log('ERRORES MOTOR WS (' + errWs.length + ')');
    for (const r of errWs) console.log('  Caso #' + r.id + ': ' + r.ws.error);
  }

  // ── Guardar reporte JSON ──────────────────────────────────────────────────
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const mode      = LOCAL_ONLY ? 'local-only' : 'full-comparison';
  const reportPath = path.join(REPORT_DIR, 'comparison-' + mode + '-' + timestamp + '.json');
  const report = {
    generated: new Date().toISOString(),
    mode,
    server_url: SERVER_URL,
    total: CASES.length,
    local_ok: localOk, local_err: localErr,
    ws_ok: wsOk, ws_err: wsErr,
    identical, divergent,
    divergence_rate: LOCAL_ONLY ? null : (divergent / CASES.length),
    results,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n📄 Reporte guardado en: ' + reportPath);

  if (!LOCAL_ONLY) {
    const pct = Math.round(identical/CASES.length*100);
    console.log('\n' + (pct === 100 ? '🟢 EQUIVALENCIA PERFECTA' : pct >= 90 ? '🟡 EQUIVALENCIA PARCIAL (' + pct + '%)' : '🔴 DIFERENCIAS SIGNIFICATIVAS (' + (100-pct) + '% de divergencia)'));
    if (pct === 100) {
      console.log('   → Seguro activar USE_LOCAL_ENGINE=true en producción.\n');
    } else {
      console.log('   → Revisar divergencias antes de activar USE_LOCAL_ENGINE=true.\n');
    }
  } else {
    console.log('\n🔵 Baseline local guardado. Ejecuta sin --local-only cuando SafetyOps_v2.html esté conectada.\n');
  }
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message);
  process.exit(1);
});
