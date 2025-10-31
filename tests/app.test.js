process.env.NODE_ENV = 'test';
process.env.STORAGE_DRIVER = 'memory';
process.env.REDIS_URL = 'mock';
process.env.DATABASE_URL = ':memory:';

const request = require('supertest');
const app = require('../src/app');
const { getDocument } = require('../src/services/documentStore');
const { resetDatabase } = require('../src/database/client');
const { putObject, clearMemoryStore } = require('../src/services/storageService');
const { closeDocumentQueue, getDocumentQueue } = require('../src/queues/documentQueue');
const { stopDocumentParserWorker } = require('../src/workers/documentParser');

const waitForDocumentStatus = async (documentId, workspaceId, status, timeout = 5000) => {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const document = getDocument(documentId, workspaceId);
    if (document && document.status === status) {
      return document;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Document ${documentId} did not reach status ${status} in time.`);
};

beforeEach(async () => {
  resetDatabase();
  clearMemoryStore();
  const queue = getDocumentQueue();
  await queue.waitUntilReady();
  await queue.drain();
});

afterAll(async () => {
  await stopDocumentParserWorker();
  await closeDocumentQueue();
});

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
});

describe('Document upload pipeline', () => {
  const workspaceHeader = 'x-workspace-id';
  const workspaceId = 'ws_test_123';

  test('issues signed upload URL and processes uploaded text file', async () => {
    const signResponse = await request(app)
      .post('/api/files/upload-url')
      .set(workspaceHeader, workspaceId)
      .send({
        fileName: 'notes.txt',
        mimeType: 'text/plain',
        sizeBytes: 4096,
        description: 'Meeting notes'
      });

    expect(signResponse.status).toBe(200);
    expect(signResponse.body.uploadUrl).toBeDefined();
    expect(signResponse.body.documentId).toBeDefined();

    const textBuffer = Buffer.from('Hello world from text file', 'utf8');

    await putObject({
      key: signResponse.body.key,
      body: textBuffer,
      contentType: 'text/plain'
    });

    const completeResponse = await request(app)
      .post('/api/files/complete')
      .set(workspaceHeader, workspaceId)
      .send({ documentId: signResponse.body.documentId });

    expect(completeResponse.status).toBe(202);

    const parsedDocument = await waitForDocumentStatus(signResponse.body.documentId, workspaceId, 'parsed');

    expect(parsedDocument.mimeType).toBe('text/plain');
    expect(parsedDocument.hash).toBeDefined();
    expect(parsedDocument.normalizedText).toContain('Hello world');
    expect(parsedDocument.metadata.parsed.mimeType).toBe('text/plain');
  });

  test('rejects unsupported file types during sign request', async () => {
    const response = await request(app)
      .post('/api/files/upload-url')
      .set(workspaceHeader, workspaceId)
      .send({
        fileName: 'malware.exe',
        mimeType: 'application/octet-stream',
        sizeBytes: 2048
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('UnsupportedFileType');
  });

  test('fails completion when antivirus detects unsafe content', async () => {
    const signResponse = await request(app)
      .post('/api/files/upload-url')
      .set(workspaceHeader, workspaceId)
      .send({
        fileName: 'virus.txt',
        mimeType: 'text/plain',
        sizeBytes: 1024
      });

    expect(signResponse.status).toBe(200);

    const virusBuffer = Buffer.from('X5O!P%@AP[4\nPZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

    await putObject({
      key: signResponse.body.key,
      body: virusBuffer,
      contentType: 'text/plain'
    });

    const completeResponse = await request(app)
      .post('/api/files/complete')
      .set(workspaceHeader, workspaceId)
      .send({ documentId: signResponse.body.documentId });

    expect(completeResponse.status).toBe(422);
    expect(completeResponse.body.error).toBe('VirusDetected');

    const document = getDocument(signResponse.body.documentId, workspaceId);
    expect(document.status).toBe('rejected');
  });
});
