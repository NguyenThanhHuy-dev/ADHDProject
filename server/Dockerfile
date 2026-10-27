# Build context is the repository root: docker build -f server/Dockerfile .
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN npm ci -w server --omit=dev --include-workspace-root=false

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=deps /app/node_modules /app/node_modules
COPY server/package.json ./
COPY server/tsconfig.json ./
COPY server/src ./src
COPY server/drizzle ./drizzle
EXPOSE 3001
USER node
# Apply pending migrations, then start the API (and its background jobs).
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx tsx src/index.ts"]
