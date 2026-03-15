const { getRegistry } = require('../websocket/ws.server');
const { query } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Send a WebSocket message to a specific user.
 */
const sendToUser = (user_id, message) => {
  const registry = getRegistry();
  const ws = registry.get(String(user_id));

  if (ws && ws.readyState === 1) { // 1 = OPEN
    ws.send(JSON.stringify({ ...message, ts: new Date().toISOString() }));
    logger.debug('WS notification sent', { user_id, type: message.type });
    return true;
  }

  logger.debug('WS: user not connected, notification dropped', { user_id, type: message.type });
  return false;
};

/**
 * Send a message to the owner of a shop.
 * Looks up the owner's user_id from the DB.
 */
const sendToShopOwner = async (shop_id, message) => {
  const { rows } = await query(
    `SELECT id FROM users WHERE shop_id = $1 AND role = 'owner' AND active = true LIMIT 1`,
    [shop_id]
  );
  if (!rows[0]) return false;
  return sendToUser(rows[0].id, message);
};

/**
 * Broadcast a message to all connected users of a shop.
 */
const broadcastToShop = async (shop_id, message) => {
  const { rows } = await query(
    `SELECT id FROM users WHERE shop_id = $1 AND active = true`,
    [shop_id]
  );
  const registry = getRegistry();
  let sent = 0;

  for (const user of rows) {
    const ws = registry.get(String(user.id));
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ ...message, ts: new Date().toISOString() }));
      sent++;
    }
  }
  return sent;
};

module.exports = { sendToUser, sendToShopOwner, broadcastToShop };
