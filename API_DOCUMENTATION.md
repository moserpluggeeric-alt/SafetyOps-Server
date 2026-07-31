# SafetyOps API v1 — Complete Reference

**Base URL (local):** `http://localhost:3001`  
**Base URL (production):** `https://api.safetyops.app` *(future)*  
**Version prefix:** `/api/v1/`  
**Protocol:** HTTP/1.1 + JSON  
**Authentication:** None (v1 — open to local network). Future: Bearer token.

---

## Architectural Decision Log

### ADR-001 — Versioned paths from day one
All routes are prefixed `/api/v1/`. When breaking changes are needed, `/api/v2/` is introduced. Existing clients on v1 continue to work. The mobile client hardcodes `/api/v1/` and is never forced to update unless it chooses to adopt new features.

### ADR-002 — WebSocket bridge pattern (transitional)
SafetyOps runs in a browser tab and cannot listen for HTTP connections. The API Server acts as a bridge: it receives HTTP requests and forwards them to the SafetyOps browser tab via WebSocket. When the SafetyOps engine moves to a Node.js backend, the WebSocket bridge is removed and the HTTP routes call the engine directly. **The HTTP contract — paths, request bodies, response schemas — is identical in both cases. No client changes required.**

### ADR-003 — Business logic stays in SafetyOps
The API Server validates only: required fields, types, and length limits. Classification, ARMS risk matrix, pattern detection, KPI updates — everything runs inside SafetyOps_v2.html. The API layer is a pure communication pipe.

### ADR-004 — Correlation ID pattern
Every request forwarded to SafetyOps carries a UUID (`correlationId`). The response from SafetyOps carries the same ID, allowing the server to match it to the waiting HTTP response without shared state.

### ADR-005 — 30s engine timeout with 503
If SafetyOps doesn't process and respond within 30 seconds, the API returns HTTP 503 with `retry_after: 5`. The mobile client should surface a clear message and allow retry.

### ADR-006 — API_BASE_URL is the only migration variable
The mobile client configures its target via a single constant `API_BASE`. Migrating from localhost to a cloud server requires changing only that value (or the `?api=` URL parameter). All request/response shapes are unchanged.

---

## Endpoints

---

### GET /api/v1/health

Health check. Returns current engine connection status.

**Request**
```
GET /api/v1/health
```
No body, no parameters.

**Response 200 — OK**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "engine": "connected",
  "uptime": 3600,
  "timestamp": "2026-07-29T23:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Always `"ok"` when server is running |
| `version` | string | API server version |
| `engine` | string | `"connected"` if SafetyOps WS is active, `"disconnected"` otherwise |
| `uptime` | number | Server uptime in seconds |
| `timestamp` | string | ISO 8601 UTC |

**engine = "disconnected"** means SafetyOps_v2.html is not open. POST /reports will return 503 until SafetyOps connects.

---

### GET /api/v1/config

Returns public configuration. Mobile client uses this to populate the area selector and stay in sync with SafetyOps configuration.

**Request**
```
GET /api/v1/config
```
No body, no parameters.

**Response 200 — OK**
```json
{
  "version": "1.0.0",
  "api_version": "v1",
  "areas": [
    "Operaciones de Vuelo",
    "Mantenimiento",
    "Operaciones en Tierra",
    "Cabina",
    "Despacho",
    "Control de Tránsito Aéreo",
    "Seguridad Aeroportuaria",
    "Otro"
  ],
  "identidades": ["anonimo", "usuario"],
  "max_texto_length": 10000,
  "engine_connected": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `areas` | string[] | Operational areas for the report form selector |
| `identidades` | string[] | Valid identity values for POST /reports |
| `max_texto_length` | number | Maximum characters allowed in `texto` |
| `engine_connected` | boolean | Whether SafetyOps is currently connected |

---

### POST /api/v1/reports

Submit a safety occurrence report. The API Server validates the request, forwards it to the SafetyOps engine for classification and storage, and returns the triage result.

**Request**
```
POST /api/v1/reports
Content-Type: application/json
```

**Request body**
```json
{
  "texto": "Durante el preflight detecté que el indicador de presión hidráulica del tren de aterrizaje mostraba lectura irregular...",
  "area": "Mantenimiento",
  "identidad": "anonimo",
  "usuario_id": null,
  "geo": {
    "lat": -34.5592,
    "lon": -58.4156,
    "acc": 15
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `texto` | string | ✓ | Report description. Min 10 chars, max 10,000 chars. |
| `area` | string | ✓ | Operational area. Must be one of the values in `/config.areas`. |
| `identidad` | string | — | `"anonimo"` (default) or `"usuario"`. |
| `usuario_id` | string\|null | — | User ID if identidad is `"usuario"`. Currently informational only. |
| `geo` | object\|null | — | Geolocation at time of report. |
| `geo.lat` | number | — | Latitude (decimal degrees). |
| `geo.lon` | number | — | Longitude (decimal degrees). |
| `geo.acc` | number | — | Accuracy radius in meters. |

**Response 200 — Report accepted and processed**
```json
{
  "folio": "OCC-1043",
  "categoria": "Falla Técnica",
  "nivel_riesgo": "Medio",
  "severidad": 3,
  "probabilidad": 2,
  "hazards": [
    "Mantenimiento",
    "Confiabilidad de sistemas",
    "Detección de falla"
  ],
  "confianza": 0.82,
  "requiere_validacion": false,
  "recomendaciones": [],
  "timestamp": "2026-07-29T23:15:42.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `folio` | string | Unique occurrence identifier assigned by SafetyOps (e.g. `"OCC-1043"`) |
| `categoria` | string | ICAO/ADREP hazard category assigned by the classifier |
| `nivel_riesgo` | string | ARMS risk level: `"Bajo"`, `"Medio"`, `"Alto"`, or `"Crítico"` |
| `severidad` | number | ARMS severity 1–5 |
| `probabilidad` | number | ARMS probability 1–5 |
| `hazards` | string[] | Identified hazards associated with the category |
| `confianza` | number | Classifier confidence 0.0–1.0 |
| `requiere_validacion` | boolean | True if GSO manual review is required (low confidence or high risk) |
| `recomendaciones` | string[] | Safety recommendations (future — empty in v1) |
| `timestamp` | string | ISO 8601 UTC when report was processed |

**Response 400 — Validation error**
```json
{
  "error": "validation_error",
  "fields": ["texto must be at least 10 characters", "area is required"]
}
```

**Response 400 — Invalid JSON**
```json
{
  "error": "invalid_json",
  "message": "Request body must be valid JSON"
}
```

**Response 503 — Engine unavailable**
```json
{
  "error": "engine_unavailable",
  "message": "SafetyOps is not connected. Open SafetyOps_v2.html and try again.",
  "retry_after": 5
}
```

**Response 503 — Engine timeout**
```json
{
  "error": "engine_timeout",
  "message": "SafetyOps did not respond in 30s. Try again.",
  "retry_after": 10
}
```

**Response 404 — Unknown route**
```json
{
  "error": "not_found",
  "message": "No route: GET /api/v1/unknown"
}
```

---

## HTTP Status Code Reference

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Request processed successfully |
| 204 | No Content | CORS preflight response |
| 400 | Bad Request | Validation error or invalid JSON |
| 404 | Not Found | Unknown route |
| 503 | Service Unavailable | SafetyOps not connected, or engine timed out |
| 500 | Internal Server Error | Unexpected server error |

---

## CORS

The server responds to all origins (`Access-Control-Allow-Origin: *`) in v1 for local development. In production, this should be restricted to the mobile client's domain.

---

## WebSocket Protocol (internal — server ↔ SafetyOps)

This is an internal protocol between the API Server and SafetyOps_v2.html. It is **not** part of the public API contract and will be removed when the engine moves to the backend.

**Server → SafetyOps (forward report)**
```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "report",
  "payload": {
    "texto": "...",
    "area": "Mantenimiento",
    "identidad": "anonimo",
    "usuario_id": null,
    "geo": null,
    "timestamp": "2026-07-29T23:15:42.000Z"
  }
}
```

**SafetyOps → Server (result)**
```json
{
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "folio": "OCC-1043",
    "categoria": "Falla Técnica",
    "nivel_riesgo": "Medio",
    "severidad": 3,
    "probabilidad": 2,
    "hazards": ["Mantenimiento", "Confiabilidad de sistemas"],
    "confianza": 0.82,
    "requiere_validacion": false,
    "recomendaciones": [],
    "timestamp": "2026-07-29T23:15:42.000Z"
  }
}
```

---

## Migration Notes

When the SafetyOps engine moves to a Node.js backend (future Phase 3+):

1. The WebSocket bridge in `safetyops-server.js` is replaced by a direct function call to the engine module.
2. The HTTP routes (`/api/v1/reports`, `/api/v1/health`, `/api/v1/config`) are unchanged.
3. The mobile client changes only `API_BASE_URL` — zero changes to request/response code.
4. The internal WebSocket protocol documented above is retired.
