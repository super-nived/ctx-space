FROM node:22-slim AS builder

# VITE_API_BASE is baked into the JS bundle at build time.
# Pass the public URL of the backend so the browser can reach it.
# Default: empty string = same origin (works when frontend proxies to backend).
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build the React SPA (outputs to dist/)
RUN npm run build

# Build the production Node server (outputs to dist-server/)
RUN npx tsc -p tsconfig.server.json

# ---- runtime image ----
FROM node:22-slim

WORKDIR /app

# Only install production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy build artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3000

ENV NODE_ENV=production
ENV AGENT_URL=http://backend:8000/

CMD ["node", "dist-server/production.js"]
