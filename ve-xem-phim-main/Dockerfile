# Stage 1: build frontend (React + Vite)
FROM node:20-slim AS frontend-build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Firebase config embedded at build time (override with --build-arg if needed)
ARG VITE_FIREBASE_API_KEY=""
ARG VITE_FIREBASE_AUTH_DOMAIN=""
ARG VITE_FIREBASE_PROJECT_ID=""
ARG VITE_FIREBASE_STORAGE_BUCKET=""
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=""
ARG VITE_FIREBASE_APP_ID=""
RUN npm run build

# Stage 2: production backend (Express serves API + dist on same origin)
FROM node:20-slim AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=frontend-build /app/dist ./dist

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.cjs"]
