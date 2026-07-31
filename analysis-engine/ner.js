'use strict';
// ── NER — nerExtract() ────────────────────────────────────────────────────────
// Extraído sin modificaciones de SafetyOps_v2.html líneas 4710-4726

function nerExtract(text){
  const e={};
  // MEJORA 13-1: Matrículas internacionales (LV-XXX AR, N-xxxx EEUU, EC-xxx España, PR-xxx Brasil, CC-xxx Chile, etc.)
  const _matRegex=/\b(LV-[A-Z]{3}|LQ-[A-Z]{3}|N[1-9][0-9]{2,4}[A-Z]{0,2}|G-[A-Z]{4}|EC-[A-Z]{3}|CC-[A-Z]{3}|PR-[A-Z]{3}|OB-[A-Z0-9]{3,4}|HK-[0-9]{4}[A-Z]?|YV-[0-9]{3}[A-Z]{2}|CP-[0-9]{4}|CX-[A-Z]{3}|PP-[A-Z]{3}|PT-[A-Z]{3}|OY-[A-Z]{3}|PH-[A-Z]{3}|SE-[A-Z]{3}|OH-[A-Z]{3})\b/i;
  const m=text.match(_matRegex);if(m)e.matricula=m[0].toUpperCase();
  const fl=text.match(/\b([A-Z]{2,3}\s?\d{3,4})\b/i);if(fl&&!/^FL/.test(fl[1]))e.vuelo=fl[1].toUpperCase();
  const rwy=text.match(/pista\s+(\d{1,2}[LRC]?)/i);if(rwy)e.pista=rwy[1].toUpperCase();
  const alt=text.match(/(\d{3,5})\s*ft/i);if(alt)e.altitud=alt[1]+"ft";
  const flv=text.match(/FL\s*(\d{2,3})/i);if(flv)e.nivelVuelo="FL"+flv[1];
  const fases=["ascenso","descenso","aproximación","aterrizaje","despegue","crucero","rodaje"];
  for(const f of fases)if(text.toLowerCase().includes(f)){e.fase=f;break}
  const meteo=[];
  if(/VMC/i.test(text))meteo.push("VMC");if(/IMC/i.test(text))meteo.push("IMC");
  if(/turbulencia/i.test(text))meteo.push("Turbulencia");if(/lluvia/i.test(text))meteo.push("Lluvia");
  if(/niebla/i.test(text))meteo.push("Niebla");if(meteo.length)e.meteo=meteo;
  return e
}

module.exports = { nerExtract };
