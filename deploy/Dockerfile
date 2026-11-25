# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @pb/api build \
  && test -d content/projects/taskflow-lite \
  && test -f content/resources/resources.json \
  && test -d examples/taskflow-lite/starter \
  && test -d examples/taskflow-lite/reference

FROM build AS web-build
ARG VITE_FREE_LAUNCH=true
ARG VITE_POSTHOG_KEY=
ARG VITE_POSTHOG_HOST=https://eu.i.posthog.com
ARG VITE_POSTHOG_REPLAY_ENABLED=false
RUN pnpm --filter @pb/web build

FROM base AS api
ENV NODE_ENV=production \
  CONTENT_DIR=/app/content \
  CHECKPOINT_DISABLE=1
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml /app/
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/packages /app/packages
COPY --from=build --chown=node:node /app/apps/api/package.json /app/apps/api/tsconfig.json /app/apps/api/
COPY --from=build --chown=node:node /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/src /app/apps/api/src
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
COPY --from=build --chown=node:node /app/content /app/content
COPY --from=build --chown=node:node /app/examples/taskflow-lite/starter /app/examples/taskflow-lite/starter
COPY --from=build --chown=node:node /app/examples/taskflow-lite/reference /app/examples/taskflow-lite/reference
USER node
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]

FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv
