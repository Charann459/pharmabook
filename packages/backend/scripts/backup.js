require('../src/config/env');

const { runDatabaseBackup } = require('../src/services/backup.service');
const logger = require('../src/utils/logger');

runDatabaseBackup()
    .then((result) => {
        if (result.skipped) {
            logger.warn(`Backup skipped: ${result.reason}`);
        } else {
            logger.info(`Backup complete: ${result.key}`);
        }

        process.exit(0);
    })
    .catch((err) => {
        logger.error('Backup command failed', { error: err.message });
        process.exit(1);
    });