const request = require('supertest');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = require('../src/api/app');
const { pool } = require('../src/config/db');
const { jwt: jwtCfg } = require('../src/config/env');

describe('rate limiting', () => {
    it('does not block authenticated API request when shop_id is available in JWT', async () => {
        const token = jwt.sign(
            {
                user_id: uuidv4(),
                shop_id: uuidv4(),
                role: 'owner',
            },
            jwtCfg.secret,
            { expiresIn: jwtCfg.expiresIn }
        );

        const res = await request(app)
            .get('/api/shops/me')
            .set('Authorization', `Bearer ${token}`);

        // Random shop_id does not exist, so app should return 404.
        // The important check is that rate limiter does not return 429.
        expect(res.statusCode).toBe(404);
        expect(res.statusCode).not.toBe(429);
    });

    it('falls back to IP-based key when no JWT is provided', async () => {
        const res = await request(app).get('/api/shops/me');

        // Route auth should reject it, not rate limiter.
        expect(res.statusCode).toBe(401);
        expect(res.statusCode).not.toBe(429);
    });

    afterAll(async () => {
        await pool.end();
    });
});