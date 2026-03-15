const barcodeService = require('../src/services/barcode.service');
const { pool, query } = require('../src/config/db');
const redisClient = require('../src/config/redis');
const { v4: uuidv4 } = require('uuid');

const shopId   = uuidv4();
const medicineId = uuidv4();
const BARCODE  = '8901234500001';

beforeAll(async () => {
  await query(`INSERT INTO shops (id, name) VALUES ($1, 'Barcode Test Shop')`, [shopId]);
  await query(
    `INSERT INTO medicines (id, barcode, name, mrp, gst_rate, category, global)
     VALUES ($1,$2,'Test Medicine',50.00,12,'Test',true)`,
    [medicineId, BARCODE]
  );
});

afterAll(async () => {
  await barcodeService.invalidate(BARCODE);
  await query(`DELETE FROM medicines WHERE id = $1`, [medicineId]);
  await query(`DELETE FROM shops WHERE id = $1`, [shopId]);
  await pool.end();
  await redisClient.quit();
});

describe('barcodeService.resolve', () => {
  it('resolves a global medicine by barcode', async () => {
    const result = await barcodeService.resolve(BARCODE, shopId);
    expect(result).not.toBeNull();
    expect(result.name).toBe('Test Medicine');
    expect(result.global).toBe(true);
  });

  it('caches result in Redis on first lookup', async () => {
    await barcodeService.invalidate(BARCODE);
    await barcodeService.resolve(BARCODE, shopId);
    const cached = await redisClient.get(`barcode:${BARCODE}`);
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached);
    expect(parsed.barcode).toBe(BARCODE);
  });

  it('returns from Redis cache on second lookup', async () => {
    // Should not throw — reads from cache
    const result = await barcodeService.resolve(BARCODE, shopId);
    expect(result.name).toBe('Test Medicine');
  });

  it('returns null for unknown barcode', async () => {
    const result = await barcodeService.resolve('0000000000000', shopId);
    expect(result).toBeNull();
  });

  it('resolves shop-scoped medicine', async () => {
    const localId  = uuidv4();
    const localBarcode = '9991234500001';
    await query(
      `INSERT INTO medicines (id, barcode, name, mrp, gst_rate, category, global, shop_id)
       VALUES ($1,$2,'Local Medicine',30.00,5,'Local',false,$3)`,
      [localId, localBarcode, shopId]
    );

    const result = await barcodeService.resolve(localBarcode, shopId);
    expect(result).not.toBeNull();
    expect(result.global).toBe(false);
    expect(result.shop_id).toBe(shopId);

    await query(`DELETE FROM medicines WHERE id = $1`, [localId]);
    await barcodeService.invalidate(localBarcode);
  });
});
