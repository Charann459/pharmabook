const cron = require('node-cron');
const { query } = require('../config/db');
const notificationService = require('../services/notification.service');
const { inventory: invCfg } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Job data: { shop_id } — triggered after every bill creation.
 * Checks for low stock across all medicines sold in the bill.
 */
module.exports = async (job) => {
  const { shop_id, bill_id } = job.data;

  // Get medicines from this bill that are now low stock
  const { rows: lowItems } = await query(
    `SELECT i.id, i.qty, i.low_stock_threshold, m.name, m.id AS medicine_id
     FROM bill_items bi
     JOIN inventory i ON i.medicine_id = bi.medicine_id AND i.shop_id = $1
     JOIN medicines m  ON m.id = bi.medicine_id
     WHERE bi.bill_id = $2
       AND i.qty <= i.low_stock_threshold
       AND i.deleted_at IS NULL`,
    [shop_id, bill_id]
  );

  for (const item of lowItems) {
    await notificationService.sendToShopOwner(shop_id, {
      type: 'LOW_STOCK',
      payload: {
        medicine_id:   item.medicine_id,
        medicine_name: item.name,
        qty:           item.qty,
        threshold:     item.low_stock_threshold,
      },
    });
    logger.info('alert.worker: low stock notified', { medicine: item.name, qty: item.qty });
  }
};

/**
 * Scheduled expiry check — runs every morning at 8 AM.
 * Sends a summary notification to all shop owners.
 */
cron.schedule('0 8 * * *', async () => {
  logger.info('alert.worker: running daily expiry check');

  const { rows: shops } = await query(`SELECT id FROM shops WHERE active = true`);

  for (const shop of shops) {
    const { rows: expiring } = await query(
      `SELECT m.name, i.qty, i.expiry_date, i.batch_no
       FROM inventory i JOIN medicines m ON m.id = i.medicine_id
       WHERE i.shop_id = $1
         AND i.expiry_date <= NOW() + ($2 || ' days')::INTERVAL
         AND i.expiry_date > NOW()
         AND i.qty > 0
         AND i.deleted_at IS NULL
       ORDER BY i.expiry_date ASC`,
      [shop.id, invCfg.expiryWarnDays]
    );

    if (expiring.length > 0) {
      await notificationService.sendToShopOwner(shop.id, {
        type: 'EXPIRY_WARNING',
        payload: {
          count:    expiring.length,
          medicines: expiring,
          warn_days: invCfg.expiryWarnDays,
        },
      });
      logger.info('alert.worker: expiry warning sent', { shop_id: shop.id, count: expiring.length });
    }
  }
});
