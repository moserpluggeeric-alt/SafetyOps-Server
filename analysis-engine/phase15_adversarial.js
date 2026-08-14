'use strict';
/**
 * PHASE 1.5 — ADVERSARIAL VALIDATION BATTERY
 * ─────────────────────────────────────────────────────────────────────────────
 * 116 cases across 11 groups. ALL phrases are NEW — not reused from Phase 1 battery.
 * Includes safety-critical confusion detection.
 *
 * Test case fields:
 *   id            : unique ID (A01..K10)
 *   g             : group code
 *   text          : incident description (adversarial / independent phrasing)
 *   lang          : 'es'|'en' (default 'es')
 *   expectCat     : expected category (null = don't care / use checkNot / checkRevisar)
 *   checkNot      : must NOT auto-accept as this category (revisar=false → FAIL)
 *   checkRevisar  : must set _revisarManualmente=true
 *   safetyRisk    : 'CRITICAL'|'HIGH'|'MEDIUM' — if misclassified w/o revisar
 *   safetyDesc    : what the confusion would mean operationally
 *   negatedConcept: expected negated concept ID (V2 only)
 *   hypothetical  : expect at least one hypothetical match
 */
const ADVERSARIAL = [

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP A — FIREARM vs FIRE (15 cases)
  // Key challenge: "fuego" appears in "arma de fuego"; "fire" appears in "firearm"
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'A01', g:'FIREARM_vs_FIRE',
    text:'El guardia de seguridad detectó un revólver en el equipaje de mano del pasajero.',
    expectCat:'Seguridad Aeroportuaria',
    safetyRisk:'CRITICAL', safetyDesc:'Arma real confundida con incendio → no se alerta seguridad',
  },
  {
    id:'A02', g:'FIREARM_vs_FIRE',
    text:'Passenger attempted to board with a concealed handgun in carry-on luggage.',
    lang:'en', expectCat:'Seguridad Aeroportuaria',
    safetyRisk:'CRITICAL', safetyDesc:'Concealed weapon missed',
  },
  {
    id:'A03', g:'FIREARM_vs_FIRE',
    text:'Se localizó una pistola cargada en el equipaje documentado durante el preembarque.',
    expectCat:'Seguridad Aeroportuaria',
  },
  {
    id:'A04', g:'FIREARM_vs_FIRE',
    text:'No hubo fuego, pero se encontró un arma de fuego en la bodega del avión.',
    expectCat:'Seguridad Aeroportuaria',
    checkNot:'Incendio',
    safetyRisk:'CRITICAL', safetyDesc:'Negation of FIRE must not cancel FIREARM detection',
  },
  {
    id:'A05', g:'FIREARM_vs_FIRE',
    text:'Armed passenger discovered in row 14; no fire or smoke on board.',
    lang:'en', expectCat:'Seguridad Aeroportuaria',
    checkNot:'Incendio',
    safetyRisk:'CRITICAL', safetyDesc:'FIREARM must win even when FIRE explicitly negated in same sentence',
  },
  {
    id:'A06', g:'FIREARM_vs_FIRE',
    text:'Principio de incendio en el compartimento de equipaje de bodega, extinguido por la tripulación.',
    expectCat:'Incendio',
    checkNot:'Seguridad Aeroportuaria',
    safetyRisk:'HIGH', safetyDesc:'Real fire misclassified as security → wrong response crew',
  },
  {
    id:'A07', g:'FIREARM_vs_FIRE',
    text:'Se activó la alarma de incendio en zona de carga; equipo de extinción desplegado.',
    expectCat:'Incendio',
  },
  {
    id:'A08', g:'FIREARM_vs_FIRE',
    text:'A fire erupted in the forward galley requiring immediate extinguisher use.',
    lang:'en', expectCat:'Incendio',
    checkNot:'Seguridad Aeroportuaria',
  },
  {
    id:'A09', g:'FIREARM_vs_FIRE',
    text:'Se reportó un posible incendio, que posteriormente se confirmó como el descubrimiento de un arma de fuego en la aeronave.',
    expectCat:'Seguridad Aeroportuaria',
    checkNot:'Incendio',
    safetyRisk:'CRITICAL', safetyDesc:'Hypoth fire + confirmed FIREARM; FIREARM must dominate',
  },
  {
    id:'A10', g:'FIREARM_vs_FIRE',
    text:'Olor a quemado detectado en cabina, sin identificar fuente; no se encontraron armas ni explosivos.',
    checkNot:'Seguridad Aeroportuaria',
    // Smoke/fire signal with explicit NOT of weapons
  },
  {
    id:'A11', g:'FIREARM_vs_FIRE',
    text:'Firearm replica found in passenger bag; no actual threat confirmed.',
    lang:'en',
    // Firearm but "replica" — reduced confidence expected, review acceptable
    checkNot:'Incendio',
  },
  {
    id:'A12', g:'FIREARM_vs_FIRE',
    text:'Smoke coming from the cargo hold, not related to any security incident.',
    lang:'en', expectCat:'Smoke / Humo a Bordo',
    checkNot:'Seguridad Aeroportuaria',
  },
  {
    id:'A13', g:'FIREARM_vs_FIRE',
    text:'Un pasajero encendió un encendedor en la cabina, ocasionando alarma pero sin incendio.',
    // encendedor → fire-adjacent but NO fire occurred; should not auto-accept Incendio
    checkNot:'Incendio',
    checkRevisar:true,
  },
  {
    id:'A14', g:'FIREARM_vs_FIRE',
    text:'Cuchillo encontrado en el cinturón del pasajero al momento del abordaje.',
    expectCat:'Seguridad Aeroportuaria',
    // knife → security, not FIREARM specifically but in same category
  },
  {
    id:'A15', g:'FIREARM_vs_FIRE',
    text:'El extintor se descargó accidentalmente en la cabina sin causa de incendio real.',
    checkNot:'Incendio',
    checkRevisar:true,
    safetyRisk:'HIGH', safetyDesc:'False fire trigger from extinguisher; should not auto-classify as real fire',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP B — ENGINE FAILURE vs ENGINE NORMAL (15 cases)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'B01', g:'ENGINE',
    text:'Pérdida de potencia en el motor izquierdo durante la etapa de crucero.',
    expectCat:'Falla Técnica',
  },
  {
    id:'B02', g:'ENGINE',
    text:'Both engines operating within normal parameters throughout the flight.',
    lang:'en',
    checkNot:'Falla Técnica',
    safetyRisk:'CRITICAL', safetyDesc:'Normal ops auto-classified as failure → unnecessary maintenance',
  },
  {
    id:'B03', g:'ENGINE',
    text:'Motor número uno apagado por procedimiento de emergencia tras indicación de falla.',
    expectCat:'Falla Técnica',
  },
  {
    id:'B04', g:'ENGINE',
    text:'Engine number two showed abnormal vibration and was shut down in flight.',
    lang:'en', expectCat:'Falla Técnica',
  },
  {
    id:'B05', g:'ENGINE',
    text:'Todos los motores respondieron normalmente durante el vuelo; sin anomalías reportadas.',
    checkNot:'Falla Técnica',
    safetyRisk:'CRITICAL', safetyDesc:'Normal flight report → should NOT be classified as Falla Técnica',
  },
  {
    id:'B06', g:'ENGINE',
    text:'El motor funcionaba normalmente durante el ascenso; sin embargo, presentó una falla en crucero.',
    // COMPLEX: ENGINE_NORMAL early + ENGINE_FAILURE later → should not cancel failure
    // Expected: review, or Falla Técnica — but ENGINE_NORMAL must not hard-cancel ENGINE_FAILURE
    checkNot:'Falla Técnica',  // if auto-accepted as Falla Técnica, that's acceptable — but must not be auto-rejected
    // Actually the safe answer is _revisarManualmente given the conflicting signals
    checkRevisar:true,
    safetyRisk:'HIGH', safetyDesc:'Temporal ordering: normal→failure; must preserve ENGINE_FAILURE signal',
    adversarial:true,
  },
  {
    id:'B07', g:'ENGINE',
    text:'Si hubiera fallado el motor, la tripulación habría activado el procedimiento de emergencia.',
    // HYPOTHETICAL engine failure
    checkNot:'Falla Técnica',
    checkRevisar:true,
    safetyRisk:'HIGH', safetyDesc:'Hypothetical failure scenario auto-classified as real failure',
  },
  {
    id:'B08', g:'ENGINE',
    text:'Engine performance was normal; no issues reported at any phase of flight.',
    lang:'en',
    checkNot:'Falla Técnica',
  },
  {
    id:'B09', g:'ENGINE',
    text:'Avería en el sistema hidráulico del motor, no relacionada con pérdida de empuje.',
    expectCat:'Falla Técnica',
    // Hydraulic issue — still a technical failure
  },
  {
    id:'B10', g:'ENGINE',
    text:'Durante el entrenamiento en simulador se practicó el procedimiento de falla de motor.',
    checkNot:'Falla Técnica',
    checkRevisar:true,
    safetyRisk:'MEDIUM', safetyDesc:'Simulator training classified as real engine failure',
  },
  {
    id:'B11', g:'ENGINE',
    text:'No se registró ninguna falla en los motores; el vuelo se desarrolló con total normalidad.',
    checkNot:'Falla Técnica',
    safetyRisk:'CRITICAL', safetyDesc:'Explicit no-failure report classified as Falla Técnica',
  },
  {
    id:'B12', g:'ENGINE',
    text:'No se detectó humo, pero hubo una falla del motor número dos.',
    // NEGATION of SMOKE + ENGINE_FAILURE → ENGINE_FAILURE must remain
    expectCat:'Falla Técnica',
    checkNot:'Incendio',
    safetyRisk:'HIGH', safetyDesc:'SMOKE negation must not cancel ENGINE_FAILURE in same report',
  },
  {
    id:'B13', g:'ENGINE',
    text:'Motor operando con RPM reducidas por protocolo de conservación de combustible; sin mal funcionamiento.',
    checkNot:'Falla Técnica',
    // Reduced RPM by design is NOT a failure
  },
  {
    id:'B14', g:'ENGINE',
    text:'Suspected engine surge on takeoff roll; crew confirmed normal engine operation after inspection.',
    lang:'en',
    // Suspected then confirmed normal → review
    checkRevisar:true,
  },
  {
    id:'B15', g:'ENGINE',
    text:'El motor número dos fue apagado preventivamente por olor inusual; falla confirmada en tierra.',
    expectCat:'Falla Técnica',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP C — RUNWAY INCURSION (10 cases)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'C01', g:'RUNWAY',
    text:'Vehículo de mantenimiento cruzó la pista activa sin autorización del controlador.',
    expectCat:'Incursión de Pista',
  },
  {
    id:'C02', g:'RUNWAY',
    text:'An aircraft entered the active runway without ATC clearance during low visibility.',
    lang:'en', expectCat:'Incursión de Pista',
  },
  {
    id:'C03', g:'RUNWAY',
    text:'Aeronave invadió la cabecera de pista mientras otra se encontraba en corta final.',
    expectCat:'Incursión de Pista',
  },
  {
    id:'C04', g:'RUNWAY',
    text:'Runway crossing was completed with proper ATC authorization; no incursion occurred.',
    lang:'en',
    checkNot:'Incursión de Pista',
    safetyRisk:'HIGH', safetyDesc:'Authorized crossing misclassified as unauthorized incursion',
  },
  {
    id:'C05', g:'RUNWAY',
    text:'Aeronave cruzó calle de rodaje sin autorización, sin llegar a invadir la pista principal.',
    // Taxiway — NOT runway → should not be Incursión de Pista (or review)
    checkNot:'Incursión de Pista',
    checkRevisar:true,
  },
  {
    id:'C06', g:'RUNWAY',
    text:'Ground vehicle entered runway 28L without clearance; landing traffic went around.',
    lang:'en', expectCat:'Incursión de Pista',
  },
  {
    id:'C07', g:'RUNWAY',
    text:'La aeronave sobrepasó el punto de espera de pista durante el rodaje, activando alerta SMGCS.',
    expectCat:'Incursión de Pista',
  },
  {
    id:'C08', g:'RUNWAY',
    text:'Unauthorized entry onto the runway threshold by a baggage cart; aircraft on short final aborted.',
    lang:'en', expectCat:'Incursión de Pista',
  },
  {
    id:'C09', g:'RUNWAY',
    text:'El avión aguardó en el punto de espera hasta recibir autorización para cruzar la pista; procedimiento normal.',
    checkNot:'Incursión de Pista',
    // Normal, authorized — not an incursion
  },
  {
    id:'C10', g:'RUNWAY',
    text:'Otro avión despegó mientras la pista aún estaba ocupada por la aeronave que aterrizaba.',
    expectCat:'Incursión de Pista',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP D — FUEL EMERGENCY (10 cases)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'D01', g:'FUEL',
    text:'Fuga de combustible observada en el ala derecha durante el rodaje previo al despegue.',
    expectCat:'Fuel / Combustible',
  },
  {
    id:'D02', g:'FUEL',
    text:'Fuel quantity warning light illuminated; crew declared minimum fuel emergency.',
    lang:'en', expectCat:'Fuel / Combustible',
  },
  {
    id:'D03', g:'FUEL',
    text:'Se detectó una pérdida de combustible en el colector del motor izquierdo.',
    expectCat:'Fuel / Combustible',
  },
  {
    id:'D04', g:'FUEL',
    text:'Niveles de combustible dentro de parámetros normales; sin pérdida ni irregularidad detectada.',
    checkNot:'Fuel / Combustible',
    safetyRisk:'HIGH', safetyDesc:'Normal fuel report classified as emergency',
  },
  {
    id:'D05', g:'FUEL',
    text:'Fuel imbalance detected between tanks; crew followed FCOM procedure, no emergency declared.',
    lang:'en',
    // Imbalance without emergency → review
    checkRevisar:true,
  },
  {
    id:'D06', g:'FUEL',
    text:'Derrame menor de combustible en plataforma durante el refulado; contenido y limpiado.',
    expectCat:'Fuel / Combustible',
    // Spill on ramp — still fuel event
  },
  {
    id:'D07', g:'FUEL',
    text:'El cálculo de combustible fue correcto y no hubo pérdida durante el vuelo.',
    checkNot:'Fuel / Combustible',
  },
  {
    id:'D08', g:'FUEL',
    text:'Aircraft landed with fuel below minimum reserve; incident declared.',
    lang:'en', expectCat:'Fuel / Combustible',
  },
  {
    id:'D09', g:'FUEL',
    text:'Olor a combustible en cabina sin fuente identificada; tripulación siguió procedimientos.',
    expectCat:'Fuel / Combustible',
    // Fuel smell → Fuel category
  },
  {
    id:'D10', g:'FUEL',
    text:'Repostaje incompleto por error de plataforma; combustible insuficiente detectado antes de despegue.',
    expectCat:'Fuel / Combustible',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP E — SMOKE / FIRE disambiguation (12 cases)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'E01', g:'SMOKE_FIRE',
    text:'Humo blanco visible proveniente del compartimento de aviónica.',
    expectCat:'Smoke / Humo a Bordo',
  },
  {
    id:'E02', g:'SMOKE_FIRE',
    text:'White smoke observed from avionics bay; no fire confirmed.',
    lang:'en', expectCat:'Smoke / Humo a Bordo',
    checkNot:'Incendio',
  },
  {
    id:'E03', g:'SMOKE_FIRE',
    text:'Se detectaron llamas en el compartimento de tren de aterrizaje delantero.',
    expectCat:'Incendio',
  },
  {
    id:'E04', g:'SMOKE_FIRE',
    text:'Flames observed coming from the nose wheel bay during approach.',
    lang:'en', expectCat:'Incendio',
  },
  {
    id:'E05', g:'SMOKE_FIRE',
    text:'No se registró humo en ninguna zona de la aeronave durante el vuelo.',
    checkNot:'Smoke / Humo a Bordo',
    checkNot2:'Incendio',
    safetyRisk:'HIGH', safetyDesc:'Explicit no-smoke report classified as smoke event',
  },
  {
    id:'E06', g:'SMOKE_FIRE',
    text:'No fire or smoke was reported at any point during the flight.',
    lang:'en',
    checkNot:'Incendio',
    safetyRisk:'HIGH', safetyDesc:'Explicit no-fire classified as fire event',
  },
  {
    id:'E07', g:'SMOKE_FIRE',
    text:'Posible presencia de humo en cabina; pasajero lo reportó pero tripulación no confirmó.',
    // Suspected smoke → review
    checkRevisar:true,
  },
  {
    id:'E08', g:'SMOKE_FIRE',
    text:'Olor a quemado detectado sin humo visible, se originó en el horno de cocina a bordo.',
    // Burning smell from galley oven → could be SMOKE but source identified as normal
    checkRevisar:true,
  },
  {
    id:'E09', g:'SMOKE_FIRE',
    text:'Se activó el detector de humo en bodega; posterior inspección no encontró humo ni incendio.',
    // False alarm → review
    checkRevisar:true,
    checkNot:'Incendio',
  },
  {
    id:'E10', g:'SMOKE_FIRE',
    text:'Incendio confirmado en el APU durante la preparación en tierra.',
    expectCat:'Incendio',
  },
  {
    id:'E11', g:'SMOKE_FIRE',
    text:'Suspected fire in the aft cargo compartment; crew deployed halon and fire extinguished.',
    lang:'en', expectCat:'Incendio',
  },
  {
    id:'E12', g:'SMOKE_FIRE',
    text:'El pasajero reportó ver humo negro saliendo del motor; se inició procedimiento de apagado.',
    expectCat:'Smoke / Humo a Bordo',
    // Smoke from engine → Smoke (not necessarily Incendio without confirmed flames)
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP F — SECURITY (10 cases)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'F01', g:'SECURITY',
    text:'Amenaza de bomba recibida verbalmente por el tripulante de cabina.',
    expectCat:'Interferencia Ilícita',
  },
  {
    id:'F02', g:'SECURITY',
    text:'A passenger threatened to detonate an explosive device on board.',
    lang:'en', expectCat:'Interferencia Ilícita',
  },
  {
    id:'F03', g:'SECURITY',
    text:'Se encontró un objeto punzocortante de grandes dimensiones oculto en equipaje de mano.',
    expectCat:'Seguridad Aeroportuaria',
  },
  {
    id:'F04', g:'SECURITY',
    text:'Pasajero realizó ademanes amenazantes hacia la tripulación durante el vuelo.',
    expectCat:'Interferencia Ilícita',
  },
  {
    id:'F05', g:'SECURITY',
    text:'Suspicious unattended bag found on boarding bridge; EOD called.',
    lang:'en', expectCat:'Seguridad Aeroportuaria',
  },
  {
    id:'F06', g:'SECURITY',
    text:'Pasajero con comportamiento agresivo inmovilizado por tripulantes y pasajeros.',
    expectCat:'Interferencia Ilícita',
  },
  {
    id:'F07', g:'SECURITY',
    text:'Armed hijacker attempted to divert the aircraft to an alternate destination.',
    lang:'en', expectCat:'Interferencia Ilícita',
  },
  {
    id:'F08', g:'SECURITY',
    text:'Se detectaron municiones de arma corta en el equipaje de bodega sin declarar.',
    expectCat:'Seguridad Aeroportuaria',
  },
  {
    id:'F09', g:'SECURITY',
    text:'Pasajero con comportamiento sospechoso fue escoltado fuera de la aeronave antes del despegue.',
    expectCat:'Seguridad Aeroportuaria',
  },
  {
    id:'F10', g:'SECURITY',
    text:'Stun gun discovered in passenger purse during secondary security screening.',
    lang:'en', expectCat:'Seguridad Aeroportuaria',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP G — HUMAN FACTORS (8 cases)
  // Must NOT cause FIREARM/ENGINE/FIRE false positives
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'G01', g:'HUMAN_FACTORS',
    text:'El copiloto seleccionó erróneamente el nivel de vuelo incorrecto durante la programación del FMS.',
    expectCat:'Factores Humanos',
  },
  {
    id:'G02', g:'HUMAN_FACTORS',
    text:'Crew miscommunication led to incorrect flap setting on approach.',
    lang:'en', expectCat:'Factores Humanos',
  },
  {
    id:'G03', g:'HUMAN_FACTORS',
    text:'El piloto reportó fatiga extrema al inicio del vuelo con solo 4 horas de descanso previo.',
    expectCat:'Fatiga de Tripulación',
  },
  {
    id:'G04', g:'HUMAN_FACTORS',
    text:'Captain reported feeling fatigued after 14 hours of duty time.',
    lang:'en', expectCat:'Fatiga de Tripulación',
  },
  {
    id:'G05', g:'HUMAN_FACTORS',
    text:'Error de lectura del altímetro por el primer oficial durante la aproximación en IMC.',
    expectCat:'Factores Humanos',
  },
  {
    id:'G06', g:'HUMAN_FACTORS',
    text:'Coordinación inadecuada entre tripulación resultó en TCAS RA ignorada.',
    // Could be TCAS_RA or HF — complex case
    checkRevisar:true,
  },
  {
    id:'G07', g:'HUMAN_FACTORS',
    text:'Cabin crew failed to follow standard door-closing procedure; door opened during taxi.',
    lang:'en', expectCat:'Factores Humanos',
  },
  {
    id:'G08', g:'HUMAN_FACTORS',
    text:'El controlador aéreo emitió instrucciones contradictorias que generaron confusión en la tripulación.',
    checkRevisar:true,
    // ATC or HF — ambiguous
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP H — OUT OF TAXONOMY (8 cases)
  // Must flag _revisarManualmente; must NOT auto-accept aeronautical category
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'H01', g:'OUT_OF_TAXONOMY',
    text:'El empleado de catering se cortó la mano al manipular bandejas en el avión.',
    checkRevisar:true,
    safetyRisk:'MEDIUM', safetyDesc:'Catering injury classified as SMS aeronautical event',
  },
  {
    id:'H02', g:'OUT_OF_TAXONOMY',
    text:'La lavadora industrial del hangar presentó una avería eléctrica.',
    checkRevisar:true,
    safetyRisk:'MEDIUM', safetyDesc:'Hangar laundry machine breakdown classified as technical failure',
  },
  {
    id:'H03', g:'OUT_OF_TAXONOMY',
    text:'Cleaning crew reported a broken mop handle on the jetway.',
    lang:'en', checkRevisar:true,
  },
  {
    id:'H04', g:'OUT_OF_TAXONOMY',
    text:'La cafetera del área de descanso de pilotos se averió; se solicitó reemplazo.',
    checkRevisar:true,
  },
  {
    id:'H05', g:'OUT_OF_TAXONOMY',
    text:'Se rompió el dispensador de jabón en el baño del aeropuerto en zona de embarque.',
    checkRevisar:true,
  },
  {
    id:'H06', g:'OUT_OF_TAXONOMY',
    text:'A catering truck had a flat tire on the apron.',
    lang:'en', checkRevisar:true,
    // Catering truck flat tire — out of scope
  },
  {
    id:'H07', g:'OUT_OF_TAXONOMY',
    text:'Fallo del sistema de computadoras de facturación; pasajeros reprogramados manualmente.',
    checkRevisar:true,
    // IT system failure — not aeronautical SMS
  },
  {
    id:'H08', g:'OUT_OF_TAXONOMY',
    text:'El cocinero del servicio de catering se quemó la mano con una sartén en la cocina del aeropuerto.',
    checkRevisar:true,
    safetyRisk:'MEDIUM', safetyDesc:'Catering kitchen burn classified as Incendio or medical event',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP I — AMBIGUOUS CASES (8 cases)
  // Two categories have reasonable evidence; system should review, not auto-accept
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'I01', g:'AMBIGUOUS',
    text:'Pasajero informó sentirse muy mal durante el vuelo; era un agente de policía fuera de servicio sin arma.',
    // MED_EMERGENCY signal + security mention (no weapon) → review
    checkRevisar:true,
    adversarial:true,
  },
  {
    id:'I02', g:'AMBIGUOUS',
    text:'Bird strike suspected on engine 1; engine continued operating normally after.',
    lang:'en',
    // BIRD_STRIKE + ENGINE_NORMAL → review expected
    checkRevisar:true,
    adversarial:true,
  },
  {
    id:'I03', g:'AMBIGUOUS',
    text:'Turbulencia moderada y pasajero con crisis epiléptica a bordo.',
    // TURBULENCE + MED_EMERGENCY → review
    checkRevisar:true,
  },
  {
    id:'I04', g:'AMBIGUOUS',
    text:'TCAS RA was triggered simultaneously with an engine vibration warning.',
    lang:'en',
    // TCAS_RA + ENGINE_FAILURE → review
    checkRevisar:true,
  },
  {
    id:'I05', g:'AMBIGUOUS',
    text:'Pasajero amenazó verbalmente a otro, quien resultó tener un arma blanca.',
    // INTERFERENCIA ILÍCITA or SEGURIDAD AEROPORTUARIA → review
    checkRevisar:true,
  },
  {
    id:'I06', g:'AMBIGUOUS',
    text:'Aterrizaje forzoso por falla de motor y también por incursión de pista simultáneas.',
    // ENGINE_FAILURE + RUNWAY_INCURSION → review
    checkRevisar:true,
    adversarial:true,
  },
  {
    id:'I07', g:'AMBIGUOUS',
    text:'Derrame de combustible y activación de alarma de incendio a bordo.',
    // FUEL_EMERGENCY + FIRE → review (both strong signals)
    checkRevisar:true,
    adversarial:true,
  },
  {
    id:'I08', g:'AMBIGUOUS',
    text:'Pasajero inconsciente descubierto con un arma en la cintura.',
    // MED_EMERGENCY + FIREARM → review
    checkRevisar:true,
    adversarial:true,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP J — LANGUAGE ROBUSTNESS (10 cases)
  // Typos, colloquial, synonyms, articles, plural/singular, regional variants
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'J01', g:'LANGUAGE',
    text:'Se produció una incurcion en la pita durante el rodaje.',   // typos: incurcion, pita
    expectCat:'Incursión de Pista',
    adversarial:true,
  },
  {
    id:'J02', g:'LANGUAGE',
    text:'Habia fuego en los motores del avion.',  // no accents, colloquial
    expectCat:'Incendio',
  },
  {
    id:'J03', g:'LANGUAGE',
    text:'Se cayó el motor — lo apagamos y seguimos con el otro.',  // very colloquial
    expectCat:'Falla Técnica',
  },
  {
    id:'J04', g:'LANGUAGE',
    text:'Berd straik on the left eng.',  // EN with heavy typos
    lang:'en',
    expectCat:'Bird Strike',
    adversarial:true,
  },
  {
    id:'J05', g:'LANGUAGE',
    text:'La pax tenía un fierro en la maleta.',  // LatAm slang: "fierro" = gun
    // Slang → may or may not detect; expect review
    checkRevisar:true,
    adversarial:true,
  },
  {
    id:'J06', g:'LANGUAGE',
    text:'Faulta del motor durante cruzero.',  // mixed typos
    expectCat:'Falla Técnica',
  },
  {
    id:'J07', g:'LANGUAGE',
    text:'No hobia fumo en la cabina, todo bien.',  // typos + regional
    checkNot:'Incendio',
    checkNot2:'Smoke / Humo a Bordo',
  },
  {
    id:'J08', g:'LANGUAGE',
    text:'Faya del primer motor en fase de crucero.',  // "faya" = falla typo
    expectCat:'Falla Técnica',
  },
  {
    id:'J09', g:'LANGUAGE',
    text:'Pasajero inconscente requirió oxígeno y desfibrilador.',  // typo: inconscente
    expectCat:'Emergencia Médica',
  },
  {
    id:'J10', g:'LANGUAGE',
    text:'Runway incurion by ground vehicle near 36R.',  // EN typo
    lang:'en', expectCat:'Incursión de Pista',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP K — ADVERSARIAL CASES (10 cases)
  // Deliberately constructed to probe edge cases and safety-critical confusions
  // ══════════════════════════════════════════════════════════════════════════
  {
    id:'K01', g:'ADVERSARIAL',
    text:'El capitán mencionó que si hubiera fuego en la cabina, usarían los extintores.',
    // HYPOTHETICAL fire — should NOT auto-classify as Incendio
    checkNot:'Incendio',
    checkRevisar:true,
    safetyRisk:'HIGH', safetyDesc:'Hypothetical fire classified as real fire → false emergency',
    hypothetical:true,
  },
  {
    id:'K02', g:'ADVERSARIAL',
    text:'El pasajero preguntó si había un extintor cercano, por precaución.',
    // Questions about fire safety equipment → NOT a fire incident
    checkNot:'Incendio',
    checkRevisar:true,
  },
  {
    id:'K03', g:'ADVERSARIAL',
    text:'La instrucción de seguridad menciona: en caso de fuego, no abrir las puertas.',
    // Safety briefing text → NOT a real event
    checkNot:'Incendio',
    checkRevisar:true,
    safetyRisk:'HIGH', safetyDesc:'Safety briefing text classified as real fire incident',
  },
  {
    id:'K04', g:'ADVERSARIAL',
    text:'Durante el adiestramiento se simuló una falla de motor para evaluar CRM.',
    // Training sim of engine failure → NOT real
    checkNot:'Falla Técnica',
    checkRevisar:true,
    safetyRisk:'HIGH', safetyDesc:'Training simulation of failure classified as real failure',
  },
  {
    id:'K05', g:'ADVERSARIAL',
    text:'Se revisó el extintor de incendios del compartimento delantero; estado: operativo.',
    // Maintenance check of fire extinguisher → NOT a fire
    checkNot:'Incendio',
    checkRevisar:true,
  },
  {
    id:'K06', g:'ADVERSARIAL',
    text:'No hubo fuego, pero sí se encontró un arma de fuego; además, el motor operaba con normalidad.',
    // 3 signals: FIRE negated, FIREARM present, ENGINE_NORMAL
    // → FIREARM must win; ENGINE_FAILURE must NOT activate
    expectCat:'Seguridad Aeroportuaria',
    checkNot:'Incendio',
    safetyRisk:'CRITICAL', safetyDesc:'Multiple negations + FIREARM; FIREARM must dominate, FIRE must stay negated',
    adversarial:true,
  },
  {
    id:'K07', g:'ADVERSARIAL',
    text:'No se detectó humo, pero hubo una falla del motor y también una incursión en pista.',
    // SMOKE negated + ENGINE_FAILURE + RUNWAY_INCURSION → 2 real events, complex
    checkNot:'Smoke / Humo a Bordo',
    checkRevisar:true,
    adversarial:true,
  },
  {
    id:'K08', g:'ADVERSARIAL',
    text:'Aves en el aeropuerto; ninguna colisionó con la aeronave.',
    // Birds present but no strike → NOT Bird Strike
    checkNot:'Bird Strike',
    safetyRisk:'MEDIUM', safetyDesc:'Presence of birds without strike classified as Bird Strike',
  },
  {
    id:'K09', g:'ADVERSARIAL',
    text:'El documento de investigación refiere: presencia de humo 2 años atrás en esa aeronave.',
    // Historical reference — not a current event → review
    checkRevisar:true,
    checkNot:'Incendio',
    adversarial:true,
  },
  {
    id:'K10', g:'ADVERSARIAL',
    text:'Weather report: smoke and fire conditions at destination airport due to forest fires.',
    lang:'en',
    // Environmental smoke/fire at destination, not on aircraft → review
    checkNot:'Incendio',
    checkRevisar:true,
    safetyRisk:'MEDIUM', safetyDesc:'External environmental fire classified as on-board fire event',
    adversarial:true,
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────
function runMode(mode, battery) {
  process.env.USE_LEXICON_V2 = mode === 'v2' ? 'true' : 'false';
  Object.keys(require.cache).forEach(k => delete require.cache[k]);
  const { clasificarV2 } = require('./classifier-v2');
  const { extractConcepts } = require('./concept-extractor');
  const { analyzeContext } = require('./context-engine');

  return battery.map(tc => {
    const r = clasificarV2(tc.text, tc.lang || 'es');
    const cat = r ? r.categoria : null;
    const conf = r ? +r.confianza.toFixed(3) : 0;
    const revisar = r ? !!r._revisarManualmente : false;

    let enriched = [];
    if (mode === 'v2') {
      const raw = extractConcepts(tc.text);
      enriched = analyzeContext(raw, tc.text);
    }

    const hasHypo = enriched.some(m => m.hypothetical);

    // Evaluate
    let ok = true;
    const issues = [];

    if (tc.expectCat && cat !== tc.expectCat) {
      ok = false; issues.push(`cat=${cat} expected=${tc.expectCat}`);
    }
    // checkNot: if we got this category AND did NOT flag for review → FAIL
    if (tc.checkNot && cat === tc.checkNot && !revisar) {
      ok = false; issues.push(`UNSAFE: auto-accepted as ${tc.checkNot}`);
    }
    // checkNot2: secondary checkNot
    if (tc.checkNot2 && cat === tc.checkNot2 && !revisar) {
      ok = false; issues.push(`UNSAFE: auto-accepted as ${tc.checkNot2}`);
    }
    if (tc.checkRevisar && !revisar && mode === 'v2') {
      ok = false; issues.push(`expected _revisarManualmente=true`);
    }
    if (tc.hypothetical && mode === 'v2' && !hasHypo) {
      ok = false; issues.push(`expected hypothetical detection`);
    }

    // Safety-critical confusion check
    const isSafetyCritical = !ok && tc.safetyRisk === 'CRITICAL';
    const isHighRisk = !ok && tc.safetyRisk === 'HIGH';

    return {
      id: tc.id, g: tc.g,
      cat, conf, revisar, ok,
      issues,
      safetyRisk: tc.safetyRisk || null,
      safetyDesc: tc.safetyDesc || null,
      isSafetyCritical,
      isHighRisk,
      expectCat: tc.expectCat || null,
      checkNot: tc.checkNot || null,
      text: tc.text.slice(0, 70),
    };
  });
}

// ── Run both modes ────────────────────────────────────────────────────────────
const v1 = runMode('v1', ADVERSARIAL);
const v2 = runMode('v2', ADVERSARIAL);

// ── Aggregate metrics ─────────────────────────────────────────────────────────
function metrics(results) {
  const total = results.length;
  const pass = results.filter(r => r.ok).length;
  const autoAccept = results.filter(r => !r.revisar);
  const autoAcceptCorrect = autoAccept.filter(r => r.ok).length;
  const toReview = results.filter(r => r.revisar).length;
  const safetyCritical = results.filter(r => r.isSafetyCritical).length;
  const highRisk = results.filter(r => r.isHighRisk).length;

  // Per-category precision/recall
  const cats = {};
  for (const r of results) {
    const pred = r.cat;
    const exp = r.expectCat;
    if (pred) {
      if (!cats[pred]) cats[pred] = { tp:0, fp:0, fn:0 };
      if (exp && pred === exp) cats[pred].tp++;
      else if (pred !== exp) cats[pred].fp++;
    }
    if (exp) {
      if (!cats[exp]) cats[exp] = { tp:0, fp:0, fn:0 };
      if (pred !== exp) cats[exp].fn++;
    }
  }

  return {
    total, pass, accuracy: (pass/total*100).toFixed(1),
    autoAccept: autoAccept.length,
    autoAcceptCorrect,
    autoAcceptPrecision: autoAccept.length ? (autoAcceptCorrect/autoAccept.length*100).toFixed(1) : 'N/A',
    toReview, toReviewPct: (toReview/total*100).toFixed(1),
    safetyCriticalFails: safetyCritical,
    highRiskFails: highRisk,
    cats,
  };
}

const m1 = metrics(v1);
const m2 = metrics(v2);

// ── Print results ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(80));
console.log('  PHASE 1.5 — ADVERSARIAL VALIDATION BATTERY (116 cases)');
console.log('  NO COMMIT · NO PUSH · NO RAILWAY CHANGES');
console.log('═'.repeat(80));

// Per-case
console.log('\nID     GRP              V1 result                 V2 result                Δ');
console.log('─'.repeat(90));
for (let i = 0; i < ADVERSARIAL.length; i++) {
  const r1 = v1[i], r2 = v2[i];
  const v1s = (r1.ok?'✓':'✗')+' '+(r1.cat||'null').slice(0,18).padEnd(18)+' c='+r1.conf.toFixed(2);
  const v2s = (r2.ok?'✓':'✗')+' '+(r2.cat||'null').slice(0,18).padEnd(18)+' c='+r2.conf.toFixed(2)+(r2.revisar?' R':'');
  const d = !r1.ok&&r2.ok?'↑':r1.ok&&!r2.ok?'↓!':'=';
  const riskTag = r2.safetyRisk && !r2.ok ? ` [${r2.safetyRisk}]` : '';
  console.log(r1.id.padEnd(7)+r1.g.slice(0,16).padEnd(17)+v1s+'  |  '+v2s+' '+d+riskTag);
  if (!r2.ok) console.log('         V2 FAIL: '+r2.issues.join('; '));
}

// ── Summary table ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(80));
console.log('  AGGREGATE METRICS');
console.log('═'.repeat(80));
console.log(('Métrica').padEnd(35)+('V1 Baseline').padEnd(22)+'V2 Phase 1');
console.log('─'.repeat(80));
const rows = [
  ['Total casos', m1.total, m2.total],
  ['PASS', m1.pass, m2.pass],
  ['Accuracy', m1.accuracy+'%', m2.accuracy+'%'],
  ['Auto-accept casos', m1.autoAccept, m2.autoAccept],
  ['Auto-accept CORRECTOS', m1.autoAcceptCorrect, m2.autoAcceptCorrect],
  ['Auto-accept PRECISION', m1.autoAcceptPrecision+'%', m2.autoAcceptPrecision+'%'],
  ['Enviados a revisión', m1.toReview+' ('+m1.toReviewPct+'%)', m2.toReview+' ('+m2.toReviewPct+'%)'],
  ['Safety-CRITICAL fails', m1.safetyCriticalFails, m2.safetyCriticalFails],
  ['HIGH-risk fails', m1.highRiskFails, m2.highRiskFails],
];
for (const [label, v1v, v2v] of rows) {
  console.log(label.padEnd(35)+String(v1v).padEnd(22)+String(v2v));
}

// ── Per-category ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(80));
console.log('  PER-CATEGORY METRICS (V2)');
console.log('─'.repeat(80));
console.log(('Categoría').padEnd(30)+('TP').padEnd(6)+('FP').padEnd(6)+('FN').padEnd(6)+('Precision').padEnd(12)+'Recall');
const allCats = new Set([...Object.keys(m2.cats)]);
for (const cat of [...allCats].sort()) {
  const s = m2.cats[cat] || {tp:0,fp:0,fn:0};
  const prec = s.tp+s.fp > 0 ? (s.tp/(s.tp+s.fp)*100).toFixed(0)+'%' : 'N/A';
  const rec  = s.tp+s.fn > 0 ? (s.tp/(s.tp+s.fn)*100).toFixed(0)+'%' : 'N/A';
  console.log(cat.slice(0,29).padEnd(30)+String(s.tp).padEnd(6)+String(s.fp).padEnd(6)+String(s.fn).padEnd(6)+prec.padEnd(12)+rec);
}

// ── Regressions ───────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(80));
console.log('  REGRESSIONS (V1 PASS → V2 FAIL)');
console.log('─'.repeat(80));
let regs = 0;
for (let i = 0; i < ADVERSARIAL.length; i++) {
  if (v1[i].ok && !v2[i].ok) {
    regs++;
    console.log(`  ↓ [${v2[i].id}] ${v2[i].text.slice(0,60)}`);
    console.log(`    V2 FAIL: ${v2[i].issues.join('; ')}`);
  }
}
if (regs === 0) console.log('  NONE — no regressions detected.');

// ── Safety-critical confusions ────────────────────────────────────────────────
console.log('\n' + '═'.repeat(80));
console.log('  ⚠  SAFETY-CRITICAL CONFUSION ANALYSIS (V2)');
console.log('═'.repeat(80));

const SAFETY_CHECKS = [
  { label:'FIREARM classified as Incendio (auto-accepted)',    pred:'Incendio',               forCats:['Seguridad Aeroportuaria'], expected:['Seguridad Aeroportuaria'] },
  { label:'FIREARM classified as non-security (auto-accepted)',pred:null,                    forCats:['Seguridad Aeroportuaria'], notPred:'Seguridad Aeroportuaria' },
  { label:'Incendio classified as Seg.Aeroportuaria',         pred:'Seguridad Aeroportuaria',forCats:['Incendio'] },
  { label:'ENGINE_NORMAL auto-accepted as Falla Técnica',     pred:'Falla Técnica',          checkNotCases:['B02','B05','B06','B07','B08','B10','B11','B13'] },
  { label:'Negated SMOKE auto-accepted as Smoke/Incendio',    pred_list:['Smoke / Humo a Bordo','Incendio'], checkNotCases:['E05','E06','J07'] },
  { label:'Negated FIRE auto-accepted as Incendio',           pred:'Incendio', checkNotCases:['K01','K02','K03'] },
  { label:'OUT-OF-TAXONOMY auto-accepted as aeronautical cat',checkNotCases:['H01','H02','H03','H04','H05','H06','H07','H08'] },
];

let criticalConfusions = 0;
for (const check of SAFETY_CHECKS) {
  const affected = [];
  for (let i = 0; i < ADVERSARIAL.length; i++) {
    const r2 = v2[i];
    const tc = ADVERSARIAL[i];

    if (check.checkNotCases) {
      if (!check.checkNotCases.includes(r2.id)) continue;
      // These should have revisar=true; if auto-accepted → problem
      if (!r2.revisar && r2.cat) {
        if (check.pred && r2.cat === check.pred) affected.push(r2);
        else if (check.pred_list && check.pred_list.includes(r2.cat)) affected.push(r2);
        else if (!check.pred && !check.pred_list) affected.push(r2);
      }
    } else if (check.forCats && check.forCats.includes(tc.expectCat)) {
      if (check.pred && r2.cat === check.pred && !r2.revisar) affected.push(r2);
      if (check.notPred && r2.cat !== check.notPred && !r2.revisar && tc.expectCat !== r2.cat) affected.push(r2);
    }
  }
  const icon = affected.length > 0 ? '🚨 DETECTED' : '✓  CLEAR';
  console.log(`\n  ${icon}: ${check.label}`);
  if (affected.length > 0) {
    criticalConfusions += affected.length;
    for (const r of affected) {
      console.log(`    → [${r.id}] cat=${r.cat} conf=${r.conf} revisar=${r.revisar}`);
      console.log(`      text: "${r.text.slice(0, 70)}"`);
    }
  }
}

// ── Final verdict ─────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(80));
console.log('  VEREDICTO PHASE 1.5');
console.log('═'.repeat(80));
const autoPrec = parseFloat(m2.autoAcceptPrecision);
const noSafetyCritical = m2.safetyCriticalFails === 0;
const noRegressions = regs === 0;
const autoAcceptOk = autoPrec >= 95;
const noCritConfusions = criticalConfusions === 0;

console.log(`  Auto-accept precision: ${m2.autoAcceptPrecision}%   Threshold: ≥95%   ${autoAcceptOk?'✓ OK':'✗ FAIL'}`);
console.log(`  Safety-critical fails: ${m2.safetyCriticalFails}               Threshold: 0      ${noSafetyCritical?'✓ OK':'✗ FAIL'}`);
console.log(`  Regressions V1→V2:     ${regs}               Threshold: 0      ${noRegressions?'✓ OK':'✗ FAIL'}`);
console.log(`  Critical confusions:   ${criticalConfusions}               Threshold: 0      ${noCritConfusions?'✓ OK':'✗ FAIL'}`);
console.log('');
if (autoAcceptOk && noSafetyCritical && noRegressions && noCritConfusions) {
  console.log('  ✅ TODOS LOS CRITERIOS CUMPLIDOS — V2 listo para revisión de commit');
} else {
  console.log('  ❌ UNO O MÁS CRITERIOS FALLARON — NO autorizar commit/Railway hasta resolver');
}
