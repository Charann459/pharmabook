const request = require('supertest');
const app = require('../src/api/app');
const { pool } = require('../src/config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Test fixtures
const shopId = uuidv4();
const ownerId = uuidv4();
const ownerEmail = `owner_${Date.now()}@test.com`;

beforeAll(async () => {
  await pool.query(`INSERT INTO shops (id, name) VALUES ($1, 'Test Shop')`, [shopId]);
  const hash = await bcrypt.hash('password123', 12);
  await pool.query(
    `INSERT INTO users (id, shop_id, name, email, password_hash, role)
     VALUES ($1,$2,'Test Owner',$3,$4,'owner')`,
    [ownerId, shopId, ownerEmail, hash]
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM users WHERE id = $1`, [ownerId]);
  await pool.query(`DELETE FROM shops WHERE id = $1`, [shopId]);
  await pool.end();
});

describe('POST /api/auth/login', () => {
  it('returns 200 + token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('owner');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });
});

describe('GET /api/auth/me', () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ownerEmail, password: 'password123' });
    token = res.body.token;
  });

  it('returns user info with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ownerEmail);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
