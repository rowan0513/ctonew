const { runWithContext, getLogger, addContext } = require('../src/observability/logger');

describe('Structured logger context utilities', () => {
  test('propagates context metadata into logger bindings', () => {
    runWithContext({ requestId: 'req-123', workspaceId: 'ws-456' }, () => {
      const contextualLogger = getLogger({ feature: 'test-suite' });
      const bindings = contextualLogger.bindings();

      expect(bindings.requestId).toBe('req-123');
      expect(bindings.workspaceId).toBe('ws-456');
      expect(bindings.feature).toBe('test-suite');

      addContext({ path: '/api/chat', method: 'POST' });
      const updatedBindings = getLogger().bindings();

      expect(updatedBindings.path).toBe('/api/chat');
      expect(updatedBindings.method).toBe('POST');
      expect(updatedBindings.requestId).toBe('req-123');
      expect(updatedBindings.workspaceId).toBe('ws-456');
    });
  });
});
