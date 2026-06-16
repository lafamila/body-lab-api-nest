FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Standalone runtime image for body-lab-api-nest; Postgres/Redis/auth hosts are injected via env.
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src/database/migrations ./dist/database/migrations
EXPOSE 3020
CMD ["sh", "-c", "node dist/database/migrate.js && node dist/main.js"]
