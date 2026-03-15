const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { withTransaction, query } = require('../../config/db');
const billingService = require('../../services/billing.service');
const inventoryService = require('../../services/inventory.service');
const { addJob } = require('../../workers');
const { pdf: pdfCfg } = require('../../config/env');

const create = async (req, res) => {
  const { items, discount, client_local_id } = req.body;
  const { shop_id, user_id } = req.user;

  // Idempotency: if same client_local_id seen before, return existing bill
  if (client_local_id) {
    const { rows: existing } = await query(
      `SELECT * FROM bills WHERE client_local_id = $1 AND shop_id = $2`,
      [client_local_id, shop_id]
    );
    if (existing[0]) return res.status(200).json(existing[0]);
  }

  const bill = await withTransaction(async (client) => {
    const totals = billingService.calculateTotals(items, discount);

    // Auto-increment bill_no per shop
    const { rows: numRow } = await client.query(
      `SELECT COALESCE(MAX(bill_no), 0) + 1 AS next FROM bills WHERE shop_id = $1`,
      [shop_id]
    );

    const id = uuidv4();
    const { rows } = await client.query(
      `INSERT INTO bills
         (id, bill_no, shop_id, cashier_id, subtotal, gst_amount, discount, total, client_local_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [id, numRow[0].next, shop_id, user_id,
       totals.subtotal, totals.gst_amount, discount, totals.total, client_local_id || null]
    );

    const bill = rows[0];

    // Insert bill_items
    for (const item of totals.items) {
      await client.query(
        `INSERT INTO bill_items (id, bill_id, medicine_id, qty, unit_price, gst_rate)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuidv4(), id, item.medicine_id, item.qty, item.unit_price, item.gst_rate]
      );
    }

    // Deduct stock inside same transaction
    await inventoryService.deductStock(client, shop_id, items, user_id);

    return bill;
  });

  // Enqueue PDF generation asynchronously — does not block the response
  await addJob('pdf', { bill_id: bill.id, shop_id });

  res.status(201).json(bill);
};

const list = async (req, res) => {
  const { shop_id } = req.user;
  const { date, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let sql = `SELECT * FROM bills WHERE shop_id = $1 AND voided_at IS NULL`;
  const params = [shop_id];

  if (date) {
    params.push(date);
    sql += ` AND DATE(created_at) = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await query(sql, params);
  res.json(rows);
};

const getById = async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM bills WHERE id = $1 AND shop_id = $2`,
    [req.params.id, req.user.shop_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });

  const { rows: items } = await query(
    `SELECT bi.*, m.name, m.barcode
     FROM bill_items bi JOIN medicines m ON m.id = bi.medicine_id
     WHERE bi.bill_id = $1`,
    [req.params.id]
  );

  res.json({ ...rows[0], items });
};

const getPdf = async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM bills WHERE id = $1 AND shop_id = $2`,
    [req.params.id, req.user.shop_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Bill not found' });

  const filePath = path.join(pdfCfg.outputDir, `${req.params.id}.pdf`);
  const fs = require('fs');

  if (!fs.existsSync(filePath)) {
    // Re-enqueue if PDF missing
    await addJob('pdf', { bill_id: req.params.id, shop_id: req.user.shop_id });
    return res.status(202).json({ message: 'PDF being generated, try again in a few seconds' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bill-${rows[0].bill_no}.pdf"`);
  fs.createReadStream(filePath).pipe(res);
};

const voidBill = async (req, res) => {
  const { rows } = await query(
    `UPDATE bills SET voided_at = NOW() WHERE id = $1 AND shop_id = $2 AND voided_at IS NULL RETURNING *`,
    [req.params.id, req.user.shop_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Bill not found or already voided' });
  res.json(rows[0]);
};

module.exports = { create, list, getById, getPdf, voidBill };
