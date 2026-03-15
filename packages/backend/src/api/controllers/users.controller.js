const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { query } = require('../../config/db');

const list = async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, email, role, active, created_at
     FROM users WHERE shop_id = $1 ORDER BY name`,
    [req.user.shop_id]
  );
  res.json(rows);
};

const getById = async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, email, role, active, created_at
     FROM users WHERE id = $1 AND shop_id = $2`,
    [req.params.id, req.user.shop_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
};

const create = async (req, res) => {
  const { name, email, password, role } = req.body;
  const { shop_id } = req.user;

  const { rows: existing } = await query(
    `SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]
  );
  if (existing[0]) return res.status(409).json({ error: 'Email already in use' });

  const password_hash = await bcrypt.hash(password, 12);
  const id = uuidv4();

  const { rows } = await query(
    `INSERT INTO users (id, shop_id, name, email, password_hash, role)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, name, email, role, active, created_at`,
    [id, shop_id, name, email.toLowerCase(), password_hash, role]
  );
  res.status(201).json(rows[0]);
};

const update = async (req, res) => {
  const { name, email, password, role, active } = req.body;
  const updates = [];
  const params = [];

  if (name)     { params.push(name);                         updates.push(`name = $${params.length}`); }
  if (email)    { params.push(email.toLowerCase());          updates.push(`email = $${params.length}`); }
  if (password) { params.push(await bcrypt.hash(password, 12)); updates.push(`password_hash = $${params.length}`); }
  if (role)     { params.push(role);                         updates.push(`role = $${params.length}`); }
  if (active !== undefined) { params.push(active);           updates.push(`active = $${params.length}`); }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id, req.user.shop_id);
  const { rows } = await query(
    `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length - 1} AND shop_id = $${params.length}
     RETURNING id, name, email, role, active`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
};

const remove = async (req, res) => {
  // Prevent owner from deleting themselves
  if (req.params.id === req.user.user_id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const { rows } = await query(
    `UPDATE users SET active = false, updated_at = NOW()
     WHERE id = $1 AND shop_id = $2 RETURNING id`,
    [req.params.id, req.user.shop_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deactivated' });
};

module.exports = { list, getById, create, update, remove };
