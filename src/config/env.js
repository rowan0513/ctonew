const path = require('path');
const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  REQUEST_SIZE_LIMIT: z.string().default('1mb'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  STORAGE_DRIVER: z.enum(['memory', 's3']),
  STORAGE_S3_BUCKET: z.string().min(1).default('documents'),
  STORAGE_S3_REGION: z.string().min(1).default('us-east-1'),
  STORAGE_S3_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_S3_FORCE_PATH_STYLE: z
    .union([z.boolean(), z.string()])
    .transform((value) => {
      if (typeof value === 'boolean') {
        return value;
      }

      return value === 'true';
    })
    .default(true),
  REDIS_URL: z.string().min(1),
  WORKSPACE_HEADER: z.string().min(1).default('x-workspace-id'),
  DATABASE_URL: z.string().min(1)
});

let cachedEnv;

const getEnv = () => {
  if (cachedEnv) {
    return cachedEnv;
  }

  const rawEnv = { ...process.env };

  if (!rawEnv.STORAGE_DRIVER) {
    rawEnv.STORAGE_DRIVER = rawEnv.NODE_ENV === 'test' ? 'memory' : 'memory';
  }

  if (!rawEnv.REDIS_URL) {
    rawEnv.REDIS_URL = rawEnv.NODE_ENV === 'test' ? 'mock' : 'redis://localhost:6379';
  }

  if (!rawEnv.DATABASE_URL) {
    rawEnv.DATABASE_URL = rawEnv.NODE_ENV === 'test' ? ':memory:' : path.join(__dirname, '../../data/storage.sqlite');
  }

  if (!rawEnv.STORAGE_S3_BUCKET) {
    rawEnv.STORAGE_S3_BUCKET = 'documents';
  }

  if (!rawEnv.STORAGE_S3_REGION) {
    rawEnv.STORAGE_S3_REGION = 'us-east-1';
  }

  if (!rawEnv.UPLOAD_MAX_BYTES) {
    rawEnv.UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
  }

  cachedEnv = envSchema.parse(rawEnv);
  return cachedEnv;
};

module.exports = {
  getEnv
};
