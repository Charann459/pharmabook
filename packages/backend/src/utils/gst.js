const VALID_GST_RATES = [0, 5, 12, 18];

/**
 * Given a GST-inclusive price and GST rate, extract the base price.
 * MRP in India is GST-inclusive.
 */
const getBasePrice = (price, gstRate) => {
  if (!VALID_GST_RATES.includes(Number(gstRate))) {
    throw new Error(`Invalid GST rate: ${gstRate}. Must be one of ${VALID_GST_RATES.join(', ')}`);
  }
  return round2(price / (1 + gstRate / 100));
};

const getGstAmount = (price, gstRate) => {
  const base = getBasePrice(price, gstRate);
  return round2(price - base);
};

/**
 * Calculate bill totals from an array of items.
 * Each item: { unit_price, qty, gst_rate, medicine_id }
 */
const calculateBillTotals = (items) => {
  let subtotal = 0;
  let totalGst = 0;

  const lineItems = items.map((item) => {
    const price    = Number(item.unit_price);
    const gstRate  = Number(item.gst_rate);
    const qty      = Number(item.qty);

    const base         = getBasePrice(price, gstRate);
    const gst          = getGstAmount(price, gstRate);
    const lineSubtotal = round2(base * qty);
    const lineGst      = round2(gst  * qty);
    const lineTotal    = round2(price * qty);

    subtotal += lineSubtotal;
    totalGst += lineGst;

    return {
      ...item,
      base_price:          base,
      gst_amount_per_unit: gst,
      line_subtotal:       lineSubtotal,
      line_gst:            lineGst,
      line_total:          lineTotal,
    };
  });

  subtotal = round2(subtotal);
  totalGst = round2(totalGst);

  return {
    items:      lineItems,
    subtotal,
    gst_amount: totalGst,
    total:      round2(subtotal + totalGst),
  };
};

const splitGst = (gstAmount) => ({
  cgst: round2(gstAmount / 2),
  sgst: round2(gstAmount / 2),
  igst: 0,
});

const round2 = (n) => Math.round(n * 100) / 100;

module.exports = {
  getBasePrice,
  getGstAmount,
  calculateBillTotals,
  splitGst,
  round2,
  VALID_GST_RATES,
};