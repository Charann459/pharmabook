const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { cors: corsCfg, isProduction } = require('../config/env');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('../utils/logger');

const authRoutes      = require('./routes/auth.routes');
const medicineRoutes  = require('./routes/medicines.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const billRoutes      = require('./routes/bills.routes');
const reportRoutes    = require('./routes/reports.routes');
const syncRoutes      = require('./routes/sync.routes');
const userRoutes      = require('./routes/users.routes');

const app = express();

/* ── Security ── */
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || corsCfg.origins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

/* ── Rate limiting ── */
app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth attempts, try again in 15 minutes' },
}));
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  message: { error: 'Rate limit exceeded' },
}));

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
app.use('/api/auth',      authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/bills',     billRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/sync',      syncRoutes);
app.use('/api/users',     userRoutes);

/* ── 404 ── */
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

/* ── Global error handler (must be last) ── */
app.use(errorHandler);

module.exports = app;
