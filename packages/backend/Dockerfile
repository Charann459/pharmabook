FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

RUN apk add --no-cache postgresql-client

COPY package.json ./

RUN pnpm install --no-frozen-lockfile

COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/pdfs

EXPOSE 3000

CMD ["pnpm", "start"]