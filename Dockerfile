# Podrida backend. Build from the REPO ROOT, since the backend depends on shared/:
#   docker build -t podrida-backend .
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY shared shared
COPY backend backend
RUN npm run build:backend && npm prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/shared/package.json shared/package.json
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/build backend/build
WORKDIR /app/backend
EXPOSE 4000
USER node
CMD ["node", "build/index.js"]
