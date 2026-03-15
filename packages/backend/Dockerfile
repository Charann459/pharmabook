FROM node:20-alpine AS base

RUN npm install -g pnpm

WORKDIR /app

COPY package.json ./

RUN pnpm install --prod --no-frozen-lockfile

COPY src ./src
COPY scripts ./scripts

RUN addgroup -S pharma && adduser -S pharma -G pharma
USER pharma

EXPOSE 3000

CMD ["node", "src/api/server.js"]