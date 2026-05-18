const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { cors: corsCfg, isProduction } = require('../config/env');
const { errorHandler } = require('./middleware/errorHandler');
const { optionalAuth } = require('./middleware/optionalAuth');
const logger = require('../utils/logger');

const authRoutes = require('./routes/auth.routes');
const medicineRoutes = require('./routes/medicines.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const billRoutes = require('./routes/bills.routes');
const reportRoutes = require('./routes/reports.routes');
const syncRoutes = require('./routes/sync.routes');
const userRoutes = require('./routes/users.routes');
const shopRoutes = require('./routes/shops.routes');
const app = express();

/* ── Security ── */
app.use(helmet());
const allowedOrigins = Array.isArray(corsCfg.origins)
  ? corsCfg.origins.map((origin) => origin.trim())
  : String(corsCfg.origins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    const requestOrigin = origin ? origin.trim() : '';

    if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
      return cb(null, true);
    }

    logger.warn(`CORS blocked origin: ${requestOrigin}. Allowed: ${allowedOrigins.join(', ')}`);
    return cb(new Error(`CORS: origin ${requestOrigin} not allowed`));
  },
  credentials: true,
}));

/* ── Rate limiting ── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `auth:${req.ip}`,
  message: { error: 'Too many auth attempts, try again in 15 minutes' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const shopId = req.rateLimitUser?.shop_id;

    if (shopId) {
      return `shop:${shopId}:${req.ip}`;
    }

    return `ip:${req.ip}`;
  },
  message: { error: 'Rate limit exceeded' },
});

app.use('/api/auth', authLimiter);
app.use('/api', optionalAuth, apiLimiter);

/* ── Body parsing ── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(compression());

/* ── Logging ── */
app.use(morgan(isProduction ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

/* ── Health check (no auth) ── */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

/* ── API routes ── */
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);

/* ── 404 ── */
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

/* ── Global error handler (must be last) ── */
app.use(errorHandler);

module.exports = app;
