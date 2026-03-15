/**
 * Simple migration runner.
 * Reads all .sql files from src/db/migrations/ in numeric order,
 * tracks applied migrations in a _migrations table,
 * and applies only new ones.
 *
 * Usage:
 *   pnpm migrate          — apply pending migrations
 *   pnpm migrate:down     — not supported (add manually)
 *   pnpm migrate:status   — list applied migrations
 */

require('../src/config/env');
const fs   = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');
const logger = require('../src/utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, '../src/db/migrations');

const run = async () => {
  const client = await pool.connect();

  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows: applied } = await client.query(
      `SELECT filename FROM _migrations ORDER BY filename`
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    // Read migration files, sort numerically
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const pending = files.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      logger.info('Migrations: nothing to apply — all up to date.');
      return;
    }

    logger.info(`Migrations: ${pending.length} pending`);

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      logger.info(`Applying: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO _migrations (filename) VALUES ($1)`, [file]
        );
        await client.query('COMMIT');
        logger.info(`✓ ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error(`✗ ${file} — ${err.message}`);
        throw err;
      }
    }

    logger.info('Migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
};

const command = process.argv[2];

if (command === 'status') {
  (async () => {
    const client = await pool.connect();
    const { rows } = await client.query(
      `SELECT filename, applied_at FROM _migrations ORDER BY filename`
    ).catch(() => ({ rows: [] }));
    console.table(rows);
    client.release();
    await pool.end();
  })();
} else {
  run().catch(err => {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  });
}
