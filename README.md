# PharmaBook

Mobile-first pharmacy management platform. Built for independent Indian pharmacies.

## Packages

| Package | Description | Status |
|---|---|---|
| [`packages/backend`](./packages/backend) | Node.js REST API + WebSocket + Bull workers | ✅ Active |
| [`packages/mobile`](./packages/mobile) | React Native (Expo) Android/iOS app | 🔜 Next |
| [`packages/web`](./packages/web) | Next.js owner dashboard (Vercel) | 📅 v2 |
| [`packages/shared`](./packages/shared) | Shared types, constants, utilities | ✅ Active |

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + docker compose

## Quick Start

```bash
git clone git@github.com:yourorg/pharmabook.git
cd pharmabook
pnpm install

# Start backend
cd packages/backend
cp .env.example .env    # fill in secrets
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
pnpm migrate
pnpm seed
node scripts/create-owner.js --shop "My Shop" --name "Owner" --email owner@example.com --password secret
```

## Running Tests

```bash
# Backend only
pnpm test:backend

# All packages
pnpm test:all
```

## Architecture

See [`packages/backend/README.md`](./packages/backend/README.md) for the full backend docs.

See [`docs/architecture.docx`](./docs/) and [`docs/decisions.docx`](./docs/) for architecture and decision records.
