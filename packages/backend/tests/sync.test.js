const { push, pull } = require('../src/services/sync.service');
const { pool, query } = require('../src/config/db');
const { v4: uuidv4 } = require('uuid');

const shopId     = uuidv4();
const userId     = uuidv4();
const medicineId = uuidv4();

beforeAll(async () => {
  await query(`INSERT INTO shops (id, name) VALUES ($1, 'Sync Test Shop')`, [shopId]);
  await query(
    `INSERT INTO users (id, shop_id, name, email, password_hash, role)
     VALUES ($1,$2,'Sync User','sync@test.com','hash','owner')`,
    [userId, shopId]
  );
  await query(
    `INSERT INTO medicines (id, barcode, name, mrp, gst_rate, category, global)
     VALUES ($1,'5550000000001','Sync Medicine',50,12,'Test',true)`,
    [medicineId]
  );
});

afterAll(async () => {
  await query(`DELETE FROM inventory  WHERE shop_id = $1`, [shopId]);
  await query(`DELETE FROM bill_items WHERE bill_id IN (SELECT id FROM bills WHERE shop_id = $1)`, [shopId]);
  await query(`DELETE FROM bills      WHERE shop_id = $1`, [shopId]);
  await query(`DELETE FROM medicines  WHERE id = $1`,      [medicineId]);
  await query(`DELETE FROM users      WHERE id = $1`,      [userId]);
  await query(`DELETE FROM shops      WHERE id = $1`,      [shopId]);
  await pool.end();
});

describe('syncService.push', () => {
  it('applies created inventory records from device', async () => {
    const invId = uuidv4();
    await push({
      shop_id: shopId,
      user_id: userId,
      changes: {
        medicines:  { created: [], updated: [], deleted: [] },
        bills:      { created: [], updated: [], deleted: [] },
        bill_items: { created: [], updated: [], deleted: [] },
        inventory:  {
          created: [{
            id:                  invId,
            medicine_id:         medicineId,
            shop_id:             shopId,
            qty:                 50,
            batch_no:            'SYNCBATCH01',
            expiry_date:         '2027-06-01',
            low_stock_threshold: 10,
            updated_by:          userId,
            created_at:          new Date().toISOString(),
            updated_at:          new Date().toISOString(),
          }],
          updated: [],
          deleted: [],
        },
      },
    });

    const { rows } = await query(`SELECT qty FROM inventory WHERE id = $1`, [invId]);
    expect(rows[0]).toBeDefined();
    expect(rows[0].qty).toBe(50);
  });

  it('does not overwrite a newer server record with an older device update', async () => {
    // Insert a record with a recent updated_at on server
    const invId = uuidv4();
    const serverTime = new Date();
    await query(
      `INSERT INTO inventory (id, medicine_id, shop_id, qty, batch_no, expiry_date, updated_at)
       VALUES ($1,$2,$3,30,'NEWBATCH','2027-06-01',$4)`,
      [invId, medicineId, shopId, serverTime]
    );

    // Device sends an older updated_at — should not overwrite
    const oldTime = new Date(serverTime.getTime() - 60_000).toISOString();
    await push({
      shop_id: shopId,
      user_id: userId,
      changes: {
        medicines:  { created: [], updated: [], deleted: [] },
        bills:      { created: [], updated: [], deleted: [] },
        bill_items: { created: [], updated: [], deleted: [] },
        inventory:  {
          created: [],
          updated: [{ id: invId, qty: 999, updated_at: oldTime }],
          deleted: [],
        },
      },
    });

    const { rows } = await query(`SELECT qty FROM inventory WHERE id = $1`, [invId]);
    expect(rows[0].qty).toBe(30); // unchanged
  });
});

describe('syncService.pull', () => {
  it('returns records updated after given timestamp', async () => {
    const before = new Date(Date.now() - 5000);

    // Insert a new inventory record
    const invId = uuidv4();
    await query(
      `INSERT INTO inventory (id, medicine_id, shop_id, qty, batch_no, expiry_date)
       VALUES ($1,$2,$3,20,'PULLBATCH','2027-06-01')`,
      [invId, medicineId, shopId]
    );

    const delta = await pull({ shop_id: shopId, since: before });

    expect(delta.inventory).toBeDefined();
    const found = delta.inventory.updated.find(r => r.id === invId);
    expect(found).toBeDefined();
    expect(found.qty).toBe(20);
  });

  it('returns empty arrays when nothing changed since timestamp', async () => {
    const future = new Date(Date.now() + 60_000);
    const delta = await pull({ shop_id: shopId, since: future });

    expect(delta.inventory.updated.length).toBe(0);
    expect(delta.bills.updated.length).toBe(0);
  });
});
