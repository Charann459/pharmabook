require('../config/env');
const http = require('http');
const app = require('./app');
const { initWsServer } = require('../websocket/ws.server');
const { pool } = require('../config/db');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const { port } = require('../config/env');

const server = http.createServer(app);

/* ── Attach WebSocket server ── */
initWsServer(server);

/* ── Graceful shutdown ── */
const shutdown = async (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await pool.end();
      logger.info('Postgres pool closed');

      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (err) {
      logger.error('Error during shutdown', {
        error: err.message,
      });
    }

    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: String(reason),
  });
});

/* ── IMPORTANT: Listen on all network interfaces ── */
server.listen(port, '0.0.0.0', () => {
  logger.info(`PharmaBook API running on port ${port} (LAN enabled)`);
});

module.exports = server;