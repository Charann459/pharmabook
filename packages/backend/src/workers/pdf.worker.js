const pdfService = require('../services/pdf.service');
const notificationService = require('../services/notification.service');
const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Job data: { bill_id, shop_id }
 * Generates GST invoice PDF and notifies cashier with PDF_READY.
 */
module.exports = async (job) => {
  const { bill_id, shop_id } = job.data;
  logger.debug('pdf.worker: generating', { bill_id });

  const outputPath = await pdfService.generate(bill_id);

  // Fetch cashier_id to notify the right device
  const { rows } = await query(`SELECT cashier_id FROM bills WHERE id = $1`, [bill_id]);
  if (!rows[0]) return;

  await notificationService.sendToUser(rows[0].cashier_id, {
    type: 'PDF_READY',
    payload: {
      bill_id,
      pdf_url: `/pdfs/${bill_id}.pdf`,
    },
  });

  logger.info('pdf.worker: done', { bill_id, outputPath });
};
