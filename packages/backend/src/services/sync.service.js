const { withTransaction, query } = require('../config/db');
const logger = require('../utils/logger');

const SYNCABLE_TABLES = ['medicines', 'inventory', 'bills', 'bill_items'];
const SOFT_DELETE_TABLES = ['medicines', 'inventory'];

// Per-table shop scope filter
const SHOP_FILTER = {
  medicines:  { filter: `(global = true OR shop_id = $1)`, params: (s) => [s] },
  inventory:  { filter: `shop_id = $1`,                    params: (s) => [s] },
  bills:      { filter: `shop_id = $1`,                    params: (s) => [s] },
  bill_items: {
    filter: `bill_id IN (SELECT id FROM bills WHERE shop_id = $1)`,
    params: (s) => [s],
  },
};

// bill_items is immutable — it only has created_at, no updated_at
const TIMESTAMP_COL = {
  medicines:  'updated_at',
  inventory:  'updated_at',
  bills:      'updated_at',
  bill_items: 'created_at',
};

const push = async ({ changes, shop_id, user_id }) => {
  await withTransaction(async (client) => {
    for (const table of SYNCABLE_TABLES) {
      const tableChanges = changes[table];
      if (!tableChanges) continue;

      for (const record of tableChanges.created || []) {
        try {
          const cols = Object.keys(record).join(', ');
          const vals = Object.values(record);
          const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
          await client.query(
            `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
            vals
          );
        } catch (err) {
          logger.warn(`Sync push: insert conflict on ${table}`, { id: record.id, err: err.message });
        }
      }

      for (const record of tableChanges.updated || []) {
        const { id, updated_at, ...fields } = record;

        // Inventory qty: apply delta strategy to avoid overwrite conflicts
        if (table === 'inventory' && fields.qty !== undefined) {
          const { rows: current } = await client.query(
            `SELECT qty, updated_at FROM inventory WHERE id = $1 FOR UPDATE`, [id]
          );
          if (current[0]) {
            const serverTs = new Date(current[0].updated_at);
            const clientTs = new Date(updated_at);
            if (clientTs > serverTs) {
              await client.query(
                `UPDATE inventory SET qty = $1, updated_at = $2 WHERE id = $3`,
                [fields.qty, updated_at, id]
              );
            }
            continue;
          }
        }

        const sets = Object.keys(fields).map((k, i) => `${k} = $${i + 2}`).join(', ');
        if (!sets) continue;
        await client.query(
          `UPDATE ${table} SET ${sets}, updated_at = $${Object.keys(fields).length + 2}
           WHERE id = $1 AND updated_at < $${Object.keys(fields).length + 2}`,
          [id, ...Object.values(fields), updated_at]
        );
      }

      for (const id of tableChanges.deleted || []) {
        if (SOFT_DELETE_TABLES.includes(table)) {
          await client.query(`UPDATE ${table} SET deleted_at = NOW() WHERE id = $1`, [id]);
        }
      }
    }
  });
};

const pull = async ({ shop_id, since }) => {
  const delta = {};

  for (const table of SYNCABLE_TABLES) {
    const hasSoftDelete  = SOFT_DELETE_TABLES.includes(table);
    const { filter, params } = SHOP_FILTER[table];
    const tsCol          = TIMESTAMP_COL[table];
    const scopeParams    = params(shop_id);
    const sinceIdx       = scopeParams.length + 1;
    const activeFilter   = hasSoftDelete ? `AND deleted_at IS NULL` : '';

    const { rows: updated } = await query(
      `SELECT * FROM ${table}
       WHERE ${filter} AND ${tsCol} > $${sinceIdx} ${activeFilter}`,
      [...scopeParams, since]
    );

    let deleted = [];
    if (hasSoftDelete) {
      const { rows } = await query(
        `SELECT id FROM ${table}
         WHERE ${filter} AND deleted_at > $${sinceIdx}`,
        [...scopeParams, since]
      );
      deleted = rows.map((r) => r.id);
    }

    delta[table] = { created: [], updated, deleted };
  }

  return delta;
};

module.exports = { push, pull };