const redisClient = require('../config/redis');
const { query } = require('../config/db');
const { barcode: cfg } = require('../config/env');

const cacheKey = (barcode) => `barcode:${barcode}`;

/**
 * Full resolution chain:
 * 1. Redis cache
 * 2. Postgres global medicines
 * 3. Postgres shop-scoped medicines
 * 4. Returns null → caller shows manual entry
 */
const resolve = async (barcode, shop_id) => {
  // Step 1: Redis
  const cached = await redisClient.get(cacheKey(barcode));
  if (cached) return JSON.parse(cached);

  // Step 2: Global medicines (branded, seeded)
  const { rows: global } = await query(
    `SELECT * FROM medicines WHERE barcode = $1 AND global = true AND deleted_at IS NULL LIMIT 1`,
    [barcode]
  );
  if (global[0]) {
    await cache(barcode, global[0]);
    return global[0];
  }

  // Step 3: Shop-scoped (previously entered local medicine)
  const { rows: scoped } = await query(
    `SELECT * FROM medicines WHERE barcode = $1 AND shop_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [barcode, shop_id]
  );
  if (scoped[0]) {
    await cache(barcode, scoped[0]);
    return scoped[0];
  }

  return null;
};

const cache = async (barcode, medicine) => {
  await redisClient.setex(cacheKey(barcode), cfg.cacheTtl, JSON.stringify(medicine));
};

const invalidate = async (barcode) => {
  await redisClient.del(cacheKey(barcode));
};

module.exports = { resolve, cache, invalidate };
