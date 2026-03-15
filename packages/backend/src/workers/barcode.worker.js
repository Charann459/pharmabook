const barcodeService = require('../services/barcode.service');
const notificationService = require('../services/notification.service');
const logger = require('../utils/logger');

/**
 * Job data: { barcode, shop_id, user_id }
 * Resolves barcode and pushes result to device via WebSocket.
 */
module.exports = async (job) => {
  const { barcode, shop_id, user_id } = job.data;
  logger.debug('barcode.worker: resolving', { barcode, shop_id });

  const medicine = await barcodeService.resolve(barcode, shop_id);

  if (medicine) {
    await notificationService.sendToUser(user_id, {
      type: 'BARCODE_RESULT',
      payload: { barcode, medicine },
    });
  } else {
    await notificationService.sendToUser(user_id, {
      type: 'BARCODE_NOT_FOUND',
      payload: { barcode, action: 'manual_entry' },
    });
  }
};
