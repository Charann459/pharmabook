# PharmaBook Backend

REST API + WebSocket server + Bull workers for the PharmaBook pharmacy management platform.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 + Bull |
| Push | WebSocket (ws) |
| Auth | JWT |
| Containers | Docker + docker-compose |
| Package manager | pnpm |

---

## Quick Start (Development)

### 1. Clone and install

```bash
git clone https://github.com/yourorg/pharmabook-backend.git
cd pharmabook-backend
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set DB password, Redis password, JWT secret
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Start all containers

```bash
# Production-like
docker compose up -d

# Development (hot reload + exposed DB/Redis ports)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### 4. Run migrations

```bash
pnpm migrate
```

### 5. Seed medicine database

```bash
# Uses sample data (5 medicines) if no SEED_FILE provided
pnpm seed

# With a real DataRequisite CSV export:
SEED_FILE=./data/medicines.csv pnpm seed
```

### 6. Create the first shop and owner

```bash
node scripts/create-owner.js \
  --shop "Rajan Medical Store" \
  --name "Rajan Krishnamurthy" \
  --email owner@example.com \
  --password yourpassword
```

---

## Docker Commands

```bash
# Start all services
docker compose up -d

# Development mode (hot reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# View logs
docker compose logs -f api
docker compose logs -f worker

# Stop all
docker compose down

# Stop and remove volumes (⚠️ deletes all data)
docker compose down -v

# Rebuild after code changes (prod)
docker compose build && docker compose up -d

# Run migrations inside running container
docker compose exec api pnpm migrate

# Open Postgres shell
docker compose exec postgres psql -U pharma -d pharmabook

# Open Redis shell
docker compose exec redis redis-cli -a yourpassword
```

---

## API Reference

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Login, returns JWT |
| POST | `/api/auth/refresh` | — | Refresh token |
| POST | `/api/auth/logout` | ✓ | Invalidate session |
| GET | `/api/auth/me` | ✓ | Current user info |

### Medicines

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/medicines` | all | List medicines |
| GET | `/api/medicines/search?q=` | all | Name search |
| GET | `/api/medicines/resolve/:barcode` | all | Barcode lookup |
| POST | `/api/medicines` | owner | Create medicine |
| PATCH | `/api/medicines/:id` | owner | Update medicine |
| DELETE | `/api/medicines/:id` | owner | Soft delete |
| POST | `/api/medicines/:id/promote` | owner | Make global |

### Inventory

| Method | Route | Roles | Description |
|---|---|---|---|
| GET | `/api/inventory` | owner, inv_manager | List inventory |
| GET | `/api/inventory/low-stock` | owner, inv_manager | Low stock items |
| GET | `/api/inventory/expiring` | owner, inv_manager | Expiring items |
| POST | `/api/inventory` | owner, inv_manager | Add stock |
| PATCH | `/api/inventory/:id/adjust` | owner, inv_manager | Adjust qty |
| DELETE | `/api/inventory/:id` | owner | Soft delete |

### Bills

| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/api/bills` | owner, cashier | Create bill |
| GET | `/api/bills` | owner, cashier | List bills |
| GET | `/api/bills/:id` | owner, cashier | Bill + items |
| GET | `/api/bills/:id/pdf` | owner, cashier | Download PDF |
| POST | `/api/bills/:id/void` | owner | Void bill |

### Reports (owner only)

| Method | Route | Query params | Description |
|---|---|---|---|
| GET | `/api/reports/daily` | `date` | Daily summary + hourly chart |
| GET | `/api/reports/weekly` | `week_start` | 7-day breakdown |
| GET | `/api/reports/monthly` | `year`, `month` | Monthly breakdown |
| GET | `/api/reports/top-medicines` | `period`, `limit` | Top sellers |
| GET | `/api/reports/gst-summary` | `year`, `month` | GSTR-1 prep data |

### Sync

| Method | Route | Description |
|---|---|---|
| POST | `/api/sync/push` | Push dirty WatermelonDB records |
| GET | `/api/sync/pull?last_pulled_at=` | Pull delta since timestamp |

### Users (owner only)

| Method | Route | Description |
|---|---|---|
| GET | `/api/users` | List shop users |
| POST | `/api/users` | Create cashier or inv_manager |
| PATCH | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Deactivate user |

---

## WebSocket

Connect: `wss://api.pharmabook.in/ws?token=<JWT>`

### Server → Device messages

| Type | Payload | Description |
|---|---|---|
| `CONNECTED` | `{ user_id, role }` | Sent on successful connection |
| `BARCODE_RESULT` | `{ barcode, medicine }` | Barcode resolved |
| `BARCODE_NOT_FOUND` | `{ barcode, action }` | Unknown barcode |
| `STOCK_UPDATE` | `{ medicine_name, qty_added, new_total, ... }` | Inv manager added stock |
| `LOW_STOCK` | `{ medicine_name, qty, threshold }` | Stock below threshold |
| `EXPIRY_WARNING` | `{ count, medicines, warn_days }` | Daily expiry check result |
| `PDF_READY` | `{ bill_id, pdf_url }` | Bill PDF generated |
| `SYNC_DELTA` | `{ changes, timestamp }` | Changes from another device |

### Device → Server messages

| Type | Description |
|---|---|
| `PING` | Keepalive (server replies `PONG`) |
| `NOTIF_ACK` | Acknowledge notification |

---

## Environment Variables

See `.env.example` for all variables with descriptions.

Required:
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`
- `REDIS_PASSWORD`
- `JWT_SECRET` (min 32 chars)

---

## Deployment (EC2)

### First-time setup

```bash
# On EC2 Ubuntu 24.04
sudo apt update && sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx

# Clone repo
git clone https://github.com/yourorg/pharmabook-backend.git /opt/pharmabook
cd /opt/pharmabook

# Configure
cp .env.example .env
# Edit .env with production values

# Start
docker compose up -d

# Migrate and seed
docker compose exec api pnpm migrate
docker compose exec api pnpm seed

# Nginx
sudo cp nginx/pharmabook.conf /etc/nginx/sites-available/pharmabook.conf
sudo ln -s /etc/nginx/sites-available/pharmabook.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d api.pharmabook.in
```

### Updating

```bash
cd /opt/pharmabook
git pull
docker compose build api worker
docker compose up -d api worker
docker compose exec api pnpm migrate   # if new migrations
```

---

## Testing

```bash
# All tests (requires Postgres + Redis running locally or via docker compose)
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

Tests use the real database (not mocks) with isolated fixtures — each test file creates and cleans up its own data.

---

## Project Structure

```
src/
  config/         env.js, db.js, redis.js
  api/
    app.js        Express app (middleware, routes)
    server.js     HTTP + WebSocket server entry
    routes/       One file per resource
    middleware/   auth, role, validate, errorHandler
    controllers/  Thin — validate, delegate to services
  services/       Business logic (no req/res)
  workers/        Bull job processors
  websocket/      WS server + message handlers
  db/
    migrations/   Numbered SQL files (node-pg-migrate)
    seeds/        Medicine import script
  utils/          logger, asyncHandler, gst helpers
tests/
  auth.test.js
  barcode.test.js
  billing.test.js
  inventory.test.js
nginx/
  pharmabook.conf
```
