FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npx tsc

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# Schema sync without destructive resets; seed is applied separately via `npm run db:seed` in CI/migrations.
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
