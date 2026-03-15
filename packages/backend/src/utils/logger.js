const { createLogger, format, transports } = require('winston');
const { env } = require('../config/env');

const logger = createLogger({
  level: env === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp(),
    env === 'production'
      ? format.json()
      : format.combine(format.colorize(), format.simple())
  ),
  transports: [new transports.Console()],
});

module.exports = logger;
