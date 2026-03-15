const syncService = require('../services/sync.service');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

/**
 * Job data: { changes, shop_id, user_id, last_pulled_at }
 * Processes a push payload and broadcasts SYNC_DELTA to other
 * devices in the same shop so they update in near-real-time.
 */
module.exports = async (job) => {
  const { changes, shop_id, user_id, last_pulled_at } = job.data;
  logger.debug('sync.worker: processing push', { shop_id, user_id });

  await syncService.push({ changes, shop_id, user_id });

  // Compute delta for other shop devices and broadcast
  const since = last_pulled_at ? new Date(Number(last_pulled_at)) : new Date(0);
  const delta = await syncService.pull({ shop_id, since });

  // Broadcast to all shop users EXCEPT the one who just pushed
  await notificationService.broadcastToShop(shop_id, {
    type:    'SYNC_DELTA',
    payload: { changes: delta, timestamp: Date.now() },
    exclude_user_id: user_id,
  });

  logger.info('sync.worker: completed', { shop_id });
};
