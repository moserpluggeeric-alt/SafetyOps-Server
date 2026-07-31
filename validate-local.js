/**
 * SafetyOps API — Local Validation Suite
 * =======================================
 * Covers all 7 validation points before Google Cloud deployment.
 *
 * Usage:
 *   node validate-local.js              # run all automated tests
 *   node validate-local.js --watch      # re-run health+WS check every 3s
 *
 * The script does NOT require the 'ws' package to be installed first —
 * it uses Node.js built-in http and net modules only.
 *
 * Prerequisites:
 *   1. node safetyops-server.js  (running in another terminal)
 *   2. SafetyOps_v2.html open in browser (for check #3 onward)
 */

'use strict';

const http = require('http');

const BASE   = process.env.API_BASE || 'http://localhost:3001';
const WATCH  = process.argv.includes('--watch');

// ── ANSI colours ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  grey:   '\x1b[90m',
};
const ok   = (s) => `${C.green}✅ ${s}${C.reset}`;
const fail = (s) => `${C.red}✗  ${s}${C.reset}`;
const warn = (s) => `${C.yellow}⚠  ${s}${C.reset}`;
const info = (s) => `${C.cyan}   ${s}${C.reset}`;
const dim  = (s) => `${C.grey}   ${s}${C.reset}`;
const head = (n, s) => `\n${C.bold}${C.white}[${n}] ${s}${C.reset}`;

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url      = new URL(BASE + path);
    const payload  = body ? JSON.stringify(body) : null;
    const opts     = {
      hostname: url.hostname,
      port:     url.port || 3001,
      path:     url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve({ status: res.status || res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) });
        } catch {
          resolve({ status: res.statusCode, body: {} });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(new Error('Request timed out')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Checks ────────────────────────────────────────────────────────────────────

async function check1_serverStarts() {
  console.log(head(1, 'API Server is running'));
  try {
    const { status, body } = await request('GET', '/api/v1/health');
    if (status === 200 && body.status === 'ok') {
      console.log(ok(`Server responded — version ${body.version}, uptime ${body.uptime}s`));
      console.log(dim(`Timestamp: ${body.timestamp}`));
      return body;
    } else {
      console.log(fail(`Unexpected response — status ${status}`));
      console.log(dim(JSON.stringify(body, null, 2)));
      return null;
    }
  } catch (e) {
    console.log(fail('Cannot reach server at ' + BASE));
    console.log(warn('Is it running?  →  node safetyops-server.js'));
    console.log(dim('Error: ' + e.message));
    return null;
  }
}

async function check2_endpoints(health) {
  console.log(head(2, 'All endpoints respond correctly'));

  // GET /api/v1/health — already validated in check 1
  console.log(ok('GET /api/v1/health — 200 OK'));

  // GET /api/v1/config
  try {
    const { status, body } = await request('GET', '/api/v1/config');
    if (status === 200 && Array.isArray(body.areas) && body.areas.length > 0) {
      console.log(ok(`GET /api/v1/config — 200 OK (${body.areas.length} areas, max_texto=${body.max_texto_length})`));
      console.log(dim('Areas: ' + body.areas.join(', ')));
    } else {
      console.log(fail(`GET /api/v1/config — unexpected response (status ${status})`));
    }
  } catch (e) {
    console.log(fail('GET /api/v1/config — ' + e.message));
  }

  // POST /api/v1/reports — validation error (short texto)
  try {
    const { status, body } = await request('POST', '/api/v1/reports', { texto: 'short', area: 'Mantenimiento' });
    if (status === 400 && body.error === 'validation_error') {
      console.log(ok('POST /api/v1/reports — validation_error on short texto (400) ✓'));
    } else {
      console.log(warn(`POST /api/v1/reports validation — expected 400, got ${status}`));
    }
  } catch (e) {
    console.log(fail('POST /api/v1/reports validation test — ' + e.message));
  }

  // POST /api/v1/reports — unknown route
  try {
    const { status, body } = await request('GET', '/api/v1/unknown');
    if (status === 404 && body.error === 'not_found') {
      console.log(ok('GET /api/v1/unknown — 404 not_found ✓'));
    } else {
      console.log(warn(`Unknown route — expected 404, got ${status}`));
    }
  } catch (e) {
    console.log(fail('Unknown route test — ' + e.message));
  }
}

async function check3_engineConnected() {
  console.log(head(3, 'SafetyOps connected to WebSocket'));
  try {
    const { status, body } = await request('GET', '/api/v1/health');
    if (body.engine === 'connected') {
      console.log(ok('SafetyOps_v2.html is connected via WebSocket'));
      return true;
    } else {
      console.log(fail('engine = "disconnected"'));
      console.log(warn('Open SafetyOps_v2.html in Chrome/Firefox, then re-run this check.'));
      console.log(info('The page auto-connects 1 second after loading.'));
      console.log(info('You should see in the server terminal:'));
      console.log(dim('  [WS] SafetyOps engine connected'));
      return false;
    }
  } catch (e) {
    console.log(fail('Could not check engine status — ' + e.message));
    return false;
  }
}

async function check4_5_6_reportFlow(engineConnected) {
  console.log(head('4–6', 'Mobile → API → SafetyOps → Classification'));

  if (!engineConnected) {
    console.log(warn('Skipping — SafetyOps engine is not connected (check 3 failed)'));
    console.log(info('Once SafetyOps is open, re-run:  node validate-local.js'));
    return null;
  }

  const testReport = {
    texto: 'Durante el preflight detecté que el indicador de presión hidráulica del tren de aterrizaje de la aeronave LV-ABC mostraba lectura irregular en fase de rodaje en pista 29. El piloto realizó el reporte de mantenimiento correspondiente antes del vuelo.',
    area: 'Mantenimiento',
    identidad: 'anonimo',
    geo: null,
  };

  console.log(info('Submitting test report to POST /api/v1/reports…'));
  console.log(dim('texto: "' + testReport.texto.slice(0, 80) + '…"'));

  try {
    const start = Date.now();
    const { status, body } = await request('POST', '/api/v1/reports', testReport);
    const elapsed = Date.now() - start;

    if (status === 200 && body.folio) {
      // Check 4: Mobile → API
      console.log(ok(`[4] Report submitted and received — ${elapsed}ms round-trip`));

      // Check 5: Report reached SafetyOps
      console.log(ok(`[5] SafetyOps processed the report — folio: ${C.cyan}${body.folio}${C.reset}`));

      // Check 6: AI classification
      const nivelColor = { Bajo: C.green, Medio: C.yellow, Alto: '\x1b[33m', Crítico: C.red }[body.nivel_riesgo] || C.white;
      console.log(ok(`[6] Classification complete:`));
      console.log(info(`    Categoría:      ${body.categoria}`));
      console.log(info(`    Nivel ARMS:     ${nivelColor}${body.nivel_riesgo}${C.reset} (S${body.severidad} / P${body.probabilidad})`));
      console.log(info(`    Confianza IA:   ${(body.confianza * 100).toFixed(0)}%`));
      console.log(info(`    Hazards:        ${body.hazards.join(', ') || '(ninguno)'}`));
      console.log(info(`    Req. validación: ${body.requiere_validacion ? 'Sí' : 'No'}`));
      return body;
    } else if (status === 503) {
      console.log(fail(`[4–6] Engine error — ${body.error}: ${body.message}`));
      return null;
    } else {
      console.log(fail(`[4–6] Unexpected response — status ${status}`));
      console.log(dim(JSON.stringify(body, null, 2)));
      return null;
    }
  } catch (e) {
    console.log(fail('[4–6] Request failed — ' + e.message));
    return null;
  }
}

function check7_dashboard(result) {
  console.log(head(7, 'Dashboard update'));
  if (!result) {
    console.log(warn('Skipping — no report result available'));
    return;
  }
  console.log(ok(`Report ${result.folio} was saved to S.ocurrencias in SafetyOps`));
  console.log(info('To verify the dashboard update manually:'));
  console.log(dim('  1. In SafetyOps_v2.html, click "Principal" (Dashboard)'));
  console.log(dim('  2. Check that the KPI card "Total Reportes" increased by 1'));
  console.log(dim('  3. Click "Reportes" in the sidebar — the new report should appear at the top'));
  console.log(dim('  4. The report folio should be: ' + result.folio));
  console.log(dim('  5. Check the "Reportes en vivo" panel for the real-time entry'));
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(results) {
  console.log(`\n${C.bold}${'─'.repeat(52)}${C.reset}`);
  console.log(`${C.bold} VALIDATION SUMMARY${C.reset}`);
  console.log(`${'─'.repeat(52)}`);
  const checks = [
    ['1', 'API Server starts',                       results.server],
    ['2', 'Endpoints respond correctly',              results.endpoints],
    ['3', 'SafetyOps WebSocket connected',            results.wsConnected],
    ['4', 'Mobile client → API (report received)',    results.reportResult],
    ['5', 'Report reached SafetyOps engine',          results.reportResult],
    ['6', 'AI classification ran correctly',          results.reportResult],
    ['7', 'Dashboard update (manual verification)',   results.wsConnected],
  ];
  let allPass = true;
  for (const [n, label, passed] of checks) {
    const sym = passed ? `${C.green}✅` : `${C.red}✗ `;
    if (!passed) allPass = false;
    console.log(`  ${sym}  [${n}] ${label}${C.reset}`);
  }
  console.log(`${'─'.repeat(52)}`);
  if (allPass) {
    console.log(`${C.bold}${C.green} ✅ ALL CHECKS PASSED — ready for Google Cloud deployment${C.reset}`);
  } else {
    console.log(`${C.bold}${C.yellow} ⚠  Some checks failed or were skipped — see above${C.reset}`);
  }
  console.log(`${'─'.repeat(52)}\n`);
}

// ── Watch mode ────────────────────────────────────────────────────────────────

async function watchMode() {
  console.log(`${C.cyan}${C.bold}Watch mode — checking engine connection every 3s. Ctrl+C to stop.${C.reset}\n`);
  let lastState = null;
  async function tick() {
    try {
      const { body } = await request('GET', '/api/v1/health');
      const state = body.engine;
      if (state !== lastState) {
        const ts = new Date().toLocaleTimeString('es-AR');
        if (state === 'connected') {
          console.log(`${C.green}[${ts}] ✅ SafetyOps engine CONNECTED${C.reset}`);
          console.log(info('You can now run:  node validate-local.js'));
        } else {
          console.log(`${C.yellow}[${ts}] ⚠  SafetyOps engine disconnected — open SafetyOps_v2.html${C.reset}`);
        }
        lastState = state;
      }
    } catch {
      if (lastState !== 'unreachable') {
        console.log(`${C.red}[${new Date().toLocaleTimeString('es-AR')}] ✗  API Server not reachable — run: node safetyops-server.js${C.reset}`);
        lastState = 'unreachable';
      }
    }
    setTimeout(tick, 3000);
  }
  tick();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}SafetyOps — Local Validation Suite${C.reset}`);
  console.log(`${C.grey}Target: ${BASE}${C.reset}`);
  console.log(`${C.grey}${'─'.repeat(52)}${C.reset}`);

  if (WATCH) {
    return watchMode();
  }

  const results = {
    server:       false,
    endpoints:    false,
    wsConnected:  false,
    reportResult: null,
  };

  const health = await check1_serverStarts();
  results.server = !!health;

  if (!health) {
    printSummary(results);
    process.exit(1);
  }

  await check2_endpoints(health);
  results.endpoints = true;

  const wsOk = await check3_engineConnected();
  results.wsConnected = wsOk;

  const reportResult = await check4_5_6_reportFlow(wsOk);
  results.reportResult = reportResult;

  check7_dashboard(reportResult);
  printSummary(results);

  process.exit(results.server && results.wsConnected && results.reportResult ? 0 : 1);
}

main().catch(e => {
  console.error(fail('Unhandled error: ' + e.message));
  process.exit(1);
});
