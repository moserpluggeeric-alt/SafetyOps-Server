# SafetyOps API Server — Deployment Guide

## Architecture

```
SafetyOps_v2.html (local browser)
    │  outbound WSS connection
    ▼
Cloud Run API Server  ◄──── HTTPS POST ────  SafetyOps_Mobile.html
(public endpoint)                             (Netlify or any browser)
```

SafetyOps runs locally and **initiates** the WebSocket connection outward to Cloud Run.
No port-forwarding, VPN, or tunnel required.

---

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated: `gcloud auth login`
- Docker (only needed if building image locally)
- Node.js 18+ (for local validation)

---

## Local Validation (before deploying)

```bash
cd safetyops-server
npm install
node safetyops-server.js
```

Open `SafetyOps_v2.html` in Chrome. You should see in the terminal:
```
[WS] SafetyOps engine connected
```

Then run the validation suite:
```bash
node validate-local.js
```

All 7 checks must pass before proceeding to deployment.

---

## Step 1 — Generate ENGINE_SECRET

```bash
openssl rand -hex 32
# Example output: a3f9c2e1b4d7...
```

Save this value — you will need it in both Cloud Run and SafetyOps browser.

---

## Step 2 — Deploy to Google Cloud Run

### Option A: Deploy from source (recommended — no Docker build step)

```bash
cd safetyops-server

gcloud run deploy safetyops-api \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --timeout 3600 \
  --set-env-vars "ENGINE_SECRET=YOUR_SECRET_HERE,CORS_ORIGIN=https://your-mobile.netlify.app"
```

### Option B: Build and deploy Docker image

```bash
cd safetyops-server

# Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/safetyops-api

# Deploy
gcloud run deploy safetyops-api \
  --image gcr.io/YOUR_PROJECT_ID/safetyops-api \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --timeout 3600 \
  --set-env-vars "ENGINE_SECRET=YOUR_SECRET_HERE,CORS_ORIGIN=https://your-mobile.netlify.app"
```

After deployment, note the Cloud Run service URL:
```
Service URL: https://safetyops-api-xxxx-uc.a.run.app
```

---

## Step 3 — Configure SafetyOps (one-time, in browser console)

Open `SafetyOps_v2.html` and paste into the browser console (F12 → Console):

```javascript
// Point SafetyOps to your Cloud Run WebSocket endpoint
localStorage.setItem('safetyops-api-ws', 'wss://safetyops-api-xxxx-uc.a.run.app');

// Set the shared authentication secret (must match ENGINE_SECRET on Cloud Run)
localStorage.setItem('safetyops-engine-secret', 'YOUR_SECRET_HERE');

// Verify the settings
console.log('WS URL:', localStorage.getItem('safetyops-api-ws'));
console.log('Secret set:', !!localStorage.getItem('safetyops-engine-secret'));
```

Then reload SafetyOps_v2.html. You should see in the console:
```
[SafetyOps][API-WS] Conectando al API Server — wss://safetyops-api-xxxx-uc.a.run.app
[SafetyOps][API-WS] ✅ Conectado
[SafetyOps][API-WS] Auth enviado
[SafetyOps][API-WS] ✅ Autenticación confirmada por el servidor
```

---

## Step 4 — Configure Mobile Client

Open `SafetyOps_Mobile.html` with the Cloud Run URL:

```
https://your-mobile.netlify.app/SafetyOps_Mobile.html?api=https://safetyops-api-xxxx-uc.a.run.app
```

Or set the default permanently by editing the `getApiBase()` fallback in `SafetyOps_Mobile.html`.

---

## Step 5 — Post-deployment validation

```bash
# Check server health
curl https://safetyops-api-xxxx-uc.a.run.app/api/v1/health

# Expected: {"status":"ok","engine":"connected",...}
# If engine is "disconnected": SafetyOps_v2.html is not open or not authenticated

# Check config endpoint
curl https://safetyops-api-xxxx-uc.a.run.app/api/v1/config

# Submit a test report
curl -X POST https://safetyops-api-xxxx-uc.a.run.app/api/v1/reports \
  -H "Content-Type: application/json" \
  -d '{"texto":"Prueba de validación post-despliegue — indicador de presión hidráulica del tren de aterrizaje con lectura irregular durante el rodaje en pista 29.","area":"Mantenimiento","identidad":"anonimo"}'
```

---

## Environment Variables Reference

| Variable | Required in prod | Default | Description |
|----------|-----------------|---------|-------------|
| `ENGINE_SECRET` | Yes | (none) | Shared secret for WS engine auth. Generate with `openssl rand -hex 32`. |
| `CORS_ORIGIN` | Yes | `*` | Comma-separated allowed origins. Set to your Netlify domain. |
| `PORT` | No | `8080` | Injected automatically by Cloud Run. Do not override. |

---

## Rollback Procedure

### Rollback to previous Cloud Run revision

```bash
# List revisions
gcloud run revisions list --service safetyops-api --region us-central1

# Route 100% traffic to a specific previous revision
gcloud run services update-traffic safetyops-api \
  --region us-central1 \
  --to-revisions REVISION_NAME=100

# Example:
gcloud run services update-traffic safetyops-api \
  --region us-central1 \
  --to-revisions safetyops-api-00001-abc=100
```

### Rollback SafetyOps WS config (revert to local)

```javascript
// In SafetyOps browser console:
localStorage.removeItem('safetyops-api-ws');
localStorage.removeItem('safetyops-engine-secret');
// Reload page — connects to localhost:3001 again
```

### Rollback Mobile Client to localhost

```
file:///path/to/SafetyOps_Mobile.html?api=http://localhost:3001
```

---

## Backup Procedure

### What to back up

SafetyOps stores all data in `localStorage` in the browser tab where it runs.
There is no server-side database. The API Server is stateless.

### Export SafetyOps data

In the SafetyOps browser console:

```javascript
// Export full state as JSON
const state = localStorage.getItem('safetyops_v2_state');
const blob  = new Blob([state], { type: 'application/json' });
const url   = URL.createObjectURL(blob);
const a     = document.createElement('a');
a.href      = url;
a.download  = 'safetyops-backup-' + new Date().toISOString().slice(0,10) + '.json';
a.click();
```

### Restore from backup

```javascript
// In SafetyOps browser console — paste the backup JSON:
const backup = '{"ocurrencias":[...],...}'; // paste your backup content
localStorage.setItem('safetyops_v2_state', backup);
location.reload();
```

### Recommended backup schedule

- Before any deployment
- Weekly automated reminder (can be added as a scheduled task in Cowork)
- Before any SafetyOps_v2.html file update

---

## Cloud Run Configuration Details

| Setting | Value | Reason |
|---------|-------|--------|
| `--min-instances 1` | 1 | Prevents cold starts that would drop the WS connection |
| `--max-instances 1` | 1 | Ensures all HTTP requests reach the instance holding the WS |
| `--timeout 3600` | 3600s | Keeps long-lived WS connections alive (Cloud Run max) |
| `--allow-unauthenticated` | yes | Mobile clients need public access; engine auth via ENGINE_SECRET |

---

## Troubleshooting

**`engine: "disconnected"` on health check**
SafetyOps_v2.html is not open, or the WS connection failed auth (check browser console).

**`engine_timeout` on POST /reports**
SafetyOps_v2.html is open but not processing. Check browser console for JS errors.

**`4001 Auth rejected` in SafetyOps console**
The `safetyops-engine-secret` in localStorage doesn't match `ENGINE_SECRET` on Cloud Run.
Re-run the Step 3 console commands with the correct secret.

**WebSocket disconnects after ~5 minutes**
Keepalive may not be working. Check that SafetyOps_v2.html is the updated version
(v1.1.0 with `_apiWSPingTimer`). Check Cloud Run logs for ping/pong entries.

**CORS error in Mobile Client**
`CORS_ORIGIN` on Cloud Run doesn't include the Mobile Client's origin.
Update via: `gcloud run services update safetyops-api --update-env-vars CORS_ORIGIN=https://new-origin.app`
