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

// ── Gemini Shadow client (Sprint 1) ─────────────────────────────────────────
// NO modificar gemini-client.js — se consume su API pública solamente.
const {
  isGeminiEnabled,
  isShadowMode,
  getModel,
  buildStructuredContext,
  geminiClassify,
} = require('./gemini-client');

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

let sqlite3Mod;
try {
  sqlite3Mod = require('sqlite3').verbose();
} catch (e) {
  console.error('[DB] FATAL: sqlite3 not found. Run: npm install sqlite3');
  process.exit(1);
}

const db = new sqlite3Mod.Database(DB_PATH, (err) => {
  if (err) { console.error('[DB] Open error:', err.message); process.exit(1); }
  console.log('[DB] SQLite ready at ' + DB_PATH);
});

// WAL mode + schema — serialized so schema runs after pragmas
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS reports (
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
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_reports_timestamp ON reports(timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reports_folio     ON reports(folio)');
  db.run('CREATE INDEX IF NOT EXISTS idx_reports_category  ON reports(category)');

  // ── TODO Sprint 3: tabla users ──────────────────────────────────────────
  // Esqueleto preparado. Descomentar cuando se active el sistema de auth.
  // bcrypt debe instalarse: npm install bcryptjs
  /*
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id    INTEGER NOT NULL DEFAULT 1,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'operador',
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    last_login    TEXT,
    last_activity TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_users_username   ON users(username)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id)');

  // Roles disponibles: 'admin' | 'supervisor' | 'operador' | 'observador'
  // Seed: usuario admin inicial (cambiar contraseña antes de activar en prod)
  // const bcrypt = require('bcryptjs');
  // const adminHash = bcrypt.hashSync('SafetyOps2025!', 10);
  // db.run(`INSERT OR IGNORE INTO users (username, password_hash, role)
  //         VALUES ('admin', ?, 'admin')`, [adminHash]);
  */
  // ── Fin skeleton users ──────────────────────────────────────────────────

  // ── demo_tokens — per-company tokens for /api/v1/ingest ──────────────────────
  // token_hash: SHA-256 hex of the plaintext token (never stored in plaintext)
  // status: 'ACTIVO' | 'REVOCADO' | 'EXPIRADO'
  // expires_at: ISO-8601 date string or NULL (no expiry)
  db.run(`CREATE TABLE IF NOT EXISTS demo_tokens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash   TEXT    NOT NULL UNIQUE,
    label        TEXT    NOT NULL,
    status       TEXT    NOT NULL DEFAULT 'ACTIVO',
    expires_at   TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
  )`);
  db.run('CREATE INDEX IF NOT EXISTS idx_demo_tokens_hash   ON demo_tokens(token_hash)');
  db.run('CREATE INDEX IF NOT EXISTS idx_demo_tokens_status ON demo_tokens(status)');

  // ── Initialize _nextReportId from DB max so folios survive server restarts ──
  db.get('SELECT MAX(id) AS maxId FROM reports', function(err, row) {
    if (!err && row && row.maxId) {
      _nextReportId = row.maxId + 1;
      console.log('[DB] _nextReportId initialized to ' + _nextReportId + ' from existing records');
    }
  });
});

/** Persist one report — fire and forget, errors logged only. */
function dbSaveReport(occ) {
  const sql = `INSERT INTO reports
    (folio, timestamp, airport, sector, title, description,
     risk, severity, probability, category, status, source, raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [
    occ.folio        || '',
    occ.fecha        ? occ.fecha + 'T00:00:00Z' : new Date().toISOString(),
    occ.aeropuerto   || null,
    occ.sector       || null,
    occ.titulo       || null,
    occ.texto        || '',
    occ.nivel_riesgo || null,
    occ.severidad    || null,
    occ.probabilidad || null,
    occ.categoria    || null,
    occ.estado       || 'Reportada',
    occ._fromMobile  ? 'mobile' : 'web',
    JSON.stringify(occ),
  ];
  db.run(sql, params, function(err) {
    if (err) console.error('[DB] Insert error:', err.message);
    else console.log('[DB] Saved report folio=' + occ.folio + ' id=' + this.lastID);
  });
}

// ── Demo Token helpers ────────────────────────────────────────────────────────
// Token hashing — SHA-256, never log or store plaintext.
function _hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Validate ISO-8601 date string (YYYY-MM-DD or full datetime). null/undefined → valid (no expiry).
function _isValidISODate(s) {
  if (s === null || s === undefined) return true;
  return typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/.test(s) &&
    !isNaN(Date.parse(s));
}

// Validate a demo token against the DB. Calls cb({ ok, id?, label?, reason? }).
// Auto-updates status to 'EXPIRADO' if expires_at is in the past.
// Never logs the token plaintext.
function _validateDemoToken(token, cb) {
  const hash = _hashToken(token);
  db.get(
    `SELECT id, label, status, expires_at FROM demo_tokens WHERE token_hash = ?`,
    [hash],
    function(err, row) {
      if (err || !row) return cb({ ok: false, reason: 'not_found' });
      if (row.expires_at && row.expires_at < new Date().toISOString()) {
        db.run(`UPDATE demo_tokens SET status='EXPIRADO' WHERE id=?`, [row.id]);
        return cb({ ok: false, reason: 'demo_expired', label: row.label });
      }
      if (row.status !== 'ACTIVO') {
        const reason = row.status === 'REVOCADO' ? 'demo_access_revoked' : 'demo_expired';
        return cb({ ok: false, reason, label: row.label });
      }
      db.run(`UPDATE demo_tokens SET last_used_at=datetime('now') WHERE id=?`, [row.id]);
      return cb({ ok: true, id: row.id, label: row.label });
    }
  );
}

// ── MEJORA 7: Aviation Context Validation Layer ───────────────────────────────
// Runs server-side after MEJORA 6. Decides whether to auto-accept the
// classification or route to human review (categoria=null, status='Revisión requerida').
//
// Rules (ordered):
//   R1 ANCHOR     — any anchor fired → auto-accept (unambiguous signal)
//   R2 STRONG_LEX — kwHits+adrepHits ≥ 2 AND conf ≥ 0.55
//   R3 CTX_LEX    — ctxStrict AND kw+adrep ≥ 1 AND mom ≥ 0.10 AND conf ≥ 0.50
//                   AND NOT FH_guard (Factores Humanos with <2 hits is NB default)
//   R4 HIGH_CONF  — conf ≥ 0.65 AND mom ≥ 0.12 AND NOT FH_guard
//   ELSE          → REVISIÓN REQUERIDA
const _M7_AV_STRICT = [
  'aeronave','aeronaves','vuelo','vuelos','aeropuerto','piloto','pilotos',
  'aterrizaje','despegue','cabina','tripulacion','tripulaciones',
  'pista','runway','aircraft','flight','atc','fir','tma','aerodromo',
  'torre de control','approach','cockpit','copiloto','comandante',
  'aerovia','apron','taxeo','rodaje'
];
function _normM7(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function simulateMejora7Server(classifyResult, texto) {
  if (!classifyResult) return { autoAccept: false, rule: 'NULL_RESULT' };
  if (classifyResult._noClasificable) return { autoAccept: false, rule: 'NO_CLASIF' };

  const trazas = classifyResult._trazas || [];
  const cat    = classifyResult.categoria;
  const conf   = classifyResult.confianza || 0;
  const scores = classifyResult._scoreDetalle || {};
  const total  = Object.values(scores).reduce((s, v) => s + v, 0);
  const top1   = scores[cat] || 0;
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top2sc = sorted[1] ? sorted[1][1] : 0;
  const mom    = total > 0 ? (top1 - top2sc) / total : 0;

  const anyAnchor = trazas.some(tr => tr.capa === 'ANCHOR');
  const kwHits    = trazas.filter(tr => tr.capa === 'KW'    && tr.categoria === cat).length;
  const adrepHits = trazas.filter(tr => tr.capa === 'ADREP' && tr.categoria === cat).length;
  const t = _normM7(texto);
  const ctxStrict = _M7_AV_STRICT.some(w => t.includes(w));

  // FH guard: Factores Humanos with <2 KW/ADREP hits is the NB default winner —
  // never auto-accept via R3/R4 without solid lexical support.
  const fhGuard = (cat === 'Factores Humanos' && kwHits + adrepHits < 2);

  if (anyAnchor)                                                                return { autoAccept: true,  rule: 'R1_ANCHOR',    cat, conf, mom, kwHits, adrepHits };
  if (kwHits + adrepHits >= 2 && conf >= 0.55)                                  return { autoAccept: true,  rule: 'R2_STRONG_LEX',cat, conf, mom, kwHits, adrepHits };
  if (!fhGuard && ctxStrict && kwHits + adrepHits >= 1 && mom >= 0.10 && conf >= 0.50) return { autoAccept: true, rule: 'R3_CTX_LEX', cat, conf, mom, kwHits, adrepHits };
  if (!fhGuard && conf >= 0.65 && mom >= 0.12)                                  return { autoAccept: true,  rule: 'R4_HIGH_CONF', cat, conf, mom, kwHits, adrepHits };
  return { autoAccept: false, rule: 'REVISIÓN', cat, conf, mom, kwHits, adrepHits };
}

// ── Shared MEJORA 6 + MEJORA 7 classification ─────────────────────────────────
// Called by both /ingest and /sync. Mutates occ in place and returns metadata.
// Returns { applied: bool, rule: string, revisarManualmente: bool }
// Never throws — all errors are non-blocking (logged + applied=false returned).
function _applyServerClassification(texto, occ, lang) {
  if (!_engine) return { applied: false, rule: 'NO_ENGINE' };
  const _catBrowser = occ.categoria || null;
  try {
    const { clasificarV2 } = require('./analysis-engine/classifier-v2');  // Edit A — Phase 2 activation prep
    const classifyResult  = clasificarV2(texto, lang || 'es');
    if (!classifyResult)  return { applied: false, rule: 'NO_RESULT' };

    const m6Rev = classifyResult._revisarManualmente;
    const m7    = simulateMejora7Server(classifyResult, texto);

    if (m6Rev || !m7.autoAccept) {
      // MEJORA 6 or MEJORA 7: route to human review
      occ.categoria              = null;
      occ.estado                 = 'Revisión requerida';
      occ._categoria_browser     = _catBrowser;
      occ._m6_revisarManualmente = m6Rev;
      occ._m7_rule               = m7.rule;
      occ._m7_conf               = classifyResult.confianza;
      occ._m7_sugerencia         = classifyResult.categoria;
      occ._clasificadoPor        = 'server:revision';
    } else {
      // MEJORA 7 auto-accepts: Railway is the authority
      occ.categoria          = classifyResult.categoria;
      occ._categoria_browser = _catBrowser;
      occ._m7_rule           = m7.rule;
      occ._m7_conf           = classifyResult.confianza;
      occ._clasificadoPor    = 'server:m7:' + m7.rule;
    }
    return { applied: true, rule: m7.rule, revisarManualmente: m6Rev || !m7.autoAccept, classifyResult };
  } catch (err) {
    console.warn('[classify] non-blocking error:', err.message);
    return { applied: false, rule: 'EXCEPTION' };
  }
}

// ── Gemini Shadow Observer (Sprint 1) ────────────────────────────────────────
// Firma: _runGeminiShadow(texto, classifyResult, finalResult)
//
//   classifyResult — output RAW de clasificarV2(). Alimenta buildStructuredContext().
//                    Contiene _trazas, _scoreDetalle, _lexiconV2, etc.
//                    NUNCA se usa para la comparación.
//
//   finalResult    — snapshot inmutable de occ DESPUÉS de que SafetyOps aplicó
//                    MEJORA 6 + MEJORA 7. Contiene la decisión real del sistema:
//                    categoria (null si Revisión requerida), estado, _m7_sugerencia,
//                    _m7_rule, _m7_conf. NUNCA se modifica aquí.
//
// Reglas absolutas:
//   - Nunca modifica occ ni ningún campo del reporte.
//   - Nunca bloquea la respuesta HTTP (fire-and-forget).
//   - Nunca lanza excepciones al caller.
//   - Nunca persiste nada.
//   - Inactivo hoy: isGeminiEnabled() = false porque GEMINI_ENABLED no está en Railway.
function _runGeminiShadow(texto, classifyResult, finalResult) {
  if (!isGeminiEnabled()) return;
  if (!isShadowMode())    return;

  // classifyResult alimenta el contexto estructurado (RAW V2)
  const ctx = buildStructuredContext(classifyResult, texto);

  Promise.resolve()
    .then(() => geminiClassify(ctx))
    .then(geminiResult => {
      if (!geminiResult) return;

      const model = getModel();

      // Decisión final real de SafetyOps (post-MEJORA 6 / MEJORA 7)
      const categFinal  = finalResult ? (finalResult.categoria      || null) : null;
      const estadoFinal = finalResult ? (finalResult.estado         || '—')  : '—';
      const catSugerida = finalResult ? (finalResult._m7_sugerencia || null) : null;
      const m7Rule      = finalResult ? (finalResult._m7_rule       || '—')  : '—';
      const m7Conf      = finalResult ? (finalResult._m7_conf != null
                            ? (finalResult._m7_conf * 100).toFixed(1) + '%'
                            : '—') : '—';

      const categGemini = geminiResult.categoria || null;

      // match_categoria compara contra la categoría que SafetyOps REALMENTE
      // aceptó. Si quedó en Revisión requerida (categFinal=null), nunca hay match.
      const matchCat = categFinal !== null && categFinal === categGemini;

      console.log(
        '[gemini-shadow]'                                                               +
        '\n  modelo='                    + model                                        +
        '\n  categoria_final_safetyops=' + (categFinal  || 'null — Revisión requerida') +
        '\n  categoria_sugerida='        + (catSugerida || '—')                        +
        '\n  estado_final='              + estadoFinal                                  +
        '\n  m7_rule='                   + m7Rule                                       +
        '\n  m7_conf='                   + m7Conf                                       +
        '\n  categoria_gemini='          + (categGemini || '—')                        +
        '\n  match_categoria='           + matchCat
      );

      const diffs = [];
      if (!matchCat) {
        diffs.push(
          '  categoria: safetyops_final="' + (categFinal || 'null') +
          '" sugerida="'  + (catSugerida || '—') +
          '" gemini="'    + (categGemini || '—') + '"'
        );
      }
      if (diffs.length > 0) {
        console.warn('[gemini-shadow][DIFF]\n' + diffs.join('\n'));
      }

      // ── Risk Adapter (Phase 3) ───────────────────────────────────────────
      // Deriva riesgo de la salida de Gemini. NO modifica occ en ningún caso.
      // Shadow Mode: solo logging. Post-Phase 4: escribirá a occ (autorización separada).
      const riskGemini = _deriveRisk(
        geminiResult.categoria,
        geminiResult.flags_seguridad,
        geminiResult.confianza,
        geminiResult.requiere_revision
      );

      // ── [gemini-risk-compare] ────────────────────────────────────────────
      // Compara categoria_safetyops con categoria_gemini y risk_gemini.
      // risk_actual (Groq) no está disponible aquí — mejora posterior (Phase 4+).
      console.log(
        '[gemini-risk-compare]'                                                              +
        '\n  [SAFETYOPS/LOCAL]'                                                              +
        '\n    categoria_safetyops='     + (categFinal || 'null — Revisión requerida')       +
        '\n    estado='                  + estadoFinal                                        +
        '\n  [GEMINI]'                                                                        +
        '\n    categoria_gemini='        + (categGemini || '—')                              +
        '\n    confianza='               + (geminiResult.confianza * 100).toFixed(0) + '%'   +
        '\n    flags='                   + (geminiResult.flags_seguridad.join(',') || '—')   +
        '\n    requiere_revision_gemini=' + geminiResult.requiere_revision                    +
        '\n  [RISK GEMINI — adapter]'                                                        +
        '\n    derived_severidad='       + (riskGemini.severidad    || 'null')               +
        '\n    derived_probabilidad='    + (riskGemini.probabilidad || 'null')               +
        '\n    derived_nivel_riesgo='    + (riskGemini.nivel_riesgo || 'null')               +
        '\n    derived_revisa='          + riskGemini._revisarManualmente                    +
        '\n    risk_source='             + riskGemini._riskSource                            +
        '\n  [DIFFS]'                                                                         +
        '\n    match_categoria='         + matchCat
      );
    })
    .catch(err => {
      console.warn('[gemini-shadow][ERROR]', err.message);
    });
}

// ── Risk Adapter — Sprint 2A Phase 3 ─────────────────────────────────────────
// _deriveRisk() transforma la salida validada de Gemini en campos de riesgo.
//
// CONTRATO:
//   Input:  categoria (string), flagsSeguridad (string[]), confianza (number 0-1),
//           requiereRevision (boolean)
//   Output: { severidad, probabilidad, nivel_riesgo, _revisarManualmente, _riskSource }
//
// REGLAS ABSOLUTAS:
//   - Pure function: mismo input → mismo output, sin side effects, sin API calls.
//   - NO modifica occ. En Shadow Mode: resultado va únicamente a logs.
//   - confianza NUNCA modifica severidad, probabilidad ni nivel_riesgo.
//   - Los flags solo pueden ELEVAR la severidad, nunca bajarla.
//   - _revisarManualmente solo puede activarse (OR), nunca desactivarse.
//   - Categoría desconocida → { severidad:null, probabilidad:null, nivel_riesgo:null,
//     _revisarManualmente:true, _riskSource:'UNKNOWN_CATEGORY:MANUAL_REVIEW' }.
//
// FUENTE: documento de diseño Sprint 2A v2, aprobado.
// Risk Adapter MVP — valores provisionales. Requieren validación con experto SMS
// y dataset histórico antes de convertirse en política operacional definitiva.

// ── Severidad base y probabilidad default por categoría (29 ICAO) ─────────────
// [DD] = Decisión de Diseño MVP provisional
// [SUP] = Supuesto pendiente de validación con datos históricos
// [ICAO] = Compatible con estructura ICAO Anexo 19 / SMS Doc 9859
const RISK_TABLE = {
  'TCAS RA':               { severidadBase: 'Crítico',        probabilidadDefault: 'Remoto' },       // [DD]
  'Bird Strike':           { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [DD]
  'Runway Excursion':      { severidadBase: 'Catastrófico',   probabilidadDefault: 'Remoto' },       // [DD]
  'Unstable Approach':     { severidadBase: 'Crítico',        probabilidadDefault: 'Remoto' },       // [DD]
  'Hard Landing':          { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
  'GPWS':                  { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [DD]
  'Turbulencia':           { severidadBase: 'Insignificante', probabilidadDefault: 'Remoto' },       // [SUP]
  'Meteorología Adversa':  { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [DD]
  'Mercancías Peligrosas': { severidadBase: 'Crítico',        probabilidadDefault: 'Remoto' },       // [DD]
  'Incidencia ATC':        { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
  'Incendio':              { severidadBase: 'Catastrófico',   probabilidadDefault: 'Remoto' },       // [DD]
  'Estela Turbulenta':     { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
  'Iluminación Láser':     { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
  'Fatiga de Tripulación': { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
  'Error de Navegación':   { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
  'Ground Damage':         { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [DD]
  'Incursión de Pista':    { severidadBase: 'Crítico',        probabilidadDefault: 'Remoto' },       // [DD]
  'Factores Humanos':      { severidadBase: 'Insignificante', probabilidadDefault: 'Remoto' },       // [SUP]
  // NOTA MVP: 'Falla Técnica' → Marginal es provisional. La categoría es demasiado
  // amplia para una sola severidad (incluye desde fallas menores hasta motores).
  // Deberá mejorarse mediante flags / subcategorías antes de política definitiva.
  'Falla Técnica':         { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [DD] — ver nota
  'Seguridad Aeroportuaria': { severidadBase: 'Marginal',     probabilidadDefault: 'Remoto' },       // [DD]
  'Interferencia Ilícita': { severidadBase: 'Catastrófico',   probabilidadDefault: 'Improbable' },   // [DD]
  'Demora Operacional':    { severidadBase: 'Insignificante', probabilidadDefault: 'Remoto' },       // [ICAO-compatible]
  'CFIT':                  { severidadBase: 'Catastrófico',   probabilidadDefault: 'Improbable' },   // [DD]
  'Emergencia Médica':     { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
  'Smoke / Humo a Bordo':  { severidadBase: 'Crítico',        probabilidadDefault: 'Remoto' },       // [DD]
  'Pérdida de Control':    { severidadBase: 'Catastrófico',   probabilidadDefault: 'Improbable' },   // [DD]
  'Presurización':         { severidadBase: 'Crítico',        probabilidadDefault: 'Remoto' },       // [DD]
  'Fuel / Combustible':    { severidadBase: 'Crítico',        probabilidadDefault: 'Remoto' },       // [DD]
  'FOD':                   { severidadBase: 'Marginal',       probabilidadDefault: 'Remoto' },       // [SUP]
};

// ── Elevación de severidad mínima por flag ─────────────────────────────────────
// Fuente: SAFETY_FLAG_IDS de gemini-schema.js — exactamente los 8 IDs reales.
// Los flags solo pueden ELEVAR la severidad, nunca bajarla.
// FIREARM y UNLAWFUL_INTERFERENCE son reglas SafetyOps/lexicon propagadas,
// no inferencias estadísticas de Gemini.
const FLAG_ELEVATION = {
  'FIREARM':               'Catastrófico',  // [REG] Priority 100 SafetyOps/lexicon
  'FIRE':                  'Catastrófico',  // [REG] Safety-critical
  'SMOKE':                 'Crítico',       // [REG] Safety-critical — mínimo Crítico
  'ENGINE_FAILURE':        'Crítico',       // [REG] Safety-critical — mínimo Crítico
  'FUEL_EMERGENCY':        'Catastrófico',  // [REG] Emergencia de combustible
  'DANGEROUS_GOODS':       'Crítico',       // [DD]  Mercancías peligrosas — mínimo Crítico
  'DEPRESSURIZATION':      'Crítico',       // [DD]  Presurización — mínimo Crítico
  'UNLAWFUL_INTERFERENCE': 'Catastrófico',  // [REG] Alta prioridad SafetyOps/lexicon
};

// ── Flags que fuerzan _revisarManualmente = true independientemente del riesgo ──
const FLAG_REVISION = new Set(['FIREARM', 'UNLAWFUL_INTERFERENCE']);
// PENDIENTE DE VALIDACIÓN SMS:
// Evaluar si 'DEPRESSURIZATION' debe pertenecer a FLAG_REVISION y por lo tanto
// forzar revisión manual independientemente de confianza y de si hubo elevación
// efectiva de severidad. Actualmente DEPRESSURIZATION solo garantiza severidad
// mínima Crítico (vía FLAG_ELEVATION) pero no activa _revisarManualmente por sí
// solo cuando la categoría base ya es Crítico o superior y Gemini no solicitó
// revisión. Decisión pospuesta hasta validación con experto SMS y dataset histórico.

// ── Matriz ICAO: severidad × probabilidad → nivel_riesgo ──────────────────────
// Fuente: ICAO Anexo 19 / SMS Doc 9859.
// Modificación aprobada Sprint 2A: Catastrófico + Remoto → 'Crítico' (vs. 'Alto'
// en versiones anteriores del documento). Prioridad: evitar subestimación.
const ICAO_MATRIX = {
  'Catastrófico:Frecuente':                   'Crítico', // [ICAO]
  'Catastrófico:Probable':                    'Crítico', // [ICAO]
  'Catastrófico:Remoto':                      'Crítico', // [ICAO + DD aprobado Sprint 2A]
  'Catastrófico:Improbable':                  'Alto',    // [ICAO]
  'Catastrófico:Extremadamente Improbable':   'Medio',   // [ICAO]
  'Crítico:Frecuente':                        'Crítico', // [ICAO]
  'Crítico:Probable':                         'Alto',    // [ICAO]
  'Crítico:Remoto':                           'Alto',    // [ICAO]
  'Crítico:Improbable':                       'Medio',   // [ICAO]
  'Crítico:Extremadamente Improbable':        'Bajo',    // [ICAO]
  'Marginal:Frecuente':                       'Alto',    // [ICAO]
  'Marginal:Probable':                        'Alto',    // [ICAO]
  'Marginal:Remoto':                          'Medio',   // [ICAO]
  'Marginal:Improbable':                      'Bajo',    // [ICAO]
  'Marginal:Extremadamente Improbable':       'Bajo',    // [ICAO]
  'Insignificante:Frecuente':                 'Medio',   // [ICAO]
  'Insignificante:Probable':                  'Bajo',    // [ICAO]
  'Insignificante:Remoto':                    'Bajo',    // [ICAO]
  'Insignificante:Improbable':                'Bajo',    // [ICAO]
  'Insignificante:Extremadamente Improbable': 'Bajo',    // [ICAO]
};

// ── Helpers de comparación de escala ──────────────────────────────────────────
// Orden de severidad: índice menor = mayor gravedad
const _SEV_ORDER  = ['Catastrófico', 'Crítico', 'Marginal', 'Insignificante'];
// Orden de probabilidad: índice menor = mayor frecuencia
const _PROB_ORDER = ['Frecuente', 'Probable', 'Remoto', 'Improbable', 'Extremadamente Improbable'];

/** Retorna la severidad más grave de las dos. */
function _sevMax(a, b) {
  const ia = _SEV_ORDER.indexOf(a);
  const ib = _SEV_ORDER.indexOf(b);
  if (ia === -1) return b;
  if (ib === -1) return a;
  return ia <= ib ? a : b;
}

/** Retorna la probabilidad más frecuente de las dos. */
function _probMax(a, b) {
  const ia = _PROB_ORDER.indexOf(a);
  const ib = _PROB_ORDER.indexOf(b);
  if (ia === -1) return b;
  if (ib === -1) return a;
  return ia <= ib ? a : b;
}

/**
 * _deriveRisk — Risk Adapter para la salida validada de Gemini.
 *
 * Pure function. No modifica occ. No llama APIs. Sin side effects.
 * En Shadow Mode: resultado va únicamente a logs.
 * Post-Phase 4 (requiere autorización separada): enriquecerá occ.
 *
 * @param {string}   categoria        geminiResult.categoria  (29-cat ICAO)
 * @param {string[]} flagsSeguridad   geminiResult.flags_seguridad
 * @param {number}   confianza        geminiResult.confianza  (0–1)
 * @param {boolean}  requiereRevision geminiResult.requiere_revision
 * @returns {{ severidad, probabilidad, nivel_riesgo, _revisarManualmente, _riskSource }}
 */
function _deriveRisk(categoria, flagsSeguridad, confianza, requiereRevision) {
  const flags = Array.isArray(flagsSeguridad) ? flagsSeguridad : [];

  // ── Categoría desconocida — safe default ────────────────────────────────
  const base = RISK_TABLE[categoria];
  if (!base) {
    return {
      severidad:           null,
      probabilidad:        null,
      nivel_riesgo:        null,
      _revisarManualmente: true,
      _riskSource:         'UNKNOWN_CATEGORY:MANUAL_REVIEW',
    };
  }

  // ── Paso 1: Severidad ────────────────────────────────────────────────────
  // Base de categoría elevada por flags. Solo puede subir, nunca bajar.
  // La confianza NO participa aquí.
  let severidadFinal = base.severidadBase;
  let flagElevated   = false;

  for (const flag of flags) {
    const sevMinima = FLAG_ELEVATION[flag];
    if (sevMinima) {
      const elevated = _sevMax(severidadFinal, sevMinima);
      if (elevated !== severidadFinal) flagElevated = true;
      severidadFinal = elevated;
    }
  }

  // ── Paso 2: Probabilidad ─────────────────────────────────────────────────
  // Default de la categoría, elevado por combos flag+categoría aprobados.
  // FIRE + Incendio/Smoke → Probable. FUEL_EMERGENCY + Fuel → Probable.
  // [DD] Provisional — pendiente validación con datos históricos.
  let probabilidadFinal = base.probabilidadDefault;

  if (flags.includes('FIRE') &&
      (categoria === 'Incendio' || categoria === 'Smoke / Humo a Bordo')) {
    probabilidadFinal = _probMax(probabilidadFinal, 'Probable');
  }
  if (flags.includes('FUEL_EMERGENCY') && categoria === 'Fuel / Combustible') {
    probabilidadFinal = _probMax(probabilidadFinal, 'Probable');
  }

  // ── Paso 3: nivel_riesgo — matriz ICAO ──────────────────────────────────
  const nivelRiesgo = ICAO_MATRIX[severidadFinal + ':' + probabilidadFinal] || null;

  // ── Paso 4: _revisarManualmente ─────────────────────────────────────────
  // Solo puede activarse (OR). Nunca puede limpiarse.
  // confianza < 0.65 activa revisión pero NO modifica riesgo.
  // [SUP] Umbral 0.65 provisional — calibrar con datos de Railway.
  const hasFlagRevision = flags.some(f => FLAG_REVISION.has(f));
  const confianzaBaja   = typeof confianza === 'number' && confianza < 0.65;
  const esCatastrofico  = severidadFinal === 'Catastrófico';

  const revisarManualmente = Boolean(requiereRevision)
                          || hasFlagRevision
                          || confianzaBaja
                          || esCatastrofico
                          || flagElevated;

  return {
    severidad:           severidadFinal,
    probabilidad:        probabilidadFinal,
    nivel_riesgo:        nivelRiesgo,
    _revisarManualmente: revisarManualmente,
    _riskSource:         'gemini:adapter',
  };
}

// ── POST /api/v1/ingest ───────────────────────────────────────────────────────
// Write-only endpoint for frontend report submission (web + mobile).
// Auth: per-company demo token (X-Ingest-Token header) verified against demo_tokens
//       table via SHA-256 hash. Falls back to legacy INGEST_TOKEN if not found.
// Server-side classification: runs local engine, applies MEJORA 6 + MEJORA 7.
// Origin-restricted to the Netlify frontend as a secondary defense layer.
async function handleIngestReport(req, res, origin) {
  // 1. Origin check (defense in depth — CORS is not auth, but reduces noise)
  if (origin !== _INGEST_ALLOWED_ORIGIN) {
    console.warn('[ingest] Rejected — unexpected origin: ' + origin);
    return sendJSON(res, 403, { error: 'forbidden', message: 'Origin no permitido.' }, origin);
  }

  // 2. Auth — demo token (DB) with legacy INGEST_TOKEN fallback
  const providedToken = (req.headers['x-ingest-token'] || '').trim();
  if (!providedToken) {
    console.warn('[ingest] Rejected — missing X-Ingest-Token');
    return sendJSON(res, 401, { error: 'unauthorized', message: 'Token de ingestión requerido.' }, origin);
  }

  // Resolve auth via demo token → legacy fallback (promisified callback)
  const authResult = await new Promise(resolve => {
    _validateDemoToken(providedToken, result => {
      if (result.ok) return resolve({ ok: true, via: 'demo', label: result.label, id: result.id });
      if (result.reason !== 'not_found') return resolve({ ok: false, ...result });
      // Not found in demo_tokens — try legacy INGEST_TOKEN
      if (INGEST_TOKEN && providedToken === INGEST_TOKEN) return resolve({ ok: true, via: 'legacy', label: 'legacy' });
      resolve({ ok: false, reason: 'not_found' });
    });
  });

  if (!authResult.ok) {
    if (authResult.reason === 'demo_access_revoked') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      console.warn('[ingest] Rejected — demo_access_revoked ip=' + ip);
      return sendJSON(res, 403, { error: 'demo_access_revoked', message: 'Acceso revocado. Contactá al administrador.' }, origin);
    }
    if (authResult.reason === 'demo_expired') {
      return sendJSON(res, 403, { error: 'demo_expired', message: 'Tu acceso de demostración ha vencido. Contactá al administrador.' }, origin);
    }
    console.warn('[ingest] Rejected — unauthorized (not_found or unknown)');
    return sendJSON(res, 401, { error: 'unauthorized', message: 'Token de ingestión requerido.' }, origin);
  }

  // 3. Rate limiting by IP
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (!_checkIngestRate(ip)) {
    return sendJSON(res, 429, { error: 'rate_limit', message: 'Demasiadas solicitudes. Intentá en unos minutos.' }, origin);
  }

  // 4. Read body with size guard
  let raw;
  try { raw = await readBody(req); }
  catch (err) { return sendJSON(res, 413, { error: 'payload_too_large' }, origin); }
  if (raw.length > 65536) {
    return sendJSON(res, 413, { error: 'payload_too_large', message: 'Payload supera el límite de 64 KB.' }, origin);
  }

  // 5. Parse JSON
  let body;
  try { body = JSON.parse(raw); }
  catch (err) { return sendJSON(res, 400, { error: 'invalid_json', message: 'Body debe ser JSON válido.' }, origin); }

  // 6. Required field: texto
  const texto = (body.texto || '').toString().trim();
  if (texto.length < 10) {
    return sendJSON(res, 400, { error: 'texto_too_short', message: 'El campo "texto" debe tener al menos 10 caracteres.' }, origin);
  }

  // 7. Build occ from whitelist only — strip everything else
  const occ = {};
  for (const k of _INGEST_WHITELIST) {
    if (body[k] !== undefined) occ[k] = body[k];
  }
  occ.texto = texto.slice(0, 3000); // enforce max length

  // 8. Validate _geo if present
  if (occ._geo) {
    const lat = occ._geo.lat;
    const lon = occ._geo.lon;
    if (typeof lat !== 'number' || typeof lon !== 'number' ||
        lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      delete occ._geo; // silently drop invalid geo
    }
  }

  // 8b. Derive source — _anonimo=true is set by all movil-mode routes in the frontend
  if (occ._anonimo === true) occ._fromMobile = true;

  // 9. Server-generated folio — client folio ignored, uniqueness guaranteed by _nextReportId
  occ.folio       = 'OCC-' + (1000 + _nextReportId++);
  if (!occ.fecha) occ.fecha = new Date().toISOString().slice(0, 10);
  occ._fromFrontend = true;
  occ._ingestedAt   = new Date().toISOString();
  occ.estado        = occ.estado || 'Reportada';

  // 10. Server-side classification + MEJORA 6 + MEJORA 7 ─────────────────────
  // Railway is the authority. The browser's categoria is preserved as
  // _categoria_browser for audit, but Railway decides what goes to the DB.
  const lang = body.lang || 'es';
  const _ingestClassResult = _applyServerClassification(texto, occ, lang);
  if (_ingestClassResult.applied) {
    if (_ingestClassResult.revisarManualmente) {
      console.log('[ingest] Revisión requerida — folio=' + occ.folio +
        ' sugerencia=' + (occ._m7_sugerencia || '—') +
        ' browser_cat=' + (occ._categoria_browser || '—') +
        ' m6=' + occ._m6_revisarManualmente + ' m7_rule=' + occ._m7_rule);
    } else {
      console.log('[ingest] Clasificación server — folio=' + occ.folio +
        ' cat=' + occ.categoria + ' m7_rule=' + occ._m7_rule +
        ' browser_cat=' + (occ._categoria_browser || '—'));
    }
  }
  if (!occ._clasificadoPor) occ._clasificadoPor = 'browser';
  _runGeminiShadow(texto, _ingestClassResult.classifyResult, {
    categoria:      occ.categoria,
    estado:         occ.estado,
    _m7_sugerencia: occ._m7_sugerencia,
    _m7_rule:       occ._m7_rule,
    _m7_conf:       occ._m7_conf,
  });

  // 11. Persist — same path as all other report flows
  _storedReports.unshift(occ);
  if (_storedReports.length > _STORED_REPORTS_MAX) _storedReports.length = _STORED_REPORTS_MAX;
  dbSaveReport(occ);

  // 12. WS push to desktop SafetyOps_v2 if connected
  if (isEngineConnected()) {
    try {
      engineSocket.send(JSON.stringify({ type: 'new_report', data: occ }));
      console.log('[ingest] new_report pushed to desktop — folio=' + occ.folio);
    } catch (e) {
      console.warn('[ingest] WS push failed:', e.message);
    }
  }

  const demoLabel = authResult.label;
  console.log('[ingest] Auth OK — demo label="' + demoLabel + '" via=' + authResult.via);
  console.log('[ingest] OK — folio=' + occ.folio +
    ' cat=' + (occ.categoria || 'Revisión requerida') +
    ' clasificadoPor=' + _clasificadoPor +
    ' area=' + (occ.area || '—') + ' ip=' + ip);

  return sendJSON(res, 200, {
    ok:           true,
    folio:        occ.folio,
    categoria:    occ.categoria    || null,
    estado:       occ.estado,
    nivel_riesgo: occ.nivel_riesgo || null,
    _revisarManualmente: (occ.estado === 'Revisión requerida'),
  }, origin);
}

// ── Admin: Demo Token CRUD ────────────────────────────────────────────────────
// Protected by API_SECRET_KEY. No token plaintext ever stored or logged.
// POST   /api/v1/admin/demo-tokens          → create token
// GET    /api/v1/admin/demo-tokens          → list all (no hashes exposed)
// POST   /api/v1/admin/demo-tokens/:id/revoke   → revoke
// POST   /api/v1/admin/demo-tokens/:id/activate → re-activate
async function handleAdminDemoTokens(req, res, origin) {
  const urlObj = new URL(req.url, 'http://localhost');
  const parts  = urlObj.pathname.split('/').filter(Boolean);
  // parts: ['api','v1','admin','demo-tokens'] or ['api','v1','admin','demo-tokens',':id','action']

  // GET /api/v1/admin/demo-tokens — list
  if (req.method === 'GET') {
    db.all(
      `SELECT id, label, status, expires_at, created_at, last_used_at FROM demo_tokens ORDER BY id DESC`,
      [],
      (err, rows) => {
        if (err) return sendJSON(res, 500, { error: 'db_error', message: err.message }, origin);
        sendJSON(res, 200, { ok: true, count: rows.length, tokens: rows }, origin);
      }
    );
    return;
  }

  // POST /api/v1/admin/demo-tokens — create
  if (req.method === 'POST' && parts.length === 4) {
    let raw;
    try { raw = await readBody(req); } catch (_) { return sendJSON(res, 400, { error: 'read_error' }, origin); }
    let body;
    try { body = JSON.parse(raw); } catch (_) { return sendJSON(res, 400, { error: 'invalid_json' }, origin); }

    const label      = (body.label || '').toString().trim();
    const expires_at = body.expires_at || null;

    if (!label) return sendJSON(res, 400, { error: 'label_required', message: 'El campo label es obligatorio.' }, origin);
    if (!_isValidISODate(expires_at)) return sendJSON(res, 400, { error: 'invalid_expires_at', message: 'expires_at debe ser ISO-8601 (YYYY-MM-DD) o null.' }, origin);

    // Generate a cryptographically random token
    const plaintext = 'dt-' + crypto.randomBytes(24).toString('base64url');
    const hash      = _hashToken(plaintext);

    db.run(
      `INSERT INTO demo_tokens (token_hash, label, status, expires_at) VALUES (?,?,?,?)`,
      [hash, label, 'ACTIVO', expires_at || null],
      function(err) {
        if (err) {
          console.error('[admin/demo] Insert error:', err.message);
          return sendJSON(res, 500, { error: 'db_error', message: err.message }, origin);
        }
        const id = this.lastID;
        console.log('[admin/demo] Created — id=' + id + ' label="' + label + '" expires=' + (expires_at || 'never'));
        // Return plaintext token ONCE — never stored, never logged beyond this point
        sendJSON(res, 201, { ok: true, id, label, token: plaintext, expires_at: expires_at || null, message: 'Guardá este token — no se mostrará nuevamente.' }, origin);
      }
    );
    return;
  }

  // POST /api/v1/admin/demo-tokens/:id/revoke or /activate
  if (req.method === 'POST' && parts.length === 6) {
    const tokenId = parseInt(parts[4], 10);
    const action  = parts[5]; // 'revoke' or 'activate'
    if (!Number.isFinite(tokenId) || !['revoke', 'activate'].includes(action)) {
      return sendJSON(res, 404, { error: 'not_found' }, origin);
    }
    const newStatus = action === 'revoke' ? 'REVOCADO' : 'ACTIVO';
    db.run(`UPDATE demo_tokens SET status='${newStatus}' WHERE id=?`, [tokenId], function(err) {
      if (err) return sendJSON(res, 500, { error: 'db_error', message: err.message }, origin);
      if (this.changes === 0) return sendJSON(res, 404, { error: 'not_found', message: 'Token id=' + tokenId + ' no encontrado.' }, origin);
      console.log('[admin/demo] Updated id=' + tokenId + ' — status=' + newStatus);
      sendJSON(res, 200, { ok: true, id: tokenId, status: newStatus }, origin);
    });
    return;
  }

  sendJSON(res, 404, { error: 'not_found' }, origin);
}

// ── API Key middleware ────────────────────────────────────────────────────────
// Checks Authorization: Bearer <key>  OR  x-api-key: <key>
// Key comes exclusively from API_SECRET_KEY env var (Railway Variables).
// If not set: endpoints return 503 — no open fallback, ever.
// Beta credential: set API_SECRET_KEY in Railway and share it with authorized clients.
const API_SECRET_KEY = process.env.API_SECRET_KEY || null;
if (!API_SECRET_KEY) {
  console.error('[API] ❌ API_SECRET_KEY not configured. Protected endpoints will return 503 until this is set in Railway Variables.');
}

// ── Ingest token — separate from API_SECRET_KEY, write-only scope ─────────────
// Allows frontend (web + mobile) to POST reports without exposing API_SECRET_KEY.
// Set INGEST_TOKEN in Railway Variables. Distribute to beta participants only.
// Does NOT grant access to GET /api/v1/reports, /stats, or POST /api/v1/sync.
const INGEST_TOKEN = process.env.INGEST_TOKEN || null;
if (!INGEST_TOKEN) {
  console.warn('[API] ⚠ INGEST_TOKEN not set — POST /api/v1/ingest will reject all requests until configured in Railway Variables.');
}

// ── In-memory rate limiter for /api/v1/ingest ─────────────────────────────────
const _ingestRateMap = new Map();
function _checkIngestRate(ip) {
  const now = Date.now();
  const WIN_MS = 10 * 60 * 1000; // 10-minute window
  const MAX_HITS = 20;            // max 20 requests per window per IP
  const hits = (_ingestRateMap.get(ip) || []).filter(function(t) { return now - t < WIN_MS; });
  hits.push(now);
  _ingestRateMap.set(ip, hits);
  return hits.length <= MAX_HITS;
}

// Allowed origin for /api/v1/ingest (defense in depth — not a substitute for token auth)
// Configurable via INGEST_ALLOWED_ORIGIN env var; defaults to the production Netlify frontend.
const _INGEST_ALLOWED_ORIGIN = process.env.INGEST_ALLOWED_ORIGIN || 'https://safetyops-personal.netlify.app';

// Whitelist of fields accepted from the frontend — all others are silently stripped
const _INGEST_WHITELIST = new Set([
  'texto', 'area', 'categoria', 'nivel_riesgo', 'confianza', 'fecha',
  'fase', 'lugar', 'matricula', 'vuelo', '_anonimo', '_geo', 'origen'
]);

function requireApiKey(req, res, origin) {
  if (!API_SECRET_KEY) {
    // Misconfiguration — refuse all requests rather than open the API.
    sendJSON(res, 503, {
      error:   'misconfigured',
      message: 'Server not configured. Contact the administrator.',
    }, origin);
    return false;
  }
  const auth = req.headers['authorization'] || '';
  const xkey = req.headers['x-api-key']     || '';
  const provided = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : xkey.trim();
  if (provided === API_SECRET_KEY) return true;
  sendJSON(res, 401, { error: 'unauthorized', message: 'API key requerida.' }, origin);
  return false;
}

// ── BETA: read-only access via INGEST_TOKEN ────────────────────────────────────
// Temporary mechanism for the closed beta (piloto 2026-08-25).
// Allows GET /api/v1/reports to be authenticated with X-Ingest-Token in addition
// to the full API_SECRET_KEY. Scope is intentionally narrow: read-only, GET only.
// POST /api/v1/reports, /sync, /stats still require API_SECRET_KEY exclusively.
// TODO: replace with a dedicated read-only key before public release.
function requireApiKeyOrIngestToken(req, res, origin) {
  // Check full API key first (same logic as requireApiKey)
  if (API_SECRET_KEY) {
    const auth     = req.headers['authorization'] || '';
    const xkey     = req.headers['x-api-key']     || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : xkey.trim();
    if (provided === API_SECRET_KEY) return true;
  }
  // BETA fallback: accept valid INGEST_TOKEN for read-only GET access
  const ingestToken = (req.headers['x-ingest-token'] || '').trim();
  if (INGEST_TOKEN && ingestToken && ingestToken === INGEST_TOKEN) {
    console.log('[API][BETA] GET /api/v1/reports autenticado con X-Ingest-Token');
    return true;
  }
  // No valid credential
  sendJSON(res, 401, { error: 'unauthorized', message: 'Token requerido.' }, origin);
  return false;
}

// ── Auth for POST /api/v1/sync ────────────────────────────────────────────────
// Accepts:
//   • API_SECRET_KEY  — admin / backend clients (Bearer or X-Api-Key)
//   • INGEST_TOKEN    — mobile frontend, sent as "Authorization: Bearer <token>"
//
// Railway Variable to configure: INGEST_TOKEN=safetyops-pilot-2026
// That matches the token hardcoded in SafetyOps_v2.html localStorage fallback.
function requireApiKeyOrSyncToken(req, res, origin) {
  const auth     = req.headers['authorization'] || '';
  const xkey     = req.headers['x-api-key']     || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7).trim() : xkey.trim();

  // Full API key (admin)
  if (API_SECRET_KEY && provided === API_SECRET_KEY) return true;

  // INGEST_TOKEN via Bearer — mobile frontend uses this credential
  if (INGEST_TOKEN && provided && provided === INGEST_TOKEN) {
    console.log('[API][sync] Authenticated via INGEST_TOKEN (mobile frontend)');
    return true;
  }

  sendJSON(res, 401, { error: 'unauthorized', message: 'API key o token de sincronización requerido.' }, origin);
  return false;
}

// ── 7-day purge — runs every 24 h ────────────────────────────────────────────
setInterval(() => {
  db.run(
    `DELETE FROM reports WHERE timestamp < datetime('now', '-7 days')`,
    function(err) {
      if (err) console.error('[DB] Purge error:', err.message);
      else console.log('[DB] Purge: ' + this.changes + ' reportes eliminados (>7 días)');
    }
  );
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

// ── Airport Database ──────────────────────────────────────────────────────────
const { searchAirports, getAirport } = require('./airports-data');

// ── Emergency Guidance Engine ─────────────────────────────────────────────────
let findGuidance = null;
let _guidanceLoadError = null;
try {
  const ge = require('./guidance-engine');
  findGuidance = ge.findGuidance;
  console.log('[guidance] guidance-engine loaded OK — ' + (ge.listProcedures ? ge.listProcedures().length : '?') + ' procedimientos');
} catch (err) {
  _guidanceLoadError = err.message;
  console.error('[guidance] guidance-engine load FAILED:', err.message);
}

let _engine = null;
try {
  _engine = require('./analysis-engine');
  console.log('[engine] Local analysis-engine loaded OK — USE_LOCAL_ENGINE=' + USE_LOCAL_ENGINE + ' COMPARE_MODE=' + COMPARE_MODE);
} catch (err) {
  console.warn('[engine] analysis-engine load failed:', err.message, '— WS-only mode');
}

// ── Groq LLM Integration ──────────────────────────────────────────────────────
// Set GROQ_API_KEY env var to enable LLM-based classification.
// Falls back to local Naive Bayes engine when not set.
const GROQ_API_KEY   = process.env.GROQ_API_KEY || null;
const GROQ_MODEL     = process.env.GROQ_MODEL   || 'llama-3.1-8b-instant';
// GROQ_MODEL_STABLE: rollback target. If new model fails gates, set GROQ_MODEL=this in Railway.
const GROQ_MODEL_STABLE = 'llama-3.1-8b-instant';
const GROQ_API_URL   = 'https://api.groq.com/openai/v1/chat/completions';
// GROQ_USE_STRUCTURED_OUTPUTS: set to 'true' in Railway only after Gate 2 (Schema) passes.
// When enabled, enforces strict JSON Schema via response_format — eliminates regex extraction.
const GROQ_USE_STRUCTURED_OUTPUTS = process.env.GROQ_USE_STRUCTURED_OUTPUTS === 'true';

const GROQ_CATEGORIES = ['Factor Humano','Técnico','Meteorología','Seguridad Aeroportuaria','ATC / Espacio Aéreo','Otro'];

// JSON Schema for structured output mode — used when GROQ_USE_STRUCTURED_OUTPUTS=true.
// Compatible with openai/gpt-oss-20b and any OpenAI-compatible model with structured outputs.
const GROQ_OUTPUT_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name:   'safety_classification',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        categoria:    { type: 'string', enum: GROQ_CATEGORIES },
        severidad:    { type: 'string', enum: ['Catastrófico','Crítico','Marginal','Insignificante'] },
        probabilidad: { type: 'string', enum: ['Frecuente','Probable','Remoto','Improbable','Extremadamente Improbable'] },
        nivel_riesgo: { type: 'string', enum: ['Crítico','Alto','Medio','Bajo'] },
        resumen:      { type: 'string' },
      },
      required: ['categoria','severidad','probabilidad','nivel_riesgo','resumen'],
      additionalProperties: false,
    },
  },
};

async function groqClassify(texto, area) {
  if (!GROQ_API_KEY) return null;
  const prompt = `Sos un experto en Gestión de Seguridad Operacional (SMS) aeronáutico, entrenado en las normas ICAO Anexo 19, EVAIR (EUROCONTROL Voluntary ATM Incident Reporting) y la taxonomía de ocurrencias de la ANAC Argentina.

Tu tarea es clasificar el siguiente reporte de seguridad operacional según estas categorías SMS:

CATEGORÍAS (elegí EXACTAMENTE una):
- "Factor Humano": errores de tripulación, fatiga, comunicación, procedimientos no seguidos, CRM deficiente
- "Técnico": fallas de aeronave, sistemas, motores, aviónica, estructura, equipamiento de rampa
- "Meteorología": condiciones meteorológicas adversas, windshear, turbulencia, hielo, visibilidad reducida
- "Seguridad Aeroportuaria": incursiones en pista, FOD, accesos no autorizados, incidentes en rampa/plataforma
- "ATC / Espacio Aéreo": separación reducida, instrucciones de ATC, gestión del espacio aéreo, conflictos de tráfico
- "Otro": no encaja en ninguna categoría anterior

GUÍA DE CLASIFICACIÓN (basada en EVAIR):
- Fuego, incendio, llamas, humo a bordo, smoke on board → SIEMPRE "Técnico". Sin excepción.
- Incursión en pista → "Seguridad Aeroportuaria"
- TCAS RA, conflicto de tráfico → "ATC / Espacio Aéreo"
- Bird strike, colisión aviar → "Técnico"
- Aproximación inestable continuada por decisión de tripulación → "Factor Humano"
- Mal tiempo que afecta operación → "Meteorología"
- Falla hidráulica / eléctrica / motores / aviónica → "Técnico"
- Descompresión, pérdida de presurización → "Técnico"

EJEMPLOS (lenguaje técnico y ciudadano/coloquial latinoamericano):
- "fuego en el avion" → "Técnico"
- "humo en cabina" → "Técnico"
- "incendio a bordo" → "Técnico"
- "había humo saliendo del motor" → "Técnico"
- "se prendió fuego el motor" → "Técnico"
- "bird strike en ascenso" → "Técnico"
- "un pájaro entró al motor" → "Técnico"
- "piloto no siguió procedimiento" → "Factor Humano"
- "el copiloto estaba cansado y se olvidó el checklist" → "Factor Humano"
- "windshear en aproximación" → "Meteorología"
- "había mucha niebla y no se veía nada" → "Meteorología"
- "persona en la pista" → "Seguridad Aeroportuaria"
- "había algo tirado en la pista" → "Seguridad Aeroportuaria"
- "casi chocamos con otro avión" → "ATC / Espacio Aéreo"

ESCALAS DE RIESGO (ICAO/ANAC):
- severidad: "Catastrófico" | "Crítico" | "Marginal" | "Insignificante"
- probabilidad: "Frecuente" | "Probable" | "Remoto" | "Improbable" | "Extremadamente Improbable"
- nivel_riesgo: "Crítico" | "Alto" | "Medio" | "Bajo"

Reporte recibido (área operacional: ${area || 'Operaciones de Vuelo'}):
"${texto}"

Respondé ÚNICAMENTE con un objeto JSON válido con estos campos: categoria, severidad, probabilidad, nivel_riesgo, resumen (una oración en español explicando la clasificación).
Sin texto adicional, sin markdown, solo el JSON.`;

  // Up to 2 attempts: retry once on JSON extraction failure (not on timeout/network).
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const _t0 = Date.now();
      const https = require('https');
      const requestBody = {
        model:       GROQ_MODEL,
        messages:    [{ role: 'user', content: prompt }],
        max_tokens:  400,        // bumped from 300; GPT-OSS 20B may generate longer resumen
        temperature: 0.1,
      };
      if (GROQ_USE_STRUCTURED_OUTPUTS) {
        requestBody.response_format = GROQ_OUTPUT_SCHEMA;
      }
      const body = JSON.stringify(requestBody);

      const result = await new Promise((resolve, reject) => {
        const url = new URL(GROQ_API_URL);
        const req = https.request({
          hostname: url.hostname,
          path:     url.pathname,
          method:   'POST',
          headers: {
            'Authorization':  'Bearer ' + GROQ_API_KEY,
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch (e) { reject(new Error('Groq parse error: ' + data.slice(0, 200))); }
          });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Groq timeout')); });
        req.write(body);
        req.end();
      });

      const latencyMs = Date.now() - _t0;

      // Check for API-level errors (e.g. model not found, rate limit)
      if (result?.error) {
        throw new Error('Groq API error: ' + (result.error.message || JSON.stringify(result.error)));
      }

      const content = result?.choices?.[0]?.message?.content || '';

      // Extract JSON — structured outputs: content IS the JSON; freeform: regex extraction.
      let parsed;
      if (GROQ_USE_STRUCTURED_OUTPUTS) {
        parsed = JSON.parse(content);
      } else {
        const match = content.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON in Groq response: ' + content.slice(0, 120));
        parsed = JSON.parse(match[0]);
      }

      // Observability fields — internal only, stripped from public API responses.
      parsed._groq_model      = GROQ_MODEL;
      parsed._groq_latency_ms = latencyMs;
      parsed._groq_structured = GROQ_USE_STRUCTURED_OUTPUTS;
      parsed._groq_attempt    = attempt;

      console.log('[groq] model=' + GROQ_MODEL +
        ' structured=' + GROQ_USE_STRUCTURED_OUTPUTS +
        ' attempt=' + attempt +
        ' latency=' + latencyMs + 'ms' +
        ' categoria=' + parsed.categoria +
        ' nivel=' + parsed.nivel_riesgo);

      return parsed;

    } catch (err) {
      // Only retry on JSON extraction errors — not on timeout or network failures.
      const isRetryable = !err.message.includes('timeout') &&
                          !err.message.includes('Groq API error') &&
                          (err.message.includes('No JSON') || err.message.includes('JSON'));
      if (attempt === 1 && isRetryable) {
        console.warn('[groq] attempt=1 retryable JSON error — retrying once: ' + err.message);
        continue;
      }
      console.warn('[groq] Error (attempt=' + attempt + ') — falling back to local engine:', err.message);
      return null;
    }
  }
  return null;
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

/** Auto-increment counter for local engine folio numbers.
 *  Initialized at boot from SELECT MAX(id) so folios are unique across server restarts.
 */
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
  if (match) return match;
  // Also accept the ingest-specific origin so OPTIONS preflights to /api/v1/ingest succeed
  // even when CORS_ORIGIN env var doesn't explicitly list it.
  if (requestOrigin === _INGEST_ALLOWED_ORIGIN) return _INGEST_ALLOWED_ORIGIN;
  return '';                                            // empty → blocked
}

function corsHeaders(requestOrigin) {
  const origin = getAllowedOrigin(requestOrigin);
  const hdrs = {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-Ingest-Token, X-Demo-Token',
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
    guidance:  findGuidance ? 'loaded' : ('error: ' + _guidanceLoadError),
    groq:             GROQ_API_KEY ? 'active' : 'not_configured',
    groq_model:       GROQ_API_KEY ? GROQ_MODEL : null,
    groq_model_stable: GROQ_MODEL_STABLE,
    groq_structured:  GROQ_USE_STRUCTURED_OUTPUTS,
    uptime:           uptime(),
    timestamp:        new Date().toISOString(),
  }, origin);
}

// ── Sprint A: POST /api/v1/classify ──────────────────────────────────────────
// Classifies a text using Groq (server-side API key).
// No auth required — public endpoint for any SafetyOps client.
// No side effects: no DB writes, no WS events, no report creation.
async function handleClassify(req, res, origin) {
  let raw;
  try { raw = await readBody(req); }
  catch (err) { return sendJSON(res, 400, { success: false, error: 'read_error' }, origin); }

  let body;
  try { body = JSON.parse(raw); }
  catch (err) { return sendJSON(res, 400, { success: false, error: 'invalid_json' }, origin); }

  const text = (body.text || '').trim();
  const lang = body.lang || 'es';

  if (!text) {
    return sendJSON(res, 400, { success: false, error: 'text_required' }, origin);
  }

  if (!GROQ_API_KEY) {
    return sendJSON(res, 503, { success: false, error: 'engine_unavailable', detail: 'GROQ_API_KEY not configured' }, origin);
  }

  try {
    const t0 = Date.now();
    const groqResult = await groqClassify(text, null);
    const ms = Date.now() - t0;

    if (!groqResult) {
      return sendJSON(res, 503, { success: false, error: 'engine_unavailable' }, origin);
    }

    // Map Groq categories → full ICAO/SMS taxonomy names
    const CAT_MAP = {
      'Factor Humano':          'Factores Humanos',
      'Técnico':                'Falla Técnica',
      'Meteorología':           'Meteorología Adversa',
      'Seguridad Aeroportuaria':'Seguridad Aeroportuaria',
      'ATC / Espacio Aéreo':    'Incidencia ATC',
      'Otro':                   'Otro',
    };
    const category = CAT_MAP[groqResult.categoria] || groqResult.categoria;

    sendJSON(res, 200, {
      success: true,
      classification: {
        category,
        risk:       groqResult.nivel_riesgo || null,
        confidence: groqResult.confianza    || null,
      },
      engine: {
        provider: 'Groq',
        model:    GROQ_MODEL,
        ms,
      },
      version: '1.0',
    }, origin);

    console.log(`[classify] "${text.slice(0, 60)}" → ${category} (${ms}ms)`);
  } catch (err) {
    console.error('[classify] Groq error:', err.message);
    sendJSON(res, 503, { success: false, error: 'engine_unavailable' }, origin);
  }
}

/**
 * POST /api/v1/sync
 * Accepts an already-analyzed occ object from SafetyOps_v2 mobile flow.
 * Saves to SQLite + pushes to connected desktop clients via WS.
 * No engine required — classification already done by the browser.
 */
async function handleSyncReport(req, res, origin) {
  let raw;
  try { raw = await readBody(req); }
  catch (err) { return sendJSON(res, 400, { error: 'read_error', message: 'Could not read body.' }, origin); }

  let occ;
  try { occ = JSON.parse(raw); }
  catch (err) { return sendJSON(res, 400, { error: 'invalid_json', message: 'Body must be valid JSON.' }, origin); }

  if (!occ || !occ.texto) {
    return sendJSON(res, 400, { error: 'validation_error', message: 'Field "texto" is required.' }, origin);
  }

  // Ensure folio and timestamp
  if (!occ.folio)  occ.folio     = 'OCC-' + Date.now();
  if (!occ.fecha)  occ.fecha     = new Date().toISOString().slice(0, 10);
  occ._fromMobile  = true;
  occ._syncedAt    = new Date().toISOString();

  // ── Server-side classification + MEJORA 6 + MEJORA 7 ──────────────────────
  // Railway overrides the browser's categoria using the same pipeline as /ingest.
  const _syncClassResult = _applyServerClassification(occ.texto, occ, 'es');
  if (_syncClassResult.applied) {
    if (_syncClassResult.revisarManualmente) {
      console.log('[sync] Revisión requerida — folio=' + occ.folio +
        ' sugerencia=' + (occ._m7_sugerencia || '—') +
        ' browser_cat=' + (occ._categoria_browser || '—') +
        ' m6=' + occ._m6_revisarManualmente + ' m7_rule=' + occ._m7_rule);
    } else {
      console.log('[sync] Clasificación server — folio=' + occ.folio +
        ' cat=' + occ.categoria + ' m7_rule=' + occ._m7_rule +
        ' browser_cat=' + (occ._categoria_browser || '—'));
    }
  }

  _runGeminiShadow(occ.texto, _syncClassResult.classifyResult, {
    categoria:      occ.categoria,
    estado:         occ.estado,
    _m7_sugerencia: occ._m7_sugerencia,
    _m7_rule:       occ._m7_rule,
    _m7_conf:       occ._m7_conf,
  });

  // ── Optional Groq enrichment ───────────────────────────────────────────────
  // When the local engine classified, Groq enriches only risk metadata
  // (severidad / probabilidad / nivel_riesgo) without overriding categoria.
  if (GROQ_API_KEY) {
    const groqResult = await groqClassify(occ.texto, occ.area);
    if (groqResult) {
      if (!_syncClassResult.applied) {
        // No local engine — use Groq as the classifier fallback
        occ.categoria       = groqResult.categoria    || occ.categoria;
        occ._clasificadoPor = 'groq:' + GROQ_MODEL;
      }
      // Always allow Groq to enrich risk metadata
      occ.severidad    = groqResult.severidad    || occ.severidad;
      occ.probabilidad = groqResult.probabilidad || occ.probabilidad;
      occ.nivel_riesgo = groqResult.nivel_riesgo || occ.nivel_riesgo;
      occ._groq_resumen = groqResult.resumen     || undefined;
    }
  }

  // Persist in memory
  _storedReports.unshift(occ);
  if (_storedReports.length > _STORED_REPORTS_MAX) _storedReports.length = _STORED_REPORTS_MAX;

  // Persist to SQLite
  dbSaveReport(occ);

  // Push to connected desktop (SafetyOps_v2)
  if (isEngineConnected()) {
    try {
      engineSocket.send(JSON.stringify({ type: 'new_report', data: occ }));
      console.log('[sync] new_report pushed to desktop — folio=' + occ.folio);
    } catch (e) {
      console.warn('[sync] WS push failed:', e.message);
    }
  }

  console.log('[sync] Report synced — folio=' + occ.folio + ' categoria=' + occ.categoria + ' clasificadoPor=' + (occ._clasificadoPor || '—'));
  return sendJSON(res, 200, { ok: true, folio: occ.folio, categoria: occ.categoria, nivel_riesgo: occ.nivel_riesgo, _clasificadoPor: occ._clasificadoPor }, origin);
}

/**
 * GET /api/v1/airports?q=EZE        → busca por ICAO, IATA, nombre o ciudad
 * GET /api/v1/airports?code=SAEZ    → aeropuerto exacto + sectores
 * No requiere API key — es información pública.
 */
function handleAirports(req, res, origin) {
  const urlObj = new URL(req.url, 'http://localhost');
  const code   = urlObj.searchParams.get('code') || '';
  const q      = urlObj.searchParams.get('q')    || '';

  if (code) {
    const airport = getAirport(code);
    if (!airport) return sendJSON(res, 404, { error: 'not_found', message: 'Aeropuerto no encontrado: ' + code }, origin);
    return sendJSON(res, 200, { ok: true, airport }, origin);
  }

  if (q.trim().length < 2) {
    return sendJSON(res, 400, { error: 'query_too_short', message: 'El parámetro q debe tener al menos 2 caracteres.' }, origin);
  }

  const results = searchAirports(q, 10);
  return sendJSON(res, 200, { ok: true, count: results.length, airports: results }, origin);
}

/**
 * GET /api/v1/stats — métricas del sistema para observabilidad.
 * Requiere API key.
 */
function handleStats(req, res, origin) {
  db.get(`SELECT COUNT(*) as total,
    SUM(CASE WHEN date(timestamp) = date('now') THEN 1 ELSE 0 END) as hoy,
    SUM(CASE WHEN date(timestamp) >= date('now','-7 days') THEN 1 ELSE 0 END) as ultimos_7_dias,
    SUM(CASE WHEN source = 'mobile' THEN 1 ELSE 0 END) as desde_movil,
    SUM(CASE WHEN category = 'Factor Humano' THEN 1 ELSE 0 END) as factor_humano,
    SUM(CASE WHEN category = 'Técnico' THEN 1 ELSE 0 END) as tecnico,
    SUM(CASE WHEN category = 'Meteorología' THEN 1 ELSE 0 END) as meteorologia,
    SUM(CASE WHEN category = 'Seguridad Aeroportuaria' THEN 1 ELSE 0 END) as seguridad_aeroportuaria,
    SUM(CASE WHEN category = 'ATC / Espacio Aéreo' THEN 1 ELSE 0 END) as atc,
    SUM(CASE WHEN category = 'Otro' THEN 1 ELSE 0 END) as otro,
    SUM(CASE WHEN risk = 'Crítico' THEN 1 ELSE 0 END) as riesgo_critico,
    SUM(CASE WHEN risk = 'Alto' THEN 1 ELSE 0 END) as riesgo_alto
  FROM reports`, (err, row) => {
    if (err) return sendJSON(res, 500, { error: 'db_error', message: err.message }, origin);
    sendJSON(res, 200, {
      ok:          true,
      timestamp:   new Date().toISOString(),
      uptime_secs: Math.floor((Date.now() - SERVER_START) / 1000),
      groq_active:       !!GROQ_API_KEY,
      groq_model:        GROQ_API_KEY ? GROQ_MODEL : null,
      groq_model_stable: GROQ_MODEL_STABLE,
      groq_structured:   GROQ_USE_STRUCTURED_OUTPUTS,
      engine_connected: isEngineConnected(),
      reportes: {
        total:              row.total             || 0,
        hoy:                row.hoy               || 0,
        ultimos_7_dias:     row.ultimos_7_dias    || 0,
        desde_movil:        row.desde_movil       || 0,
        por_categoria: {
          factor_humano:          row.factor_humano          || 0,
          tecnico:                row.tecnico                || 0,
          meteorologia:           row.meteorologia           || 0,
          seguridad_aeroportuaria:row.seguridad_aeroportuaria|| 0,
          atc:                    row.atc                    || 0,
          otro:                   row.otro                   || 0,
        },
        por_riesgo: {
          critico: row.riesgo_critico || 0,
          alto:    row.riesgo_alto    || 0,
        },
      },
    }, origin);
  });
}

/**
 * POST /api/v1/guidance
 * Body: { trigger: string, sector?: string, aircraft?: string }
 * Sin API key — es información pública (procedimientos validados, no datos del usuario).
 * Rate limit implícito: si el origen no tiene CORS permitido, el browser lo bloquea igual.
 */
function handleGuidance(req, res, origin) {
  if (!findGuidance) {
    return sendJSON(res, 503, { error: 'guidance_unavailable', message: _guidanceLoadError }, origin);
  }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch (_) {
      return sendJSON(res, 400, { error: 'invalid_json' }, origin);
    }
    const { trigger, sector, aircraft } = parsed;
    if (!trigger || typeof trigger !== 'string' || trigger.trim().length < 3) {
      return sendJSON(res, 400, { error: 'trigger_required', message: "El campo 'trigger' es obligatorio (mínimo 3 caracteres)." }, origin);
    }
    const result = findGuidance(trigger.trim(), sector, aircraft);
    if (!result.found) {
      return sendJSON(res, 200, { ok: false, steps: null, fallback: result.fallback }, origin);
    }
    return sendJSON(res, 200, { ok: true, ...result.data }, origin);
  });
}

function handleGetReports(req, res, origin) {
  const urlObj = new URL(req.url, 'http://localhost');
  const limit  = Math.min(parseInt(urlObj.searchParams.get('limit') || '100', 10), 500);
  const since  = urlObj.searchParams.get('since') || null;
  const sql    = since
    ? `SELECT id, folio, timestamp, airport, sector, title, description,
              risk, severity, probability, category, status, source
       FROM reports WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?`
    : `SELECT id, folio, timestamp, airport, sector, title, description,
              risk, severity, probability, category, status, source
       FROM reports ORDER BY timestamp DESC LIMIT ?`;
  const params = since ? [since, limit] : [limit];
  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('[DB] GET /api/v1/reports error:', err.message);
      return sendJSON(res, 500, { error: 'db_error', message: err.message }, origin);
    }
    sendJSON(res, 200, { ok: true, count: rows.length, reports: rows }, origin);
  });
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
    TRACE( 3, 'JSON parse OK',                  { fn: _fn, keys: Object.keys(body), textoLen: body.texto ? body.texto.length : 0, area: body.area, identidad: body.identidad, elapsed: Date.now() - _t0 });
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
    // BETA: accepts X-Ingest-Token in addition to API_SECRET_KEY (read-only)
    if (!requireApiKeyOrIngestToken(req, res, origin)) return;
    return handleGetReports(req, res, origin);
  }
  if (method === 'POST' && url === '/api/v1/ingest') {
    return handleIngestReport(req, res, origin);
  }
  if (method === 'POST' && url === '/api/v1/sync') {
    if (!requireApiKeyOrSyncToken(req, res, origin)) return;
    return handleSyncReport(req, res, origin);
  }
  if (method === 'GET' && url.startsWith('/api/v1/airports')) {
    return handleAirports(req, res, origin);
  }
  if (method === 'GET' && url === '/api/v1/stats') {
    if (!requireApiKey(req, res, origin)) return;
    return handleStats(req, res, origin);
  }
  if (method === 'POST' && url === '/api/v1/guidance') {
    return handleGuidance(req, res, origin);
  }
  if (method === 'POST' && url === '/api/v1/classify') {
    return handleClassify(req, res, origin);
  }

  // ── Admin: Demo Token management (API_SECRET_KEY required) ───────────────────
  if (url.startsWith('/api/v1/admin/demo-tokens')) {
    if (!requireApiKey(req, res, origin)) return;
    return handleAdminDemoTokens(req, res, origin);
  }

  // ── TODO Sprint 3: /api/v1/login ─────────────────────────────────────────
  // Endpoint de autenticación. Esqueleto preparado — NO activado.
  // Para activar: descomentar el bloque, instalar bcryptjs, habilitar tabla users.
  //
  // if (method === 'POST' && url === '/api/v1/login') {
  //   return handleLogin(req, res, origin);
  // }
  // if (method === 'POST' && url === '/api/v1/logout') {
  //   return handleLogout(req, res, origin);
  // }
  // if (method === 'GET' && url === '/api/v1/me') {
  //   return handleMe(req, res, origin);
  // }
  // ── Fin skeleton login ────────────────────────────────────────────────────

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
