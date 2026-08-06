'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// middleware/auth.js — SafetyOps Authentication Middleware
// STATUS: SKELETON — no activado. Activar en Sprint 3.
// ─────────────────────────────────────────────────────────────────────────────
//
// TODO Sprint 3:
//
// 1. requireAuth(req, res, next)
//    - Lee header Authorization: Bearer <token>
//    - Verifica token en tabla sessions (o valida expiración en payload)
//    - Si inválido → 401 { error: 'unauthorized' }
//    - Si válido   → agrega req.user = { id, username, role, company_id }
//    - next()
//
// 2. requireRole(...roles)
//    - Middleware factory: requireRole('admin', 'supervisor')
//    - Si req.user.role no está en roles → 403 { error: 'forbidden' }
//
// 3. Rutas públicas (sin auth):
//    - POST /api/v1/login
//    - POST /api/v1/reports   (flujo móvil/QR — anónimo permitido)
//    - GET  /api/v1/health
//    - GET  /api/v1/config
//
// Ejemplo de uso en safetyops-server.js:
//   const { requireAuth, requireRole } = require('./middleware/auth');
//   if (method === 'GET' && url === '/api/v1/stats') {
//     return requireAuth(req, res, () => handleStats(req, res, origin));
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 horas

/** Placeholder — reemplazar en Sprint 3 con validación real. */
function requireAuth(req, res, next) {
  // TODO Sprint 3: validar Bearer token contra tabla sessions
  // Por ahora pasa todo (no bloqueamos nada antes de activar auth)
  return next();
}

/** Placeholder — reemplazar en Sprint 3. */
function requireRole(..._roles) {
  return function(req, res, next) {
    // TODO Sprint 3: verificar req.user.role
    return next();
  };
}

module.exports = { requireAuth, requireRole, TOKEN_EXPIRY_MS };
