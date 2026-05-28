FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package.json ./
COPY pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/pdfs

EXPOSE 3000

CMD ["pnpm", "start"]