const { Pool } = require('pg');
const { db, isProduction } = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: db.url,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.debug('Postgres: new client connected');
});

pool.on('error', (err) => {
  logger.error('Postgres pool error', { error: err.message });
});

/**
 * Execute a query against the pool.
 * @param {string} text  SQL string
 * @param {Array}  params  Parameterised values
 */
const query = (text, params) => pool.query(text, params);

/**
 * Acquire a client for multi-statement transactions.
 * Always call client.release() in a finally block.
 */
const getClient = () => pool.connect();

/**
 * Run a callback inside a transaction.
 * Automatically commits on success, rolls back on error.
 *
 * @param {Function} fn  async (client) => result
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { query, getClient, withTransaction, pool };
