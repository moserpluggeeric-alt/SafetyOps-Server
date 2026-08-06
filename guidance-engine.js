'use strict';

const path = require('path');
const fs   = require('fs');

// ── Carga modular desde procedures/ ──────────────────────────────────────────
let proceduresCache = [];

function loadProcedures() {
  const dir = path.join(__dirname, 'procedures');
  // Fallback a procedures.json plano si no existe el directorio
  if (!fs.existsSync(dir)) {
    try {
      const raw = fs.readFileSync(path.join(__dirname, 'procedures.json'), 'utf8');
      proceduresCache = JSON.parse(raw);
      console.log(`[GUIDANCE] ${proceduresCache.length} procedimientos cargados desde procedures.json (legacy).`);
    } catch (err) {
      console.error('[GUIDANCE] Error al cargar procedures.json:', err.message);
    }
    return;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const loaded = [];
  for (const file of files) {
    try {
      const raw  = fs.readFileSync(path.join(dir, file), 'utf8');
      const proc = JSON.parse(raw);
      // Validación mínima de contrato
      if (!proc.id || !proc.trigger_keywords || !proc.steps) {
        console.warn(`[GUIDANCE] ${file} ignorado — faltan campos obligatorios (id/trigger_keywords/steps).`);
        continue;
      }
      loaded.push(proc);
    } catch (err) {
      console.error(`[GUIDANCE] Error al parsear ${file}:`, err.message);
    }
  }
  proceduresCache = loaded;
  console.log(`[GUIDANCE] ${proceduresCache.length} procedimientos cargados desde procedures/ (${files.length} archivos).`);
}

loadProcedures();

// ── Motor de matching ─────────────────────────────────────────────────────────
/**
 * Busca el procedimiento más relevante dado un texto de trigger.
 * Umbral mínimo score >= 2 para evitar falsos positivos en emergencias.
 *
 * @param {string} trigger   - Descripción libre de la emergencia.
 * @param {string} [sector]  - Sector del aeropuerto (opcional, mejora el score).
 * @param {string} [aircraft]- Tipo de aeronave (opcional, mejora el score).
 * @returns {{ found: boolean, data?: object, fallback?: string }}
 */
function findGuidance(trigger, sector, aircraft) {
  if (!trigger || typeof trigger !== 'string') {
    return { found: false, fallback: 'El campo trigger es obligatorio.' };
  }

  const text = trigger.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const proc of proceduresCache) {
    let score = 0;

    // Keywords del trigger (peso principal — cada match suma 1)
    for (const kw of proc.trigger_keywords) {
      if (text.includes(kw.toLowerCase())) score += 1;
    }

    // Bonificación por sector y aeronave (peso menor)
    if (sector && Array.isArray(proc.sector_tags)) {
      if (proc.sector_tags.some(s => s.toLowerCase() === sector.toLowerCase())) score += 0.5;
    }
    if (aircraft && Array.isArray(proc.aircraft_tags)) {
      if (proc.aircraft_tags.some(a => a.toLowerCase() === aircraft.toLowerCase())) score += 0.5;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = proc;
    }
  }

  // Sin ningún match
  if (highestScore === 0 || !bestMatch) {
    return {
      found: false,
      fallback: 'Procedimiento no encontrado en la base de datos validada. ' +
                'Contactar al supervisor de inmediato y seguir los protocolos generales de seguridad.'
    };
  }

  // Score 1 → devolvemos el procedimiento con confianza baja + aviso
  // Score ≥ 2 → confianza media; ≥ 3 → alta
  const confidence = highestScore >= 3 ? 'alta' : highestScore >= 2 ? 'media' : 'baja';

  return {
    found: true,
    data: {
      id:                   bestMatch.id,
      title:                bestMatch.title        || bestMatch.id,
      fuente:               bestMatch.fuente       || '—',
      severity:             bestMatch.severity     || 'MEDIO',
      confidence,
      requiresEmergencyCall: bestMatch.requiresEmergencyCall === true,
      steps:                bestMatch.steps        || [],
      warnings:             bestMatch.warnings     || [],
      aviso: confidence === 'baja'
        ? 'Coincidencia baja — verificar con supervisor si este procedimiento aplica.'
        : null
    }
  };
}

/**
 * Lista todos los procedimientos cargados (para tests y health checks).
 */
function listProcedures() {
  return proceduresCache.map(p => ({
    id:       p.id,
    title:    p.title || p.id,
    severity: p.severity || '—',
    keywords: p.trigger_keywords.length
  }));
}

module.exports = { findGuidance, listProcedures };
