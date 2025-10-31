const request = require('supertest');
const app = require('../src/app');

const originalDbUrl = process.env.DATABASE_URL;
const originalRedisUrl = process.env.REDIS_URL;
const originalOpenAIKey = process.env.OPENAI_API_KEY;

describe('Health check endpoint', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://observer:password@localhost:5432/observability';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.DATABASE_HEALTHCHECK_FAIL;
    delete process.env.REDIS_HEALTHCHECK_FAIL;
    delete process.env.OPENAI_HEALTHCHECK_FAIL;
  });

  afterAll(() => {
    if (originalDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDbUrl;
    }

    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = originalRedisUrl;
    }

    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
  });

  test('returns dependency status and uptime information', async () => {
    const response = await request(app).get('/admin/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptimeMs).toBe('number');
    expect(response.body.dependencies.database.status).toBe('ok');
    expect(response.body.dependencies.redis.status).toBe('ok');
    expect(response.body.dependencies.openai.status).toBe('ok');
  });
});
