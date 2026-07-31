'use strict';
/**
 * SafetyOps — Batería de 50 casos de prueba para validación de equivalencia
 * motor WebSocket (SafetyOps_v2.html) vs motor local (analysis-engine/).
 *
 * Categorías cubiertas:
 *   Bird Strike, FOD, Runway Incursion, Smoke, Fire, Fatiga de Tripulacion,
 *   Factores Humanos, Violencia/Arma, Error Mantenimiento, Error ATC,
 *   Meteorologia, Fauna, Combustible, Cabina, Seguridad Operacional,
 *   CFIT, TCAS RA, Hard Landing, Ground Damage, Mercancias Peligrosas,
 *   Presurizacion, Estela Turbulenta.
 */

const CASES = [

  // ── BIRD STRIKE ────────────────────────────────────────────────────────────
  {
    id: 1, categoria_esperada: 'Bird Strike',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Durante el despegue se produjo un impacto de ave de gran porte contra el motor numero dos. La tripulacion aborto el despegue, redujo potencia y regreso a plataforma. Se detecto dano en las paletas del compresor. Se activo el procedimiento de inspeccion post bird strike.',
  },
  {
    id: 2, categoria_esperada: 'Bird Strike',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'En fase de aproximacion final una bandada de aves impacto contra el radome y parabrisas de la aeronave. El capitan declaro emergencia, solicito prioridad ATC y efectuo aterrizaje de emergencia sin novedad. Se requiere inspeccion estructural completa.',
  },
  {
    id: 3, categoria_esperada: 'Bird Strike',
    area: 'Operaciones de Vuelo', lang: 'en',
    texto: 'Bird strike on both engines shortly after takeoff. Crew declared emergency, performed engine shutdown procedure and diverted to alternate airport. Aircraft sustained significant FOD damage to fan blades. Wildlife control notified.',
  },

  // ── FOD (Foreign Object Damage/Debris) ────────────────────────────────────
  {
    id: 4, categoria_esperada: 'FOD',
    area: 'Operaciones en Tierra', lang: 'es',
    texto: 'Durante la inspeccion pre-vuelo el mecanico detecto un objeto extraño en la pista de rodaje cerca de la aeronave. Se trato de una pieza metalica de aproximadamente 15 cm que pudo haber sido ingerida por el motor. Se retiro el FOD y se realizo inspeccion del area.',
  },
  {
    id: 5, categoria_esperada: 'FOD',
    area: 'Operaciones en Tierra', lang: 'es',
    texto: 'Hallazgo de objeto extraño en pista principal. Personal de mantenimiento informo la presencia de un tornillo de gran tamaño en la zona de umbral. Se suspendio temporalmente la operacion para limpieza de pista. Se investiga el origen del objeto.',
  },

  // ── RUNWAY INCURSION ───────────────────────────────────────────────────────
  {
    id: 6, categoria_esperada: 'Incursión de Pista',
    area: 'Control de Tránsito Aéreo', lang: 'es',
    texto: 'Un vehiculo de mantenimiento ingreso a la pista activa sin autorizacion ATC mientras una aeronave estaba en carrera de despegue. El piloto fue alertado por la torre y aborto el despegue exitosamente. El vehiculo no tenia comunicacion activa con la torre de control.',
  },
  {
    id: 7, categoria_esperada: 'Incursión de Pista',
    area: 'Control de Tránsito Aéreo', lang: 'es',
    texto: 'Incursion de pista por aeronave en rodaje. La aeronave XYZ cruzo el punto de espera sin clearance de torre, coincidiendo con una aeronave en final de aproximacion. ATC emitio go-around inmediato. Se activo el protocolo de investigacion de incursion de pista.',
  },
  {
    id: 8, categoria_esperada: 'Incursión de Pista',
    area: 'Operaciones en Tierra', lang: 'en',
    texto: 'A ground vehicle entered the active runway without ATC clearance while an aircraft was on short final. Tower controller issued immediate go-around instruction. The vehicle operator was unaware of the active runway status. Runway incursion investigation initiated.',
  },

  // ── SMOKE ──────────────────────────────────────────────────────────────────
  {
    id: 9, categoria_esperada: 'Smoke / Fumes',
    area: 'Cabina', lang: 'es',
    texto: 'La tripulacion de cabina reporto olor a humo en la cabina de pasajeros durante el crucero a FL320. El capitan declaro urgencia, inicio descenso de emergencia y activo los procedimientos de humo en cabina. Se utilizo el equipo de proteccion contra humo. El avion aterrizo sin novedad.',
  },
  {
    id: 10, categoria_esperada: 'Smoke / Fumes',
    area: 'Cabina', lang: 'es',
    texto: 'Deteccion de vapores y humo en la bodega delantera. El sistema de deteccion de incendios activo la alarma de bodega. La tripulacion descargo los extintores automaticos. Se declaro emergencia y se efectuo aterrizaje de emergencia prioritario. Se detecto derrame de quimicos en la carga.',
  },

  // ── FIRE ───────────────────────────────────────────────────────────────────
  {
    id: 11, categoria_esperada: 'Engine Fire',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Alarma de incendio en motor izquierdo activada durante el crucero. La tripulacion ejecuto el procedimiento de incendio de motor, apago el motor y descargo el extintor. El incendio fue controlado. Se declaro emergencia y se aterrizo en aeropuerto alternativo.',
  },
  {
    id: 12, categoria_esperada: 'Engine Fire',
    area: 'Operaciones de Vuelo', lang: 'en',
    texto: 'Engine fire warning light illuminated during climb phase. Crew executed engine fire checklist, shut down affected engine and discharged fire bottle. Declared emergency and diverted. Post-landing inspection confirmed fire in engine nacelle, cause under investigation.',
  },
  {
    id: 13, categoria_esperada: 'Smoke / Fumes',
    area: 'Cabina', lang: 'es',
    texto: 'Incendio en el lavabo de la aeronave causado por material inflamable depositado en el cesto de residuos. La azafata detecto el fuego y lo extinguio con el extintor de cabina. Se declaro urgencia y se aterrizo prioritariamente. El pasajero responsable fue identificado.',
  },

  // ── FATIGA DE TRIPULACION ─────────────────────────────────────────────────
  {
    id: 14, categoria_esperada: 'Fatiga de Tripulacion',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'El primer oficial reporto niveles de fatiga elevados al inicio del turno. Habia acumulado mas de 12 horas de servicio en las ultimas 24 horas sin descanso adecuado. El capitan considero continuar la operacion pero el primer oficial solicito ser relevado por somnolencia severa.',
  },
  {
    id: 15, categoria_esperada: 'Fatiga de Tripulacion',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'La tripulacion reporto microsueños durante la fase de crucero nocturno. Ambos pilotos evidenciaron fatiga acumulada por rotacion de turnos irregulares. El sistema ACARS alerto sobre la falta de respuesta en el intervalo reglamentario. Se activo el protocolo de fatiga FRMS.',
  },

  // ── FACTORES HUMANOS ──────────────────────────────────────────────────────
  {
    id: 16, categoria_esperada: 'Factores Humanos',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'El piloto omitio completar el checklist de aproximacion debido a la alta carga de trabajo en el sector terminal. Como resultado, no se verifico la posicion del tren de aterrizaje antes del aterrizaje. Se activo la alarma de configuracion en final.',
  },
  {
    id: 17, categoria_esperada: 'Factores Humanos',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Falla de comunicacion entre capitan y primer oficial durante fase critica del despegue. El capitan tomo una decision unilateral sin consultar al primer oficial. El CRM deficiente llevo a una discrepancia en la lectura de instrumentos que no fue resuelta oportunamente.',
  },
  {
    id: 18, categoria_esperada: 'Factores Humanos',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'El controlador de trafico aereo programo incorrectamente el nivel de vuelo en el sistema al estar distraido por una llamada de coordinacion. El error fue detectado por el piloto al comparar la instruccion recibida con la del ACARS.',
  },
  {
    id: 19, categoria_esperada: 'Factores Humanos',
    area: 'Mantenimiento', lang: 'es',
    texto: 'Tecnico de mantenimiento instalo un filtro de aceite incorrecto por confusion entre numeros de parte similares. El error fue detectado en la inspeccion de doble verificacion antes del vuelo. Se atribuye al estado de presion y apuro del personal por el retraso operacional.',
  },
  {
    id: 20, categoria_esperada: 'Factores Humanos',
    area: 'Cabina', lang: 'es',
    texto: 'La azafata senior no brindo el briefing de seguridad obligatorio antes del despegue por distraccion con situacion de pasajero conflictivo. El incidente fue reportado por otro miembro de la tripulacion de cabina. Se identifica falla en supervision y CRM de cabina.',
  },

  // ── VIOLENCIA / ARMA ──────────────────────────────────────────────────────
  {
    id: 21, categoria_esperada: 'Seguridad Aeroportuaria',
    area: 'Seguridad Aeroportuaria', lang: 'es',
    texto: 'Pasajero perturbador y violento en cabina durante el vuelo. El individuo agredio fisicamente a otro pasajero y amenazo a la tripulacion de cabina. Se aplicaron restricciones fisicas. El capitan declaro urgencia, solicito presencia policial en destino. El agresor fue detenido al aterrizaje.',
  },
  {
    id: 22, categoria_esperada: 'Seguridad Aeroportuaria',
    area: 'Seguridad Aeroportuaria', lang: 'es',
    texto: 'Amenaza de bomba recibida por la torre de control afectando a la aeronave en aproximacion. Se activo el protocolo de amenaza de bomba. La aeronave fue desviada a aeropuerto alternativo. Se realizo inspeccion completa de seguridad sin hallazgo de artefacto.',
  },
  {
    id: 23, categoria_esperada: 'Seguridad Aeroportuaria',
    area: 'Seguridad Aeroportuaria', lang: 'es',
    texto: 'Deteccion de arma de fuego en equipaje de mano durante control de seguridad. El pasajero fue retenido por fuerzas de seguridad. La aeronave fue demorada para inspeccion de seguridad completa. Se inicio proceso legal correspondiente.',
  },

  // ── ERROR MANTENIMIENTO ────────────────────────────────────────────────────
  {
    id: 24, categoria_esperada: 'Falla Técnica',
    area: 'Mantenimiento', lang: 'es',
    texto: 'Falla del sistema hidraulico principal durante el vuelo atribuida a la instalacion incorrecta de una manguera hidraulica en el ultimo servicio de mantenimiento. El mecánico no siguio el procedimiento del manual de mantenimiento aprobado. Se activo el sistema hidraulico de respaldo.',
  },
  {
    id: 25, categoria_esperada: 'Falla Técnica',
    area: 'Mantenimiento', lang: 'es',
    texto: 'Error de mantenimiento en el sistema de oxigeno de la tripulacion. La mascara del piloto no funciono correctamente por una conexion invertida durante el mantenimiento programado. El error se descubrio en la inspeccion pre-vuelo del siguiente dia.',
  },
  {
    id: 26, categoria_esperada: 'Falla Técnica',
    area: 'Mantenimiento', lang: 'es',
    texto: 'Inspeccion de mantenimiento omitida en el sistema de frenos principales. El tecnico no registro la inspeccion en el libro de mantenimiento y la aeronave opero sin la verificacion obligatoria. Los frenos mostraron desgaste excesivo detectado en la siguiente inspeccion programada.',
  },

  // ── ERROR ATC ──────────────────────────────────────────────────────────────
  {
    id: 27, categoria_esperada: 'Error ATC',
    area: 'Control de Tránsito Aéreo', lang: 'es',
    texto: 'El controlador de trafico aereo autorizo dos aeronaves al mismo nivel de vuelo en la misma ruta generando un conflicto de separacion. El TCAS de ambas aeronaves activo las alertas de resolucion RA. Ambas tripulaciones siguieron las instrucciones del TCAS.',
  },
  {
    id: 28, categoria_esperada: 'Error ATC',
    area: 'Control de Tránsito Aéreo', lang: 'es',
    texto: 'Instruccion erronea de ATC envio a la aeronave a un nivel de vuelo ocupado por otra aeronave. La separacion minima reglamentaria fue violada. El error fue detectado por el supervisor del centro de control y la situacion fue resuelta sin incidente.',
  },
  {
    id: 29, categoria_esperada: 'Error ATC',
    area: 'Control de Tránsito Aéreo', lang: 'es',
    texto: 'El controlador autorizo el despegue de una aeronave sin verificar que la pista estuviera libre. Otra aeronave se encontraba aun en la pista en proceso de vaciar la misma. Se emitio orden de aborto de despegue a tiempo. Distancia de separacion critica.',
  },

  // ── METEOROLOGIA ───────────────────────────────────────────────────────────
  {
    id: 30, categoria_esperada: 'Turbulencia',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'La aeronave experimento turbulencia severa a FL370 sin previo aviso por turbulencia en aire claro CAT. Tres pasajeros que no tenian el cinturon de seguridad abrochado sufrieron lesiones leves. El capitan activo la alerta de cinturones y reporto el area de turbulencia.',
  },
  {
    id: 31, categoria_esperada: 'Turbulencia',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Viento cizallante severo en aproximacion final causo perdida de velocidad de mas de 25 nudos. El piloto efectuo go-around inmediato. Se reporto el fenomeno meteorologico al ATIS. Otras aeronaves fueron alertadas sobre la condicion de wind shear.',
  },
  {
    id: 32, categoria_esperada: 'Turbulencia',
    area: 'Operaciones de Vuelo', lang: 'en',
    texto: 'Severe icing conditions encountered during cruise at FL280. Ice accumulation exceeded aircraft certification limits. Anti-ice systems were activated but insufficient. Aircraft diverted to nearest airport. PIREP filed for other traffic.',
  },

  // ── FAUNA / WILDLIFE ──────────────────────────────────────────────────────
  {
    id: 33, categoria_esperada: 'Bird Strike',
    area: 'Operaciones en Tierra', lang: 'es',
    texto: 'Coyote detectado en pista principal durante las operaciones nocturnas. El controlador de pista ordeno la suspension de movimientos hasta el retiro del animal. Servicio de control de fauna activado. El animal fue retirado sin incidentes. Se reviso el protocolo de control de fauna.',
  },
  {
    id: 34, categoria_esperada: 'Bird Strike',
    area: 'Operaciones en Tierra', lang: 'es',
    texto: 'Presencia de bandada de aves en area de maniobras reportada por tripulacion de aeronave en rodaje. Se activo el sistema de disuasion acustica. Las operaciones continuaron con monitoreo intensificado. Se reporto el hallazgo al responsable de fauna aeroportuaria.',
  },

  // ── COMBUSTIBLE ────────────────────────────────────────────────────────────
  {
    id: 35, categoria_esperada: 'Falla Técnica',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Error en el calculo de combustible para el vuelo. El despachador utilizo un factor de conversion incorrecto resultando en un deficit de combustible de 800 kg. El piloto detecto la discrepancia al cruzar los datos de la hoja de despacho con el indicador de combustible.',
  },
  {
    id: 36, categoria_esperada: 'Falla Técnica',
    area: 'Mantenimiento', lang: 'es',
    texto: 'Contaminacion de combustible detectada durante la inspeccion pre-vuelo. El operador de reabastecimiento cargo combustible de tipo incorrecto en el deposito principal. La aeronave fue puesta fuera de servicio hasta completar el proceso de drenaje y recarga.',
  },

  // ── CABINA ─────────────────────────────────────────────────────────────────
  {
    id: 37, categoria_esperada: 'Factores Humanos',
    area: 'Cabina', lang: 'es',
    texto: 'Evacuacion de emergencia iniciada por decision unilateral de una azafata sin coordinacion con el capitan. La azafata abrio la puerta de emergencia y activo el tobogan antes de recibir la orden de evacuacion. Tres pasajeros resultaron con lesiones leves durante el descenso por tobogan.',
  },
  {
    id: 38, categoria_esperada: 'Falla Técnica',
    area: 'Cabina', lang: 'es',
    texto: 'Falla del sistema de mascaras de oxigeno en la cabina de pasajeros. Al efectuarse la prueba obligatoria del sistema, doce mascaras del sector central no desplegaron correctamente. Se requirio mantenimiento inmediato antes de la siguiente operacion.',
  },

  // ── SEGURIDAD OPERACIONAL ─────────────────────────────────────────────────
  {
    id: 39, categoria_esperada: 'Seguridad Aeroportuaria',
    area: 'Seguridad Aeroportuaria', lang: 'es',
    texto: 'Acceso no autorizado al area de plataforma por persona sin credencial. El individuo ingreso a traves de una puerta de servicio dejada sin seguro por personal de limpieza. La camara de vigilancia detecto el ingreso y la seguridad intervino. Se reviso el protocolo de control de accesos.',
  },
  {
    id: 40, categoria_esperada: 'Mercancías Peligrosas',
    area: 'Despacho', lang: 'es',
    texto: 'Carga de mercancias peligrosas clase 3 lquidos inflamables transportada sin la documentacion reglamentaria correspondiente. El error fue detectado en la inspeccion de bodega antes del cierre de puertas. La carga fue retirada del vuelo y el agente de carga fue notificado.',
  },
  {
    id: 41, categoria_esperada: 'Mercancías Peligrosas',
    area: 'Despacho', lang: 'es',
    texto: 'Pasajero intento embarcar con baterias de litio de alta capacidad no declaradas ocultas en su equipaje de bodega. El sistema de rayos X detecto los articulos. Las baterias fueron retiradas por exceder los limites permitidos de transporte de mercancias peligrosas.',
  },

  // ── CFIT ───────────────────────────────────────────────────────────────────
  {
    id: 42, categoria_esperada: 'CFIT',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Alarma GPWS activada en aproximacion al aeropuerto de montana. La aeronave descendio por debajo de la trayectoria de planeo segura en condiciones de baja visibilidad. El capitan ejecuto inmediatamente el procedimiento de escape por GPWS. El terreno fue evitado por margen minimo.',
  },
  {
    id: 43, categoria_esperada: 'CFIT',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Alerta de proximidad al terreno TAWS activada durante el descenso nocturno. El equipo de vuelo no identifico oportunamente el obstaculo en la carta de aproximacion. La tripulacion actuo siguiendo el procedimiento GPWS y evito el terreno. Se inicia investigacion por aproximacion no estabilizada.',
  },

  // ── TCAS RA ────────────────────────────────────────────────────────────────
  {
    id: 44, categoria_esperada: 'TCAS RA',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'El sistema TCAS emitio una alerta de resolucion RA de descenso durante el crucero. La tripulacion siguio las instrucciones del TCAS y descendio 500 pies. La aeronave conflictiva no respondio al RA coordinado y la separacion minima fue violada brevemente.',
  },
  {
    id: 45, categoria_esperada: 'TCAS RA',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Activacion de TCAS RA en zona de alta densidad de trafico. La aeronave recibio instruccion de ascenso del TCAS mientras ATC habia emitido una instruccion de descenso. La tripulacion siguio correctamente al TCAS sobre la instruccion ATC segun los procedimientos.',
  },

  // ── HARD LANDING ───────────────────────────────────────────────────────────
  {
    id: 46, categoria_esperada: 'Hard Landing',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Aterrizaje brusco con tasa de descenso superior a 600 pies por minuto al tocar pista. El sistema de registro de datos de vuelo indico una carga en el tren superior al limite aprobado. La aeronave fue retirada de servicio para inspeccion de tren de aterrizaje y estructura.',
  },

  // ── GROUND DAMAGE ──────────────────────────────────────────────────────────
  {
    id: 47, categoria_esperada: 'Ground Damage',
    area: 'Operaciones en Tierra', lang: 'es',
    texto: 'El tractor de remolque colisiono con el tren de nariz de la aeronave durante la operacion de pushback. El operador del tractor realizo una maniobra incorrecta. Se produjo dano estructural en el varillaje del tren de nariz. La aeronave fue puesta fuera de servicio.',
  },

  // ── PRESURIZACIÓN ──────────────────────────────────────────────────────────
  {
    id: 48, categoria_esperada: 'Presurización',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'Falla del sistema de presurizacion durante el crucero a FL380. La presion de cabina descendio por debajo del minimo reglamentario. La tripulacion ejecuto el descenso de emergencia a FL100 y activo las mascaras de oxigeno. Todos los pasajeros y tripulantes resultaron ilesos.',
  },

  // ── ESTELA TURBULENTA ─────────────────────────────────────────────────────
  {
    id: 49, categoria_esperada: 'Estela Turbulenta',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'La aeronave experimento una perturbacion severa causada por la estela turbulenta de un avion pesado que habia aterrizado dos minutos antes en la misma pista. La separacion de estela aplicada resulto insuficiente para las condiciones meteorologicas del momento.',
  },

  // ── UNSTABLE APPROACH ─────────────────────────────────────────────────────
  {
    id: 50, categoria_esperada: 'Factores Humanos',
    area: 'Operaciones de Vuelo', lang: 'es',
    texto: 'La tripulacion continuo una aproximacion inestable por debajo del gate de estabilizacion a 1000 pies en IMC. La velocidad era excesiva y el perfil de descenso estaba por encima de la trayectoria de planeo. El go-around no fue ejecutado a pesar de que los criterios de estabilizacion no se cumplian.',
  },

];

module.exports = { CASES };
