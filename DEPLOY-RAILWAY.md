# SafetyOps Server — Deploy Railway (Producción)
**Estado:** Listo para producción · Equivalencia validada 50/50 (100%)  
**Fecha de validación:** 2026-07-31

---

## Variables de entorno en Railway

Ve a tu proyecto Railway → **Variables** y configura exactamente esto:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `USE_LOCAL_ENGINE` | `true` | Motor IA en-proceso. **No requerir browser.** |
| `COMPARE_MODE` | `false` | Modo producción. Sin overhead de comparación. |
| `ENGINE_SECRET` | `<genera abajo>` | Secreto para conexiones WebSocket (fallback) |
| `CORS_ORIGIN` | `https://<tu-app>.netlify.app` | Origen permitido para CORS |

> `PORT` es asignado automáticamente por Railway — no lo configures.

### Generar ENGINE_SECRET
```bash
openssl rand -hex 32
```
Ejemplo de output: `a3f8c2d1e4b7...` (64 caracteres hexadecimales)

### CORS_ORIGIN con múltiples dominios
```
CORS_ORIGIN=https://safetyops.netlify.app,https://www.safetyops.app
```

---

## Pasos de deploy

### 1. Conectar repositorio
- Railway → New Project → Deploy from GitHub repo
- Seleccionar el repositorio → branch `main`
- Root directory: `safetyops-server/`

### 2. Configurar variables
Copiar exactamente las 4 variables de la tabla anterior.

### 3. Deploy
Railway detecta `railway.toml` automáticamente. El build instala dependencias con `npm install` y arranca con `node safetyops-server.js`.

### 4. Verificar arranque
En los logs de Railway debes ver:
```
[engine] Local analysis-engine loaded OK — USE_LOCAL_ENGINE=true COMPARE_MODE=false
[API] SafetyOps API Server v1.1.0
[API] Listening on http://localhost:<PORT>
[API] ENGINE_SECRET: ✅ set (64 chars)
[API] CORS_ORIGIN:   https://<tu-app>.netlify.app
[API] Keepalive:     ping every 30s, timeout at 90s
[API] Routes: GET /api/v1/health  GET /api/v1/config  POST /api/v1/reports
[API] Open SafetyOps_v2.html in a browser to activate the engine.
```
> El mensaje final es informativo — con USE_LOCAL_ENGINE=true el browser NO es necesario.

### 5. Smoke test de producción
```bash
# Health check
curl https://<tu-railway-url>/api/v1/health

# Respuesta esperada:
# {"status":"ok","version":"1.1.0","engine":"disconnected","uptime":...}
# NOTA: engine="disconnected" es CORRECTO con USE_LOCAL_ENGINE=true
# (el WS no está conectado pero el motor local sí está activo)

# Test de análisis
curl -X POST https://<tu-railway-url>/api/v1/reports \
  -H 'Content-Type: application/json' \
  -d '{"texto":"El avion impacto con un ave durante el despegue y la tripulacion aborto la carrera","area":"Operaciones de Vuelo","identidad":"anonimo"}'

# Respuesta esperada:
# {"folio":"OCC-1001","categoria":"Bird Strike","nivel_riesgo":"Medio","severidad":2,...}
```

### 6. Actualizar URL en SafetyOps_Mobile.html
Asegurarse que la variable de API URL apunte al dominio Railway de producción.

---

## Flujo E2E en producción

```
Usuario escanea QR
       ↓
SafetyOps_Mobile.html (Netlify)
       ↓  POST /api/v1/reports
SafetyOps-Server (Railway)
       ↓  engine.analyzeReport() — EN PROCESO
analysis-engine/ (Node.js, mismo proceso)
       ↓
Respuesta JSON al mobile
       ↓
Usuario ve: folio + categoría + nivel de riesgo
```

**SafetyOps_v2.html NO interviene en este flujo.**  
Se mantiene disponible como plataforma de gestión y como fallback WS (si en el futuro se necesita volver al modo bridge).

---

## Rollback (si es necesario)

Para volver al modo WebSocket en emergencia:
```
USE_LOCAL_ENGINE=false   # en variables Railway
```
Redeploy → el server vuelve al puente WS y requiere SafetyOps_v2.html conectado.

---

## Checklist final

```
✅ analysis-engine validado — 50/50 sin errores
✅ Equivalencia 100% — 50/50 casos idénticos (WS vs LOCAL)
✅ USE_LOCAL_ENGINE=true  (default de producción)
✅ COMPARE_MODE=false     (default de producción)
✅ lang propagado en payload WS (corrección aplicada 2026-07-31)
✅ Código WebSocket preservado (fallback disponible)
✅ railway.toml configurado
⬜ Variables configuradas en panel Railway
⬜ Deploy exitoso y logs verificados
⬜ Smoke test con URL de producción pasado
⬜ SafetyOps_Mobile.html apuntando a URL Railway de producción
⬜ Flujo E2E QR → Mobile → Railway → respuesta validado en producción
```
