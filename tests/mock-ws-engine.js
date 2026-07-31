#!/usr/bin/env node
'use strict';
/**
 * SafetyOps — Mock WebSocket Engine
 * ===================================
 * Simula exactamente el protocolo que usa SafetyOps_v2.html al conectarse al server.
 * Usa el mismo analysis-engine module para procesar los reportes.
 *
 * Uso:
 *   node tests/mock-ws-engine.js
 *
 * Propósito: permite correr la comparación WS vs LOCAL sin necesitar un browser.
 * El mock implementa el mismo handshake y flujo de mensajes que _initApiWS()
 * en SafetyOps_v2.html, líneas 18959-19200.
 */

const { WebSocket } = require('ws');
const engine = require('../analysis-engine');

const SERVER_WS   = process.env.SERVER_WS   || 'ws://localhost:3001';
const ENGINE_SECRET = process.env.ENGINE_SECRET || null;
const RECONNECT_DELAY = 2000;

let _nextId = 1;
let _ws     = null;
let _connected = false;

function log(msg, data) {
  const ts = new Date().toISOString().slice(11, 23);
  if (data !== undefined) {
    console.log('[mock-ws-engine ' + ts + '] ' + msg, data);
  } else {
    console.log('[mock-ws-engine ' + ts + '] ' + msg);
  }
}

function connect() {
  log('Conectando a ' + SERVER_WS + ' …');
  _ws = new WebSocket(SERVER_WS);

  _ws.on('open', () => {
    log('WS abierto');
    // Replicar exactamente el comportamiento de _initApiWS() open handler:
    // Si hay ENGINE_SECRET, enviar auth como primer mensaje.
    if (ENGINE_SECRET) {
      const authMsg = JSON.stringify({ type: 'auth', secret: ENGINE_SECRET });
      _ws.send(authMsg);
      log('Auth enviado');
    }
    _connected = true;
    log('Mock engine LISTO — esperando reportes del server');
  });

  _ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { log('JSON parse error', e.message); return; }

    // Replicar exactamente el switch de mensajes de _initApiWS() message handler:
    switch (msg.type) {

      case 'auth_ok':
        log('auth_ok recibido');
        break;

      case 'ping':
        // Responder pong de application-level (igual que SafetyOps_v2.html)
        _ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'pong':
        break;

      case 'report': {
        // El server envió un reporte para analizar.
        // Replicar exactamente _handleApiReport() de SafetyOps_v2.html:
        const { correlationId, payload } = msg;
        if (!correlationId || !payload) {
          log('Mensaje report sin correlationId o payload', msg);
          break;
        }

        log('Procesando reporte correlationId=' + correlationId + ' área=' + (payload.area || '—'));

        let result;
        try {
          result = engine.analyzeReport({
            texto:     payload.texto,
            area:      payload.area,
            identidad: payload.identidad || 'anonimo',
            lang:      payload.lang || 'es',
            nextId:    _nextId++,
            timestamp: payload.timestamp || new Date().toISOString(),
            geo:       payload.geo || null,
          });
        } catch (err) {
          log('ERROR en analyzeReport:', err.message);
          // Replicar el error path de _handleApiReport()
          _ws.send(JSON.stringify({
            correlationId,
            error: err.message,
          }));
          break;
        }

        // Enviar resultado de vuelta al server.
        // El servidor espera { correlationId, result } — NO "payload".
        // Ver safetyops-server.js línea 446: const { correlationId, result, error } = msg;
        _ws.send(JSON.stringify({
          correlationId,
          result,
        }));
        log('Resultado enviado folio=' + result.folio + ' cat=' + result.categoria);
        break;
      }

      default:
        log('Mensaje desconocido tipo=' + msg.type);
    }
  });

  _ws.on('close', (code, reason) => {
    _connected = false;
    log('WS cerrado code=' + code + ' reason=' + (reason ? reason.toString() : '—') + ' — reconectando en ' + RECONNECT_DELAY + 'ms');
    setTimeout(connect, RECONNECT_DELAY);
  });

  _ws.on('error', err => {
    log('WS error:', err.message);
    // close event se disparará después y manejará la reconexión
  });
}

// Señal para terminar limpiamente
process.on('SIGINT',  () => { log('SIGINT — cerrando'); if (_ws) _ws.close(); process.exit(0); });
process.on('SIGTERM', () => { log('SIGTERM — cerrando'); if (_ws) _ws.close(); process.exit(0); });

connect();
