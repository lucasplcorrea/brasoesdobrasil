FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV BRASOES_ROOT=/app
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

RUN useradd --create-home --uid 10001 worker \
  && mkdir -p /app/data /app/assets /app/docs \
  && chown -R worker:worker /app

USER worker
CMD ["node", "dist/cli/index.js", "worker", "executar"]
