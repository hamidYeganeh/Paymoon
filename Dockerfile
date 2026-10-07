FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@paymoon/commerce-api --filter=@paymoon/worker

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 4000 4001
CMD ["node", "apps/api/dist/main.js"]
