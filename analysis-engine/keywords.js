'use strict';
// ── KEYWORDS — KW, KW_EN, ROOTS, RAE_LEMMAS, CONCEPT_PATTERNS, SYNONYMS, ICAO_ADREP, AV_TERMS
// Extraído sin modificaciones de SafetyOps_v2.html
const { _norm } = require('./norm');

// KW: líneas 1170-2191
const KW={
  // ── TCAS RA — colisión aérea / conflicto de tráfico ─────────────────────
  "TCAS RA":[
    // técnico
    "tcas","acas","acas ii","tcas ii","resolución de tráfico","alerta de tráfico",
    "conflicto de tráfico","separación vertical","proximidad de tráfico","pérdida de separación",
    "maniobra de evasión","evasión ejecutada","coordinación atc fallida",
    // frases naturales / no técnico
    "casi chocamos con otro avión","casi nos chocamos","estuvimos a punto de chocar",
    "otro avión muy cerca","demasiado cerca de otro avión","nos cruzamos con otro avión",
    "dos aviones casi chocan","iba a chocar","conflicto aéreo","tráfico conflictivo",
    "se activó el tcas","nos avisó el tcas","avisó tcas","activó tcas",
    "aviso de colisión","casi choque","separación insuficiente","separación mínima",
    // inglés
    "resolution advisory","traffic advisory","ta/ra","climb climb","descend descend",
    "clear of conflict","traffic traffic","proximity warning","loss of separation",
    "near mid-air collision","nmac","conflicting traffic","airborne collision avoidance"
  ],
  // ── BIRD STRIKE — impacto con fauna ──────────────────────────────────────
  "Bird Strike":[
    // técnico
    "bird strike","impacto de ave","impacto con ave","impacto aviario","ingesta de ave","ingesta de fauna",
    "colisión con ave","choque con ave","ave en motor","ave en turbina","ave en pista",
    "wildlife strike","fauna aeroportuaria","control de fauna","impacto fauna",
    // frases naturales / no técnico
    "un pájaro entró al motor","chocamos con un pájaro","golpeamos un ave",
    "choque con un pájaro","choque con un ave","impactamos un pájaro","golpeó un pájaro",
    "un pájaro impactó","un ave golpeó el avión","una gaviota entró","pájaro en el motor",
    "ave en el motor","comimos un pájaro","restos de pájaro","restos de ave","plumas",
    "plumas en el motor","plumas en el parabrisas","plumas en fuselaje",
    "encontramos restos de ave","inspección post-impacto",
    "pájaro","pájaro en pista","pájaro en pista de rodaje","animal en pista",
    "fauna en pista","fauna en área operacional","fauna en aeropuerto",
    // nombres de aves
    "gaviota","paloma","buitre","cigüeña","pato","garza","cóndor","halcón",
    "ave rapaz","bandada","parvada","flota de aves","loro","golondrina",
    "lechuza","cuervo","hornero","cotorra","flamenco","ibis",
    // inglés
    "bird ingestion","bird hit","wildlife hazard","bird remains","feathers found",
    "engine bird strike","windshield bird","multiple bird strike","birdstrike"
  ],
  // ── RUNWAY EXCURSION — salida de pista ───────────────────────────────────
  "Runway Excursion":[
    // técnico
    "excursión de pista","salida de pista","corrida de pista","desvío de pista",
    "salida lateral","sobrecarrera","veer-off","hydroplaning","acuaplaning",
    "pista contaminada","frenado insuficiente","distancia de aterrizaje excedida","RESA",
    // frases naturales / no técnico
    "nos fuimos de pista","se fue de pista","salió de la pista","nos salimos de la pista",
    "corrió la pista","pasó la pista","no frenó a tiempo","no paró en pista",
    "excedió la pista","se pasó de pista","se pasó del umbral","toque muy largo",
    "aterrizaje muy largo","salió por el final de pista","se fue a la gramilla",
    "se fue al pasto","terminó fuera de pista","se desvió de la pista",
    "frenó de golpe en la pista","frenada brusca en pista","frenó tarde",
    "pista húmeda","pista con agua","pista con hielo","pista con nieve",
    "aterrizó en la calle de rodaje","abortó tarde","rechazó tarde el despegue",
    "se salió","se fue del asfalto","abandonó la pista","perdió la pista",
    // inglés
    "runway excursion","overrun","veer off","runway end","stopway",
    "crosswind limit","aquaplaning","wet runway","contaminated runway",
    "braking action","poor braking","tail wind landing","runway end safety area"
  ],
  // ── UNSTABLE APPROACH — aproximación inestabilizada ──────────────────────
  "Unstable Approach":[
    // técnico
    "aproximación inestabilizada","aproximación no estabilizada","go-around","go around",
    "aproximación frustrada","gate de estabilización","glideslope desviado",
    "localizer desviado","vref excedida","configuración tardía","tren no abajo",
    // frases naturales / no técnico
    "tuvimos que hacer go-around","hicimos go-around","abortamos la aproximación",
    "hicimos una vuelta","no pudimos aterrizar","volvimos a intentar","dimos una vuelta",
    "la aproximación no estaba bien","fuera de parámetros","íbamos muy rápido",
    "íbamos muy alto","íbamos muy bajo","entramos muy rápido","velocidad excesiva en final",
    "por encima del perfil","por debajo del perfil","energía excesiva",
    "continuamos inestabilizados","no configurada","flaps no extendidos",
    "vuelta al circuito","frustrada","discontinuar la aproximación",
    // inglés
    "unstabilised approach","unstable approach","missed approach","go-around executed",
    "below glideslope","above glideslope","speed high on final","speed low on final",
    "not configured","flaps not set","gear not down","continued unstabilised",
    "excessive sink rate on final","high energy approach","below decision height"
  ],
  // ── HARD LANDING — aterrizaje brusco ─────────────────────────────────────
  "Hard Landing":[
    // técnico
    "aterrizaje brusco","aterrizaje fuerte","aterrizaje duro","tasa de descenso elevada",
    "carga g elevada","exceso de g","qar fuera de límite","hard landing check",
    "excedencia de parámetros","registro qar","registro foqa","porpoise",
    // frases naturales / no técnico
    "aterrizamos fuerte","aterrizamos duro","fue un golpe fuerte","golpe fuerte al tocar",
    "aterrizaje muy brusco","sentimos un golpe","tocó muy fuerte","el avión rebotó",
    "rebotamos al aterrizar","aterrizamos y rebotamos","descenso muy rápido",
    "bajamos muy rápido","descendíamos muy rápido","impacto fuerte en pista",
    "aterrizó fuerte","aterrizó muy fuerte","aterrizó duro","el avión aterrizó fuerte",
    "frenó de golpe","frenó bruscamente en la pista","el impacto fue fuerte",
    "sentimos el impacto","el toque fue muy duro","golpe al tocar pista",
    "aterrizaje duro","aterrizaje muy duro","aterrizaje violento","traqueteo fuerte",
    "tren afectado","se inspeccionó el tren","inspección de tren post-aterrizaje",
    // inglés
    "hard landing","heavy landing","high sink rate","bounce","bounce landing",
    "firm landing","landing gear inspection","g-load exceedance","overweight landing",
    "qar exceedance","fdr spike","structural inspection required","foqa trigger"
  ],
  // ── GPWS / CFIT — alerta de terreno ──────────────────────────────────────
  "GPWS":[
    // técnico
    "gpws","egpws","TAWS","terrain pull up","whoop whoop","cfit",
    "colisión con suelo","colisión con terreno","conciencia situacional de terreno",
    "sink rate","don't sink","terrain terrain","pull up","too low terrain",
    // frases naturales / no técnico
    "sonó la alarma de terreno","se activó gpws","se activó el gpws","el gpws sonó",
    "el avión avisó del terreno","alarma de montaña","estábamos muy cerca del cerro",
    "casi chocamos con la montaña","nos acercamos al terreno","iban a pegar en el cerro",
    "casi tocan el suelo","alerta de obstáculo","proximidad del terreno",
    "montaña","cerro","terreno elevado","obstáculo en ruta","vuelo hacia terreno",
    "colisión con obstáculo","colisión con montaña","alerta terrain",
    // inglés
    "ground proximity","terrain warning","terrain alert","controlled flight into terrain",
    "terrain avoidance","pull up warning","mode 1","mode 2","mode 3","mode 4","mode 5",
    "terrain clearance","minimum safe altitude warning","msaw"
  ],
  // ── TURBULENCIA — sacudidas / windshear ──────────────────────────────────
  "Turbulencia":[
    // técnico
    "turbulencia","turbulencia severa","turbulencia moderada","turbulencia extrema",
    "turbulencia leve","estela turbulenta","vórtice de estela","windshear",
    "cizalladura","cizallamiento de viento","microburst","CAT","turbulencia en aire claro",
    // meteorología — condiciones adversas
    "tormenta","tormenta eléctrica","tormenta severa","tormenta convectiva",
    "truenos","rayos","relámpagos","granizo","lluvia fuerte","lluvia intensa",
    "lluvia torrencial","viento fuerte","viento cruzado","rachas de viento",
    "niebla","neblina","banco de niebla","baja visibilidad","visibilidad reducida",
    "visibilidad baja","visibilidad mínima","visibilidad limitada","condiciones IMC",
    "mal tiempo","condiciones meteorológicas adversas","condiciones adversas",
    "tiempo severo","meteorología adversa","tormenta en ruta","celda convectiva",
    "cumulonimbus","CB","thunderstorm","convección","frente frío","frente cálido",
    "hielo","engelamiento","ice","icing","anti-ice","carburador con hielo",
    "lluvia helada","superficie helada","pista helada","pista con hielo",
    // frases naturales / no técnico
    "sacudida","sacudida fuerte","nos sacudió fuerte","fue una turbulencia fuerte",
    "el avión se sacudió","nos movió mucho","hubo mucha turbulencia",
    "turbulencia inesperada","turbulencia repentina","sin aviso de turbulencia",
    "los pasajeros cayeron","pasajeros heridos","tripulantes heridos",
    "alguien se golpeó la cabeza","cayó al pasillo","se cayó del asiento",
    "lesión en cabina","lesión por turbulencia","sin cinturón","no estaban sentados",
    "golpearon el techo","golpearon el compartimento","cayó equipaje",
    "tripulante cayó","auxiliar de vuelo cayó","azafata cayó",
    "el tiempo estaba muy malo","el tiempo nos afectó","problemas por el tiempo",
    "condiciones muy malas","no se veía nada","visibilidad casi cero",
    // inglés
    "turbulence","severe turbulence","moderate turbulence","clear air turbulence",
    "wake turbulence","wake vortex","microburst","low level windshear",
    "LLWS","mountain wave","convective turbulence","injury from turbulence",
    "chop","light chop","moderate chop","extreme turbulence","unexpected turbulence",
    "thunderstorm","lightning","hail","low visibility","fog","icing conditions",
    "wind shear encounter","adverse weather","severe weather","weather diversion"
  ],
  // ── METEOROLOGÍA ADVERSA / LVO — condiciones met adversas sin turbulencia en vuelo ──
  "Meteorología Adversa":[
    // visibilidad reducida / niebla
    "niebla densa","banco de niebla","niebla espesa","niebla intensa","niebla en pista",
    "niebla en cabecera","niebla en aeródromo","visibilidad mínima operacional",
    "baja visibilidad","visibilidad reducida","visibilidad inferior al mínimo",
    "visibilidad por debajo del mínimo","visibilidad cero","visibilidad casi cero",
    "RVR","runway visual range","alcance visual en pista","alcance visual de pista",
    "LVO","low visibility operations","operaciones de baja visibilidad",
    "procedimientos de baja visibilidad","CAT II","CAT III","CAT I",
    "aproximación de baja visibilidad","aterrizaje de baja visibilidad",
    // decisiones operacionales en meteorología
    "aeropuerto no cierra","no cierran el espacio aéreo","espacio aéreo no cerrado",
    "continuar operaciones en condiciones adversas","presión para operar con mal tiempo",
    "despacho con meteorología adversa","despachado con tiempo malo",
    "vuelo despachado bajo condiciones límite","operar bajo condiciones mínimas",
    "por debajo de mínimos meteorológicos","fuera de los mínimos meteorológicos",
    "despacho bajo IMC","condiciones IMC en destino","alternativa meteorológica",
    "desvío por meteorología","desvío por tiempo","divert weather","weather divert",
    // engelamiento / hielo en tierra y en vuelo
    "engelamiento","engelamiento en suelo","hielo en pista","hielo en aeronave",
    "pista helada","pista con hielo","pista contaminada por hielo","superficie helada",
    "deicing","anti-icing","de-icing","tratamiento anticongelante","fluido anticongelante",
    "icing","in-flight icing","carburador con hielo","formación de hielo en vuelo",
    // tormenta eléctrica sin turbulencia
    "tormenta en aeródromo","tormenta sobre el aeropuerto","tormenta en destino",
    "actividad eléctrica","rayos en pista","rayos en aeródromo","lightning strike ground",
    "paralización por tormenta","espera por tormenta","hold for weather",
    // viento extremo sin turbulencia en vuelo
    "viento en pista excede límite","viento cruzado excede límite","crosswind limit exceeded",
    "viento excede máximo operacional","viento sobre límite","viento fuera de límite",
    "operación fuera del límite de viento","por encima del límite de viento",
    // lluvia / nieve / granizo en tierra
    "nieve en pista","nevada en aeródromo","pista cubierta de nieve","pista nevada",
    "granizo en aeródromo","lluvia torrencial en pista","pista anegada","agua en pista",
    // inglés
    "dense fog","fog bank","low visibility","minimum visibility","below minimums",
    "weather below minimums","airport not closed","continue operations adverse weather",
    "ground icing","runway contaminated","snow on runway","freezing rain","black ice runway"
  ],

  // ── MERCANCÍAS PELIGROSAS / HAZMAT ──────────────────────────────────────
  "Mercancías Peligrosas":[
    "mercancía peligrosa","mercancías peligrosas","carga peligrosa","material peligroso",
    "materiales peligrosos","sustancia peligrosa","sustancias peligrosas","dgr","dangerous goods",
    "dangerous cargo","hazmat","hazardous material","hazardous cargo","clase 1","clase 3",
    "clase 4","clase 5","clase 6","clase 7","clase 8","clase 9","iata dgr",
    "batería de litio no declarada","baterías de litio no declaradas","undeclared lithium",
    "batería de litio","baterías de litio","lithium battery","lithium batteries",
    "declaración de carga","cargo declaration","shipper declaration","declaración del expedidor",
    "derrame de sustancia","spill hazmat","fuga de material peligroso","contenedor dañado carga",
    "embalaje deficiente","embalaje incorrecto","mala clasificación carga","etiquetado incorrecto",
    "radioactivo","explosivo en carga","inflamable no declarado","oxidante en bodega",
    "mercancía no declarada","carga no declarada","undeclared cargo","carga oculta"
  ],
  // ── INCIDENCIA ATC / COMUNICACIONES ─────────────────────────────────────
  "Incidencia ATC":[
    "error atc","error de control de tráfico","instrucción incorrecta atc","instrucción errónea atc",
    "instrucción equivocada atc","atc dio instrucción incorrecta","controlador aéreo error",
    "controlador dio instrucción equivocada","instrucción de atc errónea","incidente atc",
    "read-back incorrecto","readback incorrecto","read back error","readback error",
    "confirmación incorrecta","repetición incorrecta de frecuencia","número de vuelo confundido",
    "confusión de callsign","callsign confusion","call sign confundido",
    "autorización incorrecta","clearance incorrecto","clearance erróneo","wrong clearance",
    "pista incorrecta autorizada","runway incorrecto","wrong runway clearance",
    "altitud incorrecta autorizada","nivel de vuelo incorrecto","fl incorrecto",
    "falla de comunicación","pérdida de comunicación","loss of communication","comm failure",
    "silencio radio","radio silencio","frecuencia incorrecta","wrong frequency",
    "comunicación fallida","no responde atc","atc no responde","unable to contact atc",
    "separación insuficiente por atc","atc no mantuvo separación","conflicto atc"
  ],
  // ── INCENDIO / FIRE ──────────────────────────────────────────────────────
  "Incendio":[
    "incendio","fuego confirmado","llamas","ignición","fire confirmed","fire onboard",
    "incendio de motor","engine fire","motor en llamas","fuego en motor",
    "incendio apU","apu fire","incendio en apu","fuego en apu",
    "incendio de tren","wheel fire","fire on wheel","frenos en llamas","frenos ardiendo",
    "incendio en bodega","cargo fire","fire in hold","fuego en bodega","bodega en llamas",
    "incendio en cabina","cabin fire","fuego en cabina","llamas en cabina",
    "incendio galley","galley fire","fuego en galley","cocina en llamas",
    "extintor activado fuego","fire extinguisher discharged confirmed","descarga de extintor por fuego",
    "fire warning light","luz de incendio","alarma de incendio confirmada","fire alarm confirmed",
    "evacuación por incendio","evacuation fire","evacuación de emergencia por fuego",
    "incendio en tierra","ground fire","aeronave en llamas","burning aircraft",
    // frases genéricas frecuentes — evitan que NB domine con FH
    "fuego en el avion","fuego en el avión","fuego en avion","fuego en avión",
    "fuego en la aeronave","fuego a bordo","fuego abordo","hay fuego","se declaró fuego",
    "se detectó fuego","se ve fuego","olor a quemado","olor a humo","humo en cabina",
    "humo en cabina de pasajeros","humo en cockpit","humo en cabina de pilotaje",
    "incendio a bordo","fire on board","fire in aircraft","fire aboard","aircraft on fire",
    "avion en llamas","avión en llamas","aeronave en llamas","plane on fire",
    "se incendió","se prendió fuego","prendio fuego","llamas a bordo","smoke on board"
  ],
  // ── ESTELA TURBULENTA / WAKE VORTEX ─────────────────────────────────────
  "Estela Turbulenta":[
    "estela turbulenta","vórtice de estela","vórtices de estela","wake turbulence",
    "wake vortex","wake vortex encounter","encuentro con estela","encuentro de estela",
    "estela de aeronave","estela de otro avión","turbulencia por estela","vortex encounter",
    "vórtice de punta de ala","wingtip vortex","turbulencia de punta de ala",
    "separación de estela","wake separation","wake separation minima","separación mínima de estela",
    "aeronave sacudida por estela","aeronave en estela","aeronave entró en estela",
    "efecto de estela","estela de heavy","estela de jumbo","heavy wake","wake of heavy",
    "turbulencia de salida","departure wake","wake on approach","estela en aproximación",
    "rodar por estela","roll from wake","roll induced by wake","balanceo por estela",
    "perdida de control por estela","upset by wake","actitud inusual por estela"
  ],
  // ── ILUMINACIÓN LÁSER ────────────────────────────────────────────────────
  "Iluminación Láser":[
    "láser","laser","iluminación láser","laser strike","laser attack","ataque de láser",
    "haz láser","rayo láser","luz láser","laser beam","apuntaron con láser",
    "láser en cockpit","laser in cockpit","láser en cabina de mando","laser apuntó cockpit",
    "láser verde","green laser","láser rojo","red laser","láser azul","blue laser",
    "deslumbramiento por láser","laser dazzle","ceguera temporal por láser","flash ciego",
    "tripulación deslumbrada","crew dazzled","piloto deslumbrado","pilot blinded laser",
    "tripulación afectada por láser","laser affected crew","vision affected laser",
    "visión afectada láser","reporte de láser","laser report","laser incident report",
    "láser desde tierra","laser from ground","laser ground attack","denuncia láser"
  ],
  // ── FATIGA DE TRIPULACIÓN ────────────────────────────────────────────────
  "Fatiga de Tripulación":[
    "fatiga de tripulación","tripulación fatigada","fatiga de piloto","piloto fatigado",
    "copiloto fatigado","crew fatigue","pilot fatigue","fatigue report","reporte de fatiga",
    "reporte fatiga","informe de fatiga","somnolencia","somnolencia en vuelo","somnoliento",
    "tripulante se durmió","piloto se durmió","se quedaron dormidos","fell asleep cockpit",
    "microsueño","micro sleep","incumplimiento fdp","fdp excedida","fdp exceeded",
    "tiempo de vuelo excedido","flight time exceeded","rest requirement violated",
    "descanso insuficiente","descanso incumplido","descanso no respetado",
    "período de descanso insuficiente","rest period insufficient","rest violated",
    "retraso en dormir","turno extendido","extended duty","extended shift",
    "fatigue risk management","frms","sistema de gestión de fatiga","fatiga acumulada",
    "no aptos por fatiga","tripulantes no aptos","crew unfit due fatigue"
  ],
  // ── ERROR DE NAVEGACIÓN ──────────────────────────────────────────────────
  "Error de Navegación":[
    "error de navegación","error navegación","navigation error","nav error",
    "waypoint incorrecto","wrong waypoint","waypoint equivocado","rumbo incorrecto",
    "rumbo equivocado","wrong heading","desviación de ruta","route deviation",
    "off course","desvío de ruta","fuera de ruta","pista incorrecta","wrong runway",
    "rnav error","rnav equivocado","error rnav","error gnss","gnss error",
    "gps spoofing","gps jamming","interferencia gps","gps signal lost","pérdida señal gps",
    "ils falso","false ils","false localizer","localizador falso","false glide slope",
    "error de procedimiento de aproximación","wrong approach","procedimiento incorrecto",
    "sid incorrecto","star incorrecta","procedimiento sid equivocado",
    "altímetro incorrecto","altimeter error","baro error","wrong qnh","qnh incorrecto",
    "posición incorrecta","wrong position","error de posición","nav database error",
    "base de datos nav incorrecta","ciclo de navegación vencido","expired nav database"
  ],
  // ── GROUND DAMAGE — daño en tierra / rampa ───────────────────────────────
  "Ground Damage":[
    // Términos normalizados por CONCEPT_PATTERNS
    "colision en rampa",
    // técnico
    "daño en tierra","daño en rampa","colisión en plataforma","FOD","cuerpo extraño",
    "pushback","towing","remolque","jet bridge","manga","pasarela","colisión en rodaje",
    "GSE","GPU","ground power unit","belt loader","loader","cargador","escalera de rampa",
    "carro de equipaje","tractor de remolque","vehículo de rampa","equipo de tierra",
    "equipo de rampa","daño en plataforma","daño en rampa","incidente en rampa","incidente en plataforma",
    "colisión en rampa","colisión en plataforma","contacto en rampa","contacto en plataforma",
    "contacto con fuselaje","contra fuselaje","contra el fuselaje","contra la aeronave",
    // frases naturales / no técnico
    "un vehículo golpeó el avión","el camión rozó el avión","la manga golpeó",
    "chocamos en la rampa","el pushback dañó","colisionó en plataforma",
    "vehículo impactó el avión","equipo de rampa chocó","encontramos un daño",
    "el loader chocó","loader golpeó","loader impactó","chocó contra fuselaje",
    "chocó con fuselaje","contra el fuselaje","contra la aeronave en plataforma",
    "encontramos daño en el avión","el avión llegó con daño","hay un daño en el avión",
    "hay una abolladura","tiene una abolladura","está abollado","está golpeado",
    "objeto en pista","encontraron algo en pista","había un objeto","cosa en pista",
    "reportaron algo en pista","algo en la pista","algo en pista","encontraron algo",
    "había algo en la pista","vieron algo en la pista","reportaron un objeto",
    "daño en cola","daño en ala","daño en timón","daño en tren de aterrizaje",
    "contacto con fuselaje","golpe de rampa","rasguño fuselaje","rasguño en hangar",
    "contacto con aeronave","daño durante rodaje","incidente en plataforma",
    // coloquial latinoamericano / verbos de incidente
    "chocó con el avión","golpeó el avión","raspó el avión","rozó el avión",
    "chocaron con el avión","golpearon el fuselaje","rasparon el fuselaje",
    "el equipo le pegó al avión","le pegaron al avión","le dieron al avión",
    "golpe contra el avión","raspón en el avión","abollaron el avión",
    "las escaleras golpearon","la rampa golpeó","el camión le pegó",
    "el tractor chocó","el loader chocó","la GPU chocó","el carro chocó",
    "daño en el fuselaje","daño en la panza","daño en la nariz","daño en la cola",
    "los daños en rampa","el incidente de rampa","accidente en rampa",
    "el avión llegó golpeado","el avión llegó con un daño","detectaron daño",
    "encontraron daño","revisaron y tenía daño","tenía una marca","tenía un raspón",
    // variantes con artículo (las/los/el/la)
    "el daño en tierra","el daño en rampa","la colisión en plataforma",
    "los equipos de rampa","el equipo de rampa","el vehículo de tierra",
    "el pushback","el towing","el remolque","la manga","la pasarela",
    // inglés
    "ground damage","ramp incident","apron collision","pushback incident",
    "towing damage","ground vehicle","jet bridge contact","ground handling",
    "foreign object","surface damage","wing tip strike","tail strike",
    "ground service equipment","gse damage","apron damage","belt loader damage",
    "gpu contact","ground power contact","ramp vehicle strike","apron vehicle"
  ],
  // ── INCURSIÓN DE PISTA — runway incursion ────────────────────────────────
  "Incursión de Pista":[
    // técnico
    "incursión de pista","runway incursion","entrada no autorizada a pista",
    "aeronave en pista activa","vehículo en pista","hotspot","runway hotspot",
    "autorización de pista","clearance de pista","line up","line-up","hold short",
    "hold position","holding point","punto de espera","barra de parada",
    "stop bar","runway status light","RWSL","rwsl","incursión de aeródromo",
    // frases naturales
    "se metió en la pista","entró a la pista","cruzó la pista sin autorización",
    "nos cortó el despegue","nos cortó la aproximación","nos cortó la pista",
    "vehículo en pista","aeronave en pista activa","otro avión en pista",
    "otro avión se cruzó","se nos cruzó un avión","se cruzó en la pista",
    "cruzamos sin autorización","entramos a la pista sin clearance",
    "no teníamos autorización para entrar","no teníamos clearance de pista",
    "invadimos la pista","ocupamos la pista","invadir la pista",
    "estaba ocupada la pista","había un avión en la pista","la pista estaba ocupada",
    "un avión estaba en la pista","hubo un conflicto en pista",
    "conflicto en área de movimiento","conflicto en taxeo","conflicto de rodaje",
    "confundimos la pista","confundión de pista","tomamos la pista equivocada",
    "pista equivocada","callejón equivocado","taxiway equivocada",
    "perdimos orientación en tierra","nos perdimos en el aeropuerto","nos perdimos en el aeródromo",
    // coloquial latinoamericano
    "se nos metió en la pista","se nos cruzó","nos invadió la pista",
    "casi chocamos en tierra","casi nos chocamos en pista","nos paramos en la pista",
    "nos quedamos en la pista","estábamos en la pista y venía otro",
    "entró sin permiso","cruzó sin permiso","se metió sin autorización",
    // variantes sin artículo
    "pista activa","cruzó pista","cruzo pista","entró pista","entro pista",
    "sin autorización de pista","sin autorizacion de pista","sin clearance de pista",
    // variantes con artículo (las/los/el/la)
    "la incursión de pista","la entrada a la pista","el vehículo en la pista",
    "la aeronave en la pista","el conflicto en pista","la pista activa",
    // inglés
    "runway incursion","unauthorized entry","active runway","runway crossing",
    "without clearance","wrong runway","runway occupied","ground conflict",
    "aircraft on runway","vehicle on runway","incursion alert","surface movement",
    "ground movement conflict","taxiway confusion","airport surface",
    "wrong taxiway","read-back error","clearance confusion","atc clearance missed"
  ],
  // ── FACTORES HUMANOS — error humano / CRM ────────────────────────────────
  "Factores Humanos":[
    // Términos normalizados por CONCEPT_PATTERNS
    "error procedimiento",
    // técnico
    "fatiga","fatiga de tripulación","error humano","error de tripulación","crm",
    "gestión de recursos de cabina","conciencia situacional","desorientación",
    "ilusión espacial","disciplina operacional","desviación de procedimiento",
    // frases naturales / no técnico
    "el piloto se distrajo","estaban cansados","llevan muchas horas volando",
    "tripulación fatigada","cansancio","somnolencia","no coordinaron",
    "no se comunicaron","mala comunicación","mala comunicación en cabina",
    "se olvidó el checklist","olvidaron el checklist","no hicieron el checklist",
    "saltaron un ítem","omitieron un paso","se confundieron","confundieron la pista",
    "aeropuerto equivocado","pista equivocada","confusión de aeropuerto",
    "error de procedimiento","no siguieron el procedimiento","quiebre de disciplina",
    // uniforme / indumentaria / EPP
    "uniforme reglamentario","indumentaria reglamentaria","ropa reglamentaria",
    "sin uniforme","sin indumentaria","ropa incorrecta","indumentaria incorrecta",
    "vestimenta incorrecta","vestimenta reglamentaria","no llevaba uniforme",
    "no vestía uniforme","sin epp","sin equipo de protección","sin chaleco",
    // secuencias y procedimientos pre-vuelo
    "secuencia incorrecta","secuencia equivocada","orden incorrecto",
    "pasos omitidos","checklist fuera de orden","pre-vuelo incorrecto",
    "walk-around incompleto","ítem fuera de secuencia","violación de sop",
    "desviación de sop","incumplimiento de norma","incumplimiento normativo",
    "violación de procedimiento","quiebre de disciplina operacional",
    "no cumplió el procedimiento","no respetó el procedimiento",
    // EN
    "uniform violation","attire violation","wrong uniform","improper attire",
    "dress code violation","pre-flight sequence error","checklist out of order",
    // apariencia / estado del uniforme
    "uniforme arrugado","uniforme sucio","uniforme en mal estado","uniforme deteriorado",
    "uniforme manchado","ropa arrugada","ropa sucia","ropa en mal estado",
    "presentación personal","apariencia personal","mal presentado","mala presentación",
    "no cumple presentación","presentación inadecuada","aspecto inapropiado",
    // azafata / tripulación de cabina
    "azafata","azafatas","sobrecargo","sobrecargos","tripulante de cabina",
    "tripulación de cabina","auxiliar de vuelo","auxiliares de vuelo",
    "flight attendant","cabin crew","stewardess","cabin attendant",
    // daño causado por acción humana sobre equipo (causa: FH, consecuencia: FT)
    "rompió el equipo","dañó el equipo","golpeó el panel","derramó sobre el sistema",
    "azafata rompió","azafata dañó","sobrecargo rompió","tripulante rompió",
    "tripulante dañó","personal dañó","causó daño al sistema","causó daño al equipo",
    "acción del tripulante","maniobra incorrecta del tripulante","manipuló incorrectamente",
    "operó mal el equipo","uso incorrecto del equipo","maltrato de equipo",
    "daño causado por tripulante","daño por acción humana","daño intencional",
    "broke the equipment","damaged the panel","crew member damaged","attendant broke",
    "briefing incompleto","falta de briefing","distracción","distracción en cabina",
    "alta carga de trabajo","sobrecarga","no dormieron bien","estaban muy cansados",
    "el copiloto no avisó","el comandante no escuchó","no se entendieron",
    "comunicación deficiente","comunicación fallida","error de coordinación",
    // pasajeros / seguridad cabina / médico
    "pasajero agresivo","pasajero violento","pasajero conflictivo","pasajero difícil",
    "pasajero indisciplinado","pasajero descontrolado","pasajero alcoholizado",
    "pasajero ebrio","pasajero bajo efecto de drogas","amenaza de pasajero",
    "altercado entre pasajeros","pelea a bordo","pasajero problemático",
    "emergencia médica","emergencia médica a bordo","enfermedad a bordo",
    "pasajero enfermo","pasajero se descompuso","tripulante enfermo",
    "pérdida de conciencia","desmayo a bordo","desmayó","convulsiones",
    "paro cardíaco","dolor de pecho","reacción alérgica","dificultad respiratoria",
    "malestar a bordo","malestar de pasajero","médico a bordo","llamaron médico",
    "oxígeno médico","botiquín de emergencia","AED","desfibrilador",
    // alcohol / drogas — personal operacional (rampa, tripulación, mantenimiento)
    "consumo de alcohol en servicio","bajo efecto de drogas en servicio",
    "alcohol en rampa","alcohol en plataforma","alcohol en hangar","alcohol en servicio",
    "personal bebiendo","empleado bebiendo","trabajador bebiendo","técnico bebiendo",
    "operador bebiendo","mecánico bebiendo","personal en estado","empleado en estado",
    "tomando alcohol","tomando vino","tomando cerveza","tomando trago","tomando tragos",
    "bebiendo en servicio","bebiendo en rampa","bebiendo en hangar","bebiendo en plataforma",
    "alcohol durante servicio","alcohol durante turno","alcohol antes de volar",
    "smell of alcohol","olor a alcohol","aliento a alcohol","aliento alcohólico",
    "test de alcoholemia","alcotest","control de drogas","drug test","alcohol test",
    "chaleco de cargo bebiendo","personal de rampa bebiendo","rampa bebiendo",
    "personal de tierra bebiendo","personal operativo bebiendo",
    "cannabis en servicio","marihuana en servicio","drogas en servicio",
    // conducta / seguridad a bordo
    "conducta inapropiada","comportamiento inapropiado","conducta indebida",
    "conducta impropia","comportamiento impropio","comportamiento indebido",
    "actividad sexual","acto sexual","sexo a bordo","sexo en el avión",
    "sexo en el baño","intimidad en el avión","relaciones sexuales a bordo",
    "acoso sexual","hostigamiento sexual","acoso a bordo","tocamiento indebido",
    "violación sexual","violada","violado","abuso sexual","agresión sexual","abuso por tripulante",
    "violó a","violó sexualmente","agredió sexualmente","abusó sexualmente",
    "tripulante abusó","piloto abusó","copiloto abusó","crew sexual assault",
    "sexual assault by crew","raped by crew","crew misconduct sexual",
    "exhibicionismo","desnudez a bordo","conducta obscena","acto obsceno",
    "incidente de conducta","violencia a bordo","altercado físico",
    "baño del avión","aseo del avión","lavabo del avión","retrete del avión",
    "se encerraron en el baño","se encerraron en el aseo","ocuparon el baño",
    // inglés
    "human factors","crew resource management","crew fatigue","flight crew error",
    "situational awareness","loss of situational awareness","spatial disorientation",
    "mode confusion","automation surprise","sterile cockpit violation",
    "checklist error","omission error","complacency","fixation","tunnel vision",
    "unruly passenger","disruptive passenger","medical emergency","passenger ill",
    "medical on board","passenger unconscious","in-flight medical","cardiac arrest",
    "sexual activity","sexual assault","sexual harassment","misconduct on board",
    "lavatory incident","bathroom incident"
  ],
  // ── FALLA TÉCNICA — falla de sistema / motor / estructura ────────────────
  "Falla Técnica":[
    // técnico — sistemas
    "falla técnica","falla de sistema","falla de motor","pérdida de motor",
    "sistema de check in","sistema check-in","sistema checkin","sistema de check-in",
    "falla sistema check in","falla check in","sistema de pasajeros","plataforma de pasajeros",
    "sistema de boarding","sistema de embarque","DCS falló","sistema DCS",
    "falla hidráulica","falla eléctrica","falla de presurización","despresurización",
    "falla de tren de aterrizaje","tren no se baja","tren no sube","falla de flaps",
    "indicación de falla","luz de advertencia","alarma de cabina","humo eléctrico",
    "avería","avería técnica","anomalía técnica","MEL","checklist de emergencia",
    "falla de instrumento","falla de aviónica","shutdown de motor",
    // CABINA DE PILOTOS / COCKPIT DOOR
    "cabina de pilotos","cabina del piloto","cockpit","flight deck",
    "puerta de cabina","puerta de pilotos","puerta del cockpit","puerta de vuelo",
    "puerta trabada","puerta bloqueada","puerta atascada","puerta no abre",
    "se trabó la puerta","se bloqueó la puerta","no podían abrir","no abrió la puerta",
    "puerta no cierra","puerta no cerró","problema con la puerta","falla de puerta",
    "acceso a cabina","no accedieron a cabina","piloto encerrado","encerrado en cabina",
    "piloto fuera de cabina","tripulante no podía entrar","no entraban a la cabina",
    "cockpit door","flight deck door","door jammed","door blocked","door failed",
    "door would not open","locked out","locked in cockpit",
    // frases naturales — sistemas
    "el motor se apagó","perdimos un motor","perdimos potencia","caída de potencia",
    "se apagó el motor","se fue un motor","hubo una falla","tuvimos una falla",
    "el avión tuvo un problema técnico","fallo técnico","algo falló",
    "presión de aceite baja","temperatura de motor alta","vibración de motor",
    "vibración excesiva","el motor vibra","el motor hace ruido raro",
    "la luz de falla se encendió","se encendió una alarma","alarma en cabina",
    "el tren no bajó","el tren no subió","las ruedas no salieron",
    "el tren de aterrizaje no funcionó","el tren no funcionó","problemas con el tren",
    "las ruedas no salieron","los flaps no bajaron","flaps no funcionaron",
    "olimos humo","había humo en cabina","salía humo","humo eléctrico",
    // ruido / vibración
    "ruido extraño","ruido raro","sonido extraño","sonido raro","ruido inusual",
    "hacía un ruido","el avión hizo un ruido extraño","el motor hacía un ruido",
    "golpe extraño","traqueteo","vibración rara","vibración inusual",
    "ruido en el motor","ruido en el tren","ruido al aterrizar","ruido al despegar",
    // sistemas específicos / no técnico
    "piloto automático","piloto automático no funcionaba","problemas con el piloto automático",
    "el autopilot se desconectó","se desconectó el autopilot","autopilot falló",
    "no funcionaba el radar","el radar no funcionaba","el radar falló","falla de radar",
    "perdimos comunicación","sin comunicación","comunicación cortada","radio falló",
    "la radio no funcionaba","no teníamos radio","perdimos el radio","falla de radio",
    "falla de comunicaciones","intercomunicador","interphone","comm failure",
    "se fue la luz","se fue la electricidad","apagón en cabina","falla eléctrica total",
    "falla completa","falla total","quedamos sin energía","sin energía eléctrica",
    // combustible
    "derrame de combustible","fuga de combustible","pérdida de combustible",
    "combustible bajo","bajo combustible","sin combustible","combustible insuficiente",
    "transferencia de combustible","falla en el combustible","fuel leak","fuel spill",
    "derrame de fuel","olimos combustible","olor a combustible","olor a kerosene",
    // presurización / oxígeno
    "problema de presurización","pérdida de presurización","se despresurizó",
    "máscaras de oxígeno","cayeron las máscaras","máscaras cayeron",
    "presión de cabina","altitud de cabina","cabin altitude","cabin pressure",
    // ESTRUCTURA — partes del avión + verbos de daño
    "fuselaje","fuselaje quebrado","fuselaje roto","fuselaje dañado","fuselaje fisurado",
    "fuselaje rajado","fuselaje golpeado","grieta en fuselaje","fisura en fuselaje",
    "daño en fuselaje","fuselaje comprometido","integridad estructural",
    "ala rota","ala dañada","ala fisurada","grieta en ala","fisura en ala",
    "cola rota","cola dañada","empenaje","daño en cola","daño en estabilizador",
    "panel roto","panel dañado","panel desprendido","panel suelto","panel quebrado",
    "remache","remache faltante","deformación estructural","abolladura en fuselaje",
    "crack","grieta","fisura","rajadura","rotura estructural","daño estructural",
    "estructura comprometida","casco dañado","cubierta rota","skin damage",
    "inspección estructural","inspeccionaron la estructura","enviaron a mantenimiento",
    "mantenimiento lo revisó","lo bajaron por daño","sacaron de servicio","fuera de servicio",
    // FUEGO / INCENDIO — aeronave, motor y aeropuerto / terminal
    "fuego en aeropuerto","fuego en terminal","fuego en hangar","fuego en la puerta",
    "fuego en manga","fuego en rampa","fuego en plataforma","incendio en terminal",
    "incendio en hangar","incendio en manga","incendio en aeropuerto",
    "alarma de incendio","evacuación de terminal","emergencia en terminal",
    "puerta de embarque en llamas","gate en llamas","aeropuerto evacuado",
    "turbina en llamas","motor en llamas","incendio de motor","incendio en vuelo",
    "incendio en turbina","fuego en motor","fuego en turbina","llamas en motor",
    "se prendió fuego","se prendió el motor","motor ardiendo","turbina ardiendo",
    "avión en llamas","aeronave en llamas","humo del motor","motor humeante",
    "turbina humeante","salía humo del motor","humo negro del motor",
    "señal de fuego","luz de fuego","alarma de incendio","fire light",
    "fire warning","fire handle","extintor disparado","botella de extinción",
    "EGT excedida","temperatura de turbina excedida","hot start",
    "compressor stall","surge de compresor","flameout","apagado de llama",
    // variantes con artículo (las/los/el/la) — matching natural en español
    "fuego en las turbinas","fuego en los motores","fuego en el motor","fuego en la turbina",
    "incendio en las turbinas","incendio en los motores","llamas en las turbinas",
    "turbinas en llamas","motores en llamas","motor en llamas","la turbina arde",
    // extinción / supresión de fuego
    "corta fuegos","corta fuego","extintor","extinguidor","extinguir",
    "sistema contra incendios","sistema de extinción","sistema extinción",
    "botella de fuego","botella antiincendio","handle de fuego","palanca de fuego",
    "extintor no funciona","corta fuegos sin funcionar","extintor falló",
    "el extintor no funcionó","el corta fuegos no funcionó","no se activó el extintor",
    // aterrizaje de emergencia / forzoso
    "aterrizaje de emergencia","aterrizaje forzoso","aterrizaje de precaución",
    "se evalúa aterrizaje","evaluando aterrizaje","se evalúa un aterrizaje",
    "declaramos emergencia","se declaró emergencia","mayday","pan pan",
    // fallas en alas / estructura en vuelo
    "falla en las alas","fallas en las alas","problema en las alas","daño en las alas",
    "falla en el ala","alas comprometidas","falla estructural en vuelo","alas dañadas",
    "problemas en las alas","problemas en alas","falla en alas",
    // inglés
    "technical failure","engine failure","engine shutdown","engine malfunction",
    "hydraulic failure","electrical failure","pressurisation failure","decompression",
    "landing gear failure","gear unsafe","flap failure","instrument failure",
    "system malfunction","warning light","EICAS message","ECAM message",
    "MEL dispatch","emergency checklist","mayday","pan pan",
    "engine fire","turbine fire","aircraft on fire","smoke from engine",
    "smoke in cockpit","cabin smoke","fire on board","cracked fuselage",
    "structural damage","hull damage","skin damage","airframe damage",
    // ── PARTES DEL AVIÓN ────────────────────────────────────────────────
    // superficies de vuelo
    "flap","flaps","alerón","alerones","slat","slats","spoiler","spoilers",
    "airbrake","speed brake","timón","timón de profundidad","timón de cola",
    "timón de dirección","estabilizador","estabilizador horizontal","estabilizador vertical",
    "elevador","elevator","rudder","aileron",
    // estructura
    "fuselaje dañado","fuselaje comprometido","fuselaje rajado","fisura en fuselaje",
    "estructura dañada","estructura comprometida","integridad estructural",
    "revestimiento","skin damage","piel del avión","daño en piel","aircraft dent","abolladuras",
    "larguero","marco estructural","frame","spar","stringer",
    // tren de aterrizaje
    "tren de aterrizaje","gear","landing gear","tren no baja","tren no sube",
    "tren no retrae","tren no extiende","tren bloqueado","tren parcialmente extendido",
    "rueda","neumático","llanta","tire","neumático reventado","tire burst","blowout",
    "frenos","brakes","brake failure","frenos calientes","brake overheat","antiskid",
    "tren delantero","nose gear","tren principal","main gear","shimmy",
    // motores y propulsión
    "falla en turbina","falla motor","engine failure","motores apagados","turbinas","nacela","nacelle",
    "compresor","turbina de alta","turbina de baja","fan blade","pala de fan",
    "empuje","thrust","FADEC","EEC","EPR","N1","N2","EGT","ITT",
    "surge","compressor stall","engine stall","pompage","reversor","reverser",
    "inversor de empuje","thrust reverser","reverser no retrae","reverser no despliega",
    "APU","auxiliary power unit","APU falla","APU inoperativo",
    // combustible
    "combustible","fuel","kerosene","Jet-A","avgas","fuel leak","fuga de combustible",
    "combustible bajo","bajo combustible","fuel low","fuel imbalance","desbalance de combustible",
    "bomba de combustible","fuel pump","fuel transfer","transferencia de combustible",
    "crossfeed","tank","tanque","fuel contamination","contaminación de combustible",
    // sistemas hidráulicos y eléctricos
    "hidráulica","hydraulic","sistema hidráulico","hydraulic failure","hydraulic leak",
    "pérdida hidráulica","fuga hidráulica","presión hidráulica","hydraulic pressure",
    "sistema eléctrico","electrical","electrics","generator","generador",
    "bus eléctrico","electrical bus","battery","batería","IDG","CSD","ELEC",
    "inverter","transformador","essential bus","non-essential bus",
    // cabina de pasajeros
    "galley","galey","gally","galera","galley fire","fuego en galley","fuego en el galley",
    "fuego en galey","fuego en el galey","galley incendiada","galley en llamas","galley se incendió",
    "lavatory","lavabo","baño de abordo","lavatory fire","fuego en lavabo","smoke in lavatory",
    "fuego en el lavabo","fuego en baño","incendio en baño",
    "overhead bin","compartimiento superior","asiento roto","cinturón roto",
    "máscara de oxígeno","oxygen mask","oxygen","oxígeno","presurización","pressurisation",
    "cabin altitude","altitud de cabina","descompresión","decompression",
    "tobogán","slide","escape slide","puerta de emergencia","emergency exit","exit door",
    "cabin crew","tripulación de cabina","azafata","TCP","flight attendant",
    // cockpit / cabina de pilotaje
    "pitot","tubo de pitot","pitot tube","pitot blocked","pitot obstruido","pitot congelado",
    "static port","puerto estático","altímetro","altimeter","velocímetro","airspeed indicator",
    "ADC","ADIRU","air data","unreliable airspeed","airspeed unreliable",
    "FMS","flight management system","autopilot","piloto automático","autothrottle","autothrust",
    "EFIS","ECAM","EICAS","glass cockpit","pantalla de vuelo","display de vuelo",
    "radio altimeter","GPWS","EGPWS","TAWS","transponder","squawk 7700",
    "radio VHF","radio HF","SELCAL","communication failure","falla de comunicaciones","comm failure",
    "ILS","localizer","glideslope","DME","VOR","NDB","GPS","GNSS","FMC",
    "weather radar","radar meteorológico","TCAS","ACAS","EFVS","HUD",
    // ── VOCABULARIO DE AEROPUERTO ────────────────────────────────────────
    "falla en pista","runway","runway contaminada","pista contaminada","pista mojada",
    "pista con hielo","pista con nieve","pista con slush","pista con FOD",
    "umbral de pista","threshold","displaced threshold","stopway","clearway",
    "RESA","runway end safety area","overrun area",
    "taxiway","calle de rodaje","calle de rodaje cerrada","taxiway cerrada",
    "apron damage","posición de estacionamiento","gate cerrado","puerta de embarque bloqueada",
    "hangar","taller","MRO","maintenance","mantenimiento en plataforma",
    "torre de control","ATC","control tower","ground control","approach control",
    "ATIS","METAR","reporte TAF","SIGMET","AIRMET","NOTAM","SNOWTAM","ASHTAM","PIREP",
    "ILS fuera","ILS no operativo","ILS inoperativo","VOR fuera","NDB fuera",
    "FOD","foreign object","objeto extraño en pista","debris en pista",
    "wildlife","fauna","perros en pista","animales en pista","deer","ciervo",
    "holding point","punto de espera","hold short","lineup","line up and wait",
    "sin clearance","ATC clearance","taxi clearance","takeoff clearance","clearance denegado",
    "push back","pushback","towing","remolque","GPU","ground power unit",
    "fueling","carga de combustible","abastecimiento","defueling","drenaje",
    "deicing","anti-icing","tratamiento anticongelante","glycol","deicing fluid",
    "catering","limpieza","cleaning","agua potable","water service","lavado de tanques",
    "bodega de carga","bodega avión","hold de carga","ULD dañado","pallet dañado",
    "contenedor dañado","mercancías peligrosas","HAZMAT declarado","IATA DGR",
    "equipaje dañado","baggage damage","maleta rota","luggage damaged","special baggage",
    "vehiculo en pista","vehículo en pista","equipo de tierra dañado",
    "follow-me","marshaller","wands","guía de atraque","VDGS","docking system",
    "jetway","manga","passenger bridge","boarding bridge","air stairs","escalera de avión",
    "low visibility operations","LVO","CAT II","CAT III","LVP",
    "runway incursion","incursión de pista","hotspot","punto caliente",
    "RWSL","stop bar","runway status lights"
  ],
  // ── SEGURIDAD AEROPORTUARIA ──────────────────────────────────────────────
  "Seguridad Aeroportuaria":[
    "robo","hurto","sustracción","robaron","hurtaron","se llevaron","desapareció",
    "robo de equipaje","hurto de equipaje","robo en sala","robo en puerta",
    "robo en terminal","robo en aeropuerto","robo en preembarque",
    "acceso no autorizado","intrusión","intruso","persona no autorizada",
    "control de acceso","tarjeta de acceso","badge","credencial","sin credencial",
    "violación de perímetro","zona restringida","área restringida",
    "acceso restringido","area restringida","área de acceso restringido","area de acceso restringido",
    "sin identificacion","sin identificación","sin identificarse","no identificado","sin id",
    "persona sin identificar","persona no identificada","persona sin badge","sin tarjeta de acceso",
    "ingreso no autorizado","ingreso sin permiso","ingreso sin identificacion","ingreso sin identificación",
    "hombre en area","persona en area","individuo en area","hombre en área","persona en área",
    "persona sospechosa","sujeto sospechoso","individuo sospechoso","tipo sospechoso",
    "persona desconocida","individuo desconocido","sujeto desconocido","desconocido en rampa",
    "desconocido en plataforma","extraño en rampa","extraño en plataforma","extraño en pista",
    "hombre no identificado","mujer no identificada","persona no identificada en rampa",
    "persona no identificada en plataforma","personal no identificado en rampa",
    "sin uniforme","sin chaleco reflectante","sin chaleco de seguridad","sin EPP",
    "no porta uniforme","no lleva uniforme","no usa uniforme","sin ropa reglamentaria",
    "sin vestimenta reglamentaria","no identificable","sin identificación visible",
    "sin credencial visible","sin gafete visible","sin tarjeta visible",
    "persona con abrigo","persona de negro","hombre de negro","mujer de negro",
    "persona encapuchada","persona con capucha","individuo encapuchado","hombre encapuchado",
    "ropa sospechosa","vestimenta sospechosa","ropa inadecuada para la zona",
    "no es personal autorizado","no parece personal","no parece empleado",
    "merodeando","merodeaba","merodeó","mirando","miraba","espiando","espiaba",
    "se coló","se colo","entró sin autorización","entró sin permiso","pasó sin autorización",
    "tailgating","piggybacking","accedió sin","accedio sin",
    "documentación falsa","documento falso","credencial falsa","id falsa","id adulterado",
    "pasaporte falso","identidad falsa","documento adulterado","documento apócrifo",
    // cámaras / vigilancia
    "cctv","vigilancia","cámara","grabación","imagen","reconocimiento","monitoreo",
    "cámara de seguridad","falla de cámara","cámara sin imagen","punto sin cámara",
    "sistema de videovigilancia","control de cámaras","grabaciones","revisar grabaciones",
    // personal y zonas
    "seguridad aeroportuaria","personal de seguridad","guardia","guardia de seguridad",
    "supervisor de seguridad","jefe de seguridad","agente de seguridad","policía aeroportuaria",
    "zona airside","zona landside","zona pública","zona restringida de vuelo",
    "sala de espera","sala de preembarque","sala de embarque","puerta de embarque",
    "zona de embarque","zona de preembarque","zona boarding","area de embarque","área de embarque",
    "sin pasaje","sin boarding pass","sin billete","sin ticket","sin pase de abordaje",
    "sin pasabordo","sin tarjeta de embarque","sin tarjeta de abordaje","sin boarding",
    "no tiene pasaje","no tenia pasaje","no tenía pasaje","no portaba pasaje",
    "persona sin pasaje","persona sin boarding","pasajero no identificado","pasajera no identificada",
    "pasillo de embarque","finger","jetway","acomodador","personal de tierra",
    // amenazas y seguridad a bordo
    "amenaza","amenaza de bomba","bomba","objeto sospechoso","artefacto","artefacto explosivo",
    "llamada amenazante","llamada de amenaza","amenaza telefónica","nota amenazante",
    "amenaza escrita","aviso de bomba","paquete sospechoso","bolso abandonado","maleta abandonada",
    "contrabando","droga","estupefacientes","arma","arma de fuego","arma blanca","cuchillo",
    "navaja","pistola","revólver","explosivo","explosivos","granada","munición",
    "narcotráfico","tráfico de armas","tráfico de personas","smuggling",
    // interferencia ilícita / seguridad en vuelo (ICAO Annex 17)
    "interferencia ilícita","acto ilícito","secuestro aéreo","hijacking","toma de rehenes",
    "explosivo a bordo","bomba a bordo","amenaza a bordo","artefacto a bordo","dispositivo a bordo",
    "material explosivo a bordo","carga explosiva","ied","dispositivo explosivo improvisado",
    "sustancia explosiva","nota amenazante en aeronave","amenaza en cabina","amenaza en vuelo",
    "baño con explosivo","explosivo en baño","artefacto en baño","objeto en baño del avión",
    "pasajero con explosivo","pasajero con bomba","pasajero con arma a bordo",
    "protocolo de seguridad a bordo","emergencia de seguridad en vuelo",
    // pasajeros
    "pasajero conflictivo","pasajero violento","pelea","incidente con pasajero",
    "pasajero agresivo","pasajero indisciplinado","pasajero perturbador",
    "pasajero alcoholizado","pasajero ebrio","pasajero bajo efecto","pasajero intoxicado",
    "disturbio","escándalo","agresión","amenaza verbal","agresión física",
    "altercado","pelea entre pasajeros","pelea a bordo","incidente de conducta",
    "unruly passenger","disruptive passenger","passenger misconduct",
    // ciberseguridad
    "phishing aeronáutico","ciberataque","ataque informático","hackeo","hacking",
    "intrusión informática","sistema comprometido","datos comprometidos",
    "ransomware","malware","ataque a sistema SMS","vulnerabilidad informática",
    // hurtos específicos
    "hurto carry-on","robo de laptop","robo de electrónico","robo de efectivo",
    "robo de documento","robo de pasaporte","robo en bodega","robo de carga",
    "robo de combustible","robo de partes","pilferage","cargo theft","fuel theft",
    "puerta de embarque sin vigilancia","sala sin cobertura","punto ciego",
    "brecha de seguridad","control deficiente","sin control de acceso",
    "security breach","unauthorized access","theft","stolen","baggage theft",
    "robo SCL","hurto SCL","SCL seguridad","seguridad SCL",
    "robo EZE","hurto EZE","robo AEP","hurto AEP",
    // ── Términos normalizados por CONCEPT_PATTERNS (RAE×ICAO) ──────────
    // Objeto abandonado
    "objeto abandonado","objeto sospechoso","objeto abandonado en instalacion",
    "bolso abandonado","mochila abandonada","paquete abandonado","maleta abandonada",
    "bulto abandonado","valija abandonada","bolsa abandonada","cartera abandonada",
    // Conducta sospechosa
    "conducta sospechosa","conducta sospechosa en instalacion",
    "comportamiento sospechoso","actitud sospechosa","conducta inusual",
    // Vigilancia / espionaje
    "vigilancia sospechosa","espiando","acechar",
    // Armas / amenazas
    "arma detectada","amenaza verbal",
    // Acceso indebido (coloquial)
    "colision en rampa","error procedimiento",
    // ── Términos normalizados por CONCEPT_PATTERNS — sujeto+locación ──────
    // Persona genérica en área de movimiento (pista, rampa, plataforma)
    "persona en area operacional","persona no autorizada en area operacional",
    "intrusión en area operacional","acceso no autorizado area operacional",
    // Persona + alcohol + área operacional (ej: "persona tomando vino en pista")
    "intrusión con alcohol en area operacional","persona con alcohol en area operacional",
    "conductor con alcohol en area operacional",
    // Animal no-aviario en área de movimiento (ej: perro en pista)
    "animal en area de movimiento","animal no identificado en pista",
  ],
  // ── INTERFERENCIA ILÍCITA (ICAO Annex 17 — in-flight unlawful interference) ──
  "Interferencia Ilícita":[
    // Armas a bordo
    "arma a bordo","arma en el avión","arma en vuelo","arma en cabina","arma en aeronave",
    "pistola a bordo","cuchillo a bordo","navaja a bordo","revólver a bordo","escopeta a bordo",
    "pasajero armado","pasajero con arma","pasajero con pistola","pasajero con cuchillo",
    "tripulante con arma","persona armada en vuelo","individuo armado en aeronave",
    // Explosivos a bordo
    "explosivo a bordo","explosivos a bordo","bomba a bordo","artefacto explosivo a bordo",
    "dispositivo explosivo a bordo","granada a bordo","ied a bordo","carga explosiva a bordo",
    "explosivo en baño del avión","explosivo en cabina","bomba en baño del avión",
    "amenaza de bomba a bordo","amenaza de bomba en vuelo","aviso de bomba en vuelo",
    // Amenazas en vuelo
    "amenaza en vuelo","amenaza en el avión","amenaza a bordo","amenaza durante el vuelo",
    "pasajero amenazó durante vuelo","pasajero hizo amenaza en vuelo",
    "nota amenazante en aeronave","nota amenazante en vuelo","nota de amenaza a bordo",
    // Secuestro / toma de control
    "secuestro aéreo","hijacking","intento de secuestro","toma de control de aeronave",
    "intento acceder a cabina de mando","pasajero intentó entrar a cockpit",
    "pasajero forzó puerta de cabina","pasajero atacó tripulación de vuelo",
    // Interferencia ilícita general
    "interferencia ilícita","acto ilícito a bordo","acto ilícito en vuelo",
    "acto de interferencia","interferencia en vuelo",
    // Apertura de puertas en vuelo
    "pasajero intentó abrir puerta de emergencia","pasajero abrió manija de emergencia",
    "intento de abrir puerta en vuelo","intentó abrir salida de emergencia en vuelo",
    // Sustancias ilegales en vuelo
    "droga en vuelo","droga a bordo","narcótico en vuelo","contrabando en vuelo",
    "sustancia ilícita a bordo","sustancia prohibida a bordo",
    // Contexto en vuelo + seguridad
    "pleno vuelo amenaza","en vuelo amenaza","crucero amenaza seguridad",
  ],
  // ── DEMORA OPERACIONAL ───────────────────────────────────────────────────
  "Demora Operacional":[
    "demora","demorado","atraso","atrasado","retraso","retrasado","delay","delayed",
    "salida tarde","salida demorada","salida atrasada","fuera de horario",
    "no salimos en horario","salimos tarde","despegamos tarde","demoramos en salir",
    "pushback tardío","pushback demorado","pushback fuera de horario",
    "catering tardío","catering demorado","catering no llegó","sin catering",
    "limpieza tardía","limpieza demorada","cleaning tardío","cleaning demorado",
    "carga demorada","carga tardía","equipaje demorado","belt loader",
    "abastecimiento tardío","combustible tardío","fueling tardío","sin combustible a tiempo",
    "documentación incompleta","documentación faltante","despacho tardío",
    "boarding tardío","embarque tardío","embarque demorado","embarque fuera de tiempo",
    "tripulación esperando","tripulación lista pero","crew ready","crew waiting",
    "llegamos en horario","llegó en horario","llegó a tiempo","llegamos a tiempo",
    "compensó el atraso","recuperamos tiempo","tiempo recuperado en ruta",
    "on time arrival","OTP","on-time performance","tasa de puntualidad",
    "turnaround","tiempo de rotación","rotación demorada","rotación extendida",
    "slot","ventana de salida","perder el slot","slot perdido"
  ],
  // ── CFIT ─────────────────────────────────────────────────────────────────
  "CFIT":[
    "cfit","vuelo controlado contra el terreno","colisión con terreno","impacto con terreno",
    "impacto con suelo","chocó contra montaña","impacto en montaña","colisión montaña",
    "descendió bajo mda","descendió bajo da","descendió sin referencias","bajo mínimos sin visual",
    "descendió en imc sin visual","atravesó mínimos","violó mínimos de aproximación",
    "gpws ignorado","egpws ignorado","ignoró la alarma gpws","ignoró pull up","no hizo pull up",
    "pull up ignorado","no respondió gpws","descenso no autorizado a terreno",
    "terreno adelante","terrain ahead ignorado","impactó terreno","impacto con colina"
  ],
  // ── EMERGENCIA MÉDICA ─────────────────────────────────────────────────────
  "Emergencia Médica":[
    "emergencia médica","emergencia medica","pasajero inconsciente","pasajero incapacitado",
    "paro cardíaco","paro cardiaco","infarto a bordo","infarto en vuelo","ataque al corazón",
    "rcp a bordo","reanimación a bordo","desfibrilador","aed a bordo","kit médico",
    "médico a bordo","médico en vuelo","solicitud médica","asistencia médica",
    "medlink","medlink consultado","consulta médica en vuelo","coordinación médica",
    "tripulante incapacitado","piloto incapacitado","crew incapacitation","incapacitación",
    "desmayo a bordo","crisis convulsiva","convulsión a bordo","accidente cerebrovascular",
    "pasajero fallecido","falleció a bordo","muerte a bordo","emergencia diabética",
    "reacción alérgica grave","anafilaxis a bordo","dificultad respiratoria"
  ],
  // ── SMOKE / HUMO A BORDO ──────────────────────────────────────────────────
  "Smoke / Humo a Bordo":[
    "humo en cabina","humo en cockpit","humo en cabina de vuelo","humo en cabina de mando",
    "humo a bordo","olor a quemado","olor a humo","smoke in cabin","smoke in cockpit",
    "humo visible","humo detectado","origen del humo","fuente de humo",
    "incendio a bordo","fuego a bordo","llamas a bordo","fire on board",
    "extintor activado","extintor usado","usó el extintor","activó extintor",
    "circuito eléctrico quemado","sobrecalentamiento eléctrico","cortocircuito a bordo",
    "fallo eléctrico con humo","humo compartimento equipaje","humo en bodega",
    "humo en galley","horno con humo","catering con humo","panel con humo",
    "vapores tóxicos","humos tóxicos","fumes on board","toxic fumes",
    "mascarillas de oxígeno","máscaras de emergencia","descenso de emergencia por humo"
  ],
  // ── PÉRDIDA DE CONTROL (LOC-I) ────────────────────────────────────────────
  "Pérdida de Control":[
    "pérdida de control","perdida de control","loss of control","loc-i","loc i",
    "pérdida de control en vuelo","pérdida de control en despegue",
    "entrada en pérdida","stall","pérdida aerodinámica","pérdida aerodinamica",
    "oscilación incontrolada","phugoid","dutch roll","alabeo incontrolado",
    "actitud anormal","unusual attitude","ángulo de banco excesivo","bank angle excesivo",
    "spiraling","barrena","entró en barrena","espiral descendente",
    "autopilot disconnect","desconexión del autopiloto","desconexión inesperada del ap",
    "override manual","corrección brusca","corrección violenta","input brusco",
    "pérdida momentánea de control","momentarily lost control","excedió límite de maniobra",
    "maniobra extrema","maniobra fuera de sobre","excedió vmo","excedió mmo"
  ],
  // ── PRESURIZACIÓN ─────────────────────────────────────────────────────────
  "Presurización":[
    "presurización","presurization","presurización fallida","presurización falla",
    "falla de presurización","fallo de presurización","pérdida de presión de cabina",
    "descompresión","descompresion","descompresión rápida","rapid decompression",
    "explosive decompression","descompresión explosiva",
    "máscaras de oxígeno desplegadas","mascarillas desplegadas","oxygen masks deployed",
    "presión de cabina baja","cabin pressure low","cabin altitude warning",
    "altitud de cabina excedida","cabin altitude exceedance",
    "descent for pressurization","descenso de emergencia por presurización",
    "seal failure","falla de sello","sello de puerta defectuoso",
    "ventana fisurada","window crack","fisura en ventana de cabina",
    "oxígeno de emergencia","emergency oxygen","pax oxygen masks"
  ],
  // ── FUEL / COMBUSTIBLE ────────────────────────────────────────────────────
  "Fuel / Combustible":[
    "emergencia de combustible","fuel emergency","low fuel","combustible bajo",
    "poca nafta","poco kerosene","fuel exhaustion","agotamiento de combustible",
    "minimum fuel","mínimo de combustible","mayday fuel","pan pan fuel",
    "cantidad de combustible incorrecta","carga de combustible incorrecta",
    "error de combustible","fuel error","wrong fuel grade","combustible equivocado",
    "contaminación de combustible","fuel contamination","agua en combustible",
    "fueling error","error de abastecimiento","abastecimiento incorrecto",
    "combustible insuficiente","insufficient fuel","fuel uplift error",
    "fuel imbalance","desbalance de combustible","asimetría de combustible",
    "fuel leak","pérdida de combustible","fuga de combustible","fuel dumping"
  ],
  // ── FOD ───────────────────────────────────────────────────────────────────
  "FOD":[
    "fod","foreign object debris","objeto extraño en pista","debris en pista",
    "objeto en pista","objeto en plataforma","objeto en taxiway",
    "daño por fod","fod damage","daño de fod en neumático","daño en llanta por fod",
    "neumático reventado por objeto","tire burst fod","blowout por objeto extraño",
    "ingesta de fod","fod en motor","object in engine","objeto en motor",
    "objeto suelto en rampa","herramienta abandonada","herramienta en pista",
    "tornillo en pista","tuerca en pista","pieza suelta en plataforma",
    "inspección de pista","runway inspection","ramp sweep","barrido de pista",
    "restos de ave en pista","plumas en pista","remains on runway",
    "cubierta de inspección suelta","panel suelto","fairing lost","cowling debris"
  ]
};

// ── ENRIQUECIMIENTO NORMATIVO: IATA / NASA ASRS / ANAC RAAC ─────────────────
// Agrega términos de taxonomía IATA AHM/IOSA, NASA ASRS, y RAAC ANAC a las categorías existentes
(function _enrichNormativa(){
  const add=(cat,terms)=>{ if(KW[cat]) KW[cat].push(...terms.filter(t=>!KW[cat].includes(t))); };

  // TCAS RA — NASA ASRS: "loss of separation", "airspace deviation"; IATA: "ACAS alert", "RA issued"
  add('TCAS RA',['asrs inflight event','asrs airspace','acas alert','ra issued','ra not followed',
    'coordinate after ra','pilot deviation tcas','adsb conflict','tcas event report',
    'iosa flt 4.2.2','annex 2 para 3.7.3']);

  // Bird Strike — IATA AHM 630, NASA ASRS Wildlife; ANAC RAAC 153
  add('Bird Strike',['iata ahm 630','wildlife hazard management','wlhm','bird aircraft strike hazard',
    'bash program','wildlife management plan','airport wildlife','raac 153 fauna',
    'asrs wildlife','strike report','febs form','faa wildlife strike database',
    'transport canada wildlife','avis strike','animal control plan']);

  // Runway Excursion — IATA RESA, NASA ASRS Runway Event; ANAC RAAC 121
  add('Runway Excursion',['iata resa 90m','resa runway end safety area','raac 121 aterrizaje',
    'ema exceedance','asrs runway event','runway overrun','veer off report','aquaplaning report',
    'ldta landing distance theoretical available','toda','lda landing distance available',
    'iosa ops 1.6','runway condition report','rcr','rcam runway condition assessment matrix',
    'braking action nil','poor braking action']);

  // Falla Técnica — IATA AHM, IOSA MNT; ANAC RAAC 145; NASA ASRS Maintenance
  add('Falla Técnica',['raac 145 mantenimiento','iosa mnt 1.3','mel maint minimum equipment list',
    'cdl configuration deviation list','asrs maintenance event','squawk maintenance',
    'maintenance error','maintenance human factors','meda maintenance error decision aid',
    'boeing meda','airbus saf','airworthiness directive','ad cn','airworthiness concern',
    'safety investigation maintenance','mx event','mx finding','iata sarp mnt',
    'engineering order','repair scheme','aog technical']);

  // Fatiga de Tripulación — IATA FRMS; ANAC RAAC 121 Subparte Q; NASA ASRS Fatigue
  add('Fatiga de Tripulación',['iata frms fatigue risk management system','raac 121 subparte q',
    'flight time limitations','ftl','rest period raac','asrs fatigue report',
    'alertness actigraphy','sleep debt','duty time exceeded','fdtl flight duty time limitations',
    'cumulative fatigue','circadian disruption','frms iata 2011','karolinska sleepiness',
    'samn perelli scale','fatigue report','epworth sleepiness score','iosa flt 2.2.9',
    'nasa sleep restriction','night duty fatigue']);

  // Factores Humanos — HFACS, IATA HFACS, NASA ASRS Human Performance
  add('Factores Humanos',['hfacs human factors analysis','hfac shell model','iata hfacs',
    'asrs human performance','james reason model','liveware hardware interface',
    'iosa flt 2.2 crew resource management','crm evaluation','crew coordination failure',
    'asrs human factors','decision error','skill based error','perceptual error',
    'situational awareness loss','workload overload','tunnel vision','asrs deviation',
    'iosa flt 4.1.4','threat and error management tem','line check captain debriefing']);

  // Mercancías Peligrosas — IATA DGR; ANAC RAAC 92/175; NASA ASRS Cargo
  add('Mercancías Peligrosas',['iata dgr dangerous goods regulations','raac 92 mercancias peligrosas',
    'raac 175 mercancias','dgr class 1 explosivos','dgr class 3 inflamables','dgr class 9',
    'shippers declaration','declaracion expedidor','asrs cargo event','undeclared dangerous goods',
    'hidden dangerous goods','cargo incident','dgr label missing','packing group',
    'iata dgr acceptance check','shipper error dgr','package integrity dgr',
    'overpack dgr','excepted quantity','limited quantity lq']);

  // Seguridad Aeroportuaria — IATA SEC, IOSA SEC; ANAC RAAC 153
  add('Seguridad Aeroportuaria',['iosa sec 1.1','raac 153 seguridad','avsec aviation security',
    'icao annex 17','ncasp national civil aviation security programme','iata avsec',
    'asrs security event','screener error','access control failure','perimeter breach',
    'unauthorized access','sterile area breach','checkpoint failure','threat assessment',
    'security incident report','iata iosa sec 1.3','prohibited item detected',
    'checkpoint anomaly','security lapse','iata do 8973']);

  // Incursión de Pista — IATA ARIWS, ANAC RAAC 121; NASA ASRS Runway Incursion
  add('Incursión de Pista',['iata ariws advanced runway incursion warning system','icao runway incursion definition',
    'category a b c d incursion','severity category incursion','asrs runway incursion',
    'hot spot aeroportuario','raac 91 pista','surface incident','apron incident',
    'ground movement error','aip hot spots','atc surface error','gmcs ground movement control',
    'pilot deviation runway','taxiway intersection incursion','land and hold short lhs',
    'lahso','ils critical area','ils sensitive area incursion']);

  // Meteorología Adversa — IATA WX, NASA ASRS Weather; ANAC RAAC 121
  add('Meteorología Adversa',['iosa flt 2.2.15 meteorologia','raac 121 meteorologia',
    'asrs weather event','pirep pilot weather report','airmet sigmet wx',
    'weather deviation approved','inadvertent icing','iata weather decision making',
    'thunderstorm avoidance policy','wx radar onboard','wx avoidance','convective activity',
    'ifr minimums not met','visual approach wx','wx alternate requirement',
    'dispatch wx release','airport wx minima','low vis operations lvo raac',
    'cat iii b authorisation','rvsm weather','turbulence encounter report']);

  // GPWS / CFIT — IATA CFIT prevention, NASA ASRS CFIT
  add('GPWS',['iata cfit prevention','raac 121 taws','asrs cfit near event','gpws alert category',
    'enhanced gpws egpws','terrain awareness warning system taws','iosa flt 4.2.5',
    'minimum terrain clearance','moca minimum obstacle clearance altitude',
    'gpws training requirement','cfit accident prevention','non precision approach cfit',
    'vnav cfit','terrain awareness program','terrain clearance floor tcf',
    'raac 121 gpws equipamiento']);

  // Comunicaciones ATC — IATA phraseology, NASA ASRS ATC Communication
  add('Incidencia ATC',['iata standard phraseology','icao annex 11 atc','asrs atc communication',
    'readback error','hearback error','similar callsign confusion','callsign confusion',
    'atc instruction misunderstood','read back incorrect','atc communication failure',
    'frequency congestion','frequency blocked','atc workload peak','controller error',
    'loss of communication','comm failure raac 91','sqawk 7600','mayday relay atc',
    'raac 91 comunicaciones','phraseology desvio']);
})();

// ── ENGLISH KEYWORD DICTIONARY (for ES→EN language switch) ─────────────────

// KW_EN: líneas 2192-2424
const KW_EN={
  "TCAS RA":[
    "tcas","acas","acas ii","tcas ii","resolution advisory","traffic advisory","ta/ra",
    "climb climb","descend descend","clear of conflict","traffic traffic",
    "proximity warning","loss of separation","near mid-air collision","nmac",
    "conflicting traffic","airborne collision avoidance","traffic conflict",
    "vertical separation","traffic proximity","evasive maneuver","atc coordination failure",
    "almost collided","nearly collided","collision avoidance","tcas alert","tcas warning",
    "tcas activated","tcas advised","acas advisory","tcas ra issued","traffic alert",
    "aircraft conflict","close call aircraft","RA issued","intruder aircraft"
  ],
  "Bird Strike":[
    "bird strike","birdstrike","bird hit","bird ingestion","engine bird strike",
    "wildlife strike","wildlife hazard","bird remains","feathers found",
    "windshield bird","multiple bird strike","bird on runway","bird on taxiway",
    "bird ingested","engine ingestion","avian strike","wildlife on runway",
    "seagull","pigeon","vulture","hawk","eagle","duck","heron","stork","condor",
    "flock of birds","bird flock","hit a bird","struck a bird","bird entered engine",
    "post-impact inspection","bird remains in engine","bird feathers","plumage found",
    "wildlife management","fauna control","bird hazard","wildlife control"
  ],
  "Runway Excursion":[
    "runway excursion","overrun","veer off","veer-off","runway end",
    "stopway","crosswind limit","aquaplaning","hydroplaning","wet runway",
    "contaminated runway","braking action","poor braking","tailwind landing",
    "runway end safety area","resa","went off runway","departed runway",
    "runway overrun","off the runway","off runway","missed the turnoff",
    "long landing","touched down long","runway remaining","insufficient braking",
    "landing too long","departed paved surface","rejected takeoff","late abort",
    "braking insufficient","skidded off","lateral excursion","cross-wind excursion",
    "icy runway","snowy runway","slippery runway","runway contamination"
  ],
  "Unstable Approach":[
    "unstabilised approach","unstable approach","missed approach","go-around executed",
    "go-around","go around","below glideslope","above glideslope","speed high on final",
    "speed low on final","not configured","flaps not set","gear not down",
    "continued unstabilised","excessive sink rate on final","high energy approach",
    "below decision height","above decision height","fast on final","high on final",
    "low on final","not stabilized","stabilisation criteria","stabilization gate",
    "vref exceeded","late configuration","gear not down and locked",
    "go-around required","executed go-around","had to go around","broke off approach",
    "discontinued approach","above profile","below profile","energy management",
    "vectored for approach","approach not stable","circled to land","visual approach"
  ],
  "Hard Landing":[
    "hard landing","heavy landing","high sink rate","bounce","bounce landing",
    "firm landing","landing gear inspection","g-load exceedance","overweight landing",
    "qar exceedance","fdr spike","structural inspection required","foqa trigger",
    "hard touchdown","rough touchdown","heavy impact","landed hard","bounced on landing",
    "high vertical speed at touchdown","high descent rate at touchdown","sink rate high",
    "aircraft bounced","g exceedance","excessive g","qar limit exceeded","porpoise",
    "hard contact","hard touch","landing impact","structural check required"
  ],
  "GPWS":[
    "gpws","egpws","taws","terrain pull up","whoop whoop","cfit",
    "controlled flight into terrain","ground proximity","terrain warning","terrain alert",
    "terrain avoidance","pull up warning","mode 1","mode 2","mode 3","mode 4","mode 5",
    "terrain clearance","minimum safe altitude warning","msaw","sink rate warning",
    "don't sink","terrain terrain","pull up","too low terrain","too low gear",
    "too low flaps","ground proximity warning","terrain proximity",
    "mountain proximity","obstacle proximity","enhanced gpws","gpws activated",
    "gpws warning","pull-up maneuver","terrain avoidance maneuver",
    "nearly hit terrain","close to terrain","close to ground","close to mountain"
  ],
  "Turbulencia":[
    "turbulence","severe turbulence","moderate turbulence","clear air turbulence","cat",
    "wake turbulence","wake vortex","microburst","low level windshear","llws",
    "mountain wave","convective turbulence","injury from turbulence","chop",
    "light chop","moderate chop","extreme turbulence","unexpected turbulence",
    "thunderstorm","lightning","hail","low visibility","fog","icing conditions",
    "wind shear encounter","adverse weather","severe weather","weather diversion",
    "passengers injured","crew injured","fell in aisle","hit ceiling",
    "unsecured passengers","no seatbelt","luggage fell","severe jolts",
    "aircraft shook","heavy shaking","bumpy flight","rough air","windshear escape",
    "pirep turbulence","pirep severe","turbulence encounter","icing encounter",
    "in-flight icing","freezing rain","ice accretion","anti-ice","deicing"
  ],
  "Meteorología Adversa":[
    "fog","dense fog","low visibility","lvo","icing","deicing","anti-icing",
    "below minimums","weather minimums","adverse weather","meteorological",
    "runway contaminated snow","freezing rain","black ice","crosswind limit",
    "weather divert","hold weather","ground stop weather","storm airport",
    "visibility zero","rvr","runway visual range","cat ii","cat iii",
    "niebla","engelamiento","visibilidad","meteorologia","condiciones adversas",
    "pista helada","nieve pista","lluvia intensa pista","tormenta aerodromo"
  ],
  "Mercancías Peligrosas":[
    "hazmat","dangerous goods","dgr","lithium","mercancia peligrosa","carga peligrosa",
    "material peligroso","clase 9","undeclared","bateria litio","embalaje","radioactivo"
  ],
  "Incidencia ATC":[
    "atc error","clearance","readback","callsign","comunicacion","frecuencia",
    "instruccion atc","separacion atc","controlador","comm failure","wrong runway atc"
  ],
  "Incendio":[
    "incendio","fuego","fire","llamas","combustion","ignicion","engine fire","apu fire",
    "wheel fire","cargo fire","evacuation fire","extintor fuego","fire warning"
  ],
  "Estela Turbulenta":[
    "estela","vortice","wake","wake turbulence","wake vortex","wingtip vortex",
    "separacion estela","upset wake","roll wake","heavy wake"
  ],
  "Iluminación Láser":[
    "laser","laser strike","haz laser","laser cockpit","laser dazzle","green laser",
    "pilot blinded","deslumbramiento laser","vision laser","ataque laser"
  ],
  "Fatiga de Tripulación":[
    "fatiga","fatigado","crew fatigue","pilot fatigue","fdp","somnolencia","dormido",
    "descanso","rest requirement","frms","microsueño","flight time"
  ],
  "Error de Navegación":[
    "navegacion","nav error","waypoint","rnav","gnss","gps","ils","wrong runway",
    "route deviation","off course","altimetro","qnh","nav database","spoofing"
  ],
    "Ground Damage":[
    "ground damage","ramp incident","apron collision","pushback incident",
    "towing damage","ground vehicle","jet bridge contact","ground handling",
    "foreign object","fod","foreign object debris","surface damage",
    "wing tip strike","tail strike","ground service equipment","gse damage",
    "apron damage","belt loader damage","gpu contact","ground power contact",
    "ramp vehicle strike","apron vehicle","vehicle hit aircraft","truck hit aircraft",
    "jetway contact","bridge contact","aircraft dent","fuselage damage",
    "wing damage","tail damage","ground equipment collision","loader struck aircraft",
    "pushback damaged","ramp damage","tug collision","ground crew incident",
    "object on runway","object on taxiway","debris on runway","fod on runway",
    "found damage","arrived with damage","dent found","scratch found"
  ],
  "Incursión de Pista":[
    "runway incursion","unauthorized entry","active runway","runway crossing",
    "without clearance","wrong runway","runway occupied","ground conflict",
    "aircraft on runway","vehicle on runway","incursion alert","surface movement",
    "ground movement conflict","taxiway confusion","airport surface",
    "wrong taxiway","read-back error","clearance confusion","atc clearance missed",
    "entered runway without clearance","crossed runway","runway hotspot",
    "line up","line-up","hold short","hold position","holding point","stop bar",
    "runway status light","rwsl","icao category a","icao category b",
    "icao category c","icao category d","ground incursion","entered active runway",
    "nearly collided on runway","runway conflict","traffic on runway",
    "taxi without clearance","unauthorized taxi","taxi into runway"
  ],
  "Factores Humanos":[
    "human factors","crew resource management","crm","crew fatigue","flight crew error",
    "situational awareness","loss of situational awareness","spatial disorientation",
    "mode confusion","automation surprise","sterile cockpit violation",
    "checklist error","omission error","complacency","fixation","tunnel vision",
    "unruly passenger","disruptive passenger","medical emergency","passenger ill",
    "medical on board","passenger unconscious","in-flight medical","cardiac arrest",
    "sexual activity","sexual assault","sexual harassment","misconduct on board",
    "lavatory incident","bathroom incident","crew coordination","crm failure",
    "fatigued crew","fatigued pilot","communication failure in cockpit",
    "missed checklist item","procedural deviation","high workload","distraction",
    "crew error","pilot error","copilot error","incomplete briefing",
    "lavatory","lavatory occupied","lavatory smoke","lavatory fire",
    "passenger aggressive","passenger violent","passenger drunk","passenger intoxicated",
    "alcohol on board","drugs on board","passenger altercation","passenger fight"
  ],
  "Falla Técnica":[
    "technical failure","engine failure","engine shutdown","engine malfunction",
    "hydraulic failure","electrical failure","pressurisation failure","decompression",
    "landing gear failure","gear unsafe","flap failure","instrument failure",
    "system malfunction","warning light","eicas message","ecam message",
    "mel dispatch","emergency checklist","mayday","pan pan",
    "engine fire","turbine fire","aircraft on fire","smoke from engine",
    "smoke in cockpit","cabin smoke","fire on board","cracked fuselage",
    "structural damage","hull damage","skin damage","airframe damage",
    "lost engine","engine flameout","compressor stall","engine surge",
    "hydraulic leak","electrical bus failure","generator failure","battery failure",
    "pressurization lost","oxygen masks deployed","emergency descent",
    "autopilot failure","autothrottle failure","fms failure","adiru failure",
    "unreliable airspeed","pitot blocked","static port blocked","altimeter error",
    "thrust reverser","reverser not stowed","gear not retracted","gear not extended",
    "gear warning","flap asymmetry","spoiler fault","hydraulic fluid loss",
    "fuel leak","fuel imbalance","fuel contamination","fuel low","fuel emergency",
    "apu failure","apu fire","structural inspection","gear inspection",
    "fire handle pulled","extinguisher discharged","fire suppression",
    "emergency landing","forced landing","declared emergency","distress",
    "cockpit door","flight deck door","door jammed","door blocked","locked out",
    "strange noise","strange sound","unusual vibration","unusual smell",
    "smoke smell","burning smell","electrical smell","fuel smell"
  ],
  "Seguridad Aeroportuaria":[
    "theft","stolen","baggage theft","security breach","unauthorized access",
    "trespassing","perimeter breach","restricted area breach","unauthorized person",
    "unidentified person","suspicious person","suspicious behavior","suspicious package",
    "abandoned bag","abandoned luggage","unattended bag","unattended luggage",
    "security threat","bomb threat","knife","firearm","weapon","weapon found",
    "smuggling","drug trafficking","contraband","narcotics found",
    "cctv failure","camera failure","surveillance gap","blind spot",
    "piggybacking","tailgating","followed through","unauthorized entry",
    "false id","fake credentials","forged document","fraudulent document",
    "no boarding pass","no ticket","no id","no identification","without badge",
    "security checkpoint","access control","badge required","credential check",
    "airside access","landside access","sterile area","restricted zone",
    "security staff","security guard","airport police","security patrol",
    "cyber attack","phishing","ransomware","malware","data breach","hacking",
    "cargo theft","fuel theft","parts theft","ramp theft","pilferage"
  ],
  "Interferencia Ilícita":[
    "unlawful interference","hijacking","aircraft hijack","hijack attempt",
    "bomb on board","explosive on board","ied on board","explosive device",
    "threatening note","threat in flight","bomb threat in flight",
    "weapon on board","gun on board","knife on board","armed passenger",
    "passenger with weapon","passenger threatened crew","passenger assaulted crew",
    "attempted cockpit access","forced cockpit door","emergency door opened",
    "tried to open emergency exit","passenger opened door handle",
    "drugs on board","narcotics on board","illegal substance on board",
    "smuggling in flight","contraband on board","seizure of contraband",
    "annex 17","icao annex 17","security protocol activated","distress code",
    "squawk 7500","squawk hijack","code 7500","unlawful seizure",
    "hostage","taken hostage","crew threatened","passenger threatened",
    "in-flight security incident","armed person on board"
  ],
  "Demora Operacional":[
    "delay","delayed","late departure","departure delay","late takeoff",
    "arrival delay","late arrival","not on time","off schedule","behind schedule",
    "pushback delay","late pushback","catering delay","no catering",
    "cleaning delay","late cleaning","fueling delay","late fueling",
    "loading delay","baggage delay","late baggage","ground handling delay",
    "dispatch delay","late paperwork","documentation delay","incomplete documents",
    "late boarding","boarding delay","crew delay","crew late","crew not ready",
    "slot missed","lost slot","rotation delay","turnaround delay",
    "otp","on-time performance","recovery","recovered time","made up time",
    "tech delay","technical delay","maintenance delay","aog","aircraft on ground"
  ],
  "CFIT":["controlled flight into terrain","terrain impact","ground impact","below mda","below da","below minimums","gpws ignored","egpws ignored","pull up ignored","terrain ahead","descended into terrain","cfit","altitude bust terrain"],
  "Emergencia Médica":["medical emergency","passenger incapacitated","cardiac arrest","cpr on board","aed used","medlink","doctor on board","crew incapacitation","pilot incapacitation","passenger unconscious","anaphylaxis","stroke on board","diabetic emergency","passenger deceased","medical assistance","oxygen therapy"],
  "Smoke / Humo a Bordo":["smoke in cabin","smoke in cockpit","fire on board","burning smell","electrical fire","fumes on board","toxic fumes","extinguisher used","smoke source","cabin smoke","smoke detected","cargo smoke","lavatory smoke","galley fire","oxygen masks deployed due smoke"],
  "Pérdida de Control":["loss of control","loc-i","unusual attitude","stall","aerodynamic stall","phugoid","dutch roll","spiral dive","excessive bank angle","uncommanded roll","autopilot disconnect","extreme attitude","manual override","momentarily lost control","exceedance vmo mmo","upset recovery"],
  "Presurización":["pressurization failure","rapid decompression","explosive decompression","cabin pressure loss","oxygen masks deployed","cabin altitude warning","seal failure","window crack","pressurization emergency","descent for pressurization","cabin pressure low","emergency oxygen","pressurization defect"],
  "Fuel / Combustible":["fuel emergency","low fuel","minimum fuel","fuel exhaustion","mayday fuel","pan pan fuel","wrong fuel grade","fuel contamination","water in fuel","fueling error","fuel imbalance","fuel leak","fuel dumping","insufficient fuel","fuel uplift error"],
  "FOD":["foreign object debris","fod","runway debris","object on runway","object on taxiway","fod damage","tire damage","blowout fod","engine fod ingestion","tool on runway","loose fastener","lost panel","cowling debris","runway inspection","ramp sweep","loose object ramp"]
};


// RAE_LEMMAS: líneas 4020-4111
const RAE_LEMMAS=[
  // IR / SER (homonimia — contexto aeronáutico distingue)
  [/\b(fue|fueron|iba|iban|fui|fuimos|vayas|vaya)\b/g,'ir'],
  // HACER
  [/\b(hizo|hicieron|hice|hicimos|haga|hagan|hecho)\b/g,'hacer'],
  // TENER
  [/\b(tuvo|tuvieron|tuve|tuvimos|tenga|tengan)\b/g,'tener'],
  // PODER
  [/\b(pudo|pudieron|pude|pudimos|pueda|puedan)\b/g,'poder'],
  // DECIR
  [/\b(dijo|dijeron|dije|dijimos|dicho)\b/g,'decir'],
  // PONER
  [/\b(puso|pusieron|puse|pusimos|puesto)\b/g,'poner'],
  // VENIR
  [/\b(vino|vinieron|vine|vinimos|venga|vengan)\b/g,'venir'],
  // SALIR
  [/\b(salio|salieron|sali|salimos|salga|salgan)\b/g,'salir'],
  // CAER
  [/\b(cayo|cayeron|cai|caimos|caiga|caigan|caido)\b/g,'caer'],
  // ENTRAR / INGRESAR — normalizar variantes
  [/\b(entro|entraron|entre|entramos|ingreso|ingresaron)\b/g,'entrar'],
  // EXCEDER / SUPERAR / SOBREPASAR
  [/\b(excedio|excedieron|excedi|excedimos|supero|superaron|sobrepaso|sobrepasaron|paso|pasaron)\b/g,'exceder'],
  // IMPACTAR / GOLPEAR / CHOCAR
  [/\b(impacto|impactaron|impacte|impactamos|golpeo|golpearon|choco|chocaron)\b/g,'impactar'],
  // DETECTAR / AVISAR / ADVERTIR
  [/\b(detecto|detectaron|detecte|detectamos|aviso|avisaron|advirtio|advirtieron)\b/g,'detectar'],
  // ACTIVAR / DISPARAR (alarmas)
  [/\b(activo|activaron|active|activamos|disparo|dispararon)\b/g,'activar'],
  // DESVIAR / SALIRSE
  [/\b(desvio|desviaron|desviaron|se salio|se salieron|salio de|salieron de)\b/g,'desviar'],
  // ABORTAR / CANCELAR (despegue/aterrizaje)
  [/\b(aborto|abortaron|aborte|abortamos|cancelo|cancelaron)\b/g,'abortar'],
  // REPORTAR / INFORMAR
  [/\b(reporto|reportaron|reporte|reportamos|informo|informaron)\b/g,'reportar'],
  // ROMPER / DAÑAR
  [/\b(rompio|rompieron|rompi|rompimos|roto|daño|danaron)\b/g,'romper'],
  // FALLAR / AVERIARSE
  [/\b(fallo|fallaron|falle|fallamos|averiarse|averio|averiaron)\b/g,'fallar'],
  // ATERRIZAR / TOCAR (pista)
  [/\b(aterrizo|aterrizaron|aterrize|aterrizamos|toco|tocaron|toco pista|toco tierra)\b/g,'aterrizar'],
  // DESPEGAR / LEVANTAR VUELO
  [/\b(despego|despegaron|despegue|despegamos|levanto vuelo|levantaron vuelo)\b/g,'despegar'],
  // ESQUIVAR / EVADIR (TCAS, obstáculos)
  [/\b(esquivo|esquivaron|esquive|esquivamos|evadio|evadieron|evadir)\b/g,'esquivar'],
  // COLISIONAR
  [/\b(colisiono|colisionaron|colisione|colisionamos)\b/g,'colisionar'],
  // PRECIPITAR (coloquial "se vino abajo")
  [/\b(se precipito|se precipitaron|precipito|precipitaron|se vino abajo|se fueron abajo)\b/g,'precipitar'],
  // EXCEDER VELOCIDAD Vref
  [/\b(excedio velocidad|excedieron velocidad|supero velocidad|sobrepaso velocidad)\b/g,'exceder velocidad'],
  // Participios irregulares → infinitivo
  [/\b(abierto)\b/g,'abrir'],
  [/\b(cubierto)\b/g,'cubrir'],
  [/\b(escrito)\b/g,'escribir'],
  [/\b(visto)\b/g,'ver'],
  [/\b(muerto)\b/g,'morir'],
  [/\b(dicho)\b/g,'decir'],
  // Inflexiones de sustantivos aeronáuticos → forma base
  [/\b(aeronaves)\b/g,'aeronave'],
  [/\b(motores)\b/g,'motor'],
  [/\b(turbinas)\b/g,'turbina'],
  [/\b(pilotos)\b/g,'piloto'],
  [/\b(tripulantes)\b/g,'tripulante'],
  [/\b(pistas)\b/g,'pista'],
  [/\b(incidentes)\b/g,'incidente'],
  [/\b(accidentes)\b/g,'accidente'],
  [/\b(fallas)\b/g,'falla'],
  [/\b(alarmas)\b/g,'alarma'],
  [/\b(aves)\b/g,'ave'],
  [/\b(pajaros)\b/g,'pajaro'],
  [/\b(vuelos)\b/g,'vuelo'],
  [/\b(pasajeros)\b/g,'pasajero'],
  [/\b(pilotos)\b/g,'piloto'],
  [/\b(controladores)\b/g,'controlador'],
];

// ── CONCEPTO PATTERNS — Matriz RAE × ICAO ─────────────────────────────────
// Objetivo: normalizar descripciones en lenguaje cotidiano (sin jerga aeronáutica)
// a términos que el sistema KW ya entiende.
// Cada entrada: [regex_español_natural, término_normalizado_en_KW]
//
// ESTRUCTURA DE LA MATRIZ:
//   Concepto ICAO (SEC/GCOL/WILD/…)
//   × Verbos RAE conjugados (entró/ingresó/se coló/se metió…)
//   × Objetos cotidianos (mochila/bolso/maleta/paquete…)
//   × Adjetivos (extraño/sospechoso/raro/abandonado…)
//   × Expresiones coloquiales LatAm (se mandó/se zarpó/se metió…)
// ─────────────────────────────────────────────────────────────────────────────
// NOTA IMPORTANTE: estos patrones se aplican DESPUÉS de _norm(), que elimina tildes.
// Por eso todos los regex están escritos SIN acentos (o→o, á→a, é→e, etc.)
// ñ→n, ú→u, etc. — no usar versiones acentuadas dentro de los regex.

// CONCEPT_PATTERNS: líneas 4112-4231
const CONCEPT_PATTERNS=[

  // ── CONTEXTO LOCACIÓN + SUJETO — detecta co-ocurrencia de quién + dónde ──
  // Problema: "persona tomando vino en la pista" → el sujeto "persona" en un
  // área operacional restringida es Seguridad Aeroportuaria, no Factores Humanos.
  // Solución: normalizar [sujeto genérico + área restringida] → señal SEC.
  // ─────────────────────────────────────────────────────────────────────────

  // Persona (genérica) + área de movimiento → intrusión / persona no autorizada
  [/\b(persona|individuo|sujeto|hombre|mujer|civil|desconocido|desconocida)\b.{0,80}\b(en (la |la )?pista|en (la |la )?rampa|en (la |la )?plataforma|en (el |el )?taxiway|en (el |el )?rodaje|en (el |el )?hangar|en (el |el )?area (de movimiento|operacional|restringida))\b/gi,'persona en area operacional'],
  // Orden inversa: área primero, persona después
  [/\b(pista|rampa|plataforma|taxiway|rodaje|hangar)\b.{0,60}\b(persona|individuo|sujeto|hombre|mujer|civil|desconocido|desconocida)\b/gi,'persona en area operacional'],

  // Persona + alcohol + área operacional (caso específico: "persona tomando vino en pista")
  [/\b(persona|individuo|sujeto|hombre|mujer|civil)\b.{0,60}\b(tomando|bebiendo|consumiendo|con)\b.{0,30}\b(vino|cerveza|alcohol|bebida alcoholica|trago|birra)\b.{0,60}\b(pista|rampa|plataforma|taxiway|rodaje|hangar|aeropuerto|area operacional)\b/gi,'intrusión con alcohol en area operacional'],
  // Orden inversa
  [/\b(pista|rampa|plataforma|taxiway|rodaje|hangar)\b.{0,60}\b(persona|individuo|sujeto|hombre|mujer|civil)\b.{0,60}\b(tomando|bebiendo|consumiendo)\b.{0,30}\b(vino|cerveza|alcohol|trago)\b/gi,'intrusión con alcohol en area operacional'],

  // Persona + conducta anómala + área operacional
  [/\b(persona|individuo|sujeto|civil)\b.{0,80}\b(dormida|durmiendo|tirada|tirado|inconsciente|desorientada|desorientado|perdida|perdido|llorando|agresiva|agresivo)\b.{0,60}\b(pista|rampa|plataforma|rodaje|hangar)\b/gi,'persona en area operacional'],
  [/\b(pista|rampa|plataforma|rodaje)\b.{0,60}\b(persona|individuo|sujeto|civil)\b.{0,60}\b(dormida|durmiendo|tirada|tirado|inconsciente|desorientada|perdida|perdido)\b/gi,'persona en area operacional'],

  // Conductor / vehículo + alcohol + área operacional
  [/\b(conductor|chofer|choferes|manejador|operador)\b.{0,60}\b(alcohol|borracho|ebrio|tomado|beodo|alcoholizado|en pedo|con olor a alcohol)\b/gi,'conductor con alcohol en area operacional'],
  [/\b(alcohol|borracho|ebrio|tomado)\b.{0,60}\b(conductor|chofer|operador)\b.{0,60}\b(pista|rampa|plataforma|rodaje|plataforma)\b/gi,'conductor con alcohol en area operacional'],

  // Animal en área de movimiento (no en motor/turbina = bird strike separado)
  [/\b(perro|gato|zorro|rata|raton|liebre|serpiente|animal|mascota)\b.{0,60}\b(en (la |la )?pista|en (la |la )?rampa|en (la |la )?plataforma|en rodaje)\b/gi,'animal en area de movimiento'],
  [/\b(pista|rampa|plataforma|rodaje)\b.{0,60}\b(perro|gato|zorro|rata|raton|liebre|serpiente|animal)\b/gi,'animal en area de movimiento'],

  // ── SEC · OBJETO ABANDONADO ────────────────────────────────────────────
  // Bolso/mochila mencionado + sale sin él/ella (pronombre de objeto)
  [/\b(mochila|bolso|maleta|maletin|bolsa|paquete|bulto|cartera|valija|trolley|equipaje)\b.{0,80}\bsal[eoi]\s+sin\s+(ella|el)\b/gi,'objeto abandonado'],
  // "sale/salen sin la mochila/bolso"
  [/\bsal[eoi][o]?\s+sin\s+(la|el|su|una|un)?\s*(mochila|bolso|maleta|maletin|bolsa|paquete|bulto|cartera|valija|trolley|equipaje)\b/gi,'objeto abandonado'],
  // "dejo/dejaron la mochila"
  [/\bdej[oa]r?o?n?\s+.{0,25}(mochila|bolso|maleta|maletin|bolsa|paquete|bulto|cartera|valija)\b/gi,'objeto abandonado'],
  // "abandono/olvido el bolso"
  [/\b(abandon[oa]r?o?n?|olvid[oa]r?o?n?)\s+.{0,15}(mochila|bolso|maleta|bolsa|paquete|bulto|cartera|valija)\b/gi,'objeto abandonado'],
  // "mochila extraña/sospechosa/sola/tirada/abandonada/dejada"
  [/\b(mochila|bolso|maleta|bolsa|paquete|bulto|valija|maletin|cartera|bolsito)\s+(extran[ao]|sospechosa?|abandonad[ao]|sin dueno|sol[ao]|tirad[ao]|dejad[ao]|olvidado?a?)\b/gi,'objeto sospechoso'],
  // "bolso/mochila dejado/tirado/olvidado" (adjetivo antes o después)
  [/\b(dejad[ao]|tirad[ao]|olvidad[ao])\b.{0,30}\b(mochila|bolso|maleta|bolsa|paquete|bulto|valija|maletin|cartera)\b/gi,'objeto abandonado'],
  [/\b(mochila|bolso|maleta|bolsa|paquete|bulto|valija|maletin|cartera)\b.{0,30}\b(dejad[ao]|tirad[ao]|olvidad[ao])\b/gi,'objeto abandonado'],
  // "se encuentra/encontró/hay una mochila/bolso"
  [/\b(se\s+encuentra|se\s+encontro|encontraron|encontro|hay|habia|encontre|vieron|vi|aparecio)\s+(una?|el|la)?\s*(mochila|bolso|paquete|bulto|maleta|cartera|valija|bolsito)\b/gi,'objeto sospechoso'],
  // "de forma extraña/sospechosa/rara" en el mismo texto que un objeto
  [/\bde\s+forma\s+(extran[ao]|sospechosa?|rar[ao]|inusual|inconveniente)\b/gi,'conducta sospechosa objeto sospechoso'],
  // "en el suelo" + objeto = objeto abandonado
  [/\b(en\s+el\s+suelo|tirado?\s+en\s+el\s+suelo|en\s+el\s+piso)\b.{0,60}\b(mochila|bolso|paquete|bulto|maleta|cartera|valija)\b/gi,'objeto abandonado'],
  [/\b(mochila|bolso|paquete|bulto|maleta|cartera|valija)\b.{0,60}\b(en\s+el\s+suelo|tirado?\s+en\s+el\s+suelo|en\s+el\s+piso)\b/gi,'objeto abandonado'],
  // "puerta de ingreso/acceso/entrada al aeropuerto/terminal"
  [/\b(puerta|zona|area)\s+(de\s+)?(ingreso|acceso|entrada)\b/gi,'acceso terminal aeroportuario'],

  // ── SEC · CONDUCTA SOSPECHOSA / ACCESO INDEBIDO ───────────────────────
  // "entra/entro en baño de hombres/mujeres" (cross-gender = conducta sospechosa)
  [/\b(entra|entro|ingreso|se metio|fue|paso)\s+.{0,30}(bano|sanitario|servicio|toilette|lavabo|wc)\s+.{0,20}(hombres?|caballeros?|varones?|mujeres?|damas?|senoras?|senores?)\b/gi,'conducta sospechosa en instalacion'],
  // "baño" + "mochila/bolso" en el mismo enunciado = objeto en baño
  [/\b(bano|sanitario|toilette|servicio|lavabo)\b.{0,60}\b(mochila|bolso|paquete|bulto|maleta)\b/gi,'objeto abandonado en instalacion'],
  [/\b(mochila|bolso|paquete|bulto|maleta)\b.{0,60}\b(bano|sanitario|toilette|servicio|lavabo)\b/gi,'objeto abandonado en instalacion'],
  // "fotografiando/filmando" puertas, accesos, aeronaves
  [/\b(fotografiand[oa]|filmand[oa]|grabando|sacando fotos|tomando fotos|tomando video)\s+.{0,30}(puerta|acceso|aeronave|avion|pista|rampa|sistema|instalacion|equipo)\b/gi,'vigilancia sospechosa'],
  // "merodeando / dando vueltas / caminando sin rumbo"
  [/\b(merodeando|dando vueltas|caminando sin rumbo|no tiene destino|va y viene|iba y venia|rondando)\b/gi,'merodeando'],
  // "comportamiento/actitud extraña/rara/sospechosa" (sin tildes)
  [/\b(comportamiento|actitud|conducta)\s+(extran[ao]|rar[ao]|sospechosa?|inusual|nervios[ao]|agitad[ao])\b/gi,'conducta sospechosa'],
  [/\b(actuaba|se comportaba|se veia)\s+(extrano|raro|sospechoso|nervioso|agitado|inusual)\b/gi,'conducta sospechosa'],
  // "nervioso mirando para los lados"
  [/\b(nervios[ao]|agitad[ao]|sudando|transpirando)\s+.{0,20}(mirando|observando|vigilando|recorriendo)\b/gi,'conducta sospechosa'],
  // "mirando fijo"
  [/\b(mirando fijo|miraba fijo|mirando fijamente|espiando|acechaba)\b/gi,'espiando'],

  // ── SEC · ACCESO NO AUTORIZADO ────────────────────────────────────────
  // "entro sin identificacion/credencial/pase/ticket/pasaje"
  [/\b(entro|ingreso|paso|se colo|se metio)\s+.{0,20}sin\s+(identificacion|credencial|pase|badge|gafete|tarjeta|pasaje|ticket|boleto|boarding)\b/gi,'acceso no autorizado'],
  // "nadie lo/la conoce / no es del personal"
  [/\b(nadie (lo|la) conoce|no (es|era) (del|de) personal|no trabaja (aca|aqui)|no es emplead[ao])\b/gi,'persona no identificada'],
  // "sin uniforme / sin chaleco" (coloquial)
  [/\b(no (llevaba|usaba|portaba|tenia) uniforme)\b/gi,'sin uniforme'],
  [/\b(no (llevaba|usaba|portaba|tenia) chaleco)\b/gi,'sin chaleco reflectante'],

  // ── SEC · AMENAZA / ARTÍCULO PROHIBIDO ───────────────────────────────
  // "tenia/saco/llevaba un cuchillo/arma"
  [/\b(tenia|saco|mostro|llevaba|portaba)\s+(un[ao]?\s+)?(cuchillo|navaja|pistola|arma|revolver|explosivo|granada)\b/gi,'arma detectada'],
  // "amenazo / hizo una amenaza"
  [/\b(amenazo|amenazando|hizo una amenaza|dijo que iba a|dijo que tenia una bomba)\b/gi,'amenaza verbal'],
  // "droga / polvo blanco"
  [/\b(droga|pastillas? sospechosas?|polvo blanco|sustancia sospechosa|paquete con polvo)\b/gi,'contrabando'],

  // ── WILD · FAUNA — va ANTES de GCOL para que "buitre chocó" → bird strike, no ground damage
  // "paloma entro en el motor" — animal antes del verbo
  [/\b(paloma|gaviota|gallinazo|buitre|murcielago|cuervo|hornero|cotorra|pajaro|pajarito|ave fauna|aves?|bicho)\s+.{0,30}(entro|paso|ingreso|se metio|fue aspirad[ao]|golpeo|impacto|choco)\b/gi,'ave en motor'],
  // "entro una paloma / golpeo un pajaro / ingreso un ave"
  [/\b(entro|paso|ingreso|se metio|golpeo|impacto|choco|aspiro)\s+.{0,20}(un?a?\s+)?(paloma|gaviota|gallinazo|buitre|murcielago|cuervo|hornero|cotorra|pajaro|pajarito|aves?|bicho)\b/gi,'ave en motor'],
  // "paloma/cuervo/ave en motor/turbina/pista"
  [/\b(paloma|gaviota|gallinazo|buitre|murcielago|cuervo|hornero|cotorra|pajaro|aves?)\s+.{0,20}(en\s+)?(motor|turbina|pista|despegue|aterrizaje)\b/gi,'ave en motor'],
  // "ave + motor" con cualquier preposicion entre ellos
  [/\baves?\b.{0,30}\b(motor|turbina|engine)\b/gi,'ave en motor'],
  [/\b(motor|turbina|engine)\b.{0,30}\baves?\b/gi,'ave en motor'],

  // ── GCOL · COLISIÓN EN TIERRA (lenguaje coloquial) ────────────────────
  [/\b(choco|se choco|chocaron|topo|rozo|golpeo|pego)\s+.{0,20}(avion|aeronave|ala|motor|fuselaje|cola|tren|rueda)\b/gi,'colision en rampa'],
  [/\b(chocaron|se chocaron|toparon|colisionaron)\s+.{0,20}(en\s)?(rampa|plataforma|pista|hangar)\b/gi,'colision en rampa'],

  // ── RE · EXCURSIÓN DE PISTA (coloquial) ──────────────────────────────
  [/\b(se fue|se salio|salimos|salieron)\s+(de\s+)?(la\s+)?pista\b/gi,'salio de pista'],
  [/\b(se paso|no freno|corrimos|corrieron|excedio|supero|sobrepaso|paso)\s+.{0,15}(el\s+)?final\s+(de\s+)?(la\s+)?pista\b/gi,'runway overrun'],
  [/\b(aeronave|avion)\s+.{0,20}(excedio|sobrepaso|supero)\s+.{0,10}pista\b/gi,'runway overrun'],

  // ── TURB · TURBULENCIA (coloquial) ───────────────────────────────────
  [/\b(el avion|la aeronave|nos)\s+(se sacudio|se agito|se movio mucho|temblamos|caimos)\b/gi,'turbulencia severa'],
  [/\b(caida|bajon|pozo de aire|bolsa de aire)\s+(brusca?o?|repentin[ao]|fuerte)\b/gi,'turbulencia severa'],

  // ── HF · FACTORES HUMANOS (coloquial) ────────────────────────────────
  [/\b(se durmio|se quedo dormido|cabeceando|se adormecio)\b/gi,'fatiga'],
  [/\b(confundio|se confundio|equivoco|se equivoco)\s+.{0,20}(pista|procedimiento|check|switch|valvula|lever|palanca)\b/gi,'error procedimiento'],
];

// Sinónimos: [patrón (regex), reemplazo normalizado]
// Se aplican ANTES de la clasificación para que los KW existentes los capturen

// SYNONYMS: líneas 4232-4314
const SYNONYMS=[
  // Aeronave / avión
  [/\b(avion|airplane|plane|the plane|el avion)\b/g,'aeronave'],
  [/\b(motores)\b/g,'motor'],  // plural → singular cubre ambos
  [/\b(turbinas)\b/g,'turbina'],
  [/\b(engines)\b/g,'motor'],
  [/\bengine\b/g,'motor'],
  // Robo / hurto — argot latinoamericano
  [/\b(afanaron|afano|me afanaron|se afano|se llevaron|se llevo|desaparecio)\b/g,'robaron'],
  [/\b(cago|me cago|se cago)\b/g,'robaron'],  // solo en contexto de robo físico
  [/\b(merco|morfi)\b/g,'robo'],
  // Golpe / daño
  [/\b(le pego|le pegaron|le dieron|le dieron un golpe|rasparon|rayaron)\b/g,'golpearon'],
  [/\b(pegó al|le pego al|le dio al)\b/g,'golpeo al'],
  [/\b(abollo|abollaron|rayaron|rasparon)\b/g,'daño'],
  // Chocar / colisionar
  [/\b(chocamos|chocaron|choco|nos chocamos)\b/g,'colision'],
  [/\b(casi chocamos|estuvimos a punto de chocar|a punto de chocar)\b/g,'proximidad peligrosa'],
  // Incendio
  [/\b(se prendio|se incendio|prendio fuego|prendieron fuego)\b/g,'incendio'],
  [/\b(ardia|ardiendo|ardio)\b/g,'incendio'],
  // Falla / avería
  [/\b(se rompio|se daño|se arruino|se jodio|se trabo)\b/g,'falla'],
  [/\b(roto|quebrado|tronado|fundido)\b/g,'averia'],
  [/\b(no funciona|no funcionaba|no funciono|sin funcionar|sin funcionamiento)\b/g,'falla de'],
  // Tripulación / piloto
  [/\b(comandante|capitan|copiloto|primer oficial|segundo oficial|pic|sic)\b/g,'piloto'],
  [/\b(auxiliar de vuelo|azafata|steward|stewardess|sobrecargo|tcp)\b/g,'tripulante de cabina'],
  // ATC / control
  [/\b(torre|control de trafico|controlador|atc|approach|ground)\b/g,'control aereo'],
  // Pista / aeropuerto
  [/\b(runway|rwy|strip)\b/g,'pista'],
  [/\b(apron|ramp)\b/g,'rampa'],
  [/\b(gate|puerta de embarque)\b/g,'puerta embarque'],
  // Aterrizaje
  [/\b(touchdown|toco|toque)\b/g,'aterrizaje'],
  [/\b(despego|tomo pista|roling|roll)\b/g,'despegue'],
  // Seguridad
  [/\b(no tenia tarjeta|sin tarjeta magnetica|sin pase|sin lazo|sin gafete)\b/g,'sin credencial'],
  [/\b(persona sospechosa|sujeto sospechoso|individuo sospechoso|tipo sospechoso)\b/g,'intruso'],
  [/\b(se metio sin permiso|entro sin permiso|paso sin permiso|colarse|se colo)\b/g,'acceso no autorizado'],
  [/\b(area segura|zona segura|zona protegida|area protegida)\b/g,'area restringida'],
  [/\bno identificad[ao]s?\b/g,'no identificado'],
  [/\bpersona no identificad[ao]s?\b/g,'persona no identificada'],
  [/\b(sin identificacion|sin identificarse|sin identificacion|sin id)\b/g,'sin credencial'],
  [/\b(zona de embarque|zona boarding|area de embarque|area boarding)\b/g,'sala de embarque'],
  // Fatiga / cansancio
  [/\b(cansado|cansados|agotado|agotados|sin dormir|no durmio|no dormimos)\b/g,'fatiga'],
  [/\b(somnoliento|somnolencia|casi me duermo|casi se durmio)\b/g,'fatiga'],
  // Demora
  [/\b(tarde|atrasados|fuera de horario|no salimos a horario|salimos despues)\b/g,'demorado'],
  [/\b(delay|retrasado|retraso)\b/g,'demora'],
  // Alcohol / drogas — pasajero O personal
  [/\b(borracho|ebrio|en pedo|alcoholizado)\b/g,'consumo de alcohol en servicio'],
  [/\btomando (vino|cerveza|alcohol|bebida|whisky|licor|ron|birra|trago|fernet|champagne|gin|vodka|tequila)\b/g,'consumo de alcohol en servicio'],
  [/\b(bebiendo alcohol|bebiendo cerveza|bebiendo vino|tomando trago|tomando tragos)\b/g,'consumo de alcohol en servicio'],
  [/\b(tomado|en estado de ebriedad|bajo efecto del alcohol)\b/g,'consumo de alcohol en servicio'],
  [/\b(drogado|bajo efecto de drogas|bajo los efectos|consumiendo drogas)\b/g,'bajo efecto de drogas en servicio'],
  [/\b(fumando marihuana|fumando porro|fumando juana)\b/g,'bajo efecto de drogas en servicio'],
  // Bird strike
  [/\b(pajaro|pajaros|gallinazo|zopilote|condor|buitre|gaviotas|palomas)\b/g,'ave'],
  [/\b(comimos un|tragamos un|ingesto)\b/g,'ingesta de'],
  // Windshear / turbulencia
  [/\b(nos sacudio|nos sacudieron|nos tiro|nos tiraron|el avion se movio mucho)\b/g,'turbulencia severa'],
  [/\b(cizallamiento|cizalla)\b/g,'windshear'],
];

// Pre-procesador: normaliza tildes → RAE lemas → CONCEPT_PATTERNS → SYNONYMS
function _preprocess(text){
  let t=_norm(text);
  // Capa 0: RAE morfológico — formas irregulares → infinitivo/forma base RAE
  for(const[pat,rep] of RAE_LEMMAS) t=t.replace(pat,rep);
  // Capa 1: CONCEPT_PATTERNS — normaliza lenguaje cotidiano → conceptos ICAO
  for(const[pat,rep] of CONCEPT_PATTERNS) t=t.replace(pat,rep);
  // Capa 2: SYNONYMS — normaliza sinónimos y variantes léxicas
  for(const[pat,rep] of SYNONYMS) t=t.replace(pat,rep);
  return t;
}

// ═══════════════════════════════════════════════════════════════════
//  RAÍCES — cubren flexiones verbales y sustantivos derivados
//  Peso 0.6 (menor que keyword exacta = 1) para no dominar la puntuación
// ═══════════════════════════════════════════════════════════════════

// ROOTS: líneas 4315-4519
const ROOTS={
  "Seguridad Aeroportuaria":[
    "robando","robado","robaron","robare","hurtar","hurtado","hurtaron",
    "sustraje","sustrajo","sustrajeron","sustrae","sustraer",
    "intrusio","intruder","amenazand","amenazaro","amenazaste",
    "sin identif","acceso restrict","zona restri","area restri",
    "tailgat","piggybac","vigilanci","perimetr"
  ],
  "Falla Técnica":[
    "averiad","averiand","inoperab","inoperat",
    "vibracion","vibrando","vibraron","vibrar",
    "derramand","derramaron","derramado",
    "shutdown","apagaron","apagase","apagand",
    "humeand","humean","saliendo humo",
    "desconect","desconecto","desconectaron",
    "calentand","sobrecalent","recalent",
    "presion baj","presion alt","temperatura alt"
  ],
  "Ground Damage":[
    "abollad","abollar","abollaron","abollando",
    "impactand","impactaron","impactado",
    "colisiono","colisionaron","colisionando",
    "raspand","rasparon","raspado",
    "rayand","rayaron","rayado",
    "dañand","dañaron","dañado"
  ],
  "Factores Humanos":[
    "fatigad","fatigando","fatigo",
    "cansanci","agotamient",
    "omitiero","omitieron","omitido","omitir",
    "olvidaron","olvidando","olvidado",
    "distraje","distrajer","distraido","distraido",
    "confundier","confundido","confundiend",
    "desorienta","desorientad"
  ],
  "Turbulencia":[
    "sacudiero","sacudieron","sacudido","sacudiendo","sacudimiento",
    "temblaron","temblando","temblo",
    "movimiento brusco","movimientos bruscos",
    "windshear","cizallad"
  ],
  "Bird Strike":[
    "ingestion","ingestio","ingesta",
    "plumas encontr","plumas en",
    "restos de ave","restos de pajaro",
    "impacto aviario","impacto de ave"
  ],
  "Runway Excursion":[
    "salio de pista","salieron de pista","saliendose",
    "corrio la pista","corrieron la pista",
    "se paso de","aquaplan","hidroplan"
  ],
  "TCAS RA":[
    "resolucion advisory","traffic advisory",
    "colision aerea","separacion vertical",
    "proximity warning","loss of separation"
  ],
  "Hard Landing":[
    "aterrizaje duro","aterrizaje fuerte","aterrizaje brusco",
    "impacto fuerte","toque fuerte","toque duro",
    "carga g","sink rate","rate of descent"
  ],
  "Unstable Approach":[
    "inestabilizad","inestabilizado","aproximacion inestable",
    "go around","missed approach","fuera de parametros"
  ],
  "GPWS":[
    "terrain warning","ground proximity","pull up",
    "colision terreno","alerta terreno"
  ],
  "Demora Operacional":[
    "demorand","demorado","demoraron",
    "atrasand","atrasaron","atrasado",
    "out of schedule","fuera de schedule"
  ],
  "Incursión de Pista":[
    "incursion","entro a pista","cruzo sin","cruzaron sin",
    "pista activa","en pista activa","cruzo pista","entraron pista",
    "pista ocupada","otro avion en pista","sin autorizacion pista"
  ]
};

// ── TAXONOMÍA ICAO ADREP — Occurrence Type Codes ──────────────────────────
// Fuente: ICAO Doc 9156 (ADREP), Annex 13, ECCAIRS taxonomy
// Cada código ADREP mapea a una categoría SMS + vocabulario oficial en ES/EN
const ICAO_ADREP={
  // SEC — Security occurrence
  "SEC":{cat:"Seguridad Aeroportuaria",kws:[
    "security occurrence","security breach","unauthorized access","acceso no autorizado",
    "threat","amenaza","weapon","arma","bomb","bomba","explosive","explosivo",
    "intrusion","intrusion","hijack","secuestro","stoaway","polizon",
    "restricted area violation","violacion area restringida","perimeter breach","violacion perimetro",
    "unscreened","sin revision","prohibited item","objeto prohibido",
    "sabotage","sabotaje","terrorism","terrorismo","suspicious person","persona sospechosa"
  ]},
  // GCOL — Ground Collision
  "GCOL":{cat:"Ground Damage",kws:[
    "ground collision","colision en tierra","vehicle strike","vehicle hit aircraft",
    "ground vehicle","vehiculo en plataforma","equipment strike","equipo golpeo aeronave",
    "ramp collision","colision en rampa","pushback collision","colision en pushback",
    "tow bar collision","colision barra remolque","loader strike","golpe loader",
    "jetway contact","contacto finger","gse contact","contacto gse",
    "ground support equipment","equipo apoyo en tierra","aircraft contacted by","aeronave golpeada por"
  ]},
  // WILD — Wildlife Strike
  "WILD":{cat:"Bird Strike",kws:[
    "wildlife strike","bird strike","animal strike","golpe fauna",
    "bird ingestion","ingestion de aves","fauna","ave en motor","bird hit",
    "bat strike","murcielago","deer strike","ciervo en pista","wildlife hazard",
    "peligro fauna","bird ingested","animal ingested","feathers in engine",
    "plumas en motor","bird remains","restos de ave","wildlife management"
  ]},
  // RE — Runway Excursion
  "RE":{cat:"Runway Excursion",kws:[
    "runway excursion","excursion de pista","veer off","desviacion lateral",
    "lateral runway excursion","salida lateral pista","overrun","corrida de pista",
    "runway overrun","corrida final pista","undershoot","aterrizaje corto",
    "aquaplaning","hydroplaning","hidroplaneo","runway end safety area",
    "resa","zona de seguridad final","departed runway","abandono pista","soft ground"
  ]},
  // RI — Runway Incursion
  "RI":{cat:"Incursión de Pista",kws:[
    "runway incursion","incursion de pista","unauthorized runway entry","ingreso no autorizado pista",
    "runway without clearance","pista sin autorizacion","entered active runway","ingreso pista activa",
    "crossed runway","cruzaron pista","runway conflict","conflicto pista",
    "vehicle on runway","vehiculo en pista","aircraft on runway","aeronave en pista ocupada",
    "hot spot","punto caliente","wrong runway","pista equivocada"
  ]},
  // CFIT — Controlled Flight Into Terrain
  "CFIT":{cat:"GPWS / CFIT",kws:[
    "controlled flight into terrain","cfit","vuelo controlado hacia terreno",
    "terrain impact","impacto con terreno","terrain proximity","proximidad terreno",
    "gpws alert","alerta gpws","taws alert","alerta taws",
    "terrain warning","advertencia terreno","pull up","sink rate alarm",
    "minimum safe altitude warning","msaw","ground proximity warning"
  ]},
  // TURB — Turbulence Encounter
  "TURB":{cat:"Turbulencia",kws:[
    "turbulence encounter","encuentro con turbulencia","severe turbulence","turbulencia severa",
    "moderate turbulence","turbulencia moderada","clear air turbulence","cat",
    "windshear encounter","encuentro cizallamiento","microburst","downburst",
    "mountain wave","onda de montaña","convective turbulence","turbulencia convectiva",
    "passengers injured turbulence","pasajeros heridos turbulencia","chop","chop severo"
  ]},
  // SCF-PP — System/Component Failure – Powerplant
  "SCF-PP":{cat:"Falla Técnica",kws:[
    "powerplant failure","falla motor","engine failure","falla de motor",
    "engine fire","incendio motor","engine shutdown","apagado motor en vuelo",
    "thrust loss","perdida de empuje","compressor stall","surge compresor",
    "flame out","apagon","bird ingestion engine","ingestion ave motor",
    "engine vibration","vibracion motor","oil pressure","presion aceite"
  ]},
  // SCF-NP — System/Component Failure – Non-Powerplant
  "SCF-NP":{cat:"Falla Técnica",kws:[
    "system component failure","falla sistema","component failure","falla componente",
    "hydraulic failure","falla hidraulica","electrical failure","falla electrica",
    "avionics failure","falla avionica","pressurization failure","falla presurización",
    "oxygen system failure","falla oxigeno","fuel system failure","falla combustible",
    "flight control failure","falla control vuelo","autopilot failure","falla piloto automatico",
    "landing gear failure","falla tren aterrizaje","structural failure","falla estructural"
  ]},
  // F-NI — Fire/Smoke – Non-Impact
  "F-NI":{cat:"Falla Técnica",kws:[
    "smoke on board","humo a bordo","fire on board","fuego a bordo",
    "cabin smoke","humo en cabina","cargo hold fire","fuego en bodega",
    "electrical fire","fuego electrico","brake fire","fuego en frenos",
    "fire warning","alerta de fuego","smoke warning","alerta de humo",
    "toilet fire","fuego sanitario","galley fire","fuego galley"
  ]},
  // LOC-I — Loss of Control – Inflight
  "LOC-I":{cat:"Falla Técnica",kws:[
    "loss of control inflight","perdida de control en vuelo","upset","actitud inusual",
    "unusual attitude","stall","entrada en perdida aerod","spin","barrena",
    "spiral dive","picada en espiral","steep bank angle","angulo banco excesivo",
    "nose dive","picada","high bank","banco pronunciado","uncontrolled descent"
  ]},
  // MED — Medical
  "MED":{cat:"Factores Humanos",kws:[
    "medical occurrence","ocurrencia medica","incapacitation","incapacitacion",
    "pilot incapacitation","incapacitacion piloto","crew incapacitation","incapacitacion tripulacion",
    "passenger medical emergency","emergencia medica pasajero","cardiac arrest","paro cardiaco",
    "unconscious","inconsciente","seizure","convulsion","stroke","ataque cerebral",
    "hypoxia","hipoxia","decompression sickness","enfermedad descompresion"
  ]},
  // EVAC — Evacuation
  "EVAC":{cat:"Falla Técnica",kws:[
    "emergency evacuation","evacuacion de emergencia","slide deployed","tobogan activado",
    "emergency slide","tobogan emergencia","ordered evacuation","evacuacion ordenada",
    "cabin emergency","emergencia de cabina","all clear evacuation","all clear",
    "slide inflation","inflado tobogan","exit blocked","salida bloqueada","evacuation injury"
  ]},
  // UIMC — Unintended IMC
  "UIMC":{cat:"Falla Técnica",kws:[
    "unintended imc","imc no planificado","inadvertent imc","imc inadvertido",
    "entered cloud","entro en nube","lost visual reference","perdio referencia visual",
    "spatial disorientation","desorientacion espacial","vertigo","vertigo piloto"
  ]},
  // ARC — Abnormal Runway Contact
  "ARC":{cat:"Hard Landing",kws:[
    "abnormal runway contact","contacto anormal pista","hard landing","aterrizaje duro",
    "tail strike","golpe cola","nose gear first","tren morro primero",
    "bounced landing","aterrizaje rebotado","porpoising","winglet strike","tip strike"
  ]}
};


// Términos genéricos de aviación para catch-all

// AV_TERMS: línea 4531
const AV_TERMS=["avion","aeronave","vuelo","pista","aeropuerto","piloto","aterrizaje","despegue",
  "motor","cabina","tripulacion","pasajero","torre","control","aereo","runway","aircraft","flight",
  "incidente","reporte","evento","accidente","emergencia","falla","problema","alarma","alerta",
  "reporte","reportar","notificacion","operacion","maniobra","aproximacion","despegue","aterrizaje",
  "aerodromo","hangar","rampa","plataforma","trafico","atc","fir","tma"];

// _initNorm: pre-normaliza todos los arrays al cargar el módulo (idéntico al comportamiento del browser)
(function _initNorm(){
  for(const c of Object.keys(KW)) KW[c]=KW[c].map(_norm);
  for(const c of Object.keys(ROOTS)) ROOTS[c]=ROOTS[c].map(_norm);
  for(const code of Object.keys(ICAO_ADREP)) ICAO_ADREP[code].kws=ICAO_ADREP[code].kws.map(_norm);
})();

module.exports = { KW, KW_EN, RAE_LEMMAS, CONCEPT_PATTERNS, SYNONYMS, ROOTS, ICAO_ADREP, AV_TERMS };
