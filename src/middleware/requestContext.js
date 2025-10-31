const { randomUUID } = require('crypto');
const { runWithContext, getLogger } = require('../observability/logger');

const requestContextMiddleware = (req, res, next) => {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || randomUUID();
  const workspaceId = req.headers['x-workspace-id'] || 'anonymous';

  const context = {
    requestId,
    workspaceId,
    method: req.method,
    path: req.originalUrl,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  };

  runWithContext(context, () => {
    const contextualLogger = getLogger();
    res.locals.logger = contextualLogger;
    res.locals.context = context;
    req.context = context;
    res.setHeader('X-Request-Id', requestId);

    if (process.env.LOG_VERBOSE === 'true') {
      contextualLogger.debug({ event: 'http.request.received', headers: req.headers });
    } else {
      contextualLogger.debug({ event: 'http.request.received' });
    }

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const responseLogger = getLogger();
      responseLogger.info({
        event: 'http.request.completed',
        statusCode: res.statusCode,
        durationMs,
        contentLength: Number(res.getHeader('content-length') || 0)
      });
    });

    next();
  });
};

module.exports = {
  requestContextMiddleware
};
