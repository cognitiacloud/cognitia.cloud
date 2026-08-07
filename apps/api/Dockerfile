# Cognitia API — long-running Fastify container.
# Build from the REPO ROOT so workspace packages are in context:
#   docker build -f apps/api/Dockerfile -t cognitia-api .
#
# Runtime strategy: esbuild bundles the API plus all @cognitia/* workspace
# sources (which ship as raw TypeScript by design) into one ESM file, keeping
# only `pg` external. This is the first verified boot path for the API — the
# tsc emit fails on TS6059 (workspace sources outside rootDir) and the
# strip-types dev script fails on .js-suffixed imports.

FROM node:22-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile --filter @cognitia/api... \
  && cd apps/api && pnpm run build:server

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Only pg (and its deps) are needed at runtime; everything else is bundled.
RUN npm install --no-save pg@8 && npm cache clean --force
COPY --from=build /repo/apps/api/dist/server.mjs ./server.mjs
COPY --from=build /repo/apps/api/scripts/assert-prod-env.mjs ./scripts/assert-prod-env.mjs

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT??process.env.PORT??3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/assert-prod-env.mjs && node server.mjs"]
