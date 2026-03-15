const Redis = require('ioredis');
const { redis: cfg } = require('./env');
const logger = require('../utils/logger');

const client = new Redis({
  host: cfg.host,
  port: cfg.port,
  ...(cfg.password ? { password: cfg.password } : {}),
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: false,
});

client.on('connect', () => logger.info('Redis: connected'));
client.on('error', (err) => logger.error('Redis error', { error: err.message }));
client.on('reconnecting', () => logger.warn('Redis: reconnecting'));

module.exports = client;
