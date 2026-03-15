const { v4: uuidv4 } = require('uuid');
const { query } = require('../../config/db');
const barcodeService = require('../../services/barcode.service');

const list = async (req, res) => {
  const { shop_id } = req.user;
  const { category, search, global: globalOnly, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let sql = `
    SELECT * FROM medicines
    WHERE (global = true OR shop_id = $1)
    AND deleted_at IS NULL
  `;
  const params = [shop_id];

  if (category) {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    sql += ` AND name ILIKE $${params.length}`;
  }
  if (globalOnly === 'true') {
    sql += ` AND global = true`;
  }

  sql += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await query(sql, params);
  res.json(rows);
};

const getById = async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM medicines WHERE id = $1 AND deleted_at IS NULL`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Medicine not found' });
  res.json(rows[0]);
};

const resolveBarcode = async (req, res) => {
  const { barcode } = req.params;
  const { shop_id } = req.user;

  const medicine = await barcodeService.resolve(barcode, shop_id);

  if (!medicine) {
    return res.status(404).json({ error: 'Barcode not found', barcode, action: 'manual_entry' });
  }

  res.json(medicine);
};

const search = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const { rows } = await query(
    `SELECT id, name, barcode, mrp, gst_rate, category
     FROM medicines
     WHERE (global = true OR shop_id = $1)
       AND deleted_at IS NULL
       AND name ILIKE $2
     ORDER BY name ASC LIMIT 20`,
    [req.user.shop_id, `%${q}%`]
  );
  res.json(rows);
};

const create = async (req, res) => {
  const { barcode, name, mrp, gst_rate, category, global: isGlobal } = req.body;
  const { shop_id, user_id } = req.user;

  // Prevent duplicate barcode within scope
  const existing = await barcodeService.resolve(barcode, shop_id);
  if (existing) {
    return res.status(409).json({ error: 'Medicine with this barcode already exists', existing });
  }

  const id = uuidv4();
  const { rows } = await query(
    `INSERT INTO medicines (id, barcode, name, mrp, gst_rate, category, global, shop_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [id, barcode, name, mrp, gst_rate, category, isGlobal, isGlobal ? null : shop_id, user_id]
  );

  // Cache immediately in Redis
  await barcodeService.cache(barcode, rows[0]);

  res.status(201).json(rows[0]);
};

const update = async (req, res) => {
  const fields = req.body;
  const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = Object.values(fields);

  const { rows } = await query(
    `UPDATE medicines SET ${sets}, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [req.params.id, ...values]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Medicine not found' });

  // Invalidate cache
  await barcodeService.invalidate(rows[0].barcode);

  res.json(rows[0]);
};

const remove = async (req, res) => {
  const { rows } = await query(
    `UPDATE medicines SET deleted_at = NOW() WHERE id = $1 RETURNING barcode`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Medicine not found' });
  await barcodeService.invalidate(rows[0].barcode);
  res.json({ message: 'Medicine deleted' });
};

const promote = async (req, res) => {
  const { rows } = await query(
    `UPDATE medicines SET global = true, shop_id = NULL, updated_at = NOW()
     WHERE id = $1 AND global = false RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Medicine not found or already global' });
  await barcodeService.cache(rows[0].barcode, rows[0]);
  res.json(rows[0]);
};

module.exports = { list, getById, resolveBarcode, search, create, update, remove, promote };
