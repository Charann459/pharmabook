/**
 * Bootstrap script — creates the first shop and owner account.
 * Run once after migrations.
 *
 * Usage:
 *   node scripts/create-owner.js \
 *     --shop "Rajan Medical Store" \
 *     --name "Rajan Krishnamurthy" \
 *     --email owner@example.com \
 *     --password yourpassword
 */

require('../src/config/env');
const { query, pool } = require('../src/config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const args = process.argv.slice(2).reduce((acc, val, i, arr) => {
  if (val.startsWith('--')) acc[val.slice(2)] = arr[i + 1];
  return acc;
}, {});

const required = ['shop', 'name', 'email', 'password'];
for (const key of required) {
  if (!args[key]) {
    console.error(`Missing required argument: --${key}`);
    process.exit(1);
  }
}

const run = async () => {
  const shopId  = uuidv4();
  const ownerId = uuidv4();
  const hash    = await bcrypt.hash(args.password, 12);

  await query(
    `INSERT INTO shops (id, name, address, phone, gst_no)
     VALUES ($1, $2, $3, $4, $5)`,
    [shopId, args.shop, args.address || null, args.phone || null, args.gst_no || null]
  );

  await query(
    `INSERT INTO users (id, shop_id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, 'owner')`,
    [ownerId, shopId, args.name, args.email.toLowerCase(), hash]
  );

  console.log('✓ Shop created:');
  console.log(`  Shop ID  : ${shopId}`);
  console.log(`  Shop name: ${args.shop}`);
  console.log('✓ Owner created:');
  console.log(`  User ID  : ${ownerId}`);
  console.log(`  Email    : ${args.email}`);
  console.log(`  Role     : owner`);
  console.log('\nLogin with these credentials on the PharmaBook app.');

  await pool.end();
};

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
