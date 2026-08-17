# syntax=docker/dockerfile:1

# ---- deps: full install (incl. devDependencies) to compile TS + native modules (bcrypt) ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ---- build: compile TypeScript ----
FROM deps AS builder
WORKDIR /app
COPY . .
RUN yarn build

# ---- prod-deps: install only production dependencies (smaller, fewer CVEs) ----
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# ---- runtime: minimal final image, non-root user ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system app \
  && useradd --system --gid app --create-home --shell /usr/sbin/nologin app \
  && mkdir -p /app/uploads/payment-evidence \
  && chown -R app:app /app

COPY --chown=app:app package.json ./
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main"]
