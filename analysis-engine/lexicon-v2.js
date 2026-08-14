'use strict';
/**
 * AVIATION LEXICON 2.0 — SafetyOps Classifier v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Concept-based lexicon. Each entry defines a semantic concept with:
 *   - Phrase matching lists (ES + EN, exact and stem)
 *   - Context rules (negation invalidates, hypothetical reduces)
 *   - Disambiguation (priority + conflicting_concepts)
 *   - Scoring (confidence_weight fed into classifier-v2)
 *
 * DESIGN NOTES (values are INITIAL — calibrate on DEV set before freezing):
 *   priority       : higher wins in concept conflict resolution
 *   confidence_weight : multiplied by concept_score in classifier-v2
 *   negation window : controlled by NEGATION_WINDOW_TOKENS in context-engine.js
 *   hypothetical_reduces : factor applied when hypothetical marker detected
 *
 * NO PRODUCTION FILES MODIFIED.
 * Phase 1 — Lexicon 2.0 + Concept Extractor + Context Engine only.
 */

// ── Normalization helper (mirrors norm.js — no import to avoid circular dep) ─
function _n(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''´`]/g, "'");
}

// ── ConceptEntry schema ───────────────────────────────────────────────────────
/**
 * @typedef {Object} ConceptEntry
 * @property {string}   id                  - SCREAMING_SNAKE_CASE identifier
 * @property {string}   canonical_name      - Human-readable ES name
 * @property {string[]} categories          - SMS categories this activates
 * @property {number}   confidence_weight   - Score boost when active (calibrate later)
 * @property {number}   priority            - Disambiguation priority (higher wins)
 * @property {boolean}  requires_context    - true = needs context_required_after match
 * @property {string[]} phrases_es          - Exact ES phrases (already normalized internally)
 * @property {string[]} phrases_en          - Exact EN phrases
 * @property {string[]} stems_es            - ES stem prefixes for partial match
 * @property {string[]} stems_en            - EN stem prefixes for partial match
 * @property {string[]} abbreviations       - Uppercase codes / squawks
 * @property {string[]} colloquial_es       - Informal ES phrases
 * @property {string[]} colloquial_en       - Informal EN phrases
 * @property {string[]} misspellings        - Common typos (already normalized)
 * @property {string[]} context_required_after - At least one of these must appear
 *                                              within CONTEXT_WINDOW tokens AFTER
 *                                              the phrase match
 * @property {string[]} negative_triggers   - These tokens in window BEFORE phrase
 *                                            negate the concept
 * @property {string[]} conflicting_concepts- IDs that cannot coexist with this one
 * @property {string}   disambiguation_rule - Human-readable tie-break explanation
 * @property {string}   severity            - CRITICAL | HIGH | MEDIUM | LOW
 * @property {boolean}  negation_invalidates- true = negation cancels concept
 * @property {number}   hypothetical_reduces- Weight multiplier when hypothetical (0–1)
 * @property {string}   source              - Origin standard
 * @property {string}   version             - Lexicon version added
 */

// ── LEXICON ───────────────────────────────────────────────────────────────────
const LEXICON_RAW = [

  // ══════════════════════════════════════════════════════
  // PRIORITY CONCEPTS (10 required by Phase 1)
  // ══════════════════════════════════════════════════════

  {
    id: 'FIREARM',
    canonical_name: 'Arma de Fuego a Bordo',
    categories: ['Seguridad Aeroportuaria'],
    confidence_weight: 5.0,   // INITIAL — highest to override FIRE
    priority: 100,
    requires_context: false,
    phrases_es: [
      'arma de fuego', 'arma a bordo', 'pasajero armado',
      'pasajero con arma', 'pistola a bordo', 'revolver a bordo',
      'arma encontrada', 'arma en el avion', 'arma detectada',
      'arma en equipaje', 'arma de fuego a bordo',
    ],
    phrases_en: [
      'firearm on board', 'weapon on board', 'armed passenger',
      'gun on board', 'handgun detected', 'pistol found',
      'weapon found', 'firearm detected', 'gun found on aircraft',
    ],
    stems_es: [],
    stems_en: ['firearm', 'handgun', 'weapon aboard'],
    abbreviations: [],
    colloquial_es: [
      'pasajero con pistola', 'llevaba un arma', 'arma escondida en equipaje',
      'tenia un arma', 'traía un arma',
    ],
    colloquial_en: ['had a gun', 'was armed', 'carrying a weapon'],
    misspellings: ['arma de fugo', 'arma fuego', 'arma de feugo'],
    context_required_after: [],
    // Phase 1.7: negative_triggers include explicit clarification phrases that denote
    // a firearm was investigated but ruled out. These do NOT suppress a concurrent FIRE.
    negative_triggers: ['no firearm involved', 'no firearm', 'no weapon found', 'no se encontro arma'],
    conflicting_concepts: ['FIRE'],
    disambiguation_rule: 'FIREARM (P=100) beats FIRE (P=80). The word "fuego" inside "arma de fuego" does NOT activate FIRE. Explicitly negated firearms ("No firearm involved") cancel FIREARM so concurrent FIRE can dominate.',
    severity: 'CRITICAL',
    // Phase 1.7: true = explicit negation ("No firearm involved") cancels FIREARM,
    // allowing a concurrent real FIRE to correctly dominate.
    negation_invalidates: true,
    hypothetical_reduces: 0.1,   // even a rumored firearm is critical
    source: 'ICAO_8973',
    version: '2.0.0',
  },

  {
    id: 'FIRE',
    canonical_name: 'Incendio a Bordo',
    categories: ['Incendio'],
    confidence_weight: 3.5,   // INITIAL
    priority: 80,
    requires_context: true,  // "fuego" alone is not enough
    phrases_es: [
      'incendio a bordo', 'fuego en cabina', 'fuego en motor',
      'fuego en el motor', 'fuego en la cabina', 'llamas a bordo',
      'fuego a bordo', 'incendio en cabina', 'incendio en motor',
      'incendio en bodega', 'fuego en bodega', 'aeronave en llamas',
      'aeronave en fuego', 'se prendio el motor', 'se prendo el motor',
    ],
    phrases_en: [
      'fire on board', 'aircraft on fire', 'cabin fire', 'engine fire',
      'cargo fire', 'fire warning', 'fire in cabin', 'fire in the cabin',
      'fire in cockpit', 'fire in the cockpit', 'fire in cargo',
      'fire in the cargo', 'engine on fire', 'aircraft fire',
      'fire in galley', 'fire in the galley',
    ],
    stems_es: ['incendi', 'fueg'],   // 'fueg' catches 'fuego' alone (requires_context still enforced)
    stems_en: ['fire'],              // catches standalone 'fire' token (requires_context enforced)
    abbreviations: ['FIRE WARN', 'ENG FIRE'],
    colloquial_es: [
      'el avion estaba en llamas', 'habia fuego', 'se prende fuego',
      'el motor estaba ardiendo', 'llamas visibles',
    ],
    colloquial_en: ['plane was on fire', 'there was fire', 'flames visible'],
    misspellings: ['incendeo', 'incencio', 'incendió'],
    // If "fuego" only — require one of these within CONTEXT_WINDOW tokens after
    context_required_after: [
      'cabina', 'motor', 'bodega', 'a bordo', 'cargo', 'avion',
      'aeronave', 'cockpit', 'galley', 'cabin',
    ],
    negative_triggers: [
      'no hubo', 'sin', 'no se detecto', 'no habia', 'ausencia de',
      'descarto', 'no humo', 'libre de', 'negativo', 'no incendio',
    ],
    conflicting_concepts: ['FIREARM'],
    disambiguation_rule: 'FIRE requires location context. "fuego" alone without cabin/motor/bodega context does NOT activate. FIREARM takes priority.',
    severity: 'CRITICAL',
    negation_invalidates: true,
    hypothetical_reduces: 0.3,   // INITIAL — "risk of fire" still scores
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'SMOKE',
    canonical_name: 'Humo a Bordo',
    categories: ['Smoke / Humo a Bordo'],
    confidence_weight: 3.5,   // INITIAL
    priority: 75,
    requires_context: false,  // "humo" alone in aviation context is sufficient
    phrases_es: [
      'humo en cabina', 'humo en la cabina', 'humo en cockpit',
      'humo en el cockpit', 'olor a quemado', 'humo a bordo',
      'humo en bodega', 'humo en la cabina de mando',
      'humo en cabina de pasajeros', 'humo visible en cabina',
      'humo en la cabina de pasajeros', 'presencia de humo',
    ],
    phrases_en: [
      'smoke in cabin', 'smoke in cockpit', 'smoke odor', 'smoke smell',
      'electrical smoke', 'smoke on board', 'smoke detected',
      'smoke in cargo', 'smell of burning', 'burning smell',
      'smoke from galley', 'smoke in avionics',
    ],
    stems_es: ['quemad'],
    stems_en: ['smoke'],
    abbreviations: ['SMOKE WARN'],
    colloquial_es: [
      'olia a quemado', 'habia humo', 'se llenó de humo',
      'olia raro', 'olor extrano en cabina',
    ],
    colloquial_en: ['smelled smoke', 'smoky cabin', 'something burning'],
    misspellings: ['umo en cabina', 'huomo', 'humo en cabina'],
    context_required_after: [],
    negative_triggers: [
      'sin humo', 'no hubo humo', 'no se detecto humo', 'sin presencia de humo',
      'no habia humo', 'humo descartado',
    ],
    conflicting_concepts: [],   // SMOKE and FIRE can coexist
    disambiguation_rule: 'SMOKE != FIRE. Visible smoke without confirmed flames -> SMOKE. Both can coexist in the same event.',
    severity: 'CRITICAL',
    negation_invalidates: true,
    hypothetical_reduces: 0.2,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'ENGINE_FAILURE',
    canonical_name: 'Falla de Motor',
    categories: ['Falla Técnica'],
    confidence_weight: 3.5,   // INITIAL
    priority: 85,
    requires_context: false,
    phrases_es: [
      'falla del motor', 'falla en el motor', 'falla de motor',
      'falla en motores', 'motor apagado', 'se apago el motor',
      'perdimos un motor', 'perdida del motor', 'averia del motor',
      'averia en el motor', 'motor sin potencia', 'motor fuera',
      'motor inoperativo', 'motor apagado en vuelo', 'motor se apago',
      'fallo del motor', 'perdida de empuje', 'motor flameo',
    ],
    phrases_en: [
      'engine failure', 'engine shutdown', 'loss of engine thrust',
      'engine malfunction', 'engine flameout', 'one engine inoperative',
      'engine failed', 'engine out', 'engine went out',
      'lost an engine', 'engine stopped', 'engine failure on departure',
      'engine unable', 'engine fire shutdown',
    ],
    stems_es: ['falla motor', 'fallo motor', 'averia motor'],
    stems_en: [],
    abbreviations: ['OEI', 'ENG FAIL', 'ENGINE FIRE SHUT'],
    colloquial_es: [
      'el motor se apago solo', 'el motor trono', 'tuvimos un motor menos',
      'el motor dejo de funcionar', 'perdimos propulsion',
    ],
    colloquial_en: ['engine went dead', 'dead engine', 'lost power on engine'],
    misspellings: ['falla del moto', 'engine faliure', 'enigne failure', 'falla de moto'],
    context_required_after: [],
    negative_triggers: [
      'motor funcionando', 'motor normal', 'sin falla', 'motor operativo',
      'ambos motores normales', 'motor sin novedad', 'motores normales',
      'motor revisado sin', 'motor en parametros', 'funcionando normalmente',
      'operando normalmente', 'sin anomalia', 'sin anomalia en motor',
    ],
    conflicting_concepts: ['ENGINE_NORMAL'],
    disambiguation_rule: 'ENGINE_FAILURE cancelled if ENGINE_NORMAL detected in same text. Negative triggers in window also cancel.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.4,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'ENGINE_NORMAL',
    canonical_name: 'Motor Operativo Normal (hard negative)',
    categories: [],           // activates NO category — it cancels ENGINE_FAILURE
    confidence_weight: 0.0,   // no positive score
    priority: 90,             // higher than ENGINE_FAILURE
    requires_context: false,
    phrases_es: [
      'motor funcionando normalmente', 'motor sin fallas', 'motor operativo',
      'ambos motores normales', 'motor revisado sin novedades',
      'motor en parametros normales', 'motores funcionando normal',
      'sin anomalia en motor', 'motor sin novedad', 'motores sin falla',
      'motor verificado sin problemas', 'motor ok',
    ],
    phrases_en: [
      'engine operating normally', 'engine normal', 'all engines operating',
      'engines within limits', 'no engine fault', 'engine checked ok',
      'engines functioning normally', 'no engine anomaly',
    ],
    stems_es: [],
    stems_en: [],
    abbreviations: [],
    colloquial_es: ['motor bien', 'motores andando bien', 'todo bien en motores'],
    colloquial_en: ['engines fine', 'engines okay', 'engines good'],
    misspellings: [],
    context_required_after: [],
    negative_triggers: [],
    conflicting_concepts: ['ENGINE_FAILURE'],
    disambiguation_rule: 'ENGINE_NORMAL (P=90) cancels ENGINE_FAILURE (P=85) when both detected.',
    severity: 'LOW',
    negation_invalidates: false,
    hypothetical_reduces: 1.0,
    source: 'INTERNAL',
    version: '2.0.0',
  },

  {
    id: 'FUEL_EMERGENCY',
    canonical_name: 'Emergencia de Combustible',
    categories: ['Fuel / Combustible'],
    confidence_weight: 4.0,   // INITIAL
    priority: 90,
    requires_context: false,
    phrases_es: [
      'emergencia de combustible', 'combustible insuficiente',
      'minimo combustible', 'fuga de combustible', 'derrame de combustible',
      'combustible en reserva minima', 'problema de combustible',
      'falla en indicacion de combustible', 'perdida de combustible',
      'combustible critico', 'combustible agotado', 'sin combustible suficiente',
      'derrame de fuel', 'escape de combustible',
    ],
    phrases_en: [
      'fuel emergency', 'minimum fuel', 'mayday fuel', 'fuel leak',
      'fuel exhaustion', 'low fuel state', 'fuel imbalance',
      'fuel quantity indication failure', 'fuel dumping', 'fuel loss',
      'fuel critically low', 'fuel starvation',
    ],
    stems_es: ['fuga combustible', 'derrame combustible'],
    stems_en: ['fuel leak', 'fuel dump'],
    abbreviations: ['MAYDAY FUEL', 'PAN PAN FUEL', 'MINIMUM FUEL', 'FUEL EMERG'],
    colloquial_es: [
      'nos quedamos sin combustible', 'el combustible se acabo',
      'perdiamos combustible', 'se fuga el combustible',
    ],
    colloquial_en: ['running out of fuel', 'fuel running low', 'losing fuel'],
    misspellings: ['combustible', 'combistible', 'fuel leak'],
    context_required_after: [],
    negative_triggers: [
      'combustible normal', 'combustible suficiente', 'sin fuga', 'sin fuga de combustible',
      'combustible en parametros', 'nivel de combustible normal',
    ],
    conflicting_concepts: [],
    disambiguation_rule: 'FUEL_EMERGENCY covers both fuel quantity emergencies and physical leaks. Fuel normal indicators cancel.',
    severity: 'CRITICAL',
    negation_invalidates: true,
    hypothetical_reduces: 0.4,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'RUNWAY_INCURSION',
    canonical_name: 'Incursión de Pista',
    categories: ['Incursión de Pista'],
    confidence_weight: 3.5,   // INITIAL
    priority: 80,
    requires_context: false,
    phrases_es: [
      'incursion de pista', 'incursion en pista', 'ingreso a la pista sin autorizacion',
      'cruzo la pista activa', 'cruzaron la pista', 'vehiculo en pista activa',
      'aeronave en pista sin permiso', 'ingreso no autorizado a pista',
      'ingreso no autorizado en pista', 'cruzar pista sin autorizacion',
    ],
    phrases_en: [
      'runway incursion', 'aircraft entered runway without clearance',
      'vehicle on active runway', 'unauthorized runway crossing',
      'runway conflict', 'entered runway without permission',
      'runway intrusion', 'unauthorized entry onto runway',
    ],
    stems_es: ['incursion pista'],
    stems_en: ['runway incursion'],
    abbreviations: ['RI', 'RIMCAS'],
    colloquial_es: [
      'se metio a la pista', 'cruzo sin permiso', 'invadio la pista',
      'entro a la pista sin clearance',
    ],
    colloquial_en: ['went onto runway', 'crossed without clearance'],
    misspellings: ['incurcion de pista', 'incursión de pista'],
    context_required_after: [],
    negative_triggers: ['no hubo incursion', 'sin incursion', 'incursion evitada sin incidente'],
    conflicting_concepts: [],
    disambiguation_rule: 'RUNWAY_INCURSION is specific to active runways. Ground damage without runway entry is not a runway incursion.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.3,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'UNLAWFUL_INTERFERENCE',
    canonical_name: 'Interferencia Ilícita / Secuestro',
    categories: ['Interferencia Ilícita'],
    confidence_weight: 5.0,   // INITIAL — highest security event
    priority: 100,
    requires_context: false,
    phrases_es: [
      'amenaza a la tripulacion', 'intento de secuestro', 'amenaza de bomba a bordo',
      'pasajero amenaza tripulacion', 'pasajero intento tomar los controles',
      'amenaza de explosivo', 'bomba a bordo', 'nota de amenaza en lavabo',
      'pasajero agresivo intento tomar controles', 'amenaza con objeto',
      'secuestro de aeronave', 'toma de rehenes a bordo',
    ],
    phrases_en: [
      'hijack attempt', 'unlawful interference', 'bomb threat',
      'passenger threatened crew', 'attempted to breach cockpit door',
      'threat note lavatory', 'squawk 7500', 'hijacking',
      'passenger attempted to seize controls', 'attempted takeover',
    ],
    stems_es: ['secuestro', 'amenaza bomba'],
    stems_en: ['hijack', 'bomb threat'],
    abbreviations: ['7500', 'SST 75', 'HIJACK'],
    colloquial_es: [
      'queran secuestrar el avion', 'pasajero loco tomo los controles',
      'amenazaron a la tripulacion',
    ],
    colloquial_en: ['tried to take over the plane', 'threatened the crew'],
    misspellings: ['secuestro', 'amenaza de bomba'],
    context_required_after: [],
    negative_triggers: [],  // threats are always critical regardless of outcome
    conflicting_concepts: [],
    disambiguation_rule: 'UNLAWFUL_INTERFERENCE covers all forms of unlawful interference per ICAO Annex 17. Squawk 7500 alone is sufficient.',
    severity: 'CRITICAL',
    negation_invalidates: false,   // a foiled hijacking is still an event
    hypothetical_reduces: 0.05,
    source: 'ICAO_8973',
    version: '2.0.0',
  },

  {
    id: 'MED_EMERGENCY',
    canonical_name: 'Emergencia Médica a Bordo',
    categories: ['Emergencia Médica'],
    confidence_weight: 3.5,   // INITIAL
    priority: 80,
    requires_context: false,
    phrases_es: [
      'emergencia medica a bordo', 'pasajero inconsciente', 'paro cardiaco a bordo',
      'ataque cardiaco a bordo', 'pasajero fallecido', 'medico solicitado en vuelo',
      'convulsiones a bordo', 'aed utilizado', 'desfibrilador a bordo',
      'emergencia medica pasajero', 'paciente a bordo', 'asistencia medica en vuelo',
      'tripulante incapacitado medicamente', 'piloto incapacitado',
    ],
    phrases_en: [
      'medical emergency', 'passenger unconscious', 'cardiac arrest on board',
      'aed applied', 'doctor on board requested', 'passenger unresponsive',
      'in-flight medical', 'medical incident', 'passenger collapsed',
      'passenger deceased on board', 'pilot incapacitation',
    ],
    stems_es: ['emergencia medic', 'paro cardiac'],
    stems_en: ['medical emerg', 'cardiac arrest'],
    abbreviations: ['AED', 'CPR', 'PAN MEDICAL', 'MEDEVAC'],
    colloquial_es: [
      'pasajero se desmayo', 'se puso mal a bordo', 'le dio el corazon',
      'pasajero no reacciona', 'perdio el conocimiento',
    ],
    colloquial_en: ['passenger fainted', 'medical problem on board', 'person collapsed'],
    misspellings: ['emergencia medica', 'paro cardiaco'],
    context_required_after: [],
    negative_triggers: [
      'pasajero en buenas condiciones', 'sin emergencia medica',
      'medico no requerido', 'sin incidentes medicos',
    ],
    conflicting_concepts: ['CREW_FATIGUE'],
    disambiguation_rule: 'MED_EMERGENCY is for PASSENGERS or medically incapacitated crew. CREW_FATIGUE is operational fatigue of active flight crew.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.3,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'CREW_FATIGUE',
    canonical_name: 'Fatiga de Tripulación',
    categories: ['Fatiga de Tripulación'],
    confidence_weight: 3.0,   // INITIAL
    priority: 75,
    requires_context: false,
    phrases_es: [
      'fatiga de tripulacion', 'capitan reporto fatiga', 'copiloto con fatiga',
      'jornada extendida', 'fdp excedido', 'tripulacion agotada',
      'copiloto se quedo dormido', 'somnolencia durante el vuelo',
      'horas de vuelo excedidas', 'tripulacion fatigada', 'piloto fatigado',
      'exceso de jornada', 'descanso insuficiente', 'ftl excedido',
    ],
    phrases_en: [
      'crew fatigue', 'pilot fatigue', 'fatigued crew', 'duty time exceeded',
      'fdp limits exceeded', 'crew rest violation', 'pilot fell asleep',
      'drowsy crew', 'sleep deprivation', 'exceeded flight time limits',
    ],
    stems_es: ['fatig', 'somnolenci'],
    stems_en: ['fatigue', 'fatigued'],
    abbreviations: ['FDP', 'FTL', 'FRMS'],
    colloquial_es: [
      'el copiloto se durmio', 'estabamos muertos de cansancio',
      'sin descanso previo', 'jornada larga sin dormir',
    ],
    colloquial_en: ['crew was exhausted', 'pilot was very tired', 'no rest before flight'],
    misspellings: ['fatiga tripulacion', 'fatiga de tripulacion'],
    context_required_after: [],
    negative_triggers: [
      'tripulacion descansada', 'sin fatiga reportada', 'horas normales de jornada',
    ],
    conflicting_concepts: ['MED_EMERGENCY'],
    disambiguation_rule: 'CREW_FATIGUE is operational (FDP/FTL related). If copilot was unconscious due to medical cause -> MED_EMERGENCY wins.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.4,
    source: 'EASA',
    version: '2.0.0',
  },

  // ══════════════════════════════════════════════════════
  // EXTENDED CONCEPTS (Phase 1 additional coverage)
  // ══════════════════════════════════════════════════════

  {
    id: 'BIRD_STRIKE',
    canonical_name: 'Impacto de Aves',
    categories: ['Bird Strike'],
    confidence_weight: 3.5,
    priority: 85,
    requires_context: false,
    phrases_es: [
      'bird strike', 'impacto de ave', 'colision aviar', 'ave impacto motor',
      'pajaro en motor', 'pajaros en motor', 'ave impacto', 'colision con ave',
      'pajaro impacto', 'aves impactaron', 'impacto aviar', 'ingesta de ave',
      'colision con aves', 'aves en motor', 'aves en el motor',
      'impacto de aves', 'colision con pajaro', 'impacto con ave',
    ],
    phrases_en: [
      'bird strike', 'bird ingestion', 'bird hit', 'avian strike',
      'bird impact', 'wildlife strike', 'bird sucked into engine',
    ],
    stems_es: ['pajar', 'aves'],   // single-token: pajar→pajaro/pajaros, aves→aves
    stems_en: [],
    abbreviations: ['BS', 'WILDLIFE STRIKE'],
    colloquial_es: ['pajaro se metio en el motor', 'chocamos con un pajaro'],
    colloquial_en: ['hit a bird', 'bird got into engine'],
    misspellings: ['birdstrike', 'bird srrike', 'pájaro impactó'],
    context_required_after: [],
    negative_triggers: [
      'no hubo impacto aviar', 'sin bird strike',
      // FIX 5 (Phase 1.6): post-match negators for "aves en zona; ninguna colisionó"
      'ninguna colisiono', 'ninguno colisiono', 'sin contacto con la aeronave',
      'no impactaron', 'no colisionaron', 'sin impacto', 'no hubo colision',
      'sin colision', 'aves en el aeropuerto sin', 'no hubo bird strike',
      'none struck', 'did not strike', 'no contact with aircraft',
    ],
    conflicting_concepts: [],
    disambiguation_rule: 'Bird strike is always specific. FOD from ground operations is NOT a bird strike. Birds in airport area WITHOUT collision are NOT a bird strike.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.3,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'TCAS_RA',
    canonical_name: 'TCAS Resolution Advisory',
    categories: ['TCAS RA'],
    confidence_weight: 4.0,
    priority: 90,
    requires_context: false,
    phrases_es: [
      'tcas ra', 'resolution advisory', 'trafico cercano', 'conflicto de trafico',
      'tcas emitio ra', 'aviso de resolucion', 'alerta tcas ra',
    ],
    phrases_en: [
      'tcas ra', 'resolution advisory', 'tcas resolution advisory',
      'traffic advisory', 'tcas alert', 'collision avoidance maneuver',
    ],
    stems_es: ['tcas', 'resolution advisory'],
    stems_en: ['tcas', 'resolution advis'],
    abbreviations: ['TCAS RA', 'RA', 'TCAS II'],
    colloquial_es: ['el tcas activó', 'tcas nos mandó a subir', 'conflicto de tráfico'],
    colloquial_en: ['tcas went off', 'got a tcas ra'],
    misspellings: ['tcas r.a.', 'tcas-ra'],
    context_required_after: [],
    negative_triggers: ['sin tcas ra', 'no se emitio ra'],
    conflicting_concepts: [],
    disambiguation_rule: 'TCAS TA (traffic advisory only) is less severe than RA. If RA is explicit -> TCAS_RA. If only TA -> review.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.3,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'GPWS',
    canonical_name: 'GPWS / TAWS Alert',
    categories: ['GPWS'],
    confidence_weight: 4.0,
    priority: 90,
    requires_context: false,
    phrases_es: [
      'gpws', 'terrain pull up', 'pull up terrain', 'too low terrain',
      'sink rate', 'alarma gpws', 'alerta gpws', 'gpws activo',
      'advertencia de terreno', 'alerta de proximidad al terreno',
    ],
    phrases_en: [
      'gpws', 'taws', 'terrain pull up', 'pull up terrain',
      'too low terrain', 'sink rate warning', 'gpws alert',
      'ground proximity warning', 'terrain warning',
    ],
    stems_es: ['gpws', 'pull up'],
    stems_en: ['gpws', 'taws', 'terrain warn'],
    abbreviations: ['GPWS', 'TAWS', 'EGPWS'],
    colloquial_es: ['el gpws sono', 'alerto el gpws'],
    colloquial_en: ['gpws went off', 'terrain alert'],
    misspellings: ['g.p.w.s.'],
    context_required_after: [],
    negative_triggers: ['gpws probado', 'gpws test', 'gpws revisado'],
    conflicting_concepts: [],
    disambiguation_rule: 'GPWS includes CFIT scenarios. CFIT -> GPWS category.',
    severity: 'CRITICAL',
    negation_invalidates: false,  // a GPWS activation is always an event
    hypothetical_reduces: 0.2,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'DEPRESSURIZATION',
    canonical_name: 'Despresurización / Pérdida de Presión en Cabina',
    categories: ['Presurización'],
    confidence_weight: 3.5,
    priority: 85,
    requires_context: false,
    phrases_es: [
      'descompresion', 'descompresion rapida', 'perdida de presion en cabina',
      'presurizacion falla', 'falla de presurizacion', 'cabina sin presion',
      'mascaras desplegadas automaticamente', 'perdida de presion de cabina',
      'presion cabina', 'descenso de emergencia por presion',
    ],
    phrases_en: [
      'depressurization', 'cabin pressure loss', 'rapid decompression',
      'pressurization failure', 'masks deployed', 'oxygen masks deployed',
      'cabin pressure failure', 'loss of pressurization',
    ],
    stems_es: ['descompresion', 'presurizacion'],
    stems_en: ['depressur', 'pressur fail'],
    abbreviations: ['EMERG DESCENT', 'RAPID DECOMP'],
    colloquial_es: ['se despresurizó la cabina', 'cayeron las mascaras'],
    colloquial_en: ['cabin lost pressure', 'masks dropped', 'had to descend fast'],
    misspellings: ['despresurizacion', 'despresurización'],
    context_required_after: [],
    negative_triggers: ['presion normal', 'presurizacion normal', 'sin perdida de presion'],
    conflicting_concepts: [],
    disambiguation_rule: 'DEPRESSURIZATION includes both rapid and gradual loss of pressurization.',
    severity: 'CRITICAL',
    negation_invalidates: true,
    hypothetical_reduces: 0.3,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'GROUND_DAMAGE',
    canonical_name: 'Daño en Tierra / Daño en Plataforma',
    categories: ['Ground Damage'],
    confidence_weight: 3.0,
    priority: 70,
    requires_context: false,
    phrases_es: [
      'dano en plataforma', 'colision en plataforma', 'vehiculo golpeo aeronave',
      'golpeo el fuselaje', 'dano al estabilizador', 'pushback golpeo',
      'catering truck golpeo', 'escalerilla golpeo', 'colision tractor',
      'dano en tierra', 'dano durante rodaje', 'impacto en plataforma',
      'colision con remolcador', 'remolcador golpeo', 'remolcador choco',
      'danos en plataforma', 'dano al ala', 'danos al ala',
      'vehiculo de servicio golpeo', 'golpe en plataforma',
    ],
    phrases_en: [
      'ground damage', 'ramp damage', 'vehicle struck aircraft',
      'ground service vehicle struck', 'wing tip damage', 'tail strike on ground',
      'pushback accident', 'ramp collision', 'ground collision',
    ],
    stems_es: ['remolcad'],   // single-token: remolcador, remolcadora
    stems_en: [],
    abbreviations: ['GD'],
    colloquial_es: ['el camion le pego al avion', 'chocaron en rampa'],
    colloquial_en: ['truck hit the plane', 'ramp accident'],
    misspellings: ['daño en plataforma'],
    context_required_after: [],
    negative_triggers: ['sin dano', 'sin danos en tierra', 'revision sin danos'],
    conflicting_concepts: [],
    disambiguation_rule: 'GROUND_DAMAGE is in-ground events. FOD is foreign object on runway/taxiway. Both can coexist.',
    severity: 'MEDIUM',
    negation_invalidates: true,
    hypothetical_reduces: 0.5,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'TURBULENCE',
    canonical_name: 'Turbulencia',
    categories: ['Turbulencia'],
    confidence_weight: 3.0,
    priority: 70,
    requires_context: false,
    phrases_es: [
      'turbulencia severa', 'turbulencia moderada', 'turbulencia en crucero',
      'turbulencia en aire claro', 'turbulencia en ascenso', 'encuentro de turbulencia',
      'turbulencia en descenso', 'cat encontrado', 'turbulencia significativa',
    ],
    phrases_en: [
      'severe turbulence', 'clear air turbulence', 'cat encounter',
      'moderate turbulence', 'turbulence encounter', 'in-flight turbulence',
    ],
    stems_es: ['turbulenci'],
    stems_en: ['turbulence'],
    abbreviations: ['CAT', 'TURB'],
    colloquial_es: ['hubo mucha turbulencia', 'el avion cabeceó fuerte'],
    colloquial_en: ['very bumpy', 'rough air', 'bad turbulence'],
    misspellings: ['turbulência', 'turbulencia'],
    context_required_after: [],
    negative_triggers: ['sin turbulencia', 'vuelo sin turbulencia'],
    conflicting_concepts: [],
    disambiguation_rule: 'Wake turbulence (WAKE_TURB) is distinct from atmospheric turbulence.',
    severity: 'MEDIUM',
    negation_invalidates: true,
    hypothetical_reduces: 0.5,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'ATC_INCIDENT',
    canonical_name: 'Incidencia ATC',
    categories: ['Incidencia ATC'],
    confidence_weight: 3.5,
    priority: 80,
    requires_context: false,
    phrases_es: [
      'error de atc', 'error del control de trafico', 'separacion minima',
      'perdida de separacion', 'instruccion incorrecta de atc',
      'atc emitio clearance incorrecto', 'falla de atc', 'conflicto de trafico atc',
      'controlador aereo error', 'clearance incorrecto',
    ],
    phrases_en: [
      'atc error', 'loss of separation', 'controller error', 'atc clearance error',
      'air traffic control error', 'conflict due to atc', 'atc failure',
      'separation loss due to atc',
    ],
    stems_es: ['error atc', 'perdida separacion'],
    stems_en: ['atc error', 'loss of separation'],
    abbreviations: ['ATC', 'APP', 'TWR', 'CTR'],
    colloquial_es: ['el control se equivoco', 'atc nos mando a la misma altitud'],
    colloquial_en: ['atc messed up', 'controller gave wrong altitude'],
    misspellings: ['a.t.c. error'],
    context_required_after: [],
    negative_triggers: ['sin error de atc', 'atc correcto'],
    conflicting_concepts: [],
    disambiguation_rule: 'ATC_INCIDENT is when ATC contributed to the event. TCAS_RA can coexist.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.4,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'DANGEROUS_GOODS',
    canonical_name: 'Mercancías Peligrosas',
    categories: ['Mercancías Peligrosas'],
    confidence_weight: 3.5,
    priority: 80,
    requires_context: false,
    phrases_es: [
      'mercancias peligrosas', 'carga peligrosa no declarada', 'materiales peligrosos',
      'sustancias inflamables no declaradas', 'baterias de litio no declaradas',
      'material peligroso sin etiquetar', 'hazmats', 'hazmat encontrado',
      'carga restringida no declarada',
    ],
    phrases_en: [
      'dangerous goods', 'undeclared dangerous goods', 'hazmat', 'hazardous materials',
      'undeclared lithium batteries', 'restricted cargo', 'dangerous cargo',
    ],
    stems_es: ['mercancias peligrosas', 'hazmat'],
    stems_en: ['dangerous goods', 'hazmat'],
    abbreviations: ['DG', 'HAZMAT', 'IATA DGR'],
    colloquial_es: ['tenia materiales peligrosos sin declarar', 'baterias no declaradas'],
    colloquial_en: ['undeclared batteries', 'had dangerous goods'],
    misspellings: ['mercancias peligrosas', 'mercancías peligrosas'],
    context_required_after: [],
    negative_triggers: ['mercancias correctamente declaradas', 'sin mercancias peligrosas'],
    conflicting_concepts: [],
    disambiguation_rule: 'DANGEROUS_GOODS covers undeclared/improperly handled DG. Properly declared DG in transit is not an event.',
    severity: 'HIGH',
    negation_invalidates: true,
    hypothetical_reduces: 0.4,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'HARD_LANDING',
    canonical_name: 'Aterrizaje Brusco / Hard Landing',
    categories: ['Hard Landing'],
    confidence_weight: 3.0,
    priority: 70,
    requires_context: false,
    phrases_es: [
      'hard landing', 'aterrizaje brusco', 'aterrizaje fuerte', 'tasa de descenso excesiva',
      'tasa de descenso superior', 'touchdown brusco', 'aterrizaje duro',
    ],
    phrases_en: [
      'hard landing', 'firm touchdown', 'heavy landing', 'hard touch',
      'touchdown exceeded limits', 'exceeded sink rate on landing',
    ],
    stems_es: ['hard landing', 'aterrizaje brusco'],
    stems_en: ['hard landing', 'heavy landing'],
    abbreviations: [],
    colloquial_es: ['aterrizaje muy brusco', 'tocaron muy fuerte'],
    colloquial_en: ['really hard landing', 'slammed down'],
    misspellings: ['hard-landing'],
    context_required_after: [],
    negative_triggers: ['aterrizaje normal', 'aterrizaje suave', 'landing normal'],
    conflicting_concepts: [],
    disambiguation_rule: 'HARD_LANDING triggers structural inspection. Distinguish from normal firm touchdowns within parameters.',
    severity: 'MEDIUM',
    negation_invalidates: true,
    hypothetical_reduces: 0.5,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  {
    id: 'FOD',
    canonical_name: 'Objeto Extraño en Pista (FOD)',
    categories: ['FOD'],
    confidence_weight: 3.0,
    priority: 70,
    requires_context: false,
    phrases_es: [
      'fod', 'objeto extrano en pista', 'objeto extrano en rodaje',
      'objeto extrano en plataforma', 'desecho en pista', 'extraneo en pista',
    ],
    phrases_en: [
      'fod', 'foreign object debris', 'foreign object on runway',
      'debris on runway', 'fod found on taxiway',
    ],
    stems_es: ['fod', 'objeto extrano'],
    stems_en: ['fod', 'foreign object'],
    abbreviations: ['FOD'],
    colloquial_es: ['habia algo en la pista', 'basura en la pista'],
    colloquial_en: ['debris on runway', 'something on taxiway'],
    misspellings: ['F.O.D.'],
    context_required_after: [],
    negative_triggers: ['sin fod', 'pista sin fod'],
    conflicting_concepts: [],
    disambiguation_rule: 'FOD is foreign object on movement areas. Not to be confused with bird strike.',
    severity: 'MEDIUM',
    negation_invalidates: true,
    hypothetical_reduces: 0.5,
    source: 'ICAO_ADREP',
    version: '2.0.0',
  },

  // Hard negative concepts — activate NO category but cancel false positives
  {
    id: 'ROUTINE_MAINTENANCE',
    canonical_name: 'Mantenimiento Rutinario / Entrenamiento (hard negative)',
    categories: [],
    confidence_weight: 0.0,
    priority: 60,
    requires_context: false,
    phrases_es: [
      'mantenimiento rutinario', 'revision de mantenimiento', 'inspeccion de rutina',
      'mantenimiento preventivo completado', 'revision programada completada',
      'verificacion sin hallazgos', 'revision sin novedad', 'mantenimiento normal',
      // FIX 2 (Phase 1.6): simulator/training context
      'en simulador', 'entrenamiento en simulador', 'practica en simulador',
      'ejercicio de emergencia', 'adiestramiento en simulador', 'simulacro de emergencia',
      'durante el entrenamiento en simulador', 'practico el procedimiento',
      'se practico el procedimiento', 'ejercicio en simulador',
    ],
    phrases_en: [
      'routine maintenance', 'scheduled maintenance', 'routine inspection',
      'maintenance check completed', 'no findings', 'maintenance completed normally',
      // FIX 2 (Phase 1.6): simulator/training context
      'in the simulator', 'during training', 'simulator training', 'emergency drill',
      'practiced the procedure', 'training exercise', 'simulator exercise',
    ],
    stems_es: ['simulador'],   // FIX 2: single-token stem covers 'simulador'
    stems_en: [],
    abbreviations: [],
    colloquial_es: ['mantenimiento normal', 'revision ok'],
    colloquial_en: ['routine check done', 'maintenance ok'],
    misspellings: [],
    context_required_after: [],
    negative_triggers: [],
    conflicting_concepts: [],  // cancels ENGINE_FAILURE, FOD if paired
    disambiguation_rule: 'Routine maintenance with no findings is NOT an SMS event.',
    severity: 'LOW',
    negation_invalidates: false,
    hypothetical_reduces: 1.0,
    source: 'INTERNAL',
    version: '2.0.0',
  },

  {
    id: 'OUT_OF_SCOPE_CATERING',
    canonical_name: 'Incidente No-SMS: Catering / Limpieza / Servicio (hard negative)',
    categories: [],
    confidence_weight: 0.0,
    priority: 55,
    requires_context: false,   // FIX 4: no longer require location context word
    phrases_es: [
      // Equipment breakdown (original)
      'camion de catering roto', 'maquina de limpieza rota', 'catering roto',
      'equipo de limpieza averiado', 'limpieza del hangar',
      // FIX 4 (Phase 1.6): employee injuries — non-aeronautical personal incidents
      'empleado de catering se corto', 'se corto la mano', 'corto la mano',
      'trabajador de catering se lesiono', 'empleado de limpieza se lesiono',
      'herida de empleado de catering', 'trabajador de servicio se corto',
      // FIX 4: industrial/laundry/non-aviation equipment faults
      'lavadora industrial', 'lavadora del hangar', 'secadora industrial',
      'averia en lavadora', 'averia de lavadora', 'equipo de cocina averiado',
      'averia electrica en hangar', 'equipo industrial averiado',
      // FIX 4: vehicle breakdowns unrelated to aircraft operations
      'camion de catering llanta', 'llanta ponchada del camion de catering',
      'neumatico del camion de catering', 'falla mecanica del camion de catering',
      'catering truck flat tire', 'flat tire catering',
    ],
    phrases_en: [
      'catering truck broken', 'cleaning machine broken', 'cleaning vehicle damaged',
      // FIX 4 (Phase 1.6)
      'catering employee cut hand', 'catering worker injured', 'cleaning staff injured',
      'industrial washing machine', 'hangar washing machine broke',
      'laundry machine fault', 'kitchen equipment failure', 'catering truck flat tire',
      'flat tyre catering truck', 'catering truck tyre',
    ],
    stems_es: [],
    stems_en: [],
    abbreviations: [],
    colloquial_es: ['se corto con la bandeja', 'lavadora rota en hangar'],
    colloquial_en: ['cut hand with tray', 'flat tire on catering truck'],
    misspellings: [],
    context_required_after: [],   // FIX 4: removed context requirement
    negative_triggers: [],
    conflicting_concepts: [],
    disambiguation_rule: 'Non-aeronautical personal injuries, laundry/kitchen equipment and vehicle breakdowns are out of SMS scope. Must NOT capture: smoke from galley, fuel spill, aircraft damage.',
    severity: 'LOW',
    negation_invalidates: false,
    hypothetical_reduces: 1.0,
    source: 'INTERNAL',
    version: '2.0.0',
  },
];

// ── Normalization pass on all phrase arrays ────────────────────────────────
const LEXICON = LEXICON_RAW.map(c => ({
  ...c,
  _phrases_es: c.phrases_es.map(_n),
  _phrases_en: c.phrases_en.map(_n),
  _stems_es:   c.stems_es.map(_n),
  _stems_en:   c.stems_en.map(_n),
  _abbrev:     c.abbreviations.map(a => a.toLowerCase()),
  _colloquial_es: c.colloquial_es.map(_n),
  _colloquial_en: c.colloquial_en.map(_n),
  _misspellings:  c.misspellings.map(_n),
  _context_after: c.context_required_after.map(_n),
  _neg_triggers:  c.negative_triggers.map(_n),
}));

// Build a fast lookup: category → all concepts that activate it
const CATEGORY_TO_CONCEPTS = {};
for (const c of LEXICON) {
  for (const cat of c.categories) {
    if (!CATEGORY_TO_CONCEPTS[cat]) CATEGORY_TO_CONCEPTS[cat] = [];
    CATEGORY_TO_CONCEPTS[cat].push(c.id);
  }
}

module.exports = { LEXICON, CATEGORY_TO_CONCEPTS };
