const logger = require('../utils/logger');

/**
 * Handle incoming messages from connected devices.
 * Devices can send:
 *   PING          — keep-alive (server replies PONG)
 *   NOTIF_ACK     — acknowledge a notification (future: read receipts)
 */
const handleMessage = (ws, user, message) => {
  const { type, payload } = message;

  switch (type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG', ts: new Date().toISOString() }));
      break;

    case 'NOTIF_ACK':
      // Future: mark notification as read in DB
      logger.debug('WS NOTIF_ACK', { user_id: user.user_id, payload });
      break;

    default:
      logger.warn('WS: unknown message type', { type, user_id: user.user_id });
      ws.send(JSON.stringify({ type: 'ERROR', payload: `Unknown message type: ${type}` }));
  }
};

module.exports = { handleMessage };
