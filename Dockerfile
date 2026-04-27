# ══════════════════════════════════════════════════
# BIACP Dashboard — Next.js Standalone Production
# ══════════════════════════════════════════════════

FROM node:20-alpine AS builder
WORKDIR /app

# Instalar dependencias
COPY frontend/package*.json ./
RUN npm ci

# Copiar código fuente y compilar
COPY frontend/ .
RUN npm run build

# ── Runner minimalista ──
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copiar artefactos de build standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
