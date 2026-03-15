const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  POSTGRES_HOST: Joi.string().default('postgres'),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_DB: Joi.string().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),

  REDIS_HOST: Joi.string().default('redis'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  PDF_OUTPUT_DIR: Joi.string().default('/app/pdfs'),
  BARCODE_CACHE_TTL_SECONDS: Joi.number().default(86400),
  LOW_STOCK_DEFAULT_THRESHOLD: Joi.number().default(10),
  EXPIRY_WARN_DAYS: Joi.number().default(30),

  CORS_ORIGINS: Joi.string().default('http://localhost:8081'),
}).unknown(true);

const { error, value } = schema.validate(process.env);

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

module.exports = {
  env: value.NODE_ENV,
  port: value.PORT,
  isProduction: value.NODE_ENV === 'production',
  isTest: value.NODE_ENV === 'test',

  db: {
    url: value.DATABASE_URL,
    host: value.POSTGRES_HOST,
    port: value.POSTGRES_PORT,
    database: value.POSTGRES_DB,
    user: value.POSTGRES_USER,
    password: value.POSTGRES_PASSWORD,
  },

  redis: {
    host: value.REDIS_HOST,
    port: value.REDIS_PORT,
    password: value.REDIS_PASSWORD,
  },

  jwt: {
    secret: value.JWT_SECRET,
    expiresIn: value.JWT_EXPIRES_IN,
  },

  pdf: {
    outputDir: value.PDF_OUTPUT_DIR,
  },

  barcode: {
    cacheTtl: value.BARCODE_CACHE_TTL_SECONDS,
  },

  inventory: {
    lowStockThreshold: value.LOW_STOCK_DEFAULT_THRESHOLD,
    expiryWarnDays: value.EXPIRY_WARN_DAYS,
  },

  cors: {
    origins: value.CORS_ORIGINS.split(',').map(o => o.trim()),
  },
};
