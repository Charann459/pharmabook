require('../config/env');
const Bull = require('bull');
const { redis: redisCfg } = require('../config/env');
const logger = require('../utils/logger');

/**
 * If Redis is unavailable (Railway free tier),
 * disable queues but keep the API running.
 */
if (
  !process.env.REDIS_HOST ||
  process.env.REDIS_HOST === 'localhost'
) {
  logger.warn('Redis unavailable - Bull queues disabled');

  module.exports = {
    addJob: async () => {
      logger.warn('Job skipped because Redis is disabled');
      return null;
    },
  };
} else {
  const redisOpts = {
    redis: {
      host: redisCfg.host,
      port: redisCfg.port,
      password: redisCfg.password,
    },
  };

  // Create queues
  const queues = {
    barcode: new Bull('barcode', redisOpts),
    pdf: new Bull('pdf', redisOpts),
    alert: new Bull('alert', redisOpts),
    sync: new Bull('sync', redisOpts),
  };

  // Register processors
  queues.barcode.process(require('./barcode.worker'));
  queues.pdf.process(require('./pdf.worker'));
  queues.alert.process(require('./alert.worker'));
  queues.sync.process(require('./sync.worker'));

  // Shared event logging
  Object.entries(queues).forEach(([name, queue]) => {
    queue.on('completed', (job) =>
      logger.info(`[${name}] job ${job.id} completed`)
    );

    queue.on('failed', (job, err) =>
      logger.error(`[${name}] job ${job.id} failed`, {
        error: err.message,
      })
    );

    queue.on('stalled', (job) =>
      logger.warn(`[${name}] job ${job.id} stalled`)
    );
  });

  const _queues = {};

  const addJob = async (queueName, data, opts = {}) => {
    if (!_queues[queueName]) {
      _queues[queueName] = new Bull(queueName, redisOpts);
    }

    return _queues[queueName].add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      ...opts,
    });
  };

  logger.info('Bull workers started', {
    queues: Object.keys(queues),
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Worker shutdown initiated');
    await Promise.all(
      Object.values(queues).map((q) => q.close())
    );
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  module.exports = { addJob };
}