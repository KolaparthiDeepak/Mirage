# Plan 20 — self-hosting: one image, SQLite, no cloud.
#
#   docker build -t mirage .
#   docker run -p 3000:3000 -v ./data:/data mirage
#   docker run -p 3000:3000 -v ./mocks:/mocks:ro -e MIRAGE_MOCKS_DIR=/mocks mirage
#
# Multi-stage, one base image throughout (node:20-slim) on purpose: Next's
# `output: "standalone"` file tracing copies better-sqlite3's compiled native
# addon into .next/standalone for us, but only because it was built for the
# same OS/libc the runner stage ships. A smaller distroless runner would
# break that.
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
# mocks.generated.json (the bundle-mode fallback every deploy target can
# still serve from) is produced here explicitly — postinstall already runs
# it, but a stale or missing bundle in the build context must never survive
# into the image silently.
RUN npm run compile
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# /data holds mirage.db (MIRAGE_DB_PATH defaults here); /mocks is where a
# read-only repo mount goes (MIRAGE_MOCKS_DIR). Neither is created by this
# image — both are the operator's volumes, per the examples above.
VOLUME ["/data"]
ENV MIRAGE_DB_PATH=/data/mirage.db
CMD ["node", "server.js"]
