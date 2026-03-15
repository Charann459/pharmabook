const syncService = require('../../services/sync.service');

const push = async (req, res) => {
  const { changes, last_pulled_at } = req.body;
  const { shop_id, user_id } = req.user;

  await syncService.push({ changes, shop_id, user_id });
  res.json({ message: 'Push accepted' });
};

const pull = async (req, res) => {
  const { last_pulled_at } = req.query;
  const { shop_id } = req.user;

  const timestamp = last_pulled_at ? new Date(Number(last_pulled_at)) : new Date(0);
  const delta = await syncService.pull({ shop_id, since: timestamp });

  res.json({
    changes: delta,
    timestamp: Date.now(),
  });
};

module.exports = { push, pull };
