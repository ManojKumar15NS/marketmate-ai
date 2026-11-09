# ==========================================
# Multi-Stage Production Dockerfile for MarketMate AI
# ==========================================

# Stage 1: Build Frontend (Vite + React)
FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build Backend (TypeScript + Node 22)
FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# Stage 3: Minimal Production Runtime
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies for server
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production && npm cache clean --force

# Copy built server and client artifacts
COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist /app/client/dist

# Create persistent storage directory
RUN mkdir -p /app/server/data && chmod 777 /app/server/data
VOLUME ["/app/server/data"]

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/index.js"]
