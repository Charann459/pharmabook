const { deductStock } = require('../src/services/inventory.service');
const { pool, query, withTransaction } = require('../src/config/db');
const { v4: uuidv4 } = require('uuid');

const shopId     = uuidv4();
const userId     = uuidv4();
const medicineId = uuidv4();
let   invId;

beforeAll(async () => {
  await query(`INSERT INTO shops (id, name) VALUES ($1,'Inv Test Shop')`, [shopId]);
  await query(
    `INSERT INTO users (id, shop_id, name, email, password_hash, role)
     VALUES ($1,$2,'Inv User','inv@test.com','hash','owner')`,
    [userId, shopId]
  );
  await query(
    `INSERT INTO medicines (id, barcode, name, mrp, gst_rate, category, global)
     VALUES ($1,'1234567890001','Inv Medicine',50,12,'Test',true)`,
    [medicineId]
  );
  invId = uuidv4();
  await query(
    `INSERT INTO inventory (id, medicine_id, shop_id, qty, batch_no, expiry_date)
     VALUES ($1,$2,$3,20,'BATCH01','2027-01-01')`,
    [invId, medicineId, shopId]
  );
});

afterAll(async () => {
  await query(`DELETE FROM inventory  WHERE shop_id = $1`, [shopId]);
  await query(`DELETE FROM medicines  WHERE id = $1`,      [medicineId]);
  await query(`DELETE FROM users      WHERE id = $1`,      [userId]);
  await query(`DELETE FROM shops      WHERE id = $1`,      [shopId]);
  await pool.end();
});

describe('inventoryService.deductStock', () => {
  it('deducts qty from inventory within a transaction', async () => {
    await withTransaction(async (client) => {
      await deductStock(client, shopId, [{ medicine_id: medicineId, qty: 5 }], userId);
    });

    const { rows } = await query(`SELECT qty FROM inventory WHERE id = $1`, [invId]);
    expect(rows[0].qty).toBe(15);
  });

  it('throws on insufficient stock', async () => {
    await expect(
      withTransaction(async (client) => {
        await deductStock(client, shopId, [{ medicine_id: medicineId, qty: 999 }], userId);
      })
    ).rejects.toThrow('Insufficient stock');
  });

  it('rolls back on error — qty unchanged', async () => {
    const { rows: before } = await query(`SELECT qty FROM inventory WHERE id = $1`, [invId]);
    try {
      await withTransaction(async (client) => {
        await deductStock(client, shopId, [{ medicine_id: medicineId, qty: 999 }], userId);
      });
    } catch {}
    const { rows: after } = await query(`SELECT qty FROM inventory WHERE id = $1`, [invId]);
    expect(after[0].qty).toBe(before[0].qty);
  });
});
