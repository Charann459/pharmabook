const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const { db, backup } = require('../config/env');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

const hasS3Config = () => (
    backup.s3BucketName &&
    backup.awsAccessKeyId &&
    backup.awsSecretAccessKey &&
    backup.awsRegion
);

const createS3Client = () => new S3Client({
    region: backup.awsRegion,
    credentials: {
        accessKeyId: backup.awsAccessKeyId,
        secretAccessKey: backup.awsSecretAccessKey,
    },
});

const buildBackupFileName = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `pharmabook-${timestamp}.sql`;
};

const runPgDump = async (outputPath) => {
    const env = {
        ...process.env,
        PGPASSWORD: db.password,
    };

    await execFileAsync(
        'pg_dump',
        [
            '-h', db.host,
            '-p', String(db.port),
            '-U', db.user,
            '-d', db.database,
            '-F', 'p',
            '-f', outputPath,
        ],
        { env }
    );
};

const uploadBackupToS3 = async ({ filePath, key }) => {
    const s3 = createS3Client();

    await s3.send(new PutObjectCommand({
        Bucket: backup.s3BucketName,
        Key: key,
        Body: fs.createReadStream(filePath),
        ContentType: 'application/sql',
    }));
};

const cleanupOldBackups = async () => {
    const s3 = createS3Client();
    const prefix = 'db-backups/';
    const cutoff = Date.now() - backup.retentionDays * 24 * 60 * 60 * 1000;

    const listed = await s3.send(new ListObjectsV2Command({
        Bucket: backup.s3BucketName,
        Prefix: prefix,
    }));

    const oldObjects = (listed.Contents || []).filter((obj) => {
        if (!obj.LastModified) return false;
        return obj.LastModified.getTime() < cutoff;
    });

    for (const obj of oldObjects) {
        await s3.send(new DeleteObjectCommand({
            Bucket: backup.s3BucketName,
            Key: obj.Key,
        }));

        logger.info(`Deleted old backup from S3: ${obj.Key}`);
    }

    return oldObjects.length;
};

const runDatabaseBackup = async () => {
    if (!hasS3Config()) {
        logger.warn('Database backup skipped: S3 configuration is incomplete');
        return {
            skipped: true,
            reason: 'S3 configuration is incomplete',
        };
    }

    const fileName = buildBackupFileName();
    const tempPath = path.join(os.tmpdir(), fileName);
    const s3Key = `db-backups/${fileName}`;

    try {
        logger.info(`Database backup started: ${fileName}`);

        await runPgDump(tempPath);
        await uploadBackupToS3({ filePath: tempPath, key: s3Key });
        const deletedCount = await cleanupOldBackups();

        logger.info(`Database backup uploaded successfully: s3://${backup.s3BucketName}/${s3Key}`);

        return {
            skipped: false,
            key: s3Key,
            deletedOldBackups: deletedCount,
        };
    } catch (err) {
        logger.error('Database backup failed', { error: err.message });
        throw err;
    } finally {
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
};

module.exports = {
    runDatabaseBackup,
    hasS3Config,
};