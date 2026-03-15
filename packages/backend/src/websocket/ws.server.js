const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { jwt: jwtCfg } = require('../config/env');
const { handleMessage } = require('./ws.handlers');
const logger = require('../utils/logger');

// user_id → WebSocket instance
const registry = new Map();

const getRegistry = () => registry;

const initWsServer = (httpServer) => {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Extract token from query string: /ws?token=<JWT>
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    let user;
    try {
      user = jwt.verify(token, jwtCfg.secret);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    // Register socket
    const userId = String(user.user_id);
    registry.set(userId, ws);
    logger.info('WS: client connected', { user_id: userId, role: user.role });

    // Heartbeat — keep connection alive through proxies/NAT
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        handleMessage(ws, user, message);
      } catch {
        ws.send(JSON.stringify({ type: 'ERROR', payload: 'Invalid JSON' }));
      }
    });

    ws.on('close', () => {
      registry.delete(userId);
      logger.info('WS: client disconnected', { user_id: userId });
    });

    ws.on('error', (err) => {
      logger.error('WS error', { user_id: userId, error: err.message });
      registry.delete(userId);
    });

    // Confirm connection
    ws.send(JSON.stringify({ type: 'CONNECTED', payload: { user_id: userId, role: user.role } }));
  });

  // Ping all clients every 30s, terminate dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  logger.info('WS server initialised on /ws');
  return wss;
};

module.exports = { initWsServer, getRegistry };
