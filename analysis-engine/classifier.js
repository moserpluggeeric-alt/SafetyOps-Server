'use strict';
// ── CLASSIFIER — clasificar() ─────────────────────────────────────────────────
// Extraído de SafetyOps_v2.html líneas 4537-4674.
// Único cambio: _lang global → parámetro lang (default 'es')
const { KW, KW_EN, ROOTS, RAE_LEMMAS, CONCEPT_PATTERNS, ICAO_ADREP, AV_TERMS } = require('./keywords');
const { _norm } = require('./norm');
const { _preprocess, _scoreNB, _NB_MODEL } = require('./preprocess');
const { nerExtract } = require('./ner');

function clasificar(text, lang) {
  const t=_preprocess(text);
  // Exclusión rápida: contextos claramente fuera del scope del SMS aeronáutico
  if(/\b(cocin[oa]|cocinero|chef|mesero|mozo|camarero|cafeteria|cafetería|restaurante|panaderi[ao]|local comercial|tienda|kiosco)\b/.test(t)&&
     /\b(se cort[oó]|cort[oó]|herida|lesion|lesión|quemadura|golpe|se lastim[oó]|accidente laboral)\b/.test(t)){
    return null; // Accidente laboral en área comercial — no es evento SMS
  }
  const scores={};
  const _trazas=[];

  // Capa 0: RAE — registrar lemas aplicados
  for(const[pat,rep] of RAE_LEMMAS){
    const match=text.toLowerCase().match(pat);
    if(match) _trazas.push({capa:'RAE',termino:match[0],lemma:rep,peso:null,info:'Lematización RAE → "'+rep+'"'});
  }

  // Capa 1: Keywords exactas (peso 1.0) — use EN dictionary when in English mode
  const _activeKW=(lang==='en')?KW_EN:KW;
  for(const[cat,kws]of Object.entries(_activeKW)){
    scores[cat]=0;
    for(const w of kws){
      if(t.includes(w)){
        scores[cat]+=1;
        _trazas.push({capa:'KW',termino:w,categoria:cat,peso:1.0,info:'Keyword exacta → '+cat});
      }
    }
  }

  // Capa 2: Raíces/stems (peso 0.6)
  for(const[cat,roots]of Object.entries(ROOTS)){
    for(const r of roots){
      if(t.includes(r)){
        scores[cat]=(scores[cat]||0)+0.6;
        _trazas.push({capa:'STEM',termino:r,categoria:cat,peso:0.6,info:'Raíz léxica → '+cat});
      }
    }
  }

  // Capa 3: ICAO ADREP taxonomy (peso 0.8) — vocabulario oficial ICAO Doc 9156
  let topAdrep=null,topAdrepScore=0;
  for(const[code,entry]of Object.entries(ICAO_ADREP)){
    const hits=entry.kws.filter(w=>t.includes(w));
    const sc=hits.length*0.8;
    if(sc>0){
      if(!scores[entry.cat])scores[entry.cat]=0;
      scores[entry.cat]+=sc;
      if(sc>topAdrepScore){topAdrepScore=sc;topAdrep=code;}
      for(const h of hits){
        _trazas.push({capa:'ADREP',termino:h,codigo:code,categoria:entry.cat,peso:0.8,
          info:'ICAO Doc 9156 · '+code+' ('+entry.label+') → '+entry.cat});
      }
    }
  }

  // Capa 4: CONCEPT_PATTERNS disparados
  const textNorm=_norm(text);
  for(const[pat,rep] of CONCEPT_PATTERNS){
    const m=textNorm.match(pat);
    if(m) _trazas.push({capa:'CONCEPT',termino:m[0].slice(0,60),concepto:rep,peso:null,info:'Patrón RAE×ICAO → "'+rep+'"'});
  }

  // Capa 5: Naive Bayes — scores estadísticos del corpus etiquetado
  const nbRaw=_scoreNB(text,_NB_MODEL);
  // Normalizar NB a [0,1]: min-max de log-probabilidades
  const nbVals=Object.values(nbRaw);
  const nbMin=Math.min(...nbVals),nbMax=Math.max(...nbVals);
  const nbRange=nbMax-nbMin||1;
  for(const[cat,logP]of Object.entries(nbRaw)){
    const nbNorm=(logP-nbMin)/nbRange; // [0,1]
    if(!scores[cat])scores[cat]=0;
    scores[cat]+=nbNorm*2.0; // peso equivalente a ~2 keyword hits
    if(nbNorm>0.6) _trazas.push({capa:'NB',termino:'(texto completo)',categoria:cat,peso:+(nbNorm.toFixed(2)),info:'Naive Bayes P('+cat+'|texto) = '+nbNorm.toFixed(3)});
  }
  // Registrar top-2 NB para trazas
  const nbSorted=Object.entries(nbRaw).sort((a,b)=>b[1]-a[1]);
  if(nbSorted.length) _trazas.push({capa:'NB',termino:'ranking NB',categoria:nbSorted[0][0],peso:null,info:'NB top-1: '+nbSorted[0][0]+' · top-2: '+(nbSorted[1]?nbSorted[1][0]:'—')});

  // Capa 6: Anchor override — términos inambiguos que dominan sobre NB sesgado
  // Si la descripción contiene un término âncora de categoría específica,
  // se aplica un boost fuerte para que la evidencia léxica supere al NB.
  function _ba(terms,cat,boost){
    const pat=new RegExp('\\b('+terms.map(_norm).join('|')+')\\b','i');
    return{pat,cat,boost};
  }
  const _ANCHORS=[
    // Seguridad Aeroportuaria — armas: prioridad sobre Incendio (boost 5.0 > 3.5)
    // "arma de fuego" contiene el token "fuego" que dispararía el anchor de Incendio
    // Este anchor debe ir PRIMERO y con boost mayor para ganar en cualquier texto de armas
    _ba(['arma de fuego','arma a bordo','pasajero con arma','pasajero armado'],'Seguridad Aeroportuaria',5.0),
    _ba(['fuego','incendio','llamas','fire','humo a bordo','humo en cabina','humo en cockpit','smoke on board','fire on board','aircraft on fire','olor a quemado','se prendio'],'Incendio',3.5),
    _ba(['bird strike','pajaros','aves','colision aviar','ave impact','pajaro en motor'],'Bird Strike',3.5),
    _ba(['tcas ra','resolution advisory','trafico cercano','conflicto de trafico'],'TCAS RA',3.5),
    _ba(['gpws','terrain pull up','pull up terrain','too low terrain','sink rate'],'GPWS',3.5),
    _ba(['medico','emergencia medica','pasajero inconsciente','pasajero fallecido','ataque al corazon'],'Emergencia Médica',3.5),
    _ba(['descompresion','presurizacion','perdida de presion','cabin pressure','presion cabina'],'Presurización',3.5),
    // Falla Técnica — "falla del motor" no matchea keyword "falla de motor" (artículo "del")
    // Sin este anchor, NB vota Factores Humanos y gana por defecto
    _ba(['falla del motor','falla en el motor','falla en motores','engine failure','perdimos un motor','motor apagado'],'Falla Técnica',3.5),
  ];
  for(const a of _ANCHORS){
    if(a.pat.test(t)){  // testear sobre texto preprocesado (sin tildes) para que \b funcione
      scores[a.cat]=(scores[a.cat]||0)+a.boost;
      _trazas.push({capa:'ANCHOR',termino:a.cat,peso:a.boost,info:'Anchor override → '+a.cat+' (+'+a.boost+')'});
    }
  }

  const total=Object.values(scores).reduce((s,v)=>s+v,0);
  // Catch-all: si no hay keywords, verificar términos genéricos de aviación (mín. 2)
  if(total===0){
    const avScore=AV_TERMS.reduce((s,w)=>s+(t.includes(w)?1:0),0);
    if(avScore>=2) return{categoria:"Falla Técnica",confianza:0.30,alternativas:[],_catchAll:true,_trazas};
    return null;
  }

  // MEJORA 3: Ponderación por fase de vuelo
  const _faseDetectada=(nerExtract(text).fase||'').toLowerCase();
  const _FASE_WEIGHTS={'aproximacion':{'CFIT':1.4,'GPWS':1.4,'Unstable Approach':1.5,'Hard Landing':1.2,'Runway Excursion':1.2},'aterrizaje':{'Hard Landing':1.5,'Runway Excursion':1.4,'Estela Turbulenta':1.2},'ascenso':{'TCAS RA':1.3,'Bird Strike':1.2,'Estela Turbulenta':1.3},'crucero':{'Turbulencia':1.4,'Fatiga de Tripulacion':1.3,'Presurización':1.3,'TCAS RA':1.2},'despegue':{'Bird Strike':1.4,'Runway Excursion':1.3,'Estela Turbulenta':1.2},'rodaje':{'Incursión de Pista':1.5,'Ground Damage':1.4,'FOD':1.3},'embarque':{'Seguridad Aeroportuaria':1.4,'Mercancías Peligrosas':1.3}};
  if(_faseDetectada&&_FASE_WEIGHTS[_faseDetectada]){
    for(const[cat,mult]of Object.entries(_FASE_WEIGHTS[_faseDetectada])){
      if(scores[cat]) scores[cat]*=mult;
    }
    _trazas.push({capa:'FASE',termino:_faseDetectada,peso:null,info:'Fase "'+_faseDetectada+'" → boost aplicado a categorías relacionadas'});
  }

  const sorted=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const top=sorted[0];
  const ratio=top[1]/total;

  // MEJORA 2: Umbral de rechazo — evidencia insuficiente
  if(ratio<0.18){
    return{categoria:null,confianza:ratio,_noClasificable:true,_trazas,
      motivo:'Evidencia insuficiente (ratio='+ratio.toFixed(2)+') — revisar descripción del evento'};
  }

  // MEJORA 1: Calibración sigmoide — más honesta que la fórmula lineal
  const conf=Math.min(0.94,Math.max(0.22,1/(1+Math.exp(-9*(ratio-0.38)))));

  // MEJORA 4: Tiebreaker — marcar cuando top-1 y top-2 están muy cerca
  const top2=sorted[1];
  const _tiebreaker=!!(top2&&top2[1]>0&&((top[1]-top2[1])/total)<0.05);
  if(_tiebreaker) _trazas.push({capa:'TIE',termino:top2[0],peso:null,info:'Empate cercano: '+top[0]+' vs '+top2[0]+' (diff='+((top[1]-top2[1])/total).toFixed(3)+') → embeddings como desempate'});

  // MEJORA 5: _topCapas — resumen de capas contribuyentes en lenguaje natural
  const _kwHits=_trazas.filter(tr=>tr.capa==='KW'&&tr.categoria===top[0]).length;
  const _stemHits=_trazas.filter(tr=>tr.capa==='STEM'&&tr.categoria===top[0]).length;
  const _adrepHits=_trazas.filter(tr=>tr.capa==='ADREP'&&tr.categoria===top[0]).length;
  const _nbEntry=_trazas.find(tr=>tr.capa==='NB'&&tr.categoria===top[0]);
  const _capaParts=[];
  if(_kwHits>0) _capaParts.push(_kwHits+' keyword'+(_kwHits>1?'s':''));
  if(_stemHits>0) _capaParts.push(_stemHits+' raíz'+(_stemHits>1?'ces léxicas':' léxica'));
  if(_adrepHits>0) _capaParts.push(_adrepHits+' término'+(_adrepHits>1?'s':'')+' ADREP'+(topAdrep?' ('+topAdrep+')':''));
  if(_nbEntry) _capaParts.push('Naive Bayes ('+_nbEntry.peso+')');
  if(_faseDetectada&&_FASE_WEIGHTS[_faseDetectada]&&_FASE_WEIGHTS[_faseDetectada][top[0]]) _capaParts.push('boost fase "'+_faseDetectada+'"');
  const _topCapas=_capaParts.length?_capaParts.join(' · '):'score combinado de múltiples capas';

  const result={
    categoria:top[0],
    confianza:conf,
    _tiebreaker,
    _topCapas,
    alternativas:sorted.slice(1,4).filter(e=>e[1]>0).map(([c,sc])=>({cat:c,prob:Math.min(0.85,sc/total)})),
    _trazas,
    _scoreDetalle:Object.fromEntries(sorted.filter(e=>e[1]>0))
  };
  if(topAdrep) result.adrep=topAdrep; // Código ADREP detectado (ej: "SEC","GCOL","WILD")
  return result;
}

module.exports = { clasificar };
