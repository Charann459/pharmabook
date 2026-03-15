const { calculateTotals } = require('../src/services/billing.service');
const { calculateBillTotals, getBasePrice, getGstAmount, round2 } = require('../src/utils/gst');

describe('GST utilities', () => {
  it('extracts base price from MRP (GST inclusive)', () => {
    // MRP ₹112 at 12% GST → base = 112/1.12 = 100
    expect(getBasePrice(112, 12)).toBe(100);
  });

  it('extracts GST amount from MRP', () => {
    expect(getGstAmount(112, 12)).toBe(12);
  });

  it('handles 5% GST correctly', () => {
    const base = getBasePrice(105, 5);
    expect(base).toBe(100);
    expect(getGstAmount(105, 5)).toBe(5);
  });

  it('handles 0% GST correctly', () => {
    expect(getBasePrice(100, 0)).toBe(100);
    expect(getGstAmount(100, 0)).toBe(0);
  });

  it('throws on invalid GST rate', () => {
    expect(() => getBasePrice(100, 7)).toThrow('Invalid GST rate');
  });
});

describe('billingService.calculateTotals', () => {
  const items = [
    { medicine_id: 'med-1', qty: 2, unit_price: 112, gst_rate: 12 },
    { medicine_id: 'med-2', qty: 1, unit_price: 105, gst_rate: 5 },
  ];

  it('calculates totals correctly', () => {
    const result = calculateTotals(items, 0);

    // Item 1: base=100, gst=12, qty=2 → subtotal=200, gst=24, total=224
    // Item 2: base=100, gst=5,  qty=1 → subtotal=100, gst=5,  total=105
    expect(result.subtotal).toBe(300);
    expect(result.gst_amount).toBe(29);
    expect(result.total).toBe(329);
  });

  it('applies discount to total', () => {
    const result = calculateTotals(items, 29);
    expect(result.total).toBe(300);
    expect(result.discount).toBe(29);
  });

  it('total never goes below 0 with large discount', () => {
    const result = calculateTotals(items, 9999);
    expect(result.total).toBe(0);
  });

  it('returns enriched line items', () => {
    const result = calculateTotals(items);
    expect(result.items[0].line_total).toBe(224);
    expect(result.items[1].line_total).toBe(105);
  });
});
