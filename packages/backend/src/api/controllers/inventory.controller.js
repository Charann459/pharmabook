const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../../config/db');
const notificationService = require('../../services/notification.service');
const { inventory: invCfg } = require('../../config/env');

const list = async (req, res) => {
  const { shop_id } = req.user;
  const { category, low_stock, expiring_days } = req.query;

  let sql = `
    SELECT i.*, m.name, m.barcode, m.mrp, m.gst_rate, m.category
    FROM inventory i
    JOIN medicines m ON m.id = i.medicine_id
    WHERE i.shop_id = $1 AND i.deleted_at IS NULL
  `;
  const params = [shop_id];

  if (low_stock === 'true') {
    sql += ` AND i.qty <= i.low_stock_threshold`;
  }
  if (expiring_days) {
    params.push(expiring_days);
    sql += ` AND i.expiry_date <= NOW() + ($${params.length} || ' days')::INTERVAL`;
  }
  if (category) {
    params.push(category);
    sql += ` AND m.category = $${params.length}`;
  }

  sql += ` ORDER BY i.expiry_date ASC`;

  const { rows } = await query(sql, params);
  res.json(rows);
};

const getById = async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, m.name, m.barcode, m.mrp, m.category
     FROM inventory i JOIN medicines m ON m.id = i.medicine_id
     WHERE i.id = $1 AND i.shop_id = $2 AND i.deleted_at IS NULL`,
    [req.params.id, req.user.shop_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Inventory item not found' });
  res.json(rows[0]);
};

const lowStock = async (req, res) => {
  const { rows } = await query(
    `SELECT i.*, m.name, m.barcode, m.category
     FROM inventory i JOIN medicines m ON m.id = i.medicine_id
     WHERE i.shop_id = $1 AND i.qty <= i.low_stock_threshold AND i.deleted_at IS NULL
     ORDER BY i.qty ASC`,
    [req.user.shop_id]
  );
  res.json(rows);
};

const expiring = async (req, res) => {
  const days = req.query.days || invCfg.expiryWarnDays;
  const { rows } = await query(
    `SELECT i.*, m.name, m.barcode, m.category
     FROM inventory i JOIN medicines m ON m.id = i.medicine_id
     WHERE i.shop_id = $1
       AND i.expiry_date <= NOW() + ($2 || ' days')::INTERVAL
       AND i.expiry_date > NOW()
       AND i.deleted_at IS NULL
     ORDER BY i.expiry_date ASC`,
    [req.user.shop_id, days]
  );
  res.json(rows);
};

const addStock = async (req, res) => {
  const { medicine_id, qty, batch_no, expiry_date, low_stock_threshold } = req.body;
  const { shop_id, user_id } = req.user;

  const id = uuidv4();
  const { rows } = await query(
    `INSERT INTO inventory
       (id, medicine_id, shop_id, qty, batch_no, expiry_date, low_stock_threshold, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [id, medicine_id, shop_id, qty, batch_no, expiry_date,
     low_stock_threshold || invCfg.lowStockThreshold, user_id]
  );

  // Fetch medicine name for notification
  const { rows: medRows } = await query(
    `SELECT name FROM medicines WHERE id = $1`, [medicine_id]
  );

  // Notify owner of stock update
  await notificationService.sendToShopOwner(shop_id, {
    type: 'STOCK_UPDATE',
    payload: {
      medicine_id,
      medicine_name: medRows[0]?.name,
      qty_added: qty,
      new_total: rows[0].qty,
      batch_no,
      expiry_date,
      updated_by: user_id,
    },
  });

  res.status(201).json(rows[0]);
};

const adjust = async (req, res) => {
  const { qty, reason } = req.body;
  const { shop_id, user_id } = req.user;

  const result = await withTransaction(async (client) => {
    const { rows: current } = await client.query(
      `SELECT qty, low_stock_threshold, medicine_id FROM inventory
       WHERE id = $1 AND shop_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [req.params.id, shop_id]
    );
    if (!current[0]) throw Object.assign(new Error('Inventory item not found'), { status: 404 });

    const newQty = current[0].qty + qty;
    if (newQty < 0) throw Object.assign(new Error('Adjustment would result in negative stock'), { status: 400 });

    const { rows: updated } = await client.query(
      `UPDATE inventory SET qty = $1, updated_by = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [newQty, user_id, req.params.id]
    );

    // Alert owner if now below threshold
    if (newQty <= current[0].low_stock_threshold) {
      await notificationService.sendToShopOwner(shop_id, {
        type: 'LOW_STOCK',
        payload: {
          inventory_id: req.params.id,
          medicine_id: current[0].medicine_id,
          qty: newQty,
          threshold: current[0].low_stock_threshold,
          reason,
        },
      });
    }

    return updated[0];
  });

  res.json(result);
};

const remove = async (req, res) => {
  const { rows } = await query(
    `UPDATE inventory SET deleted_at = NOW() WHERE id = $1 AND shop_id = $2 RETURNING id`,
    [req.params.id, req.user.shop_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Inventory item not found' });
  res.json({ message: 'Inventory item deleted' });
};

module.exports = { list, getById, lowStock, expiring, addStock, adjust, remove };
