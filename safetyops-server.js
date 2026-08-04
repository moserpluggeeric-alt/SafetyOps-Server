/**
 * SafetyOps API Server v1.1.0
 *
 * HTTP bridge between external clients (mobile, web) and the SafetyOps engine.
 * SafetyOps_v2.html connects via WebSocket; HTTP clients POST reports which are
 * forwarded to SafetyOps and the result is returned to the HTTP caller.
 *
 * See API_DOCUMENTATION.md for full contract details.
 * See .env.example for all environment variables.
 *
 * Start:      node safetyops-server.js
 * Local dev:  PORT=3001 node safetyops-server.js
 * Production: Set ENGINE_SECRET, CORS_ORIGIN, PORT via Cloud Run env vars.
 */

'use strict';

const http   = require('http');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { WebSocketServer } = require('ws');

// ── SQLite Persistence — Railway Volume ───────────────────────────────────────
// Railway volumes mount at /data. If the directory doesn't exist the server
// refuses to start — never silently fall back to ephemeral local storage.
const DB_PATH = (() => {
  const vol = '/data';
  if (!fs.existsSync(vol)) {
    console.error('[DB] FATAL: Railway Volume not mounted at /data.');
    console.error('[DB] Create a Volume in Railway dashboard and mount it at /data.');
    process.exit(1);
  }
  return path.join(vol, 'reports.db');
})();

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('[DB] FATAL: better-sqlite3 not found. Run: npm install better-sqlite3');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // safe concurrent reads while writing
db.pragma('foreign_keys = ON');

// Schema — idempotent, safe to run on every start
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folio       TEXT    NOT NULL,
    timestamp   TEXT    NOT NULL,
    airport     TEXT,
    sector      TEXT,
    title       TEXT,
    description TEXT    NOT NULL,
    risk        TEXT,
    severity    TEXT,
    probability TEXT,
    category    TEXT,
    status      TEXT    DEFAULT 'Reportada',
    source      TEXT    DEFAULT 'mobile',
    raw_json    TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp);
  CREATE INDEX IF NOT EXISTS idx_reports_folio     ON reports(folio);
  CREATE INDEX IF NOT EXISTS idx_reports_category  ON reports(category);
`);

console.log('[DB] SQLite ready at ' + DB_PATH);

// Prepared statements — compiled once, reused on every call
const stmtInsert = db.prepare(`
  INSERT INTO reports
    (folio, timestamp, airport, sector, title, description,
     risk, severity, probability, category, status, source, raw_json)
  VALUES
    (@folio, @timestamp, @airport, @sector, @title, @description,
     @risk, @severity, @probability, @category, @status, @source, @raw_json)
`);

const stmtSelectPage = db.prepare(`
  SELECT id, folio, timestamp, airport, sector, title, description,
         risk, severity, probability, category, status, source
  FROM   reports
  WHERE  (@since IS NULL OR timestamp >= @since)
  ORDER  BY timestamp DESC
  LIMIT  @limit
`);

const stmtPurge = db.prepare(
  `DELETE FROM reports WHERE timestamp < datetime('now', '-7 days')`
);

/** Persist one report. Accepts the _occ object already built in handlePostReport. */
function dbSaveReport(occ) {
  try {
    stmtInsert.run({
      folio:       occ.folio       || '',
      timestamp:   occ.fecha       ? occ.fecha + 'T00:00:00Z' : new Date().toISOString(),
      airport:     occ.aeropuerto  || null,
      sector:      occ.sector      || null,
      title:       occ.titulo      || null,
      description: occ.texto       || '',
      risk:        occ.nivel_riesgo || null,
      severity:    occ.severidad   || null,
      probability: occ.probabilidad || null,
      category:    occ.categoria   || null,
      status:      occ.estado      || 'Reportada',
      source:      occ._fromMobile ? 'mobile' : 'web',
      raw_json:    JSON.stringify(occ),
    });
    console.log('[DB] Saved report folio=' + occ.folio);
  } catch (err) {
    console.error('[DB] Insert error:', err.message);
  }
}

// ── API Key middleware ────────────────────────────────────────────────────────
// Checks Authorization: Bearer <key>  OR  x-api-key: <key>
// Key is read from API_SECRET_KEY env var; defaults to pilot value.
const API_SECRET_KEY = process.env.API_SECRET_KEY || 'safetyops-pilot-2026';

function requireApiKey(req, res, origin) {
  const auth = req.headers['authorization'] || '';
  const xkey = req.headers['x-api-key']     || '';
  const provided = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : xkey.trim();
  if (provided === API_SECRET_KEY) return true;
  sendJSON(res, 401, { error: 'unauthorized', message: 'API key requerida.' }, origin);
  return false;
}

// ── 7-day purge — runs every 24 h ────────────────────────────────────────────
setInterval(() => {
  try {
    const info = stmtPurge.run();
    console.log('[DB] Purge: ' + info.changes + ' reportes eliminados (>7 días)');
  } catch (err) {
    console.error('[DB] Purge error:', err.message);
  }
}, 24 * 60 * 60 * 1000);

// ── Configuration ─────────────────────────────────────────────────────────────

const PORT           = parseInt(process.env.PORT || '3001', 10);
const ENGINE_TIMEOUT = 30_000;     // ms to wait for SafetyOps to respond
const API_VERSION    = '1.1.0';
const SERVER_START   = Date.now();

// ── STEP 1: ENGINE_SECRET ─────────────────────────────────────────────────────
// When set, the SafetyOps engine must send {"type":"auth","secret":"<value>"}
// as its very first WebSocket message. Connections that fail auth within 5s
// are closed with code 4001.
// When NOT set (local dev), all engine connections are accepted immediately.
const ENGINE_SECRET      = process.env.ENGINE_SECRET || null;
const ENGINE_AUTH_TIMEOUT = 5_000; // ms for SafetyOps to send auth after connecting

// ── STEP 2: CORS_ORIGIN ───────────────────────────────────────────────────────
// Comma-separated list of allowed origins, e.g.:
//   CORS_ORIGIN=https://mobile.safetyops.app,https://staging.safetyops.app
// Defaults to * (all origins) for local development.
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || '*';
const CORS_ORIGINS    = CORS_ORIGIN_RAW === '*'
  ? null // null means allow all
  : CORS_ORIGIN_RAW.split(',').map(s => s.trim()).filter(Boolean);

// ── STEP 3: KEEPALIVE ─────────────────────────────────────────────────────────
// Server sends a protocol-level WS ping every PING_INTERVAL ms.
// SafetyOps browser handles protocol-level pong automatically.
// Server also sends application-level {"type":"ping"} for belt-and-suspenders.
// If no pong (protocol or app-level) arrives within PONG_TIMEOUT ms, the
// connection is considered stale and forcibly closed so SafetyOps reconnects.
const PING_INTERVAL = 30_000;  // 30s between pings
const PONG_TIMEOUT  = 90_000;  // 90s without any pong → stale, close

// ── Local Analysis Engine ─────────────────────────────────────────────────────
// Equivalencia validada 50/50 (100%) — 2026-07-31.
// USE_LOCAL_ENGINE=true  → análisis en-proceso sin WebSocket (PRODUCCIÓN).
// USE_LOCAL_ENGINE=false → puente WebSocket a SafetyOps_v2.html (fallback/legacy).
// COMPARE_MODE=true      → corre ambos motores y loguea diferencias (solo transición).
// COMPARE_MODE=false     → modo producción normal.
const USE_LOCAL_ENGINE = process.env.USE_LOCAL_ENGINE !== 'false'; // default: true (PRODUCCIÓN)
const COMPARE_MODE     = process.env.COMPARE_MODE     === 'true';  // default: false (PRODUCCIÓN)

let _engine = null;
try {
  _engine = require('./analysis-engine');
  console.log('[engine] Local analysis-engine loaded OK — USE_LOCAL_ENGINE=' + USE_LOCAL_ENGINE + ' COMPARE_MODE=' + COMPARE_MODE);
} catch (err) {
  console.warn('[engine] analysis-engine load failed:', err.message, '— WS-only mode');
}

// ── Diagnostic Mode ───────────────────────────────────────────────────────────
// Unified trace logger — add observability without touching any logic.
// All TRACE calls are pure console output; no side effects on control flow.
function TRACE(step, title, data) {
  if (data === undefined) data = {};
  console.log('[TRACE ' + String(step).padStart(2, '0') + '] ' + title, data);
}

/** Operational areas — must match SafetyOps_v2.html SEED */
const AREAS = [
  'Operaciones de Vuelo',
  'Mantenimiento',
  'Operaciones en Tierra',
  'Cabina',
  'Despacho',
  'Control de Tránsito Aéreo',
  'Seguridad Aeroportuaria',
  'Otro',
];

const IDENTIDADES      = ['anonimo', 'usuario'];
const MAX_TEXTO_LENGTH = 10_000;

// ── Pilot Mode: Default values applied when fields are missing ────────────────
const REPORT_DEFAULTS = {
  area:      'Otro',
  identidad: 'anonimo',
  lang:      'es',
  fuente:    'mobile',
  categoria: null,
  estado:    'Reportada',
  prioridad: 'normal',
  geo:       null,
};

/**
 * normalizeReport(raw)
 *
 * Unifies field aliases and applies REPORT_DEFAULTS for any missing fields.
 * Only hard rule: the resolved `texto` must not be empty after trim().
 *
 * Alias resolution (first non-empty wins):
 *   texto ← raw.texto | raw.descripcion | raw.description
 *
 * Returns { ok: true, report } or { ok: false, error }
 */
function normalizeReport(raw) {
  const texto = (raw.texto || raw.descripcion || raw.description || '').trim();
  if (!texto) {
    return { ok: false, error: 'El campo texto no puede estar vacío.' };
  }
  if (texto.length > MAX_TEXTO_LENGTH) {
    return { ok: false, error: `texto no puede superar ${MAX_TEXTO_LENGTH} caracteres.` };
  }
  const report = {
    ...REPORT_DEFAULTS,
    ...raw,
    texto,               // always use the resolved + trimmed value
    _normalized: true,
    _pilot_defaults: true,
  };
  return { ok: true, report };
}

// ── State ─────────────────────────────────────────────────────────────────────

/** The single authenticated WebSocket from SafetyOps_v2.html. */
let engineSocket = null;

/** Auto-increment counter for local engine folio numbers. */
let _nextReportId = 1;

/**
 * Reports received from Mobile and analysed by the local engine.
 * Temporary in-memory store (max 500). Cleared on server restart.
 * Replace with a persistent DB in a future iteration — no other code depends on this array.
 * @type {Array<Object>}
 */
const _storedReports = [];
const _STORED_REPORTS_MAX = 500;

/**
 * Pending HTTP requests awaiting a SafetyOps response.
 * Map<correlationId, { resolve, reject, timer }>
 */
const pendingRequests = new Map();

// ── CORS helper ───────────────────────────────────────────────────────────────

function getAllowedOrigin(requestOrigin) {
  if (!CORS_ORIGINS) return '*';                        // dev mode — allow all
  if (!requestOrigin) return CORS_ORIGINS[0] || '*';   // no Origin header
  const match = CORS_ORIGINS.find(o => o === requestOrigin);
  return match || '';                                   // empty → blocked
}

function corsHeaders(requestOrigin) {
  const origin = getAllowedOrigin(requestOrigin);
  const hdrs = {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
  // Only add Vary when we're doing per-origin access control.
  // Never set it to undefined — Node.js http throws ERR_HTTP_INVALID_HEADER_VALUE.
  if (CORS_ORIGINS) {
    hdrs['Vary'] = 'Origin';
  }
  return hdrs;
}

// ── Generic helpers ───────────────────────────────────────────────────────────

function sendJSON(res, status, body, reqOrigin) {
  const hdrs    = corsHeaders(reqOrigin);
  const payload = JSON.stringify(body);
  hdrs['Content-Length'] = Buffer.byteLength(payload);
  res.writeHead(status, hdrs);
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function isEngineConnected() {
  return engineSocket !== null && engineSocket.readyState === 1; /* OPEN */
}

function uptime() {
  return Math.floor((Date.now() - SERVER_START) / 1000);
}

// ── Route handlers ────────────────────────────────────────────────────────────

function handleHealth(res, origin) {
  sendJSON(res, 200, {
    status:    'ok',
    version:   API_VERSION,
    engine:    isEngineConnected() ? 'connected' : 'disconnected',
    uptime:    uptime(),
    timestamp: new Date().toISOString(),
  }, origin);
}

function handleGetReports(req, res, origin) {
  const urlObj  = new URL(req.url, 'http://localhost');
  const limit   = Math.min(parseInt(urlObj.searchParams.get('limit') || '100', 10), 500);
  const since   = urlObj.searchParams.get('since') || null; // ISO date e.g. 2026-08-01
  try {
    const rows = stmtSelectPage.all({ limit, since });
    sendJSON(res, 200, { ok: true, count: rows.length, reports: rows }, origin);
  } catch (err) {
    console.error('[DB] GET /api/v1/reports error:', err.message);
    sendJSON(res, 500, { error: 'db_error', message: err.message }, origin);
  }
}

function handleConfig(res, origin) {
  sendJSON(res, 200, {
    version:          API_VERSION,
    api_version:      'v1',
    areas:            AREAS,
    identidades:      IDENTIDADES,
    max_texto_length: MAX_TEXTO_LENGTH,
    engine_connected: isEngineConnected(),
  }, origin);
}

async function handlePostReport(req, res, origin) {
  const _t0 = Date.now(); // request-scoped timer — observability only
  const _fn = 'handlePostReport';
  TRACE( 1, 'POST /api/v1/reports received',   { fn: _fn, method: req.method, url: req.url, origin, elapsed: 0 });
  TRACE( 5, 'engineSocket state',               { fn: _fn, socketExists: !!engineSocket, readyState: engineSocket ? engineSocket.readyState : null, elapsed: Date.now() - _t0 });
  TRACE( 6, 'isEngineConnected()',              { fn: _fn, connected: isEngineConnected(), elapsed: Date.now() - _t0 });
  if (!USE_LOCAL_ENGINE && !isEngineConnected()) {
    TRACE( 6, 'ENGINE NOT CONNECTED — early return 503', { fn: _fn, reason: 'engineSocket null or readyState !== 1', elapsed: Date.now() - _t0 });
    return sendJSON(res, 503, {
      error:       'engine_unavailable',
      message:     'SafetyOps is not connected. Open SafetyOps_v2.html and try again.',
      retry_after: 5,
    }, origin);
  }

  let raw;
  try {
    raw = await readBody(req);
    TRACE( 2, 'Body received',                  { fn: _fn, byteLength: raw.length, elapsed: Date.now() - _t0 });
  } catch (err) {
    TRACE( 2, 'ERROR reading body — early return 400', { fn: _fn, reason: err.message, elapsed: Date.now() - _t0 });
    return sendJSON(res, 400, { error: 'read_error', message: 'Could not read request body.' }, origin);
  }

  let body;
  try {
    body = JSON.parse(raw);
    TRACE( 3, 'JSON parse OK',                  { fn: _fn, keys: Object.keys(body), textoLen: report.texto ? report.texto.length : 0, area: report.area, identidad: report.identidad, elapsed: Date.now() - _t0 });
  } catch (err) {
    TRACE( 3, 'ERROR JSON parse failed — early return 400', { fn: _fn, reason: err.message, rawSlice: raw.slice(0, 100), elapsed: Date.now() - _t0 });
    return sendJSON(res, 400, { error: 'invalid_json', message: 'Request body must be valid JSON.' }, origin);
  }

  // Normalize + validate (only hard rule: texto must not be empty)
  const normalized = normalizeReport(body);
  if (!normalized.ok) {
    TRACE( 4, 'VALIDATION FAILED — early return 400', { fn: _fn, reason: normalized.error, elapsed: Date.now() - _t0 });
    return sendJSON(res, 400, { error: 'validation_error', message: normalized.error }, origin);
  }
  const report = normalized.report;
  TRACE( 4, 'Validation OK (normalized)',        { fn: _fn, texto_len: report.texto.length, area: report.area, identidad: report.identidad, _pilot_defaults: true, elapsed: Date.now() - _t0 });

  // ── LOCAL ENGINE PATH ──────────────────────────────────────────────────────
  // Active when USE_LOCAL_ENGINE=true. Skips WebSocket entirely.
  if (USE_LOCAL_ENGINE && _engine) {
    const correlationId = crypto.randomUUID();
    TRACE( 7, 'correlationId generated (LOCAL)',  { fn: _fn, correlationId, elapsed: Date.now() - _t0 });
    try {
      const localResult = _engine.analyzeReport({
        texto:     report.texto,
        area:      report.area,
        identidad: report.identidad,
        lang:      report.lang,
        nextId:    _nextReportId++,
        timestamp: new Date().toISOString(),
        geo:       report.geo,
      });
      TRACE(14, 'LOCAL ENGINE — HTTP 200 sent',   { fn: _fn, correlationId, folio: localResult.folio, categoria: localResult.categoria, elapsed: Date.now() - _t0 });

      // ── Store + WS push to SafetyOps_v2 ────────────────────────────────────
      // Build occ object matching S.ocurrencias schema used by SafetyOps_v2.html
      const _ts = localResult.timestamp || new Date().toISOString();
      const _occ = {
        id:                  _nextReportId - 1,
        folio:               localResult.folio,
        fecha:               _ts.slice(0, 10),
        texto:               report.texto,
        categoria:           localResult.categoria,
        hazards:             localResult.hazards || [],
        severidad:           localResult.severidad,
        probabilidad:        localResult.probabilidad,
        nivel_riesgo:        localResult.nivel_riesgo,
        confianza:           localResult.confianza,
        requiere_validacion: localResult.requiere_validacion ? 1 : 0,
        estado:              'Reportada',
        area:                report.area,
        origen:              'Reporte Móvil',
        fase:                (localResult._ner && localResult._ner.fase) || '',
        matricula:           (localResult._ner && localResult._ner.matricula) || '',
        vuelo:               (localResult._ner && localResult._ner.vuelo) || '',
        _anonimo:            (!report.identidad || report.identidad === 'anonimo') ? true : undefined,
        _geo:                report.geo || undefined,
        _evidencias:         [],
        _fromMobile:         true,   // flag: came from SafetyOps Mobile via Railway
      };
      // Persist in memory (cap at max)
      _storedReports.unshift(_occ);
      if (_storedReports.length > _STORED_REPORTS_MAX) _storedReports.length = _STORED_REPORTS_MAX;
      // Persist to SQLite (Railway Volume)
      dbSaveReport(_occ);
      // Real-time push to SafetyOps_v2 if it is connected
      if (isEngineConnected()) {
        try {
          engineSocket.send(JSON.stringify({ type: 'new_report', data: _occ }));
          console.log('[push] new_report sent to SafetyOps_v2 — folio=' + _occ.folio);
        } catch (pushErr) {
          console.warn('[push] WS send failed:', pushErr.message);
        }
      }
      // ── END Store + WS push ─────────────────────────────────────────────────

      return sendJSON(res, 200, localResult, origin);
    } catch (err) {
      console.error('[engine] Local engine error:', err);
      return sendJSON(res, 500, { error: 'engine_error', message: err.message }, origin);
    }
  }
  // ── END LOCAL ENGINE PATH ──────────────────────────────────────────────────

  const correlationId = crypto.randomUUID();
  TRACE( 7, 'correlationId generated',           { fn: _fn, correlationId, elapsed: Date.now() - _t0 });
  const message = JSON.stringify({
    correlationId,
    type: 'report',
    payload: {
      texto:      report.texto,
      area:       report.area,
      identidad:  report.identidad,
      lang:       report.lang,
      usuario_id: body.usuario_id || null,
      geo:        report.geo,
      timestamp:  new Date().toISOString(),
    },
  });

  const timer = setTimeout(() => {
    if (pendingRequests.has(correlationId)) {
      pendingRequests.get(correlationId).reject(new Error('engine_timeout'));
      pendingRequests.delete(correlationId);
    }
  }, ENGINE_TIMEOUT);

  TRACE(11, 'Awaiting engine response',          { fn: _fn, correlationId, timeoutMs: ENGINE_TIMEOUT, elapsed: Date.now() - _t0 });
  await new Promise((resolve, reject) => {
    pendingRequests.set(correlationId, { resolve, reject, timer });
    TRACE( 8, 'pendingRequests entry created',   { fn: _fn, correlationId, pendingCount: pendingRequests.size, elapsed: Date.now() - _t0 });
    TRACE( 9, 'Sending report via WebSocket',    { fn: _fn, correlationId, messageLen: message.length, elapsed: Date.now() - _t0 });
    try {
      engineSocket.send(message);
      TRACE(10, 'engineSocket.send() OK — ball in engine court', { fn: _fn, correlationId, elapsed: Date.now() - _t0 });
    } catch (err) {
      TRACE(10, 'ERROR engineSocket.send() threw', { fn: _fn, correlationId, reason: err.message, elapsed: Date.now() - _t0 });
      clearTimeout(timer);
      pendingRequests.delete(correlationId);
      reject(err);
    }
  }).then(result => {
    TRACE(14, 'HTTP 200 sent to mobile',         { fn: _fn, correlationId, folio: result ? result.folio : null, categoria: result ? result.categoria : null, elapsed: Date.now() - _t0 });

    // ── COMPARE MODE ────────────────────────────────────────────────────────
    // Runs local engine alongside WS result; logs divergences. No effect on response.
    if (COMPARE_MODE && _engine && result) {
      try {
        const localResult = _engine.analyzeReport({
          texto:     report.texto,
          area:      report.area,
          identidad: report.identidad,
          lang:      report.lang,
          nextId:    _nextReportId++,
          timestamp: new Date().toISOString(),
          geo:       report.geo,
        });
        const match = localResult.categoria === result.categoria &&
                      localResult.nivel_riesgo === result.nivel_riesgo;
        console.log('[COMPARE] id=' + correlationId + ' match=' + match +
          ' WS={cat:' + result.categoria + ',riesgo:' + result.nivel_riesgo + '}' +
          ' LOCAL={cat:' + localResult.categoria + ',riesgo:' + localResult.nivel_riesgo + '}');
        if (!match) {
          console.warn('[COMPARE] DIVERGENCE:', JSON.stringify({
            ws:    { categoria: result.categoria,      nivel_riesgo: result.nivel_riesgo,      severidad: result.severidad,      probabilidad: result.probabilidad },
            local: { categoria: localResult.categoria, nivel_riesgo: localResult.nivel_riesgo, severidad: localResult.severidad, probabilidad: localResult.probabilidad },
          }));
        }
      } catch (err) {
        console.error('[COMPARE] Local engine error:', err.message);
      }
    }
    // ── END COMPARE MODE ─────────────────────────────────────────────────────

    sendJSON(res, 200, result, origin);
  }).catch(err => {
    if (err.message === 'engine_timeout') {
      TRACE(14, 'HTTP 503 engine_timeout sent',  { fn: _fn, correlationId, reason: 'no engine response within ENGINE_TIMEOUT', elapsed: Date.now() - _t0 });
      sendJSON(res, 503, {
        error:       'engine_timeout',
        message:     'SafetyOps did not respond in 30s. Try again.',
        retry_after: 10,
      }, origin);
    } else {
      TRACE(14, 'HTTP 503 engine_unavailable sent', { fn: _fn, correlationId, reason: err.message, elapsed: Date.now() - _t0 });
      console.error('[API] Error forwarding to engine:', err);
      sendJSON(res, 503, {
        error:       'engine_unavailable',
        message:     'Lost connection to SafetyOps while processing.',
        retry_after: 5,
      }, origin);
    }
  });
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  const origin = req.headers['origin'] || '';

  // CORS preflight
  if (method === 'OPTIONS') {
    const allowed = getAllowedOrigin(origin);
    if (CORS_ORIGINS && !allowed) {
      res.writeHead(403);
      res.end();
      return;
    }
    const hdrs = corsHeaders(origin);
    delete hdrs['Content-Type'];
    res.writeHead(204, hdrs);
    res.end();
    return;
  }

  console.log(`[API] ${method} ${url} origin=${origin || '(none)'}`);

  if (method === 'GET'  && url === '/api/v1/health')  return handleHealth(res, origin);
  if (method === 'GET'  && url === '/api/v1/config')  return handleConfig(res, origin);
  if (method === 'POST' && url === '/api/v1/reports') {
    if (!requireApiKey(req, res, origin)) return;
    return handlePostReport(req, res, origin);
  }
  if (method === 'GET'  && url.startsWith('/api/v1/reports')) {
    if (!requireApiKey(req, res, origin)) return;
    return handleGetReports(req, res, origin);
  }

  sendJSON(res, 404, { error: 'not_found', message: `No route: ${method} ${url}` }, origin);
});

// ── WebSocket Server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const remoteAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const origin     = req.headers['origin'] || remoteAddr;
  console.log(`[WS] New connection — origin: ${origin}`);

  // ── STEP 1: Authentication ─────────────────────────────────────────────────
  // If ENGINE_SECRET is set, the first message must be an auth message.
  // If not set, skip auth entirely (local dev mode).
  let authenticated = !ENGINE_SECRET; // true immediately when no secret required
  let authTimer = null;

  if (ENGINE_SECRET) {
    authTimer = setTimeout(() => {
      console.warn(`[WS] Auth timeout — closing unauthenticated connection from ${origin}`);
      ws.close(4001, 'Authentication timeout');
    }, ENGINE_AUTH_TIMEOUT);
  } else {
    // No secret configured — accept immediately as engine
    console.log('[WS] ENGINE_SECRET not set — accepting connection in local dev mode');
    registerEngine(ws, origin);
  }

  ws.on('message', raw => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.error('[WS] Non-JSON message — ignored');
      return;
    }

    // ── STEP 1: Handle auth message ──────────────────────────────────────────
    if (!authenticated) {
      if (msg.type === 'auth') {
        if (msg.secret === ENGINE_SECRET) {
          clearTimeout(authTimer);
          authenticated = true;
          console.log(`[WS] ✅ Engine authenticated — ${origin}`);
          registerEngine(ws, origin);
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        } else {
          console.warn(`[WS] ✗ Wrong secret from ${origin} — closing`);
          ws.close(4001, 'Invalid secret');
        }
      } else {
        console.warn('[WS] Message before auth — ignored');
      }
      return;
    }

    // ── STEP 3: Handle keepalive messages ────────────────────────────────────
    if (msg.type === 'ping') {
      try { ws.send(JSON.stringify({ type: 'pong' })); } catch(e) {}
      return;
    }
    if (msg.type === 'pong') {
      // Application-level pong — update liveness timestamp
      ws._lastPong = Date.now();
      return;
    }

    // ── Report result from SafetyOps ──────────────────────────────────────────
    const { correlationId, result, error } = msg;
    const _fn12 = 'wsMessageHandler';
    TRACE(12, 'WS result message received from engine', { fn: _fn12, correlationId, hasResult: !!result, hasError: !!error, folio: result ? result.folio : null });

    if (!correlationId) {
      console.warn('[WS] Message without correlationId — ignored:', JSON.stringify(msg).slice(0, 120));
      TRACE(12, 'WARN no correlationId — early return', { fn: _fn12, reason: 'missing correlationId in engine message', msgSlice: JSON.stringify(msg).slice(0, 80) });
      return;
    }

    const pending = pendingRequests.get(correlationId);
    if (!pending) {
      console.warn('[WS] No pending request for correlationId:', correlationId);
      TRACE(13, 'WARN no pending request — early return', { fn: _fn12, correlationId, reason: 'correlationId not in pendingRequests (timeout or duplicate)' });
      return;
    }

    clearTimeout(pending.timer);
    pendingRequests.delete(correlationId);
    TRACE(13, 'pendingRequests resolved — timer cleared', { fn: _fn12, correlationId, folio: result ? result.folio : null, pendingRemaining: pendingRequests.size });

    if (error) {
      TRACE(13, 'Resolving with ERROR from engine', { fn: _fn12, correlationId, reason: error });
      pending.reject(new Error(error));
    } else {
      TRACE(13, 'Resolving with SUCCESS from engine', { fn: _fn12, correlationId, folio: result ? result.folio : null, categoria: result ? result.categoria : null });
      pending.resolve(result);
    }
  });

  ws.on('pong', () => {
    // Protocol-level pong — browser responds automatically to ws.ping()
    ws._lastPong = Date.now();
  });

  ws.on('close', (code, reason) => {
    const reasonStr = reason ? reason.toString() : '';
    console.log(`[WS] Disconnected — code: ${code}${reasonStr ? ', reason: ' + reasonStr : ''}`);
    cleanup(ws);
  });

  ws.on('error', err => {
    console.error('[WS] Socket error:', err.message);
  });
});

// ── STEP 3: Engine registration with keepalive ────────────────────────────────

function registerEngine(ws, origin) {
  // Close any stale previous engine connection
  if (engineSocket && engineSocket !== ws) {
    console.warn('[WS] Replacing stale engine connection');
    engineSocket.terminate();
  }
  engineSocket = ws;
  ws._lastPong = Date.now();

  console.log(`[WS] ✅ SafetyOps engine registered — ${origin}`);

  // Send any reports that arrived while SafetyOps_v2 was not connected
  if (_storedReports.length > 0) {
    try {
      ws.send(JSON.stringify({ type: 'stored_reports', data: _storedReports }));
      console.log('[push] stored_reports sent — count=' + _storedReports.length);
    } catch (e) {
      console.warn('[push] Could not send stored_reports:', e.message);
    }
  }

  // Protocol-level ping (browser responds with pong frame automatically)
  // Application-level ping (SafetyOps JS responds with {"type":"pong"})
  const pingTimer = setInterval(() => {
    if (!ws || ws.readyState !== 1 /* OPEN */) {
      clearInterval(pingTimer);
      return;
    }
    // Check for stale connection
    const silence = Date.now() - (ws._lastPong || Date.now());
    if (silence > PONG_TIMEOUT) {
      console.warn(`[WS] Engine silent for ${Math.round(silence / 1000)}s — closing stale connection`);
      clearInterval(pingTimer);
      ws.terminate();
      return;
    }
    // Send both protocol-level and application-level pings
    try { ws.ping(); } catch(e) {}
    try { ws.send(JSON.stringify({ type: 'ping' })); } catch(e) {}
    console.log(`[WS] Ping sent — engine last pong ${Math.round(silence / 1000)}s ago`);
  }, PING_INTERVAL);

  ws._pingTimer = pingTimer;
}

function cleanup(ws) {
  if (ws._pingTimer) clearInterval(ws._pingTimer);
  if (engineSocket === ws) engineSocket = null;

  // Reject all pending requests waiting on this engine
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timer);
    pending.reject(new Error('engine_disconnected'));
    pendingRequests.delete(id);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[API] SafetyOps API Server v${API_VERSION}`);
  console.log(`[API] Listening on http://localhost:${PORT}`);
  console.log(`[API] ENGINE_SECRET: ${ENGINE_SECRET ? '✅ set (' + ENGINE_SECRET.length + ' chars)' : '⚠  not set (local dev mode — all engine connections accepted)'}`);
  console.log(`[API] CORS_ORIGIN:   ${CORS_ORIGIN_RAW}`);
  console.log(`[API] Keepalive:     ping every ${PING_INTERVAL / 1000}s, timeout at ${PONG_TIMEOUT / 1000}s`);
  console.log('[API] Routes: GET /api/v1/health  GET /api/v1/config  POST /api/v1/reports');
  console.log('[API] Open SafetyOps_v2.html in a browser to activate the engine.');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[API] Port ${PORT} already in use. Set PORT env var to use a different port.`);
  } else {
    console.error('[API] Server error:', err);
  }
  process.exit(1);
});
