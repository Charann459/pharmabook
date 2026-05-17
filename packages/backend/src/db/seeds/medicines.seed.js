require('../../../src/config/env');

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { query, pool } = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

const SEED_FILE = process.env.SEED_FILE || path.join(__dirname, 'sample_medicines.csv');
const BATCH_SIZE = 500;

const run = async () => {
  if (!fs.existsSync(SEED_FILE)) {
    logger.warn(`Seed file not found: ${SEED_FILE}`);
    logger.info('Creating sample seed file with 5 example medicines...');

    fs.writeFileSync(
      SEED_FILE,
      `barcode,name,mrp,gst_rate,category\n` +
      `8901234567890,Dolo 650mg (Strip of 15),28.50,12,Analgesic\n` +
      `8902345678901,Azithromycin 500mg (Strip of 5),88.00,12,Antibiotic\n` +
      `8903456789012,Pantoprazole 40mg (Strip of 15),62.00,12,Antacid\n` +
      `8904567890123,Metformin 500mg (Strip of 10),28.00,5,Antidiabetic\n` +
      `8905678901234,Vitamin D3 60K IU (Strip of 4),120.00,12,Vitamin\n`
    );
  }

  const csv = fs.readFileSync(SEED_FILE, 'utf8');
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  logger.info(`Seeding ${records.length} medicines...`);

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    for (const r of batch) {
      try {
        const result = await query(
          `
          INSERT INTO medicines (
            id,
            barcode,
            name,
            mrp,
            gst_rate,
            category,
            global
          )
          VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT (barcode) DO NOTHING
          `,
          [
            uuidv4(),
            r.barcode,
            r.name,
            parseFloat(r.mrp),
            parseFloat(r.gst_rate),
            r.category,
          ]
        );

        if (result.rowCount === 1) {
          inserted++;
        } else {
          skipped++;
        }
      } catch (err) {
        skipped++;
        logger.warn(`Skipped row: ${r.barcode} — ${err.message}`);
      }
    }

    logger.info(`Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
  }

  logger.info(`Seed complete. ${inserted} medicines inserted, ${skipped} skipped.`);
  await pool.end();
};

run().catch((err) => {
  logger.error('Seed failed', { error: err.message });
  process.exit(1);
});