const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = require('../src/api/app');
const { query, pool } = require('../src/config/db');
const { jwt: jwtCfg } = require('../src/config/env');

const shopId = uuidv4();
const ownerId = uuidv4();
const cashierId = uuidv4();

const ownerToken = jwt.sign(
    { user_id: ownerId, shop_id: shopId, role: 'owner' },
    jwtCfg.secret,
    { expiresIn: jwtCfg.expiresIn }
);

const cashierToken = jwt.sign(
    { user_id: cashierId, shop_id: shopId, role: 'cashier' },
    jwtCfg.secret,
    { expiresIn: jwtCfg.expiresIn }
);

beforeAll(async () => {
    const passwordHash = await bcrypt.hash('secret123', 10);

    await query(
        `INSERT INTO shops (id, name, address, phone, gst_no)
     VALUES ($1, 'Original Shop', 'Old Address', '9999999999', 'GSTOLD123')`,
        [shopId]
    );

    await query(
        `INSERT INTO users (id, shop_id, name, email, password_hash, role)
     VALUES ($1,$2,'Owner','owner-shop@test.com',$3,'owner')`,
        [ownerId, shopId, passwordHash]
    );

    await query(
        `INSERT INTO users (id, shop_id, name, email, password_hash, role)
     VALUES ($1,$2,'Cashier','cashier-shop@test.com',$3,'cashier')`,
        [cashierId, shopId, passwordHash]
    );
});

afterAll(async () => {
    await query('DELETE FROM users WHERE id IN ($1, $2)', [ownerId, cashierId]);
    await query('DELETE FROM shops WHERE id = $1', [shopId]);
    await pool.end();
});

describe('shops API', () => {
    it('GET /api/shops/me returns current user shop details', async () => {
        const res = await request(app)
            .get('/api/shops/me')
            .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.shop).toBeDefined();
        expect(res.body.shop.id).toBe(shopId);
        expect(res.body.shop.name).toBe('Original Shop');
        expect(res.body.shop.gst_no).toBe('GSTOLD123');
    });

    it('PUT /api/shops/me allows owner to update shop details', async () => {
        const res = await request(app)
            .put('/api/shops/me')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
                name: 'Updated Shop',
                address: 'New Address',
                phone: '8888888888',
                gst_no: 'GSTNEW123',
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.shop.name).toBe('Updated Shop');
        expect(res.body.shop.address).toBe('New Address');
        expect(res.body.shop.phone).toBe('8888888888');
        expect(res.body.shop.gst_no).toBe('GSTNEW123');
    });

    it('PUT /api/shops/me blocks non-owner users', async () => {
        const res = await request(app)
            .put('/api/shops/me')
            .set('Authorization', `Bearer ${cashierToken}`)
            .send({
                name: 'Cashier Update Attempt',
            });

        expect(res.statusCode).toBe(403);
    });

    it('GET /api/shops/me requires authentication', async () => {
        const res = await request(app).get('/api/shops/me');

        expect(res.statusCode).toBe(401);
    });
});