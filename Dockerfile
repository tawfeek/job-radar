# JobRadar production image. Single-stage Node 22 — installs both
# workspaces, generates Prisma, builds the React client, runs migrations
# on boot, then starts the Express server which serves /api + the SPA.

FROM node:22-bookworm-slim

# Native deps for openssl/libssl (Prisma) and curl (healthcheck).
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install root devDeps (concurrently — only used in dev, but cheap).
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install

# Server: install + generate prisma client.
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install
COPY server/prisma ./server/prisma
COPY server/prisma.config.ts ./server/
RUN cd server && npx prisma generate

# Client: install + build static bundle.
COPY client/package.json client/package-lock.json* ./client/
RUN cd client && npm install
COPY client ./client
RUN cd client && npm run build

# Server source last so server-only changes don't bust the client cache.
COPY server ./server

ENV NODE_ENV=production
EXPOSE 5173

# `npm start` runs `prisma migrate deploy && npm start` in the server
# workspace, so a fresh DB volume gets the schema applied automatically.
CMD ["npm", "start"]
