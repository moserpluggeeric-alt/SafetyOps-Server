'use strict';
/**
 * PHASE 1.6 — FULL VALIDATION BATTERY
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs ALL required validation cases:
 *   A) Phase 1 original battery (32 cases)
 *   B) Phase 1.5 adversarial battery (116 cases)
 *   C) SafetyOps critical known cases (19)
 *   D) Negation cases (5)
 *   E) Hypothetical cases (4)
 *   F) Concept coexistence cases (4)
 *
 * For each case: V1 vs V2 comparison with full metrics.
 * NO COMMIT · NO PUSH · NO RAILWAY · LOCAL DEV ONLY.
 */

// ── Flush require cache so fresh modules are loaded ──────────────────────────
Object.keys(require.cache).forEach(k => delete require.cache[k]);
const { clasificar }    = require('./classifier');
const { clasificarV2 }  = require('./classifier-v2');
const { extractConcepts } = require('./concept-extractor');
const { analyzeContext }  = require('./context-engine');

process.env.USE_LEXICON_V2 = 'true';

// ── Shared helpers ────────────────────────────────────────────────────────────
function _n(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[''´`]/g, "'");
}

function runV1(text, lang) {
  try { return clasificar(text, lang || 'es'); }
  catch(e) { return null; }
}
function runV2(text, lang) {
  try { return clasificarV2(text, lang || 'es'); }
  catch(e) { return null; }
}

function catOf(r)   { return r ? r.categoria : null; }
function confOf(r)  { return r ? +(r.confianza||0).toFixed(3) : 0; }
function revisar(r) { return r ? !!r._revisarManualmente : false; }

// ── BATTERY A — Phase 1 original (32 cases) ──────────────────────────────────
const BATTERY_A = [
  // Group 1: FIRE / SMOKE
  { id:'L01', g:'A_FIRE',    text:'Se detectó humo en la cabina de pasajeros y tripulación activó protocolo.', lang:'es', expectCat:'Smoke / Humo a Bordo' },
  { id:'L02', g:'A_FIRE',    text:'Olor a humo proveniente del compartimento de equipaje.', lang:'es', expectCat:'Smoke / Humo a Bordo' },
  { id:'L03', g:'A_FIRE',    text:'Alarma de incendio activada en bodega durante el vuelo.', lang:'es', expectCat:'Incendio' },
  { id:'L04', g:'A_FIRE',    text:'Fire alarm activated in cargo hold during flight.', lang:'en', expectCat:'Incendio' },
  { id:'L05', g:'A_NEGATION',text:'No se detectó humo, pero el pasajero reportó olor extraño.', lang:'es', expectCat:null, checkRevisar:true },
  // Group 2: ENGINE
  { id:'L06', g:'A_ENGINE',  text:'Falla del motor número 2 durante el ascenso.', lang:'es', expectCat:'Falla Técnica' },
  { id:'L07', g:'A_ENGINE',  text:'Engine failure on takeoff roll — crew declared emergency.', lang:'en', expectCat:'Falla Técnica' },
  { id:'L08', g:'A_ENGINE',  text:'Vibración anormal detectada en motor izquierdo en crucero.', lang:'es', expectCat:'Falla Técnica' },
  // Group 3: BIRD STRIKE
  { id:'L09', g:'A_BIRD',    text:'Impacto de ave en motor derecho durante el despegue.', lang:'es', expectCat:'Bird Strike' },
  { id:'L10', g:'A_BIRD',    text:'Bird strike on engine 1 — FOD debris found.', lang:'en', expectCat:'Bird Strike' },
  // Group 4: FIREARM
  { id:'L11', g:'A_FIREARM', text:'Se encontró un arma de fuego no declarada en el equipaje de bodega.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'L12', g:'A_FIREARM', text:'Undeclared firearm found in checked baggage during security screening.', lang:'en', expectCat:'Seguridad Aeroportuaria' },
  // Group 5: FUEL
  { id:'L13', g:'A_FUEL',    text:'Derrame de combustible en ala izquierda durante el abastecimiento.', lang:'es', expectCat:'Fuel / Combustible' },
  { id:'L14', g:'A_FUEL',    text:'Fuel spill on left wing during refueling.', lang:'en', expectCat:'Fuel / Combustible' },
  // Group 6: RUNWAY
  { id:'L15', g:'A_RUNWAY',  text:'Incursión en pista — aeronave cruzó sin autorización ATC.', lang:'es', expectCat:'Incursión de Pista' },
  { id:'L16', g:'A_RUNWAY',  text:'Runway incursion — aircraft crossed runway without ATC clearance.', lang:'en', expectCat:'Incursión de Pista' },
  // Group 7: GROUND DAMAGE
  { id:'L17', g:'A_GROUND',  text:'Daños en el fuselaje por impacto de equipo de rampa durante empuje.', lang:'es', expectCat:'Ground Damage' },
  { id:'L18', g:'A_GROUND',  text:'Ground damage to wing tip caused by ground support vehicle.', lang:'en', expectCat:'Ground Damage' },
  // Group 8: SECURITY
  { id:'L19', g:'A_SECURITY',text:'Pasajero amenazó a otro con un objeto punzante a bordo.', lang:'es', expectCat:'Interferencia Ilícita' },
  { id:'L20', g:'A_SECURITY',text:'Passenger threatened crew member with a sharp object during boarding.', lang:'en', expectCat:'Interferencia Ilícita' },
  // Group 9: ENGINE_NORMAL hard-negative
  { id:'L21', g:'A_HARDNEG', text:'El motor operaba dentro de parámetros normales. Sin anomalías reportadas.', lang:'es', expectCat:null, checkRevisar:true },
  { id:'L22', g:'A_HARDNEG', text:'Engine performance normal throughout the flight. No anomalies detected.', lang:'en', expectCat:null, checkRevisar:true },
  // Group 10: FATIGUE
  { id:'L23', g:'A_FATIGUE', text:'Tripulante reportó fatiga extrema antes del vuelo y fue relevado.', lang:'es', expectCat:'Fatiga de Tripulación' },
  { id:'L24', g:'A_FATIGUE', text:'Flight crew reported excessive fatigue — captain replaced before departure.', lang:'en', expectCat:'Fatiga de Tripulación' },
  // Group 11: TCAS
  { id:'L25', g:'A_TCAS',    text:'TCAS RA emitido — tripulación ejecutó maniobra de resolución.', lang:'es', expectCat:'TCAS RA' },
  { id:'L26', g:'A_TCAS',    text:'TCAS resolution advisory triggered — crew complied.', lang:'en', expectCat:'TCAS RA' },
  // Group 12: MIXED/EDGE
  { id:'L27', g:'A_MIXED',   text:'Se encontró un arma de fuego y además había humo en la cabina.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'L28', g:'A_MIXED',   text:'Firearm discovered AND smoke detected in cabin — dual incident.', lang:'en', expectCat:'Seguridad Aeroportuaria' },
  { id:'L29', g:'A_NEGATION',text:'No se detectó fuego en la aeronave durante la revisión.', lang:'es', expectCat:null, checkRevisar:true },
  { id:'L30', g:'A_MIXED',   text:'Catering truck damaged aircraft fuselage during push-back.', lang:'en', expectCat:'Ground Damage' },
  { id:'L31', g:'A_MIXED',   text:'Dangerous goods — undeclared lithium batteries found in passenger bag.', lang:'en', expectCat:'Mercancias Peligrosas' },
  { id:'L32', g:'A_MIXED',   text:'ATC issued incorrect clearance — runway incursion resulted.', lang:'en', expectCat:'Incursión de Pista' },
];

// ── BATTERY B — Phase 1.5 adversarial (116 cases) ────────────────────────────
const BATTERY_B = [
  // GROUP A: FIREARM vs FIRE
  { id:'A01', g:'B_FIREARM', text:'Se encontró un arma de fuego oculta en el equipaje de mano del pasajero.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'A02', g:'B_FIREARM', text:'Pasajero portaba arma de fuego sin declarar; fue detenido en la puerta.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'A03', g:'B_FIREARM', text:'Arma hallada tras el aterrizaje durante revisión de equipaje.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'A04', g:'B_FIREARM', text:'No hubo fuego, pero se encontró un arma de fuego en la bodega del avión.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkNot:'Incendio', safetyRisk:'CRITICAL' },
  { id:'A05', g:'B_FIREARM', text:'Se detectó fuego en la bodega pero era un arma de fuego, no un incendio real.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkNot:'Incendio' },
  { id:'A06', g:'B_FIREARM', text:'El fuego fue provocado intencionalmente; se encontró un encendedor y restos.', lang:'es', expectCat:'Incendio' },
  { id:'A07', g:'B_FIREARM', text:'Incendio en la cabina con humo visible y extintor activado.', lang:'es', expectCat:'Incendio' },
  { id:'A08', g:'B_FIREARM', text:'Fire in the galley — crew used extinguisher. No firearm involved.', lang:'en', expectCat:'Incendio' },
  { id:'A09', g:'B_FIREARM', text:'Passengers reported smelling smoke; firearm also found in carry-on.', lang:'en', expectCat:'Seguridad Aeroportuaria' },
  { id:'A10', g:'B_FIREARM', text:'Dos armas incautadas; ninguna munición. Sin incidente de fuego.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkNot:'Incendio', checkRevisar:false },
  { id:'A11', g:'B_FIREARM', text:'Weapon detected by X-ray at security checkpoint — passenger arrested.', lang:'en', expectCat:'Seguridad Aeroportuaria' },
  { id:'A12', g:'B_FIREARM', text:'Smoke detected in lavatory; unrelated to firearm found in luggage separately.', lang:'en', expectCat:'Smoke / Humo a Bordo' },
  { id:'A13', g:'B_FIREARM', text:'Alarma de incendio activada en bodega. No hubo arma.', lang:'es', expectCat:'Incendio' },
  { id:'A14', g:'B_FIREARM', text:'Revisión de seguridad reveló arma. Sin humo ni fuego asociado.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'A15', g:'B_FIREARM', text:'Crew reported smoke smell; security later found a firearm in cargo.', lang:'en', expectCat:'Incendio' },
  // GROUP B: ENGINE
  { id:'B01', g:'B_ENGINE',  text:'El motor presentó una falla súbita al aumentar la potencia.', lang:'es', expectCat:'Falla Técnica' },
  { id:'B02', g:'B_ENGINE',  text:'Motor apagado en vuelo — tripulación declaró emergencia.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'B03', g:'B_ENGINE',  text:'Falla de motor en despegue — se abortó el vuelo.', lang:'es', expectCat:'Falla Técnica' },
  { id:'B04', g:'B_ENGINE',  text:'Pérdida de potencia gradual en motor 2 durante crucero.', lang:'es', expectCat:'Falla Técnica' },
  { id:'B05', g:'B_ENGINE',  text:'Engine parameters normal during entire flight.', lang:'en', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'B06', g:'B_ENGINE',  text:'El motor funcionaba normalmente durante el ascenso; sin embargo, presentó una falla en crucero.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'B07', g:'B_ENGINE',  text:'Engine operated within normal limits; no anomaly noted.', lang:'en', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'B08', g:'B_ENGINE',  text:'El sistema de monitoreo mostró el motor dentro de rangos normales.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'B09', g:'B_ENGINE',  text:'Falla de motor número 1 con pérdida de empuje en ascenso inicial.', lang:'es', expectCat:'Falla Técnica' },
  { id:'B10', g:'B_ENGINE',  text:'Durante el entrenamiento en simulador se practicó el procedimiento de falla de motor.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true, safetyRisk:'MEDIUM' },
  { id:'B11', g:'B_ENGINE',  text:'Se reportó vibración en motor; parámetros en rango normal al aterrizar.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'B12', g:'B_ENGINE',  text:'No se detectó humo, pero hubo una falla del motor número dos.', lang:'es', expectCat:'Falla Técnica', checkNot:'Incendio' },
  { id:'B13', g:'B_ENGINE',  text:'Falla de motor con pérdida de combustible simultánea.', lang:'es', expectCat:'Falla Técnica' },
  { id:'B14', g:'B_ENGINE',  text:'Suspected engine surge on takeoff roll; crew confirmed normal after.', lang:'en', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'B15', g:'B_ENGINE',  text:'Avería del motor izquierdo con humo blanco visible.', lang:'es', expectCat:'Falla Técnica' },
  // GROUP C: RUNWAY
  { id:'C01', g:'B_RUNWAY',  text:'Aeronave ingresó a pista activa sin autorización de la torre.', lang:'es', expectCat:'Incursión de Pista' },
  { id:'C02', g:'B_RUNWAY',  text:'Cruce de calle de rodaje sin clearance del controlador.', lang:'es', expectCat:'Incursión de Pista' },
  { id:'C03', g:'B_RUNWAY',  text:'Piloto leyó mal la instrucción y ocupó pista equivocada.', lang:'es', expectCat:'Incursión de Pista' },
  { id:'C04', g:'B_RUNWAY',  text:'ATC emitió una instrucción de rodaje incorrecta al piloto.', lang:'es', expectCat:'Incidencia ATC' },
  { id:'C05', g:'B_RUNWAY',  text:'Piloto no confirmó posición en la pista antes de despegue.', lang:'es', expectCat:'Incursión de Pista', checkRevisar:true },
  { id:'C06', g:'B_RUNWAY',  text:'Runway occupied by aircraft awaiting takeoff without clearance.', lang:'en', expectCat:'Incursión de Pista' },
  { id:'C07', g:'B_RUNWAY',  text:'Aircraft lined up on runway 09 instead of 09L.', lang:'en', expectCat:'Incursión de Pista' },
  { id:'C08', g:'B_RUNWAY',  text:'Aeronave cruzó pista activa sin comunicación con torre.', lang:'es', expectCat:'Incursión de Pista' },
  { id:'C09', g:'B_RUNWAY',  text:'Crew entered runway holding position without clearance.', lang:'en', expectCat:'Incursión de Pista', checkRevisar:true },
  { id:'C10', g:'B_RUNWAY',  text:'Controlador confundió marcaciones de pista y dio clearance erróneo.', lang:'es', expectCat:'Incursión de Pista' },
  // GROUP D: FUEL
  { id:'D01', g:'B_FUEL',    text:'Contaminación de combustible detectada antes del vuelo.', lang:'es', expectCat:'Fuel / Combustible' },
  { id:'D02', g:'B_FUEL',    text:'Fuel contamination found during pre-flight check.', lang:'en', expectCat:'Fuel / Combustible' },
  { id:'D03', g:'B_FUEL',    text:'Derrame de combustible en la plataforma durante reabastecimiento.', lang:'es', expectCat:'Fuel / Combustible' },
  { id:'D04', g:'B_FUEL',    text:'Niveles de combustible dentro de parámetros normales; sin pérdida ni derrame.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true, safetyRisk:'HIGH' },
  { id:'D05', g:'B_FUEL',    text:'Fuel imbalance detected between tanks; crew followed FCOM procedures, no emergency.', lang:'en', expectCat:'Fuel / Combustible', checkRevisar:true },
  { id:'D06', g:'B_FUEL',    text:'Fuel leak found in right engine nacelle after landing.', lang:'en', expectCat:'Fuel / Combustible' },
  { id:'D07', g:'B_FUEL',    text:'El cálculo de combustible fue correcto y no hubo pérdida durante el vuelo.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true, safetyRisk:'HIGH' },
  { id:'D08', g:'B_FUEL',    text:'Tripulación reportó alarma de bajo combustible; verificación mostró nivel normal.', lang:'es', expectCat:'Fuel / Combustible' },
  { id:'D09', g:'B_FUEL',    text:'Derrame menor de combustible en rampa; contenido con absorbente.', lang:'es', expectCat:'Fuel / Combustible' },
  { id:'D10', g:'B_FUEL',    text:'Fuel vented during descent — quantity recorded by crew.', lang:'en', expectCat:'Fuel / Combustible' },
  // GROUP E: SMOKE/FIRE
  { id:'E01', g:'B_SMOKE',   text:'Humo visible en cabina de pasajeros — evacuación en pista.', lang:'es', expectCat:'Smoke / Humo a Bordo' },
  { id:'E02', g:'B_SMOKE',   text:'Olor a quemado en cabina; origen no identificado.', lang:'es', expectCat:'Smoke / Humo a Bordo' },
  { id:'E03', g:'B_SMOKE',   text:'Incendio en lavatorio del avión — extintor activado.', lang:'es', expectCat:'Incendio' },
  { id:'E04', g:'B_SMOKE',   text:'Fire alarm activated; source identified as electrical fault in avionics bay.', lang:'en', expectCat:'Incendio' },
  { id:'E05', g:'B_SMOKE',   text:'Crew reported smoke in flight deck; declared emergency, returned to base.', lang:'en', expectCat:'Smoke / Humo a Bordo', checkRevisar:true },
  { id:'E06', g:'B_SMOKE',   text:'No hubo incendio real; la alarma fue activada por vapor de agua.', lang:'es', expectCat:'Incendio', checkRevisar:true },
  { id:'E07', g:'B_SMOKE',   text:'Posible presencia de humo en cabina; pasajero lo reportó pero crew no confirmó.', lang:'es', expectCat:'Smoke / Humo a Bordo', checkRevisar:true },
  { id:'E08', g:'B_SMOKE',   text:'Olor a quemado detectado sin humo visible, se originó en el compartimento de cocina.', lang:'es', expectCat:'Smoke / Humo a Bordo', checkRevisar:true },
  { id:'E09', g:'B_SMOKE',   text:'Humo en cabina y alarma de incendio simultánea — múltiples sistemas afectados.', lang:'es', expectCat:'Incendio', checkRevisar:true },
  { id:'E10', g:'B_SMOKE',   text:'Fire broke out in cargo — extinguished before landing.', lang:'en', expectCat:'Incendio' },
  { id:'E11', g:'B_SMOKE',   text:'Incendio en motor derecho con humo negro visible desde tierra.', lang:'es', expectCat:'Incendio' },
  { id:'E12', g:'B_SMOKE',   text:'Pasajero fumó en el lavatorio; humo generado por cigarrillo.', lang:'es', expectCat:'Smoke / Humo a Bordo' },
  // GROUP F: SECURITY
  { id:'F01', g:'B_SECURITY',text:'Pasajero agredió físicamente a un asistente de vuelo.', lang:'es', expectCat:'Interferencia Ilícita' },
  { id:'F02', g:'B_SECURITY',text:'Suspicious passenger removed from aircraft before departure.', lang:'en', expectCat:'Interferencia Ilícita' },
  { id:'F03', g:'B_SECURITY',text:'Amenaza de bomba recibida en el aeropuerto.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'F04', g:'B_SECURITY',text:'Explosive device threat called in to airport operations.', lang:'en', expectCat:'Interferencia Ilícita' },
  { id:'F05', g:'B_SECURITY',text:'Sospechoso detenido con documentos falsos en el aeropuerto.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'F06', g:'B_SECURITY',text:'Passenger attempted to access cockpit — restrained by crew.', lang:'en', expectCat:'Interferencia Ilícita' },
  { id:'F07', g:'B_SECURITY',text:'Hijacking attempt foiled — aircraft diverted to nearest airport.', lang:'en', expectCat:'Interferencia Ilícita' },
  { id:'F08', g:'B_SECURITY',text:'Zona de seguridad del aeropuerto fue comprometida por vehículo no autorizado.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'F09', g:'B_SECURITY',text:'Persona no autorizada accedió a la pista durante operaciones.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'F10', g:'B_SECURITY',text:'Pasajero intentó sobornar a agente de seguridad para eludir revisión.', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  // GROUP G: HUMAN FACTORS
  { id:'G01', g:'B_HUMAN',   text:'Piloto aplicó procedimiento incorrecto durante falla de motor.', lang:'es', expectCat:'Factores Humanos' },
  { id:'G02', g:'B_HUMAN',   text:'Crew resource management failure contributed to runway incursion.', lang:'en', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'G03', g:'B_HUMAN',   text:'Tripulante reportó fatiga antes del vuelo y fue relevado del servicio.', lang:'es', expectCat:'Fatiga de Tripulación' },
  { id:'G04', g:'B_HUMAN',   text:'Captain reported excessive fatigue — first officer assumed command.', lang:'en', expectCat:'Fatiga de Tripulación' },
  { id:'G05', g:'B_HUMAN',   text:'Error de comunicación entre piloto y copiloto antes del despegue.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'G06', g:'B_HUMAN',   text:'Coordinación inadecuada entre tripulación resultó en TCAS RA no ejecutado correctamente.', lang:'es', expectCat:'TCAS RA', checkRevisar:true },
  { id:'G07', g:'B_HUMAN',   text:'Maintenance technician applied wrong torque spec — discovered during pre-flight.', lang:'en', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'G08', g:'B_HUMAN',   text:'Piloto leyó altímetro en pies cuando debía leer en metros.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  // GROUP H: OUT_OF_TAXONOMY
  { id:'H01', g:'B_OOT',     text:'El empleado de catering se cortó la mano al manipular bandejas en el avión.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'MEDIUM' },
  { id:'H02', g:'B_OOT',     text:'La lavadora industrial del hangar presentó una avería eléctrica.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'MEDIUM' },
  { id:'H03', g:'B_OOT',     text:'Personal de limpieza reportó mal funcionamiento del equipo de aspirado.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'H04', g:'B_OOT',     text:'Supervisor de hangar reportó malestar general y fue atendido.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'H05', g:'B_OOT',     text:'Técnico de mantenimiento sufrió contusión al resbalarse en plataforma.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'H06', g:'B_OOT',     text:'A catering truck had a flat tire on the apron.', lang:'en', expectCat:null, checkRevisar:true, safetyRisk:'MEDIUM' },
  { id:'H07', g:'B_OOT',     text:'Ground handler slipped on wet surface; no aircraft damage.', lang:'en', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'H08', g:'B_OOT',     text:'Airport staff reported broken air conditioning in the terminal.', lang:'en', expectCat:'Factores Humanos', checkRevisar:true },
  // GROUP I: AMBIGUOUS
  { id:'I01', g:'B_AMBIG',   text:'Pasajero informó sentirse muy mal durante el vuelo; era un agente encubierto con arma.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkRevisar:true },
  { id:'I02', g:'B_AMBIG',   text:'Bird strike suspected on engine 1; engine continued operating normally.', lang:'en', expectCat:'Bird Strike', checkRevisar:true },
  { id:'I03', g:'B_AMBIG',   text:'Turbulencia moderada y pasajero con crisis epiléptica a bordo.', lang:'es', expectCat:'Turbulencia', checkRevisar:true },
  { id:'I04', g:'B_AMBIG',   text:'TCAS RA was triggered simultaneously with an engine vibration warning.', lang:'en', expectCat:'TCAS RA', checkRevisar:true },
  { id:'I05', g:'B_AMBIG',   text:'Pasajero amenazó verbalmente a otro, quien resultó tener un arma.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkRevisar:true },
  { id:'I06', g:'B_AMBIG',   text:'Aterrizaje forzoso por falla de motor y también por incursión de pista simultánea.', lang:'es', expectCat:'Falla Técnica', checkRevisar:true },
  { id:'I07', g:'B_AMBIG',   text:'Derrame de combustible y activación de alarma de incendio a la vez.', lang:'es', expectCat:'Incendio', checkRevisar:true },
  { id:'I08', g:'B_AMBIG',   text:'Pasajero inconsciente descubierto con un arma en la cintura.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkRevisar:true },
  // GROUP J: LANGUAGE ROBUSTNESS
  { id:'J01', g:'B_LANG',    text:'Aeronave ocupó la pista sin clearance previo del control.', lang:'es', expectCat:'Incursión de Pista' },
  { id:'J02', g:'B_LANG',    text:'Fire detected in the cargo hold — Halon system activated.', lang:'en', expectCat:'Incendio' },
  { id:'J03', g:'B_LANG',    text:'Avería eléctrica en el sistema de flaps durante el vuelo.', lang:'es', expectCat:'Falla Técnica' },
  { id:'J04', g:'B_LANG',    text:'Se observó ave muerta en la entrada del motor tras el aterrizaje.', lang:'es', expectCat:'Bird Strike' },
  { id:'J05', g:'B_LANG',    text:'Tripulación reportó cansancio extremo al final de una rotación larga.', lang:'es', expectCat:'Fatiga de Tripulación', checkRevisar:true },
  { id:'J06', g:'B_LANG',    text:'Se detectó irregularidad en el sistema hidráulico del tren de aterrizaje.', lang:'es', expectCat:'Falla Técnica' },
  { id:'J07', g:'B_LANG',    text:'Crew fatigue documented after 14-hour duty period.', lang:'en', expectCat:'Fatiga de Tripulación', checkRevisar:true },
  { id:'J08', g:'B_LANG',    text:'Fallo en el sistema de frenos durante la rodadura.', lang:'es', expectCat:'Falla Técnica' },
  { id:'J09', g:'B_LANG',    text:'Pasajero sufrió pérdida del conocimiento — tripulación solicitó atención médica.', lang:'es', expectCat:'Emergencia Médica' },
  { id:'J10', g:'B_LANG',    text:'Controlador confundió la instrucción de rodaje y aeronave cruzó pista.', lang:'es', expectCat:'Incursión de Pista' },
  // GROUP K: ADVERSARIAL
  { id:'K01', g:'B_ADV',     text:'El capitán mencionó que si hubiera fuego en la cabina, usarían los extintores.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'HIGH' },
  { id:'K02', g:'B_ADV',     text:'Tripulación revisó extintores — sin indicios de incendio previo.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'K03', g:'B_ADV',     text:'La instrucción de seguridad menciona: en caso de fuego, no abrir las puertas.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'HIGH' },
  { id:'K04', g:'B_ADV',     text:'Durante el adiestramiento se simuló una falla de motor para entrenar al equipo.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true, safetyRisk:'HIGH' },
  { id:'K05', g:'B_ADV',     text:'No hubo ningún incidente durante el vuelo — reporte rutinario.', lang:'es', expectCat:'Factores Humanos', checkRevisar:true },
  { id:'K06', g:'B_ADV',     text:'No hubo fuego, pero sí se encontró un arma de fuego; además, el motor operaba con normalidad.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkNot:'Incendio', safetyRisk:'CRITICAL' },
  { id:'K07', g:'B_ADV',     text:'No se detectó humo, pero hubo una falla del motor y también vibración en tren.', lang:'es', expectCat:'Falla Técnica', checkNot:'Incendio', checkRevisar:true },
  { id:'K08', g:'B_ADV',     text:'Aves en el aeropuerto; ninguna colisionó con la aeronave.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'MEDIUM' },
  { id:'K09', g:'B_ADV',     text:'El documento de investigación refiere: presencia de humo 2 años antes del evento actual.', lang:'es', expectCat:null, checkRevisar:true },
  { id:'K10', g:'B_ADV',     text:'Tripulación reportó olor a humo; revisión determinó que era vapor de cocina, no humo real.', lang:'es', expectCat:'Incendio', checkRevisar:true, safetyRisk:'MEDIUM' },
];

// ── BATTERY C — SafetyOps critical known cases (19) ──────────────────────────
const BATTERY_C = [
  { id:'C_01', g:'C_CRIT', text:'arma de fuego encontrada a bordo', lang:'es', expectCat:'Seguridad Aeroportuaria' },
  { id:'C_02', g:'C_CRIT', text:'fuego en el avión', lang:'es', expectCat:'Incendio' },
  { id:'C_03', g:'C_CRIT', text:'fuego en la cabina', lang:'es', expectCat:'Incendio' },
  { id:'C_04', g:'C_CRIT', text:'humo en la cabina', lang:'es', expectCat:'Smoke / Humo a Bordo' },
  { id:'C_05', g:'C_CRIT', text:'humo en cabina', lang:'es', expectCat:'Smoke / Humo a Bordo' },
  { id:'C_06', g:'C_CRIT', text:'falla del motor', lang:'es', expectCat:'Falla Técnica' },
  { id:'C_07', g:'C_CRIT', text:'avería del motor', lang:'es', expectCat:'Falla Técnica' },
  { id:'C_08', g:'C_CRIT', text:'falla de motor en crucero', lang:'es', expectCat:'Falla Técnica' },
  { id:'C_09', g:'C_CRIT', text:'incursión en pista', lang:'es', expectCat:'Incursión de Pista' },
  { id:'C_10', g:'C_CRIT', text:'incursión de pista', lang:'es', expectCat:'Incursión de Pista' },
  { id:'C_11', g:'C_CRIT', text:'máquina de limpieza rota en hangar', lang:'es', expectCat:null, checkRevisar:true },
  { id:'C_12', g:'C_CRIT', text:'camión de catering roto en terminal', lang:'es', expectCat:null, checkRevisar:true },
  { id:'C_13', g:'C_CRIT', text:'derrame de combustible en pista', lang:'es', expectCat:'Fuel / Combustible' },
  { id:'C_14', g:'C_CRIT', text:'mercancías peligrosas sin declarar', lang:'es', expectCat:'Mercancias Peligrosas' },
  { id:'C_15', g:'C_CRIT', text:'batería de litio dañada', lang:'es', expectCat:'Mercancias Peligrosas' },
  { id:'C_16', g:'C_CRIT', text:'aves impactaron la aeronave', lang:'es', expectCat:'Bird Strike' },
  { id:'C_17', g:'C_CRIT', text:'pájaros impactaron la aeronave', lang:'es', expectCat:'Bird Strike' },
  { id:'C_18', g:'C_CRIT', text:'bird strike', lang:'en', expectCat:'Bird Strike' },
  { id:'C_19', g:'C_CRIT', text:'ATC emitió instrucción incorrecta', lang:'es', expectCat:'Incidencia ATC' },
];

// ── BATTERY D — Negation cases (5) ───────────────────────────────────────────
const BATTERY_D = [
  { id:'D_01', g:'D_NEG', text:'no hubo fuego', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'CRITICAL' },
  { id:'D_02', g:'D_NEG', text:'no hubo humo', lang:'es', expectCat:null, checkRevisar:true },
  { id:'D_03', g:'D_NEG', text:'sin humo en cabina', lang:'es', expectCat:null, checkRevisar:true },
  { id:'D_04', g:'D_NEG', text:'no se produjo incendio', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'CRITICAL' },
  { id:'D_05', g:'D_NEG', text:'no hubo impacto de aves', lang:'es', expectCat:null, checkRevisar:true },
];

// ── BATTERY E — Hypothetical cases (4) ───────────────────────────────────────
const BATTERY_E = [
  { id:'E_01', g:'E_HYP', text:'si hubiera fuego en la cabina, se activaría el extintor.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'HIGH' },
  { id:'E_02', g:'E_HYP', text:'en caso de fuego, el procedimiento indica cerrar válvulas.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'HIGH' },
  { id:'E_03', g:'E_HYP', text:'si se detectara humo en cabina, se aplicaría el QRH.', lang:'es', expectCat:null, checkRevisar:true, safetyRisk:'HIGH' },
  { id:'E_04', g:'E_HYP', text:'qué ocurriría si hubiera una falla de motor en despegue.', lang:'es', expectCat:null, checkRevisar:true },
];

// ── BATTERY F — Concept coexistence (4) ──────────────────────────────────────
const BATTERY_F = [
  { id:'F_01', g:'F_CO', text:'No hubo fuego, pero se encontró un arma de fuego.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkNot:'Incendio', safetyRisk:'CRITICAL' },
  { id:'F_02', g:'F_CO', text:'No se detectó humo, pero hubo una falla del motor.', lang:'es', expectCat:'Falla Técnica', checkNot:'Incendio' },
  { id:'F_03', g:'F_CO', text:'El motor funcionaba normalmente; posteriormente presentó una falla.', lang:'es', expectCat:'Falla Técnica', checkRevisar:true },
  { id:'F_04', g:'F_CO', text:'Se reportó un posible incendio, posteriormente confirmado como arma de fuego.', lang:'es', expectCat:'Seguridad Aeroportuaria', checkNot:'Incendio' },
];

// ── Merge all batteries ───────────────────────────────────────────────────────
const ALL_CASES = [
  ...BATTERY_A.map(c => ({...c, battery:'A'})),
  ...BATTERY_B.map(c => ({...c, battery:'B'})),
  ...BATTERY_C.map(c => ({...c, battery:'C'})),
  ...BATTERY_D.map(c => ({...c, battery:'D'})),
  ...BATTERY_E.map(c => ({...c, battery:'E'})),
  ...BATTERY_F.map(c => ({...c, battery:'F'})),
];

// ── Run batteries ─────────────────────────────────────────────────────────────
const results = [];

for (const tc of ALL_CASES) {
  const r1 = runV1(tc.text, tc.lang);
  const r2 = runV2(tc.text, tc.lang);

  const cat1 = catOf(r1), cat2 = catOf(r2);
  const rev1 = revisar(r1), rev2 = revisar(r2);
  const conf1 = confOf(r1), conf2 = confOf(r2);

  // Compute pass/fail
  let pass1, pass2, fail2reason;
  if (tc.checkRevisar) {
    pass1 = rev1 === true;
    pass2 = rev2 === true;
    if (!pass2) fail2reason = `expected _revisarManualmente=true, got false (cat=${cat2})`;
  } else if (tc.expectCat) {
    pass1 = cat1 === tc.expectCat;
    pass2 = cat2 === tc.expectCat;
    if (!pass2) fail2reason = `cat=${cat2} expected=${tc.expectCat}`;
    // UNSAFE: auto-accepted as wrong cat
    if (!pass2 && !rev2) fail2reason += ' [AUTO-ACCEPTED-WRONG]';
  } else {
    // expectCat=null: no specific category required, just review
    pass1 = rev1 === true;
    pass2 = rev2 === true;
    if (!pass2) fail2reason = `expected _revisarManualmente=true`;
  }

  // Check forbidden category
  if (tc.checkNot && cat2 === tc.checkNot && !rev2) {
    pass2 = false;
    fail2reason = `UNSAFE: auto-accepted as ${tc.checkNot} (forbidden)`;
  }

  // Regression and improvement detection
  const regression = pass1 && !pass2;
  const improvement = !pass1 && pass2;

  // Concept analysis (V2 only — for debug)
  let concepts2 = [];
  try {
    const raw = extractConcepts(tc.text);
    const enriched = analyzeContext(raw, tc.text);
    concepts2 = enriched.map(m => `${m.conceptId}(${m.active?'✓':'✗'}${m.negated?'neg':''}${m.hypothetical?'hyp':''}${!m.contextSatisfied?'noctx':''})`);
  } catch(e) { concepts2 = [`ERR:${e.message}`]; }

  results.push({
    ...tc,
    cat1, cat2, conf1, conf2, rev1, rev2,
    pass1, pass2, regression, improvement,
    fail2reason: pass2 ? null : fail2reason,
    concepts2,
  });
}

// ── PRINT RESULTS ─────────────────────────────────────────────────────────────
const LINE = '─'.repeat(120);
const DLINE = '═'.repeat(120);

console.log(DLINE);
console.log('  PHASE 1.6 — FULL VALIDATION BATTERY (180 cases)');
console.log('  Post-fix: conceptSupportsWinner≥5.0, hypothetical phrases, simulator context, OUT_OF_SCOPE_CATERING expanded, BIRD_STRIKE post-neg');
console.log(DLINE);

const headers = 'ID     BAT GRP              V1 result                 V2 result                  Δ  CONCEPTS(V2)';
console.log(headers);
console.log(LINE);

// Group printout by battery
const byBat = {};
for (const r of results) {
  if (!byBat[r.battery]) byBat[r.battery] = [];
  byBat[r.battery].push(r);
}

const BATTERY_LABELS = {
  A: 'BATTERY A — Phase 1 original (32 cases)',
  B: 'BATTERY B — Phase 1.5 adversarial (116 cases)',
  C: 'BATTERY C — Critical known cases (19)',
  D: 'BATTERY D — Negation (5)',
  E: 'BATTERY E — Hypothetical (4)',
  F: 'BATTERY F — Concept coexistence (4)',
};

let totalPass1=0, totalPass2=0, totalCases=0;
const regressions=[], improvements=[];
const safetyFails=[], criticalConf=[];

for (const [bat, cases] of Object.entries(byBat)) {
  console.log(`\n${BATTERY_LABELS[bat] || bat}`);
  console.log(LINE);
  for (const r of cases) {
    totalCases++;
    if (r.pass1) totalPass1++;
    if (r.pass2) totalPass2++;
    if (r.regression) regressions.push(r);
    if (r.improvement) improvements.push(r);

    const v1str = r.cat1 ? r.cat1.substring(0,20).padEnd(20) : 'null                ';
    const v2str = r.cat2 ? r.cat2.substring(0,20).padEnd(20) : 'null                ';
    const v1flag = r.rev1 ? 'R' : ' ';
    const v2flag = r.rev2 ? 'R' : ' ';
    const delta = r.regression ? '↓!' : (r.improvement ? '↑' : '=');
    const risk  = r.safetyRisk ? ` [${r.safetyRisk}]` : '';
    const mark1 = r.pass1 ? '✓' : '✗';
    const mark2 = r.pass2 ? '✓' : '✗';
    const cpts  = r.concepts2.length ? r.concepts2.slice(0,3).join(',') : '—';

    console.log(
      `${r.id.padEnd(6)} ${r.battery}  ${(r.g||'').substring(0,14).padEnd(16)} ` +
      `${mark1} ${v1str} c=${r.conf1.toFixed(2)}${v1flag}  |  ` +
      `${mark2} ${v2str} c=${r.conf2.toFixed(2)}${v2flag} ${delta}${risk} · ${cpts}`,
    );
    if (!r.pass2) {
      console.log(`         V2 FAIL: ${r.fail2reason}`);
      if (r.safetyRisk === 'CRITICAL') safetyFails.push(r);
    }
  }
}

// ── AGGREGATE METRICS ────────────────────────────────────────────────────────
console.log(`\n${DLINE}`);
console.log('  AGGREGATE METRICS');
console.log(DLINE);

// Auto-accept stats
const autoAccept1 = results.filter(r => !r.rev1);
const autoAccept2 = results.filter(r => !r.rev2);
const aaCorrect1  = autoAccept1.filter(r => r.pass1);
const aaCorrect2  = autoAccept2.filter(r => r.pass2);
const aaPrecision1 = autoAccept1.length ? (aaCorrect1.length/autoAccept1.length*100).toFixed(1) : 'N/A';
const aaPrecision2 = autoAccept2.length ? (aaCorrect2.length/autoAccept2.length*100).toFixed(1) : 'N/A';

const pct = (n,d) => d ? (n/d*100).toFixed(1)+'%' : 'N/A';

console.log(`Métrica                            V1 Baseline           V2 Phase 1.6`);
console.log(LINE);
console.log(`Total casos                        ${totalCases}                   ${totalCases}`);
console.log(`PASS                               ${totalPass1}                    ${totalPass2}`);
console.log(`Accuracy                           ${pct(totalPass1,totalCases)}                ${pct(totalPass2,totalCases)}`);
console.log(`Auto-accept casos                  ${autoAccept1.length}                    ${autoAccept2.length}`);
console.log(`Auto-accept CORRECTOS              ${aaCorrect1.length}                    ${aaCorrect2.length}`);
console.log(`Auto-accept PRECISION              ${aaPrecision1}%                 ${aaPrecision2}%`);
console.log(`Enviados a revisión                ${results.filter(r=>r.rev1).length} (${pct(results.filter(r=>r.rev1).length,totalCases)})    ${results.filter(r=>r.rev2).length} (${pct(results.filter(r=>r.rev2).length,totalCases)})`);
console.log(`Mejoras V1→V2                      —                     ${improvements.length}`);
console.log(`Regresiones V1→V2                  —                     ${regressions.length}`);

// ── PER-CATEGORY METRICS ─────────────────────────────────────────────────────
console.log(`\n${LINE}`);
console.log('  PER-CATEGORY METRICS (V2)');
console.log(LINE);

const cats = {};
for (const r of results) {
  if (!r.expectCat || r.checkRevisar) continue; // skip non-category or review-only cases
  const exp = r.expectCat;
  const got = r.cat2;
  if (!cats[exp]) cats[exp] = { tp:0, fn:0 };
  if (got === exp) cats[exp].tp++;
  else cats[exp].fn++;
  // FP: V2 outputs this category for a case expecting something else
  if (got && got !== exp) {
    if (!cats[got]) cats[got] = { tp:0, fn:0 };
    if (!cats[got].fp) cats[got].fp = 0;
    cats[got].fp = (cats[got].fp||0) + 1;
  }
}
const catNames = [...new Set(results.filter(r=>r.expectCat).map(r=>r.expectCat))].sort();
console.log('Categoría                     TP    FP    FN    Precision   Recall');
for (const cat of catNames) {
  const d = cats[cat] || {};
  const tp = d.tp||0, fp = d.fp||0, fn = d.fn||0;
  const prec = (tp+fp)>0 ? pct(tp,tp+fp) : 'N/A';
  const rec  = (tp+fn)>0 ? pct(tp,tp+fn) : 'N/A';
  console.log(`  ${cat.substring(0,28).padEnd(28)} ${String(tp).padStart(3)} ${String(fp).padStart(5)} ${String(fn).padStart(5)} ${prec.padStart(9)}  ${rec.padStart(9)}`);
}

// ── REGRESSIONS ──────────────────────────────────────────────────────────────
console.log(`\n${LINE}`);
console.log('  REGRESSIONS (V1 PASS → V2 FAIL)');
console.log(LINE);
if (regressions.length === 0) {
  console.log('  ✓ NONE');
} else {
  for (const r of regressions) {
    const risk = r.safetyRisk ? ` [${r.safetyRisk}]` : '';
    console.log(`  ↓ [${r.id}]${risk} ${r.text.substring(0,65)}`);
    console.log(`    V2 FAIL: ${r.fail2reason}`);
  }
}

// ── IMPROVEMENTS ─────────────────────────────────────────────────────────────
console.log(`\n${LINE}`);
console.log('  IMPROVEMENTS (V1 FAIL → V2 PASS)');
console.log(LINE);
if (improvements.length === 0) {
  console.log('  (none)');
} else {
  for (const r of improvements) {
    console.log(`  ↑ [${r.id}] ${r.text.substring(0,65)}`);
    console.log(`    V1: cat=${r.cat1} rev=${r.rev1} → V2: cat=${r.cat2} rev=${r.rev2}`);
  }
}

// ── SAFETY CRITICAL CONFUSION ANALYSIS ──────────────────────────────────────
console.log(`\n${DLINE}`);
console.log('  SAFETY-CRITICAL CONFUSION ANALYSIS (V2)');
console.log(DLINE);

// 1. FIREARM classified as Incendio auto-accepted
const firearmAsIncendio = results.filter(r =>
  (r.expectCat === 'Seguridad Aeroportuaria' || r.text.includes('arma de fuego') || r.text.includes('firearm')) &&
  r.cat2 === 'Incendio' && !r.rev2
);
if (firearmAsIncendio.length) {
  console.log('  🚨 CRITICAL: FIREARM auto-accepted as Incendio');
  firearmAsIncendio.forEach(r => console.log(`    → [${r.id}] cat=${r.cat2} conf=${r.conf2} rev=${r.rev2}\n      text: "${r.text.substring(0,60)}"`));
  criticalConf.push(...firearmAsIncendio);
} else {
  console.log('  ✓  CLEAR: FIREARM not auto-accepted as Incendio');
}

// 2. Negated FIRE auto-accepted as Incendio
const negFireAsIncendio = results.filter(r =>
  (r.id.startsWith('D_') || r.checkNot === 'Incendio') &&
  r.cat2 === 'Incendio' && !r.rev2
);
if (negFireAsIncendio.length) {
  console.log('  🚨 CRITICAL: Negated/forbidden FIRE auto-accepted as Incendio');
  negFireAsIncendio.forEach(r => console.log(`    → [${r.id}] cat=${r.cat2} conf=${r.conf2}\n      text: "${r.text.substring(0,60)}"`));
  criticalConf.push(...negFireAsIncendio);
} else {
  console.log('  ✓  CLEAR: Negated/forbidden FIRE not auto-accepted as Incendio');
}

// 3. Hypothetical fire auto-accepted as Incendio
const hypFireAsIncendio = results.filter(r =>
  r.battery === 'E' && r.cat2 === 'Incendio' && !r.rev2
);
if (hypFireAsIncendio.length) {
  console.log('  🚨 CRITICAL: Hypothetical fire auto-accepted as Incendio');
  hypFireAsIncendio.forEach(r => console.log(`    → [${r.id}] cat=${r.cat2} conf=${r.conf2}\n      text: "${r.text.substring(0,60)}"`));
  criticalConf.push(...hypFireAsIncendio);
} else {
  console.log('  ✓  CLEAR: Hypothetical fire not auto-accepted as Incendio');
}

// 4. ENGINE_NORMAL auto-accepted as Falla Técnica
const engineNormalAsFT = results.filter(r =>
  (r.checkRevisar && r.text.toLowerCase().includes('normal') && r.text.toLowerCase().includes('motor')) &&
  r.cat2 === 'Falla Técnica' && !r.rev2
);
if (engineNormalAsFT.length) {
  console.log('  🚨 DETECTED: ENGINE_NORMAL auto-accepted as Falla Técnica');
  engineNormalAsFT.forEach(r => console.log(`    → [${r.id}] cat=${r.cat2} conf=${r.conf2}\n      text: "${r.text.substring(0,60)}"`));
  criticalConf.push(...engineNormalAsFT);
} else {
  console.log('  ✓  CLEAR: ENGINE_NORMAL not auto-accepted as Falla Técnica');
}

// 5. Simulator training auto-accepted as Falla Técnica
const simAsFT = results.filter(r =>
  (r.text.toLowerCase().includes('simulador') || r.text.toLowerCase().includes('simulator')) &&
  r.cat2 === 'Falla Técnica' && !r.rev2
);
if (simAsFT.length) {
  console.log('  🚨 DETECTED: Simulator training auto-accepted as Falla Técnica');
  simAsFT.forEach(r => console.log(`    → [${r.id}] cat=${r.cat2} conf=${r.conf2}\n      text: "${r.text.substring(0,60)}"`));
  criticalConf.push(...simAsFT);
} else {
  console.log('  ✓  CLEAR: Simulator training not auto-accepted as Falla Técnica');
}

// 6. OUT-OF-TAXONOMY auto-accepted as aeronautical
const ootAutoAccept = results.filter(r =>
  r.battery === 'B' && r.g === 'B_OOT' && r.expectCat === null && !r.rev2
);
if (ootAutoAccept.length) {
  console.log('  🚨 DETECTED: OUT-OF-TAXONOMY auto-accepted');
  ootAutoAccept.forEach(r => console.log(`    → [${r.id}] cat=${r.cat2} conf=${r.conf2}\n      text: "${r.text.substring(0,60)}"`));
  criticalConf.push(...ootAutoAccept);
} else {
  console.log('  ✓  CLEAR: OUT-OF-TAXONOMY cases all sent to review');
}

// 7. Bird-negative auto-accepted as Bird Strike
const negBirdAsBS = results.filter(r =>
  r.checkRevisar && (r.text.toLowerCase().includes('aves') || r.text.toLowerCase().includes('bird')) &&
  r.expectCat === null && r.cat2 === 'Bird Strike' && !r.rev2
);
if (negBirdAsBS.length) {
  console.log('  🚨 DETECTED: Bird (no collision) auto-accepted as Bird Strike');
  negBirdAsBS.forEach(r => console.log(`    → [${r.id}] cat=${r.cat2}\n      text: "${r.text.substring(0,60)}"`));
  criticalConf.push(...negBirdAsBS);
} else {
  console.log('  ✓  CLEAR: Bird non-collision not auto-accepted as Bird Strike');
}

// ── PER-FIX ANALYSIS ─────────────────────────────────────────────────────────
console.log(`\n${DLINE}`);
console.log('  PER-FIX ANALYSIS');
console.log(DLINE);

// FIX 1: Hypothetical phrases
const fix1Targets = results.filter(r => r.battery === 'E' || r.id === 'K01' || r.id === 'K03');
const fix1Pass = fix1Targets.filter(r => r.pass2).length;
console.log(`Fix 1 (Hypothetical phrases): targets=${fix1Targets.length}, pass2=${fix1Pass}/${fix1Targets.length}`);
fix1Targets.forEach(r => console.log(`  [${r.id}] V2=${r.cat2} rev=${r.rev2} ${r.pass2?'✓':'✗'} · concepts: ${r.concepts2.join(',')}`));

// FIX 2: Simulator context
const fix2Targets = results.filter(r => r.id === 'B10' || r.id === 'K04' || (r.text.toLowerCase().includes('simulador')));
const fix2Pass = fix2Targets.filter(r => r.pass2).length;
console.log(`\nFix 2 (Simulator context): targets=${fix2Targets.length}, pass2=${fix2Pass}/${fix2Targets.length}`);
fix2Targets.forEach(r => console.log(`  [${r.id}] V2=${r.cat2} rev=${r.rev2} ${r.pass2?'✓':'✗'} · concepts: ${r.concepts2.join(',')}`));

// FIX 3: conceptSupportsWinner threshold
const fix3Before = regressions.filter(r =>
  r.id.match(/^(I0[1-8]|E0[7-9]|D0[45]|D07|G06)$/)
);
console.log(`\nFix 3 (conceptSupportsWinner 2→5): ambiguous/review cases`);
const ambigTargets = results.filter(r => r.g === 'B_AMBIG');
ambigTargets.forEach(r => console.log(`  [${r.id}] V2=${r.cat2} rev=${r.rev2} ${r.pass2?'✓':'✗'}`));

// FIX 4: OUT_OF_SCOPE_CATERING expansion
const fix4Targets = results.filter(r => ['H01','H02','H06','C_11','C_12'].includes(r.id));
const fix4Pass = fix4Targets.filter(r => r.pass2).length;
console.log(`\nFix 4 (OUT_OF_SCOPE_CATERING expanded): targets=${fix4Targets.length}, pass2=${fix4Pass}/${fix4Targets.length}`);
fix4Targets.forEach(r => console.log(`  [${r.id}] V2=${r.cat2} rev=${r.rev2} ${r.pass2?'✓':'✗'} · concepts: ${r.concepts2.join(',')}`));

// FIX 5: BIRD_STRIKE post-match neg
const fix5Targets = results.filter(r => r.id === 'K08' || r.id === 'D_05');
const fix5Pass = fix5Targets.filter(r => r.pass2).length;
console.log(`\nFix 5 (BIRD_STRIKE post-match neg): targets=${fix5Targets.length}, pass2=${fix5Pass}/${fix5Targets.length}`);
fix5Targets.forEach(r => console.log(`  [${r.id}] V2=${r.cat2} rev=${r.rev2} ${r.pass2?'✓':'✗'} · concepts: ${r.concepts2.join(',')}`));

// FIX 6: low-confidence
const fix6Targets = results.filter(r => ['H01','H06','H02','C_11','C_12'].includes(r.id));
console.log(`\nFix 6 (low-confidence no-evidence → review): same targets as Fix 4`);

// ── VEREDICTO ─────────────────────────────────────────────────────────────────
console.log(`\n${DLINE}`);
console.log('  VEREDICTO PHASE 1.6');
console.log(DLINE);

const autoAccPrec2 = parseFloat(aaPrecision2);
const regCount = regressions.length;
const critCount = [...new Set(criticalConf.map(r=>r.id))].length;
const safetyCritFails = results.filter(r => r.safetyRisk === 'CRITICAL' && !r.pass2).length;

const thresholds = [
  { name: 'Auto-accept precision', val: autoAccPrec2+'%',  ok: autoAccPrec2 >= 95, threshold: '≥ 95%' },
  { name: 'Safety-critical fails', val: safetyCritFails,   ok: safetyCritFails === 0, threshold: '= 0' },
  { name: 'Regressions V1→V2',    val: regCount,            ok: regCount === 0, threshold: '= 0' },
  { name: 'Critical confusions',  val: critCount,           ok: critCount === 0, threshold: '= 0' },
];

let allOk = true;
for (const t of thresholds) {
  const icon = t.ok ? '✓' : '✗';
  const status = t.ok ? 'OK  ' : 'FAIL';
  if (!t.ok) allOk = false;
  console.log(`  ${icon} ${t.name.padEnd(26)} ${String(t.val).padEnd(10)} Threshold: ${t.threshold.padEnd(8)} ${status}`);
}

console.log('');
if (allOk) {
  console.log('  ✅ TODOS LOS CRITERIOS PASAN — Se puede recomendar commit/Railway');
} else {
  console.log('  ❌ UNO O MÁS CRITERIOS FALLARON — NO autorizar commit/Railway hasta resolver');
}
console.log(DLINE);
