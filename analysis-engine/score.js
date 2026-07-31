'use strict';
// ── SCORE — SEV_KW, PROB_KW, CAT_ARMS_DEFAULT, scoreKW() ─────────────────────
// Extraído sin modificaciones de SafetyOps_v2.html
const { _preprocess } = require('./preprocess');

// SEV_KW: líneas 2440-2535
const SEV_KW={
  5:["catastrófico","catastrófica","destrucción total","pérdida total","colisión","fatalidad","fallecido","muerte","muertos","víctimas",
     "aeronave destruida","pérdida de la aeronave","incendio en vuelo","incendio de motor",
     "llamas","fire onboard","hull loss","fatal","fatalities","aircraft destroyed",
     "mayday","declared emergency","controlled flight into terrain","cfit",
     "terrain impact","ground impact","colisión con terreno","impacto con suelo",
     // fuego / incendio — variantes en español natural (orden directo e invertido)
     "fuego","en llamas","llamas en","se prendió fuego","se incendió","prendió fuego",
     "fuego a bordo","fuego en vuelo","incendio a bordo","arde","ardiendo",
     // explosión — motor, turbina, fuselaje
     "explotó","explosión","exploto","explosion","explodió","detonó","detonación",
     "deflagración","estallido","estalla","estalló","bang en","bang del motor",
     "turbina explotó","motor explotó","turbina estalló","motor estalló",
     "se escuchó una explosión","se escuchó explosión","sonó una explosión",
     // emergencia aguda — aterrizaje forzoso / evaluación crítica
     "aterrizaje de emergencia","aterrizaje forzoso","aterrizaje de precaución",
     "emergencia en vuelo","emergencia a bordo","evacuación de emergencia",
     "se evalúa aterrizaje","evaluando aterrizaje","declaran emergencia",
     // extinción fallida — máximo riesgo
     "extintor no funciona","extintor sin funcionar","extintor falló","extintor falla",
     "corta fuegos no funciona","corta fuegos sin funcionar","sistema extinción falla",
     "sistema de extinción no funciona","botella de extinción no activó",
     // fallas estructurales graves
     "falla en las alas","fallas en las alas","problema en las alas","daño en las alas",
     "falla en el ala","alas comprometidas","integridad de alas comprometida"],
  4:["grave","mayor","peligrosa","incidente grave","reducción importante de seguridad","lesiones graves",
     "daño estructural severo","daños estructurales","heridos graves","hospitalización","politraumatismo","fractura","daño severo",
     "incapacitación","pérdida de control","loss of control",
     "unreliable airspeed","runaway trim","engine fire","depressurisation",
     "descompresión explosiva","pan pan","emergencia declarada","terrain pull up",
     "gpws warning","egpws","windshear escape","microburst","falla hidráulica total",
     "hydraulic failure","engine shutdown","apagado de motor","fuego en plataforma",
     "runway overrun","salida de pista","excursión de pista",
     // extinción / supresión de fuego — nivel 4 si no se especifica que falla
     "corta fuegos","extintor","extinguidor","extinguir el fuego","sistema contra incendio",
     "sistema de extinción","botella de extinción","fire handle","disparar extintor",
     "descargamos extintor","extinción activada","fire suppression",
     // emergencias técnicas graves
     "emergencia","forzoso","falla total","falla crítica","múltiples fallas","doble falla",
     "pérdida de potencia total","ambos motores","pérdida de ambos","dual engine failure",
     "falla en alas","daño en ala","problemas en las alas","problemas en alas",
     // daño a partes críticas del avión
     "flap asimétrico","flap bloqueado","flap no retrae","flap stuck","flap jam",
     "alerón bloqueado","alerón inoperativo","rudder jam","timón bloqueado",
     "tren no baja","tren no extiende","gear not down","gear unsafe","gear disagree",
     "neumático reventado","tire burst","blowout en aterrizaje","blown tire",
     "APU fire","fuego en APU","APU en llamas","APU shutdown",
     "galley fire","fuego en galley","fuego en el galley","fuego en galey","fuego en el galey",
     "galey","galley en llamas","galey en llamas","lavatory fire","fuego en lavatorio",
     "pitot obstruido","pitot bloqueado","pitot icing","pitot congelado",
     "unreliable airspeed","airspeed unreliable","velocidad no confiable",
     "fuselaje rajado","fisura en fuselaje","bird strike en fuselaje",
     "fan blade off","blade off","FBO","pala desprendida","blade liberated",
     "reverser deployed","reverser deployed in flight","reversor desplegado en vuelo",
     "fuel leak","fuga de combustible","combustible bajo crítico","fuel emergency",
     "hydraulic leak","fuga hidráulica","loss of hydraulic","pérdida hidráulica total"],
  3:["moderado","moderada","dificultad operativa","retraso significativo","falla de sistema","lesiones leves","daño moderado","hard landing","aterrizaje brusco",
     "tcas ra","resolución de tráfico","excursión confinada","bird strike ingestion",
     "ingesta de ave","aproximación inestabilizada","unstabilised approach",
     "ground proximity","separación reducida","near miss","casi choque","conflicto atc",
     "go-around tardío","baulked landing","falla de motor parcial","partial failure",
     "smoke in cockpit","humo en cabina","hydraulic low","presión hidráulica baja",
     "wind shear","cizalladura de viento","upset recovery","unusual attitude",
     // expansión moderado — heridos / daño confirmado
     "heridos","lesionados","lesión","lesión leve","herido leve",
     "daño en aeronave","aeronave dañada","daño confirmado",
     "salida de pista confinada","bird strike con daño","ingesta confirmada",
     // sistemas críticos degradados
     "motor inoperativo","motor apagado","engine out","single engine",
     "motor único","falla de motor","un motor","apagamos un motor",
     "tren no sale","tren no baja","tren de aterrizaje no funciona",
     "tren bloqueado","ruedas atascadas","tren trabado",
     "presurización perdida","máscaras desplegadas","rapid depressurisation",
     "derrame de combustible","fuga de combustible confirmada",
     // humo / incendio sin emergencia total
     "smoke in cabin","humo en pasaje","humo en cabina de pasajeros",
     // maniobras degradadas
     "go-around tardío","missed approach","aproximación frustrada",
     // separación / tráfico
     "conflicto de tráfico confirmado","separación mínima confirmada",
     // condiciones excedidas
     "viento cruzado excedido","crosswind limit exceeded",
     // near miss
     "near miss","caso near miss","estuvimos muy cerca"],
  2:["menor","leve","inconveniente","sistema no esencial","procedimiento alternativo","molestia","desvío leve",
     "daño leve","daño menor","minor damage","incidente menor","bird strike exterior",
     "impacto de ave sin ingesta","tcas ta","traffic advisory","separación mínima",
     "desvío de procedimiento","deviation","soft overrun","confusión de taxeo",
     "wrong runway","runway incursion","incursión de pista","fod encontrado",
     "foreign object","tire damage","daño en neumático","ground incident","incidente en rampa"],
  1:["insignificante","sin consecuencias","normal","mínimo","sin daños","sin daño","no damage","observación","nota de seguridad",
     "finding","hallazgo","reporte de mejora","improvement report","sin consecuencias",
     "no injury","sin heridos","discrepancia menor","minor discrepancy","close call resuelto"]
};

// PROBABILIDAD ARMS 1-5 — (1=Improbable … 5=Frecuente)  [OACI Doc 9859 Tabla 5-2]

// PROB_KW: líneas 2536-2696
const PROB_KW={
  5:["frecuente","frecuentemente","siempre","constante","reiterativo","continuo","repetitivo","común",
     "repetido","recurrente sistemático","patrón repetitivo",
     "múltiples veces","varias veces por semana","diariamente","todos los vuelos",
     "consistently","always","every flight","daily occurrence","chronic",
     // evento catastrófico activo — avión literalmente en llamas en vuelo → Crítico
     "en llamas","llamas","llamas en","en llamas en vuelo","avión en llamas","aeronave en llamas",
     "fuego a bordo","incendio a bordo","llamas a bordo","llamas visibles",
     "motor en llamas","turbina en llamas","fuselaje en llamas",
     "estamos en llamas","nos incendiamos","el avión arde","ardiendo en vuelo",
     // explosión activa
     "explotó","explosión","exploto","explodió","detonó","detonación","estalló","estallido",
     "turbina explotó","motor explotó","turbina estalló","motor estalló",
     "pérdida de control","loss of control","LOC-I","impacto con terreno",
     "caída libre","nose dive","estructura comprometida","desintegración"],
  4:["probable","ocasional","periódico","habitual","recurrente","varias veces al mes","lluvia intensa",
     "condiciones degradadas frecuentes","high likelihood","likely to recur",
     "expected","se espera que ocurra","tendencia al alza","increasing trend",
     "viento cruzado habitual","crosswind frequent","regularly","regularly observed",
     // emergencias activas de alta gravedad → mínimo Probable
     "fuego en vuelo","incendio en vuelo","humo en cabina","humo a bordo",
     "smoke in cabin","motor fallando","engine failure","engine fire",
     "pérdida de presión","descompresión explosiva","rapid depressurisation",
     "pérdida de hydraulic","fallo eléctrico total","blackout eléctrico",
     "mayday","pan-pan","emergencia declarada","squawk 7700"],
  3:["remoto","poco común","inusual","esporádico","a veces","algunas veces","puede ocurrir","durante",
     "condiciones adversas","adverse conditions","possible","posible","could happen",
     "intermittent","intermitente","sporadic","seasonal","estacional",
     "en condiciones específicas","bajo ciertas condiciones","might occur",
     // expansión remoto/ocasional — condiciones que elevan probabilidad
     "en estas condiciones","con estas condiciones","bajo estas condiciones",
     "lluvia","con lluvia","pista mojada","niebla","baja visibilidad","viento cruzado",
     "carga elevada","alta densidad","temporada alta","período vacacional",
     "noche","nocturno","nocturna","vuelo nocturno",
     "condiciones de pista degradada","PIREP de turbulencia","CAT reportada",
     "fatiga acumulada","fatiga de tripulación","tripulación fatigada",
     // recurrencia / antecedentes
     "problema conocido","ya pasó antes","ocurrió antes","ocurrencia previa",
     "antecedente","historial de fallas","falla recurrente en ese sistema",
     // emergencias activas — el peligro está presente → probabilidad remota/ocasional al menos
     "aterrizaje de emergencia","aterrizaje forzoso","emergencia en vuelo",
     "emergencia a bordo","incendio en vuelo","incendio de motor","fuego en motor",
     "fuego en turbina","fuego en las turbinas","fuego en los motores",
     "extintor falló","extintor sin funcionar","corta fuegos sin funcionar",
     "se evalúa","evaluando aterrizaje","declaran emergencia",
     "doble falla","múltiples fallas simultáneas","falla catastrófica",
     "humo en cabina","humo a bordo","smoke in cabin",
     // condiciones de aeropuerto que elevan probabilidad
     "pista contaminada","pista mojada","pista con hielo","pista con nieve","pista con slush",
     "NOTAM activo","restricciones por NOTAM","NOTAM en vigencia",
     "ILS no operativo","ILS fuera de servicio","ILS inoperativo",
     "baja visibilidad","LVP","low visibility procedures","CAT II","CAT III",
     "FOD reportado","FOD en pista","FOD en taxiway","FOD en plataforma",
     "fauna activa","wildlife alert","bird activity","actividad de fauna",
     "deicing","pista tratada","anti-icing en curso",
     "tráfico intenso","alta densidad de tráfico","hora pico","peak hour",
     "trabajo en pista","obras en pista","NOTAM runway","pista reducida",
     "tormenta eléctrica","lightning","SIGMET activo","volcanic ash","ceniza volcánica"],
  2:["improbable","casi nunca","muy raro","sumamente difícil","poco probable","infrecuente",
     "unlikely","raro","pocas veces","uncommon","baja frecuencia","low frequency",
     "primera vez","primera ocurrencia","first time","no esperado","unexpected",
     "excepcional","exceptional","difícil que ocurra","hard to recur","isolated incident","incidente aislado"],
  1:["extremadamente improbable","imposible","nunca","inédito","sin antecedentes",
     "raramente","casi imposible","extremely unlikely","never reported",
     "no precedents","no prior","históricamente inusual","historically rare",
     "virtually impossible","prácticamente imposible","primera vez en años","anomalía única","unique anomaly"]
};

// ── BOWTIE DATA ─────────────────────────────────────────────────────────────
const BOWTIE={
  "TCAS RA":{
    topEvent:"Pérdida de separación aérea",
    color:"#EF4444",
    amenazas:["Instrucción ATC errónea","Error de tripulación","Falla de transponder","Tráfico no cooperativo","Degradación de comunicaciones"],
    barreras_prev:["Separación estándar ATC","Monitoreo de radar secundario","Briefing de espacio aéreo","Coordinación ATC–piloto","Altimetría correcta"],
    barreras_mit:["Maniobra de evasión RA","Separación vertical inmediata","Coordinación post-TCAS ATC","Declaración de emergencia","Reporte obligatorio OACI"],
    consecuencias:["Colisión en vuelo","Pérdida de aeronave","Víctimas fatales","Cierre de espacio aéreo","Investigación regulatoria"]
  },
  "Bird Strike":{
    topEvent:"Impacto con fauna silvestre",
    color:"#22C55E",
    amenazas:["Fauna en área de movimiento","Actividad migratoria","Cultivos o basurales cercanos","Fauna atraída por luces","Falta de control de fauna"],
    barreras_prev:["Programa control de fauna","Inspección de pista","NOTAM de actividad aviaria","Coordinación aeropuerto–pilotos","Radar de detección de fauna"],
    barreras_mit:["Inspección post-impacto","Potencia reducida de motor","Aterrizaje de emergencia","Borescope de motor","Informe técnico obligatorio"],
    consecuencias:["Pérdida de motor","Daño estructural","Aborto de despegue","Aterrizaje de emergencia","Fuera de servicio extendido"]
  },
  "Runway Excursion":{
    topEvent:"Salida de pista",
    color:"#F97316",
    amenazas:["Pista contaminada","Viento cruzado excesivo","Velocidad excesiva en aterrizaje","Falla de frenos","Aquaplaning"],
    barreras_prev:["Informe de estado de pista SNOWTAM","Briefing de performance","Límite de viento cruzado","Chequeo de sistema de frenos","Gate de energía en final"],
    barreras_mit:["Zona de seguridad RESA","Arrestor de pista EMAS","Notificación inmediata a ATC","Evacuación de pasajeros","Intervención de emergencias aeropuerto"],
    consecuencias:["Daño estructural aeronave","Lesiones a ocupantes","Cierre de pista","Investigación JIAAC","Responsabilidad operacional"]
  },
  "Unstable Approach":{
    topEvent:"Aproximación fuera de parámetros",
    color:"#F5A623",
    amenazas:["Alta velocidad en final","Descenso fuera de perfil","Configuración tardía","Baja visibilidad","Distracción en cabina"],
    barreras_prev:["Gate de estabilización 500ft","Briefing de aproximación","Call-outs CRM","Monitoreo de PAPI/ILS","Gestión de energía automatizada"],
    barreras_mit:["Go-around inmediato","Circuito de espera","Nueva asignación de pista ATC","Briefing post-evento","Análisis FOQA/QAR"],
    consecuencias:["Aterrizaje duro","Salida de pista","CFIT","Lesiones tripulación","Reporte obligatorio"]
  },
  "Hard Landing":{
    topEvent:"Aterrizaje brusco con excedencia de carga G",
    color:"#F97316",
    amenazas:["Tasa de descenso elevada","Windshear en final","Técnica de flare incorrecta","Referencia visual incorrecta","Sobrecarga de trabajo"],
    barreras_prev:["Monitoreo de sink rate","Call-out de tasa de descenso","Estabilización en 500ft","GPWS modo 1","Briefing de condiciones"],
    barreras_mit:["Inspección estructural obligatoria","Hard landing check AMM","QAR trigger automático","Aeronave fuera de servicio","Análisis de fatiga estructural"],
    consecuencias:["Daño en tren de aterrizaje","Grieta estructural","Aeronave no aeronavegable","Fuera de servicio no planificado","Costo de mantenimiento elevado"]
  },
  "GPWS":{
    topEvent:"Proximidad al terreno no intencional",
    color:"#EF4444",
    amenazas:["Aproximación no estabilizada","Error de navegación","Altimetría incorrecta","Baja visibilidad con terreno elevado","Descenso prematuro"],
    barreras_prev:["Base de datos terreno EGPWS","Carta de aproximación actualizada","Briefing de terreno en ruta","Mínimos de descenso","Monitoreo de altitud ATC"],
    barreras_mit:["Maniobra de escape inmediata","TOGA / máxima potencia","Coordinación ATC post-alerta","Investigación de causa raíz","NOTAM de terreno peligroso"],
    consecuencias:["CFIT — Colisión con terreno","Pérdida total de aeronave","Víctimas fatales","Investigación internacional","Impacto reputacional grave"]
  },
  "Turbulencia":{
    topEvent:"Turbulencia severa en vuelo",
    color:"#2DD4BF",
    amenazas:["Celda convectiva no detectada","Estela de otra aeronave","Ondas de montaña","Turbulencia en aire claro (CAT)","Condiciones no pronosticadas"],
    barreras_prev:["Planificación meteorológica","SIGMET y PIREP activos","Uso de radar meteorológico","Asientos y cinturones abrochados","Comunicación con ATC/ATFM"],
    barreras_mit:["Velocidad de turbulencia VB","Solicitud de cambio de nivel","Asistencia médica a bordo","Reporte urgente a ATC","PIREP obligatorio post-evento"],
    consecuencias:["Lesiones a tripulantes","Lesiones a pasajeros","Daño en cabina","Desvío médico","Reporte a regulador"]
  },
  "Ground Damage":{
    topEvent:"Daño a aeronave en tierra",
    color:"#F5A623",
    amenazas:["Equipo de rampa sin autorización","Baja visibilidad nocturna","Error de marshaling","Pushback sin guía","FOD en plataforma"],
    barreras_prev:["Procedimiento de zona de seguridad","Certificación de conductores GSE","Iluminación de plataforma","Double-check de posición","Comunicación piloto–rampa"],
    barreras_mit:["Inspección de daño inmediata","Fotografía y documentación","Aeronave fuera de servicio","Notificación a MRO","Reporte de seguridad operacional"],
    consecuencias:["Daño estructural no detectado","Vuelo con aeronave dañada","AOG — Aeronave en tierra","Costo de reparación","Responsabilidad civil"]
  },
  "Factores Humanos":{
    topEvent:"Error humano con impacto operacional",
    color:"#a78bfa",
    amenazas:["Fatiga de tripulación","Alta carga de trabajo","Presión de tiempo","Comunicación deficiente","Falta de entrenamiento reciente"],
    barreras_prev:["Límites de tiempo de vuelo FTL","Gestión de fatiga FRMS","CRM y briefing de tripulación","Checklists verificados","Cultura de reporte voluntario"],
    barreras_mit:["Just Culture — sin represalia","Análisis de causa raíz","Plan de acción correctiva","Refuerzo de entrenamiento","Revisión de procedimientos SOP"],
    consecuencias:["Desviación de procedimiento","Incidente operacional","Sanción regulatoria","Lesiones o víctimas","Pérdida de certificación"]
  },
  "Falla Técnica":{
    topEvent:"Falla de sistema en vuelo",
    color:"#60a5fa",
    amenazas:["Mantenimiento deficiente","Pieza fuera de vida útil","Corrosión no detectada","Falla de software","Error de instalación"],
    barreras_prev:["Programa de mantenimiento CAMO","Airworthiness Directives vigentes","Inspección pre-vuelo","MEL y CDL actualizados","Sistema de monitoreo ACARS"],
    barreras_mit:["Checklist de emergencia aplicado","Aterrizaje de precaución","AOG — Rectificación en destino","Análisis de causa raíz técnica","Informe a ANAC / fabricante"],
    consecuencias:["Aterrizaje de emergencia","Aeronave AOG","Lesiones por falla","Multa regulatoria","Retiro de certificación de tipo"]
  }
};

// ═══════════════════════════════════════════════════════════════════
//  MOTOR DE NORMALIZACIÓN — eliminación de tildes + sinónimos
//  Permite que "área" = "area", "identificación" = "identificacion", etc.
// ═══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
//  NAIVE BAYES — clasificador estadístico entrenado en corpus etiquetado
//  Complementa KW/ROOTS/ADREP: aprende co-ocurrencias, no solo palabras clave
//  Peso en fusión: 0.35 (KW: 0.40, ADREP: 0.25)
// ══════════════════════════════════════════════════════════════════════════

// CAT_ARMS_DEFAULT: líneas 4676-4696
const CAT_ARMS_DEFAULT={
  "Colisión en Pista":         {sev:5,prob:2},
  "CFIT":                      {sev:5,prob:2},
  "Aproximación Inestable":    {sev:4,prob:3},
  "Incursión en Pista":        {sev:4,prob:2},
  "Incendio":                  {sev:4,prob:2},
  "Pérdida de Separación":     {sev:4,prob:3},
  "Estela Turbulenta":         {sev:3,prob:3},
  "Error de Navegación":       {sev:3,prob:2},
  "Meteorología Adversa":      {sev:3,prob:3},
  "Fatiga de Tripulación":     {sev:3,prob:3},
  "Mercancías Peligrosas":     {sev:3,prob:2},
  "Incidencia ATC":            {sev:3,prob:2},
  "Falla Técnica":             {sev:3,prob:2},
  "Daño a Aeronave":           {sev:3,prob:2},
  "Iluminación Láser":         {sev:3,prob:2},
  "Seguridad Aeroportuaria":   {sev:3,prob:2},
  "Bird Strike / Fauna":       {sev:3,prob:3},
  "Factores Humanos":          {sev:2,prob:3},
  "Daño en Tierra":            {sev:2,prob:2},
};

// scoreKW(): líneas 4697-4709
function scoreKW(text,map){
  // MEJORA 8-2: priorizar niveles 4-5 con ≥1 match sobre niveles bajos con muchas coincidencias
  const t=_preprocess(text);let best=1,bestPriority=0;
  for(const[lvl,words]of Object.entries(map)){
    const lvlInt=parseInt(lvl);
    const s=words.reduce((a,w)=>a+(t.includes(w)?1:0),0);
    if(s===0) continue;
    // Niveles críticos (4-5) tienen prioridad absoluta con cualquier match
    const priority=lvlInt>=4 ? lvlInt*1000+s : s*10+lvlInt;
    if(priority>bestPriority){bestPriority=priority;best=lvlInt;}
  }
  return best;
}

module.exports = { SEV_KW, PROB_KW, CAT_ARMS_DEFAULT, scoreKW };
