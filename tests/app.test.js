const request = require('supertest');
const app = require('../src/app');

describe('API validation and security middleware', () => {
  test('rejects invalid user payloads', async () => {
    const response = await request(app).post('/api/users').send({
      name: '',
      email: 'invalid'
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  test('sanitizes post content before responding', async () => {
    const response = await request(app)
      .post('/api/posts')
      .send({
        title: 'Hello',
        content: '<p>content</p><script>alert(1)</script>',
        tags: ['general']
      });

    expect(response.status).toBe(201);
    expect(response.body.post.content).toContain('<p>content</p>');
    expect(response.body.post.content).not.toContain('<script>');
  });

  test('enforces CSP and security headers on admin route', async () => {
    const response = await request(app).get('/admin/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['strict-transport-security']).toBeDefined();
  });

  test('flags suspicious file uploads', async () => {
    const response = await request(app)
      .post('/api/files')
      .field('description', 'contains secrets')
      .attach('file', Buffer.from('password=super-secret'), 'secrets.txt');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('flagged');
    expect(response.body.issues.length).toBeGreaterThan(0);
  });
});
