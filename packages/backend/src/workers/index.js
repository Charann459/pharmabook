require('../config/env');
const Bull = require('bull');
const { redis: redisCfg } = require('../config/env');
const logger = require('../utils/logger');

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
  pdf:     new Bull('pdf',     redisOpts),
  alert:   new Bull('alert',   redisOpts),
  sync:    new Bull('sync',    redisOpts),
};

// Register processors
queues.barcode.process(require('./barcode.worker'));
queues.pdf.process(require('./pdf.worker'));
queues.alert.process(require('./alert.worker'));
queues.sync.process(require('./sync.worker'));

// Shared event logging
Object.entries(queues).forEach(([name, queue]) => {
  queue.on('completed', (job) => logger.info(`[${name}] job ${job.id} completed`));
  queue.on('failed',    (job, err) => logger.error(`[${name}] job ${job.id} failed`, { error: err.message }));
  queue.on('stalled',   (job) => logger.warn(`[${name}] job ${job.id} stalled`));
});

/**
 * Add a job to a named queue from outside the worker process.
 * Used by API controllers to enqueue without importing Bull directly.
 */
const _queues = {};
const addJob = async (queueName, data, opts = {}) => {
  if (!_queues[queueName]) {
    _queues[queueName] = new Bull(queueName, redisOpts);
  }
  return _queues[queueName].add(data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, ...opts });
};

logger.info('Bull workers started', { queues: Object.keys(queues) });

// Graceful shutdown
const shutdown = async () => {
  logger.info('Worker shutdown initiated');
  await Promise.all(Object.values(queues).map((q) => q.close()));
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

module.exports = { addJob };
