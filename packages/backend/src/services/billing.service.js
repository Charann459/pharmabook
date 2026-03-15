const { calculateBillTotals, round2 } = require('../utils/gst');

/**
 * Calculate bill totals from items array.
 * items: [{ medicine_id, qty, unit_price, gst_rate }]
 * Returns enriched items + subtotal, gst_amount, total
 */
const calculateTotals = (items, discount = 0) => {
  const totals = calculateBillTotals(items);
  const total = round2(totals.total - discount);
  return { ...totals, discount: round2(discount), total: Math.max(total, 0) };
};

module.exports = { calculateTotals };
