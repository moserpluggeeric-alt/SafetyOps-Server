'use strict';

/**
 * SafetyOps Airport & Sector Database
 * Fuentes: ANAC Argentina, ICAO Doc 7910, yovuelo.com.ar, SKYbrary
 * Cubre aeropuertos argentinos principales + hubs internacionales relevantes.
 */

const AIRPORTS = [
  // ── Argentina ────────────────────────────────────────────────────────────────
  {
    icao: 'SAEZ', iata: 'EZE', name: 'Aeropuerto Internacional Ministro Pistarini',
    city: 'Ezeiza', country: 'AR',
    sectors: [
      'Terminal A — Internacional',
      'Terminal B — Internacional',
      'Terminal C — Cabotaje',
      'Terminal D — Low Cost',
      'Plataforma Norte',
      'Plataforma Sur',
      'Pista 11/29',
      'Pista 17/35',
      'Torre de Control',
      'Centro de Operaciones',
      'Área de Carga',
      'Hangares de Mantenimiento',
      'Servicios de Rampa',
      'Combustible / Planta',
      'Perimetral / Valla',
      'Acceso Vehicular',
    ],
  },
  {
    icao: 'SABE', iata: 'AEP', name: 'Aeropuerto Jorge Newbery',
    city: 'Buenos Aires', country: 'AR',
    sectors: [
      'Terminal Principal',
      'Sala de Embarque Nacional',
      'Sala de Embarque Regional',
      'Plataforma Norte',
      'Plataforma Sur',
      'Pista 13/31',
      'Torre de Control',
      'Área de Combustible',
      'Hangares',
      'Acceso Costanera',
      'Zona de Carga',
    ],
  },
  {
    icao: 'SACO', iata: 'COR', name: 'Aeropuerto Internacional Ingeniero Aeronáutico Ambrosio Taravella',
    city: 'Córdoba', country: 'AR',
    sectors: [
      'Terminal Internacional',
      'Terminal Nacional',
      'Plataforma Principal',
      'Pista 18/36',
      'Torre de Control',
      'Área de Carga',
      'Combustible',
      'Hangares',
    ],
  },
  {
    icao: 'SAME', iata: 'MDZ', name: 'Aeropuerto Internacional El Plumerillo',
    city: 'Mendoza', country: 'AR',
    sectors: [
      'Terminal Principal',
      'Plataforma',
      'Pista 18/36',
      'Torre de Control',
      'Área de Carga',
      'Combustible',
    ],
  },
  {
    icao: 'SARI', iata: 'IGR', name: 'Aeropuerto Internacional Cataratas del Iguazú',
    city: 'Iguazú', country: 'AR',
    sectors: [
      'Terminal Internacional',
      'Terminal Nacional',
      'Plataforma',
      'Pista 08/26',
      'Torre de Control',
    ],
  },
  {
    icao: 'SAWH', iata: 'USH', name: 'Aeropuerto Internacional Malvinas Argentinas',
    city: 'Ushuaia', country: 'AR',
    sectors: [
      'Terminal Principal',
      'Plataforma',
      'Pista 07/25',
      'Torre de Control',
      'Área de Carga',
    ],
  },
  {
    icao: 'SAZR', iata: 'RSA', name: 'Aeropuerto de Santa Rosa',
    city: 'Santa Rosa', country: 'AR',
    sectors: ['Terminal', 'Plataforma', 'Pista 01/19', 'Torre de Control'],
  },
  {
    icao: 'SASA', iata: 'SLA', name: 'Aeropuerto Internacional Martín Miguel de Güemes',
    city: 'Salta', country: 'AR',
    sectors: [
      'Terminal Internacional',
      'Terminal Nacional',
      'Plataforma',
      'Pista 02/20',
      'Torre de Control',
      'Área de Carga',
    ],
  },
  {
    icao: 'SANT', iata: 'TUC', name: 'Aeropuerto Internacional Teniente Benjamín Matienzo',
    city: 'Tucumán', country: 'AR',
    sectors: ['Terminal', 'Plataforma', 'Pista 10/28', 'Torre de Control'],
  },
  {
    icao: 'SARC', iata: 'RES', name: 'Aeropuerto Internacional Juan José Castelli',
    city: 'Resistencia', country: 'AR',
    sectors: ['Terminal', 'Plataforma', 'Pista 02/20', 'Torre de Control'],
  },
  {
    icao: 'SARF', iata: 'FMA', name: 'Aeropuerto Internacional El Pucú',
    city: 'Formosa', country: 'AR',
    sectors: ['Terminal', 'Plataforma', 'Pista', 'Torre de Control'],
  },
  {
    icao: 'SAVV', iata: 'VDM', name: 'Aeropuerto Gobernador Castello',
    city: 'Viedma', country: 'AR',
    sectors: ['Terminal', 'Plataforma', 'Pista', 'Torre de Control'],
  },
  {
    icao: 'SAVC', iata: 'CRD', name: 'Aeropuerto Internacional General Enrique Mosconi',
    city: 'Comodoro Rivadavia', country: 'AR',
    sectors: ['Terminal', 'Plataforma', 'Pista 07/25', 'Torre de Control', 'Área de Carga'],
  },
  {
    icao: 'SAWG', iata: 'RGL', name: 'Aeropuerto Internacional Piloto Civil Norberto Fernández',
    city: 'Río Gallegos', country: 'AR',
    sectors: ['Terminal', 'Plataforma', 'Pista 07/25', 'Torre de Control'],
  },
  // ── Regionales / Uruguay ─────────────────────────────────────────────────────
  {
    icao: 'SUMU', iata: 'MVD', name: 'Aeropuerto Internacional de Carrasco',
    city: 'Montevideo', country: 'UY',
    sectors: [
      'Terminal Internacional',
      'Terminal Nacional',
      'Plataforma',
      'Pista 07/25',
      'Torre de Control',
      'Área de Carga',
    ],
  },
  {
    icao: 'SCEL', iata: 'SCL', name: 'Aeropuerto Internacional Arturo Merino Benítez',
    city: 'Santiago', country: 'CL',
    sectors: [
      'Terminal 1',
      'Terminal 2',
      'Plataforma Norte',
      'Plataforma Sur',
      'Pista 17L/35R',
      'Pista 17R/35L',
      'Torre de Control',
      'Área de Carga',
    ],
  },
  {
    icao: 'SBGR', iata: 'GRU', name: 'Aeropuerto Internacional de Guarulhos',
    city: 'São Paulo', country: 'BR',
    sectors: [
      'Terminal 1',
      'Terminal 2',
      'Terminal 3',
      'Plataforma Norte',
      'Plataforma Sur',
      'Pista 09L/27R',
      'Pista 09R/27L',
      'Torre de Control',
      'Área de Carga',
    ],
  },
  // ── Hubs internacionales relevantes ─────────────────────────────────────────
  {
    icao: 'LEMD', iata: 'MAD', name: 'Aeropuerto Adolfo Suárez Madrid-Barajas',
    city: 'Madrid', country: 'ES',
    sectors: [
      'Terminal 1',
      'Terminal 2',
      'Terminal 3',
      'Terminal 4',
      'Terminal 4S',
      'Plataforma T1-T3',
      'Plataforma T4',
      'Pista 14L/32R',
      'Pista 14R/32L',
      'Pista 18L/36R',
      'Pista 18R/36L',
      'Torre de Control',
      'Área de Carga',
    ],
  },
  {
    icao: 'EGLL', iata: 'LHR', name: 'Aeropuerto de Heathrow',
    city: 'Londres', country: 'GB',
    sectors: [
      'Terminal 2',
      'Terminal 3',
      'Terminal 4',
      'Terminal 5',
      'Pista 09L/27R',
      'Pista 09R/27L',
      'Torre de Control',
      'Área de Carga',
    ],
  },
  {
    icao: 'KMIA', iata: 'MIA', name: 'Aeropuerto Internacional de Miami',
    city: 'Miami', country: 'US',
    sectors: [
      'Concourse D',
      'Concourse E',
      'Concourse F',
      'Concourse G',
      'Concourse H',
      'Concourse J',
      'Plataforma Norte',
      'Plataforma Sur',
      'Pista 08L/26R',
      'Pista 08R/26L',
      'Torre de Control',
      'Área de Carga',
    ],
  },
];

/**
 * Search airports by ICAO, IATA, name, or city.
 * Returns up to `limit` results (default 10).
 */
function searchAirports(query, limit) {
  if (!query || query.trim().length < 2) return [];
  const q   = query.trim().toUpperCase();
  const max = Math.min(limit || 10, 50);
  return AIRPORTS.filter(a =>
    a.icao.includes(q) ||
    a.iata.includes(q) ||
    a.name.toUpperCase().includes(q) ||
    a.city.toUpperCase().includes(q)
  ).slice(0, max);
}

/**
 * Get a single airport by ICAO or IATA code.
 */
function getAirport(code) {
  const c = (code || '').trim().toUpperCase();
  return AIRPORTS.find(a => a.icao === c || a.iata === c) || null;
}

module.exports = { AIRPORTS, searchAirports, getAirport };
