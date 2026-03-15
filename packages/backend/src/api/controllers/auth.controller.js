const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/db');
const redisClient = require('../../config/redis');
const { jwt: jwtCfg } = require('../../config/env');

const signToken = (user) =>
  jwt.sign(
    { user_id: user.id, shop_id: user.shop_id, role: user.role },
    jwtCfg.secret,
    { expiresIn: jwtCfg.expiresIn }
  );

const login = async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT id, name, email, password_hash, role, shop_id, active
     FROM users WHERE email = $1 LIMIT 1`,
    [email.toLowerCase()]
  );

  const user = rows[0];

  if (!user || !user.active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);

  // Cache session in Redis for fast invalidation on logout
  await redisClient.setex(`session:${user.id}`, 7 * 24 * 60 * 60, token);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, shop_id: user.shop_id },
  });
};

const refresh = async (req, res) => {
  const { token } = req.body;
  try {
    const payload = jwt.verify(token, jwtCfg.secret, { ignoreExpiration: true });

    // Check token is not older than 30 days
    const issuedAt = payload.iat * 1000;
    if (Date.now() - issuedAt > 30 * 24 * 60 * 60 * 1000) {
      return res.status(401).json({ error: 'Token too old to refresh, please log in again' });
    }

    const { rows } = await query(
      'SELECT id, name, email, role, shop_id, active FROM users WHERE id = $1',
      [payload.user_id]
    );
    const user = rows[0];
    if (!user || !user.active) return res.status(401).json({ error: 'User not found or inactive' });

    const newToken = signToken(user);
    await redisClient.setex(`session:${user.id}`, 7 * 24 * 60 * 60, newToken);

    res.json({ token: newToken });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const logout = async (req, res) => {
  await redisClient.del(`session:${req.user.user_id}`);
  res.json({ message: 'Logged out' });
};

const me = async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.shop_id, s.name AS shop_name, s.gst_no
     FROM users u JOIN shops s ON s.id = u.shop_id
     WHERE u.id = $1`,
    [req.user.user_id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
};

module.exports = { login, refresh, logout, me };
