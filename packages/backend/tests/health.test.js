const request = require('supertest');
const app = require('../src/api/app');

describe('Health API', () => {
    it('GET /health should return ok status', async () => {
        const res = await request(app).get('/health');

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('ts');
    });
});