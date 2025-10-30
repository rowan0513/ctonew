const request = require('supertest');
const app = require('../src/app');
const { workspaceRateLimiter } = require('../src/middleware/rateLimit');

const originalLimit = process.env.CHAT_RATE_LIMIT;
const originalWindow = process.env.CHAT_RATE_LIMIT_WINDOW_MS;

describe('Chat rate limiting middleware', () => {
  beforeEach(() => {
    process.env.CHAT_RATE_LIMIT = '2';
    process.env.CHAT_RATE_LIMIT_WINDOW_MS = '1000';
    workspaceRateLimiter.reset();
  });

  afterAll(() => {
    if (originalLimit === undefined) {
      delete process.env.CHAT_RATE_LIMIT;
    } else {
      process.env.CHAT_RATE_LIMIT = originalLimit;
    }

    if (originalWindow === undefined) {
      delete process.env.CHAT_RATE_LIMIT_WINDOW_MS;
    } else {
      process.env.CHAT_RATE_LIMIT_WINDOW_MS = originalWindow;
    }

    workspaceRateLimiter.reset();
  });

  test('enforces per-workspace limits and surfaces headers', async () => {
    const workspaceId = 'workspace-alpha';

    const first = await request(app)
      .post('/api/chat')
      .set('X-Workspace-Id', workspaceId)
      .send({ message: 'Hello there' });

    expect(first.status).toBe(200);
    expect(first.headers['x-ratelimit-limit']).toBe('2');
    expect(Number(first.headers['x-ratelimit-remaining'])).toBe(1);
    expect(first.body.rateLimit.limit).toBe(2);
    expect(typeof first.body.rateLimit.resetAt).toBe('string');

    const second = await request(app)
      .post('/api/chat')
      .set('X-Workspace-Id', workspaceId)
      .send({ message: 'Second message' });

    expect(second.status).toBe(200);
    expect(Number(second.headers['x-ratelimit-remaining'])).toBe(0);

    const third = await request(app)
      .post('/api/chat')
      .set('X-Workspace-Id', workspaceId)
      .send({ message: 'This should be limited' });

    expect(third.status).toBe(429);
    expect(third.body.error).toBe('RateLimitExceeded');
    expect(third.headers['retry-after']).toBeDefined();

    const otherWorkspace = await request(app)
      .post('/api/chat')
      .set('X-Workspace-Id', 'workspace-beta')
      .send({ message: 'Different workspace should pass' });

    expect(otherWorkspace.status).toBe(200);

    const summary = await request(app).get('/admin/jobs/summary');

    expect(summary.status).toBe(200);
    expect(summary.body.metrics.completed).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(summary.body.jobs.completed)).toBe(true);

    const metrics = await request(app).get('/admin/jobs/metrics');
    expect(metrics.status).toBe(200);
    expect(metrics.text).toContain('job_queue_completed_total');
  });
});
