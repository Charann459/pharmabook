const { query } = require('../config/db');

/**
 * Deduct stock for all items in a bill.
 * Runs inside an existing transaction (client passed in).
 * Uses FIFO: deduct from the batch expiring soonest first.
 * Throws if any medicine has insufficient stock.
 */
const deductStock = async (client, shop_id, items, user_id) => {
  for (const item of items) {
    let remaining = item.qty;

    // Lock rows for update, FIFO by expiry
    const { rows: batches } = await client.query(
      `SELECT id, qty FROM inventory
       WHERE medicine_id = $1 AND shop_id = $2
         AND qty > 0 AND deleted_at IS NULL
       ORDER BY expiry_date ASC
       FOR UPDATE`,
      [item.medicine_id, shop_id]
    );

    const totalAvailable = batches.reduce((s, b) => s + b.qty, 0);
    if (totalAvailable < item.qty) {
      throw Object.assign(
        new Error(`Insufficient stock for medicine ${item.medicine_id}. Available: ${totalAvailable}, requested: ${item.qty}`),
        { status: 400 }
      );
    }

    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(batch.qty, remaining);
      await client.query(
        `UPDATE inventory SET qty = qty - $1, updated_by = $2, updated_at = NOW() WHERE id = $3`,
        [deduct, user_id, batch.id]
      );
      remaining -= deduct;
    }
  }
};

/**
 * Check if any inventory items for a shop are below threshold.
 * Returns array of low-stock items.
 */
const getLowStockItems = async (shop_id) => {
  const { rows } = await query(
    `SELECT i.id, i.medicine_id, i.qty, i.low_stock_threshold, m.name
     FROM inventory i JOIN medicines m ON m.id = i.medicine_id
     WHERE i.shop_id = $1 AND i.qty <= i.low_stock_threshold AND i.deleted_at IS NULL`,
    [shop_id]
  );
  return rows;
};

module.exports = { deductStock, getLowStockItems };
