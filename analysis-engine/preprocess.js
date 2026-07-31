'use strict';
// ── PREPROCESS — _norm, _NB_STOPWORDS, _tokNB, _buildNB, _scoreNB, _NB_MODEL, _preprocess
// Extraído sin modificaciones de SafetyOps_v2.html
const { RAE_LEMMAS, CONCEPT_PATTERNS, SYNONYMS } = require('./keywords');
const { NB_CORPUS } = require('./corpus');

function _norm(s){
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
}

const _NB_STOPWORDS=new Set(['del','los','las','una','unos','unas','por','para','con','sin','que','fue','ser','hay','los','las','sus','eso','este','esta','estos','estas','ese','esa','esos','esas','aun','mas','muy','pero','sino','bien','mal','dos','tres','cuatro','cinco','toda','todo','todos','todas','cual','como','cuando','donde','quien','cada','otro','otra','otros','otras','ante','bajo','tras','sobre','entre','desde','hasta','hacia','segun']);


function _tokNB(text){
  const words=_norm(text).split(/[\s,.\-;:!?()[\]\/]+/).filter(w=>w.length>2&&!_NB_STOPWORDS.has(w));
  // Bigramas: captura frases técnicas compuestas ("aterrizaje_duro", "incursion_pista", "tasa_descenso")
  // Solo entre tokens no-stopword para evitar ruido
  const bigrams=[
  // MEJORA 4-3: Entradas adicionales para las 7 categorías nuevas (≥15 por categoría)
  // ── Iluminación Láser ────────────────────────────────────────────────────
  ["haz de luz verde apuntó directo a la cabina durante final","Iluminación Láser"],
  ["laser verde azul apunta tripulacion durante approach","Iluminación Láser"],
  ["tripulacion deslumbrada por laser desde tierra aeropuerto","Iluminación Láser"],
  ["green laser pointed at cockpit during night approach","Iluminación Láser"],
  ["piloto perdió visión temporalmente por láser en final","Iluminación Láser"],
  ["laser de alta potencia impactó visera del capitán","Iluminación Láser"],
  ["distraction laser light during ILS approach visibility affected","Iluminación Láser"],
  ["navegante reporta destello verde repetido desde zona residencial","Iluminación Láser"],
  ["tripulacion reporta beam laser durante descenso nocturno","Iluminación Láser"],
  ["laser rojo apuntó al copiloto durante aproximación visual","Iluminación Láser"],
  ["pilot incapacitated momentarily green laser strike","Iluminación Láser"],
  ["laser pointer apuntando aeronave desde área perimetral","Iluminación Láser"],
  ["blue-green laser affected pilot vision nighttime landing","Iluminación Láser"],
  ["deslumbramiento por láser en fase de aterrizaje activó go-around","Iluminación Láser"],
  ["reportaron incidente laser ANAC notificación inmediata","Iluminación Láser"],

  // ── Estela Turbulenta ────────────────────────────────────────────────────
  ["vórtice de estela de B747 heavy causó balanceo severo en ascenso","Estela Turbulenta"],
  ["wake turbulence encounter B777 leader rolling uncommanded","Estela Turbulenta"],
  ["estela del heavy en despegue provocó pérdida de control momentánea","Estela Turbulenta"],
  ["separación estela insuficiente ATC autorizó despegue inmediato","Estela Turbulenta"],
  ["encountered wake vortex of preceding aircraft on short final","Estela Turbulenta"],
  ["aeronave liviana entró en vórtice de estela B787 durante aproximación","Estela Turbulenta"],
  ["rolling moment induced by wake vortex after heavy departure","Estela Turbulenta"],
  ["tripulación reporta turbulencia repentina en ausencia de nubes — estela sospechada","Estela Turbulenta"],
  ["seguimos a un heavy a 5 millas y sentimos el vórtice en 1000 ft","Estela Turbulenta"],
  ["wake turbulence separation minima not applied correctly by ATC","Estela Turbulenta"],
  ["vortex encounter caused wing drop 30 degrees on approach","Estela Turbulenta"],
  ["estela turbulenta de avión pesado dañó timón de profundidad","Estela Turbulenta"],
  ["turbulencia de estela causó lesión a un auxiliar de cabina","Estela Turbulenta"],
  ["piloto declaro alerta estela tras encontrar torbellino inesperado","Estela Turbulenta"],
  ["wake turbulence from super heavy caused upset at 2500 ft AGL","Estela Turbulenta"],

  // ── Fatiga de Tripulación ────────────────────────────────────────────────
  ["tripulación completó turno nocturno de 14 horas sin descanso reglamentario","Fatiga de Tripulación"],
  ["piloto reportó microsueño durante crucero largo — FTL excedida","Fatiga de Tripulación"],
  ["crew fatigue report duty time exceeded FDP limits FRMS","Fatiga de Tripulación"],
  ["rotación excedió límite FTL en 1 hora copiloto reportó somnolencia","Fatiga de Tripulación"],
  ["pilot fell asleep on cruise autopilot engaged ACARS alert","Fatiga de Tripulación"],
  ["tripulante de cabina reportó incapacidad por fatiga acumulada semana","Fatiga de Tripulación"],
  ["ambos pilotos reportan cansancio extremo en ruta nocturna transoceánica","Fatiga de Tripulación"],
  ["FDR muestra período sin intervención tripulación 8 minutos en crucero","Fatiga de Tripulación"],
  ["pilot fatigue reported at top of descent after 11-hour sector","Fatiga de Tripulación"],
  ["comandante declaró no apto por fatiga antes del vuelo médico avisa","Fatiga de Tripulación"],
  ["crew unfit fatigue report pre-flight FRMS activation","Fatiga de Tripulación"],
  ["tripulación operó con menos de 8 horas de descanso entre vuelos","Fatiga de Tripulación"],
  ["copiloto se quedó dormido en crucero commandante no notó","Fatiga de Tripulación"],
  ["fatigue risk management system alerta nivel alto tripulación","Fatiga de Tripulación"],
  ["CADORS fatigue report filed pilot reported 3 sectors same day","Fatiga de Tripulación"],

  // ── Error de Navegación ────────────────────────────────────────────────
  ["tripulación ingresó waypoint incorrecto en FMS rumbo equivocado","Error de Navegación"],
  ["wrong runway approach plate loaded incorrect navaid frequency","Error de Navegación"],
  ["FMS programado con ruta incorrecta equipo despachador error","Error de Navegación"],
  ["aeronave devió 15 NM de la ruta asignada sin autorización ATC","Error de Navegación"],
  ["incorrect airways loaded SIGMET area penetrated unplanned","Error de Navegación"],
  ["piloto confundió VOR y se desvió 20 millas del track autorizado","Error de Navegación"],
  ["navegación con carta desactualizada no reflejaba restricción airspace","Error de Navegación"],
  ["waypoint erróneo llevó a aeronave sobre espacio aéreo restringido","Error de Navegación"],
  ["misidentified airport visual approach runway opposite direction","Error de Navegación"],
  ["FMS inserción de punto erróneo provocó descenso anticipado","Error de Navegación"],
  ["cross-track deviation 8 NM noticed by ATC not crew","Error de Navegación"],
  ["equipo GPS con base de datos vencida — obstáculo no incluido","Error de Navegación"],
  ["tripulación perdió posición en IMC sin referencia radio correcta","Error de Navegación"],
  ["pilot selected wrong SID after departure cleared another route","Error de Navegación"],
  ["navegación IFR con falla de INS no declarada al ATC","Error de Navegación"],

  // ── Meteorología Adversa ────────────────────────────────────────────────
  ["windshear severo en final aeronave ganó 25 nudos abruptamente","Meteorología Adversa"],
  ["cizalladura de viento en pista causó go-around en los últimos 200 ft","Meteorología Adversa"],
  ["severe turbulence enountered clear air FL350 passenger injury","Meteorología Adversa"],
  ["icing conditions severe aeronave acumuló hielo en alas en crucero","Meteorología Adversa"],
  ["cumulonimbus en ruta evitado maniobra no coordinada con ATC","Meteorología Adversa"],
  ["microburst detected final approach LLWAS alert go-around executed","Meteorología Adversa"],
  ["aeronave penetró tormenta convectiva por falla del radar meteorológico","Meteorología Adversa"],
  ["freezing rain coated wings ground deicing insuficiente despegue","Meteorología Adversa"],
  ["viento cruzado excedió límite operacional comandante continuó","Meteorología Adversa"],
  ["SIGMET activo ignorado en planificación ruta ingresó área CBs","Meteorología Adversa"],
  ["low level windshear alert system activado tripulacion no reaccionó","Meteorología Adversa"],
  ["condiciones IMC inesperadas VFR-into-IMC piloto no habilitado IFR","Meteorología Adversa"],
  ["granizo dañó nariz radar antena y borde de ataque parabrisas","Meteorología Adversa"],
  ["severe icing inflight anti-ice system failure altitude deviation","Meteorología Adversa"],
  ["fog reduced visibility below minima captain continued approach","Meteorología Adversa"],

  // ── Mercancías Peligrosas ────────────────────────────────────────────────
  ["batería de litio no declarada encontrada en bodega","Mercancías Peligrosas"],
  ["undeclared lithium batteries found in checked baggage belly","Mercancías Peligrosas"],
  ["pasajero llevaba spray inflamable en equipaje de mano no declarado","Mercancías Peligrosas"],
  ["dangerous goods discovered in cargo without NOTOC paperwork","Mercancías Peligrosas"],
  ["mercancía peligrosa clase 3 líquido inflamable sin packaging IATA","Mercancías Peligrosas"],
  ["shipment of radioactive material incorrect labeling DG class 7","Mercancías Peligrosas"],
  ["cargamento de aerosoles sin etiquetar cargado en bodega",  "Mercancías Peligrosas"],
  ["passenger declared perfume but undeclared flammable liquid found","Mercancías Peligrosas"],
  ["paquete clase 9 mercancía miscelánea peligrosa sin declaración","Mercancías Peligrosas"],
  ["HAZMAT incident lithium battery fire risk in cargo compartment","Mercancías Peligrosas"],
  ["dry ice sin declarar en bodega pasajeros sin aviso tripulación","Mercancías Peligrosas"],
  ["operator failed to screen cargo for hazardous materials","Mercancías Peligrosas"],
  ["agente terrestre cargó material corrosivo sin NOTOC al comandante","Mercancías Peligrosas"],
  ["DG class 2 compressed gas cylinder loaded without crew notification","Mercancías Peligrosas"],
  ["pasajero con arma declarada incorrectamente procedimiento violado","Mercancías Peligrosas"],

  // ── Incidencia ATC ────────────────────────────────────────────────────
  ["controlador emitió instrucción incorrecta de altitud aeronave descendió","Incidencia ATC"],
  ["ATC cleared aircraft to wrong altitude conflict generated","Incidencia ATC"],
  ["instrucción ATC confusa causó lectura incorrecta por tripulación","Incidencia ATC"],
  ["controlador autorizó despegue con aeronave en pista activa","Incidencia ATC"],
  ["ATC runway incursion clearance given with traffic on runway","Incidencia ATC"],
  ["pérdida de comunicación con sector control 12 minutos TCAS activo","Incidencia ATC"],
  ["controller gave descent below minimum safe altitude MVA","Incidencia ATC"],
  ["ATC error assigned same FL to two aircraft opposite direction","Incidencia ATC"],
  ["controlador no informó tráfico conflictivo TCAS generó RA","Incidencia ATC"],
  ["falla de comunicaciones en sector TMA durante hora pico","Incidencia ATC"],
  ["frequency congestion ATC unable to transmit timely instruction","Incidencia ATC"],
  ["controlador emitió vector incorrecto aeronave fuera de ILS","Incidencia ATC"],
  ["ATC handed off aircraft without coordination between sectors","Incidencia ATC"],
  ["instrucción ATC contradictoria con SID publicado en carta","Incidencia ATC"],
  ["radar failure sector control used non-radar separation lapse","Incidencia ATC"],

];
  for(let i=0;i<words.length-1;i++) bigrams.push(words[i]+'§'+words[i+1]);
  return words.concat(bigrams);
}

function _buildNB(corpus){
  const cats={},wordCats={},catTotals={};
  for(const[text,cat]of corpus){
    cats[cat]=(cats[cat]||0)+1;
    const words=_tokNB(text);
    if(!catTotals[cat])catTotals[cat]=0;
    for(const w of words){
      if(!wordCats[w])wordCats[w]={};
      wordCats[w][cat]=(wordCats[w][cat]||0)+1;
      catTotals[cat]++;
    }
  }
  const V=Object.keys(wordCats).length;
  return{cats,wordCats,catTotals,V,total:corpus.length};
}

function _scoreNB(text,model){
  const words=_tokNB(text);
  const scores={};
  const numCats=Object.keys(model.cats).length;
  // MEJORA 4-1: Prior uniforme — evita sesgo por clases con más entradas (ej: FH×3)
  const logUniformPrior=Math.log(1/numCats);
  for(const cat of Object.keys(model.cats)){
    // Suave: mezcla 70% uniforme + 30% empírico (permite leve ajuste si la categoría genuinamente domina)
    const empirical=model.cats[cat]/model.total;
    const blended=0.7*(1/numCats)+0.3*empirical;
    let logP=Math.log(blended);
    for(const w of words){
      const c=(model.wordCats[w]||{})[cat]||0;
      // MEJORA 4-2: IDF discriminativo — tokens que aparecen en pocas categorías pesan más
      const numCatsWithTok=Object.keys(model.wordCats[w]||{}).length;
      const idf=numCatsWithTok>0?1/Math.sqrt(numCatsWithTok):1;
      logP+=idf*Math.log((c+1)/(model.catTotals[cat]+model.V));
    }
    scores[cat]=logP;
  }
  return scores;
}

let _NB_MODEL=_buildNB(NB_CORPUS);

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

module.exports = { _norm, _NB_STOPWORDS, _tokNB, _buildNB, _scoreNB, _NB_MODEL, _preprocess };
