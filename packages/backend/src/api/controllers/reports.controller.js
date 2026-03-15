const { query } = require('../../config/db');

const daily = async (req, res) => {
  const { shop_id } = req.user;
  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const { rows: summary } = await query(
    `SELECT
       COUNT(*)::int         AS bill_count,
       COALESCE(SUM(total), 0)::numeric  AS revenue,
       COALESCE(SUM(gst_amount), 0)::numeric AS gst_collected,
       COALESCE(SUM(discount), 0)::numeric   AS total_discount,
       COALESCE(AVG(total), 0)::numeric      AS avg_bill_value
     FROM bills
     WHERE shop_id = $1 AND DATE(created_at) = $2 AND voided_at IS NULL`,
    [shop_id, date]
  );

  // Hourly breakdown for the chart
  const { rows: hourly } = await query(
    `SELECT
       EXTRACT(HOUR FROM created_at)::int AS hour,
       COUNT(*)::int AS bills,
       COALESCE(SUM(total), 0)::numeric AS revenue
     FROM bills
     WHERE shop_id = $1 AND DATE(created_at) = $2 AND voided_at IS NULL
     GROUP BY hour ORDER BY hour`,
    [shop_id, date]
  );

  res.json({ date, summary: summary[0], hourly });
};

const weekly = async (req, res) => {
  const { shop_id } = req.user;
  const weekStart = req.query.week_start || (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().slice(0, 10);
  })();

  const { rows } = await query(
    `SELECT
       DATE(created_at) AS date,
       COUNT(*)::int AS bill_count,
       COALESCE(SUM(total), 0)::numeric AS revenue
     FROM bills
     WHERE shop_id = $1
       AND created_at >= $2::date
       AND created_at <  $2::date + INTERVAL '7 days'
       AND voided_at IS NULL
     GROUP BY DATE(created_at) ORDER BY date`,
    [shop_id, weekStart]
  );
  res.json({ week_start: weekStart, days: rows });
};

const monthly = async (req, res) => {
  const { shop_id } = req.user;
  const year  = req.query.year  || new Date().getFullYear();
  const month = req.query.month || new Date().getMonth() + 1;

  const { rows } = await query(
    `SELECT
       DATE(created_at) AS date,
       COUNT(*)::int AS bill_count,
       COALESCE(SUM(total), 0)::numeric AS revenue,
       COALESCE(SUM(gst_amount), 0)::numeric AS gst_collected
     FROM bills
     WHERE shop_id = $1
       AND EXTRACT(YEAR FROM created_at)  = $2
       AND EXTRACT(MONTH FROM created_at) = $3
       AND voided_at IS NULL
     GROUP BY DATE(created_at) ORDER BY date`,
    [shop_id, year, month]
  );
  res.json({ year, month, days: rows });
};

const topMedicines = async (req, res) => {
  const { shop_id } = req.user;
  const limit  = Math.min(req.query.limit || 10, 50);
  const period = req.query.period || 'today';

  const intervals = { today: '1 day', week: '7 days', month: '30 days' };
  const interval  = intervals[period] || '1 day';

  const { rows } = await query(
    `SELECT
       m.id, m.name, m.category,
       SUM(bi.qty)::int          AS units_sold,
       SUM(bi.qty * bi.unit_price)::numeric AS revenue
     FROM bill_items bi
     JOIN bills     b  ON b.id = bi.bill_id
     JOIN medicines m  ON m.id = bi.medicine_id
     WHERE b.shop_id = $1
       AND b.created_at >= NOW() - $2::INTERVAL
       AND b.voided_at IS NULL
     GROUP BY m.id, m.name, m.category
     ORDER BY units_sold DESC
     LIMIT $3`,
    [shop_id, interval, limit]
  );
  res.json({ period, medicines: rows });
};

const gstSummary = async (req, res) => {
  const { shop_id } = req.user;
  const year  = req.query.year  || new Date().getFullYear();
  const month = req.query.month || new Date().getMonth() + 1;

  const { rows } = await query(
    `SELECT
       bi.gst_rate,
       SUM(bi.qty * bi.unit_price)::numeric      AS taxable_value,
       SUM(bi.qty * bi.unit_price * bi.gst_rate / 100)::numeric AS gst_amount,
       COUNT(DISTINCT b.id)::int                 AS bill_count
     FROM bill_items bi
     JOIN bills b ON b.id = bi.bill_id
     WHERE b.shop_id = $1
       AND EXTRACT(YEAR  FROM b.created_at) = $2
       AND EXTRACT(MONTH FROM b.created_at) = $3
       AND b.voided_at IS NULL
     GROUP BY bi.gst_rate
     ORDER BY bi.gst_rate`,
    [shop_id, year, month]
  );
  res.json({ year, month, gst_breakup: rows });
};

module.exports = { daily, weekly, monthly, topMedicines, gstSummary };
