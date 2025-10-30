const request = require('supertest');
const app = require('../src/app');
const {
  resetState,
  setGlobalMasking,
  setWorkspaceMasking,
  getAnalyticsEvents,
  getDataSourceSnapshot,
  getReindexJobs,
  getAuditLog
} = require('../src/services/privacyService');

const WORKSPACE_ID = 'workspace-test';

describe('Privacy controls', () => {
  beforeEach(() => {
    resetState();
  });

  test('masks PII in analytics events when global masking is enabled', async () => {
    setGlobalMasking(true, { id: 'tester' });

    const response = await request(app)
      .post('/api/users')
      .set('x-workspace-id', WORKSPACE_ID)
      .send({
        name: 'Masked User',
        email: 'masked.user@example.com',
        phone: '+1 (555) 123-4567'
      });

    expect(response.status).toBe(201);

    const events = getAnalyticsEvents();
    expect(events.length).toBe(1);
    const recorded = events[0];
    expect(recorded.masked).toBe(true);
    expect(recorded.payload.email).toMatch(/\[\[hash:/);
    expect(recorded.payload.email).not.toContain('masked.user@example.com');
    expect(recorded.payload.phone).toMatch(/\[\[hash:/);
  });

  test('respects workspace masking overrides', async () => {
    setGlobalMasking(false, { id: 'tester' });
    setWorkspaceMasking(WORKSPACE_ID, true, { id: 'tester' });

    await request(app)
      .post('/api/users')
      .set('x-workspace-id', WORKSPACE_ID)
      .send({
        name: 'Workspace User',
        email: 'workspace.user@example.com',
        phone: '+44 20 1234 5678'
      });

    const events = getAnalyticsEvents();
    expect(events.length).toBe(1);
    expect(events[0].masked).toBe(true);
    expect(events[0].payload.email).not.toContain('workspace.user@example.com');
  });

  test('does not mask analytics when disabled', async () => {
    setGlobalMasking(false, { id: 'tester' });

    await request(app)
      .post('/api/users')
      .set('x-workspace-id', WORKSPACE_ID)
      .send({
        name: 'Visible User',
        email: 'visible.user@example.com',
        phone: '555-111-2222'
      });

    const events = getAnalyticsEvents();
    expect(events.length).toBe(1);
    expect(events[0].masked).toBe(false);
    expect(events[0].payload.email).toBe('visible.user@example.com');
    expect(events[0].payload.phone).toBe('555-111-2222');
  });

  test('forget data workflow removes resources, reindexes, and logs actions', async () => {
    await request(app)
      .post(`/api/workspaces/${WORKSPACE_ID}/data-sources`)
      .set('x-actor-id', 'auditor')
      .send({
        id: 'source-1',
        originalFile: {
          key: 'uploads/source-1/file.txt',
          location: 'https://example.com/uploads/source-1/file.txt'
        },
        parsedDocuments: [
          { id: 'doc-1', content: 'Document 1' },
          { id: 'doc-2', content: 'Document 2' }
        ],
        chunks: [{ id: 'chunk-1', content: 'Chunk data' }],
        embeddings: [{ id: 'emb-1', vector: [0.1, 0.2, 0.3] }],
        indices: [{ name: 'primary', ready: true }]
      });

    const dataSourceBefore = getDataSourceSnapshot(WORKSPACE_ID, 'source-1');
    expect(dataSourceBefore).toBeTruthy();
    expect(dataSourceBefore.parsedDocuments.length).toBe(2);

    const forgetResponse = await request(app)
      .delete(`/api/workspaces/${WORKSPACE_ID}/data-sources/source-1`)
      .set('x-actor-id', 'auditor');

    expect(forgetResponse.status).toBe(202);
    expect(forgetResponse.body.dataSource.deletedAt).toBeDefined();
    expect(forgetResponse.body.dataSource.originalFile).toBeNull();
    expect(forgetResponse.body.dataSource.parsedDocuments).toEqual([]);
    expect(forgetResponse.body.dataSource.chunks).toEqual([]);
    expect(forgetResponse.body.dataSource.embeddings).toEqual([]);
    expect(forgetResponse.body.dataSource.indices).toEqual([]);
    expect(forgetResponse.body.dataSource.lastReindexedAt).toBeDefined();

    const dataSourceAfter = getDataSourceSnapshot(WORKSPACE_ID, 'source-1');
    expect(dataSourceAfter.deletedAt).toBeDefined();
    expect(dataSourceAfter.parsedDocuments).toEqual([]);

    const reindexJobs = getReindexJobs();
    expect(reindexJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ workspaceId: WORKSPACE_ID, dataSourceId: 'source-1' })
      ])
    );

    const auditEntries = getAuditLog().filter((entry) => entry.metadata.dataSourceId === 'source-1');
    const forgetEntry = auditEntries.find((entry) => entry.action === 'FORGET_DATA');
    const reindexEntry = auditEntries.find((entry) => entry.action === 'REINDEX_TRIGGERED');
    expect(forgetEntry).toBeDefined();
    expect(forgetEntry.actor.id).toBe('auditor');
    expect(reindexEntry).toBeDefined();

    const getResponse = await request(app).get(`/api/workspaces/${WORKSPACE_ID}/data-sources/source-1`);
    expect(getResponse.status).toBe(404);
  });

  test('audit log captures masking toggles with actor context', async () => {
    const response = await request(app)
      .post('/api/privacy/masking')
      .set('x-actor-id', 'privacy-admin')
      .send({ enabled: true });

    expect(response.status).toBe(200);

    const auditEntries = getAuditLog().filter((entry) => entry.action === 'MASKING_TOGGLED');
    expect(auditEntries.length).toBeGreaterThan(0);
    expect(auditEntries[auditEntries.length - 1].actor.id).toBe('privacy-admin');
  });
});
