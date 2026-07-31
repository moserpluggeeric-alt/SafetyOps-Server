'use strict';
// ── NORM — _norm() ────────────────────────────────────────────────────────────
// Extraído sin modificaciones de SafetyOps_v2.html líneas 3720-3722
// Hoja del árbol de dependencias — sin dependencias propias

function _norm(s){
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}

module.exports = { _norm };
