# SafetyOps API Server — Dockerfile
# Build:  docker build -t safetyops-api .
# Run:    docker run -p 3001:8080 -e ENGINE_SECRET=mysecret safetyops-api
# Deploy: gcloud run deploy safetyops-api --source .

FROM node:20-alpine

# Security: run as non-root user
RUN addgroup -S safetyops && adduser -S safetyops -G safetyops

WORKDIR /app

# Install dependencies first (layer cache — only re-runs on package.json change)
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY safetyops-server.js ./

# Switch to non-root user
USER safetyops

# Cloud Run injects PORT — default to 8080
ENV PORT=8080

EXPOSE 8080

# Healthcheck — Cloud Run will also use /api/v1/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/v1/health | grep '"status":"ok"' || exit 1

CMD ["node", "safetyops-server.js"]
