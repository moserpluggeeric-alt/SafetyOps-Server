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
const { WebSocketServer } = require('ws');

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

// ── State ─────────────────────────────────────────────────────────────────────

/** The single authenticated WebSocket from SafetyOps_v2.html. */
let engineSocket = null;

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
  if (!isEngineConnected()) {
    return sendJSON(res, 503, {
      error:       'engine_unavailable',
      message:     'SafetyOps is not connected. Open SafetyOps_v2.html and try again.',
      retry_after: 5,
    }, origin);
  }

  let raw;
  try {
    raw = await readBody(req);
  } catch {
    return sendJSON(res, 400, { error: 'read_error', message: 'Could not read request body.' }, origin);
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return sendJSON(res, 400, { error: 'invalid_json', message: 'Request body must be valid JSON.' }, origin);
  }

  // Validate
  const errors = [];
  if (typeof body.texto !== 'string' || body.texto.trim().length < 10) {
    errors.push('texto must be at least 10 characters');
  }
  if (body.texto && body.texto.length > MAX_TEXTO_LENGTH) {
    errors.push(`texto must not exceed ${MAX_TEXTO_LENGTH} characters`);
  }
  if (!body.area || !AREAS.includes(body.area)) {
    errors.push(`area is required and must be one of: ${AREAS.join(', ')}`);
  }
  if (body.identidad && !IDENTIDADES.includes(body.identidad)) {
    errors.push(`identidad must be one of: ${IDENTIDADES.join(', ')}`);
  }
  if (errors.length > 0) {
    return sendJSON(res, 400, { error: 'validation_error', fields: errors }, origin);
  }

  const correlationId = crypto.randomUUID();
  const message = JSON.stringify({
    correlationId,
    type: 'report',
    payload: {
      texto:      body.texto.trim(),
      area:       body.area,
      identidad:  body.identidad || 'anonimo',
      usuario_id: body.usuario_id || null,
      geo:        body.geo || null,
      timestamp:  new Date().toISOString(),
    },
  });

  const timer = setTimeout(() => {
    if (pendingRequests.has(correlationId)) {
      pendingRequests.get(correlationId).reject(new Error('engine_timeout'));
      pendingRequests.delete(correlationId);
    }
  }, ENGINE_TIMEOUT);

  await new Promise((resolve, reject) => {
    pendingRequests.set(correlationId, { resolve, reject, timer });
    try {
      engineSocket.send(message);
    } catch (err) {
      clearTimeout(timer);
      pendingRequests.delete(correlationId);
      reject(err);
    }
  }).then(result => {
    sendJSON(res, 200, result, origin);
  }).catch(err => {
    if (err.message === 'engine_timeout') {
      sendJSON(res, 503, {
        error:       'engine_timeout',
        message:     'SafetyOps did not respond in 30s. Try again.',
        retry_after: 10,
      }, origin);
    } else {
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
  if (method === 'POST' && url === '/api/v1/reports') return handlePostReport(req, res, origin);

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

    if (!correlationId) {
      console.warn('[WS] Message without correlationId — ignored:', JSON.stringify(msg).slice(0, 120));
      return;
    }

    const pending = pendingRequests.get(correlationId);
    if (!pending) {
      console.warn('[WS] No pending request for correlationId:', correlationId);
      return;
    }

    clearTimeout(pending.timer);
    pendingRequests.delete(correlationId);

    if (error) {
      pending.reject(new Error(error));
    } else {
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
