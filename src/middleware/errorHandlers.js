const { ZodError } = require('zod');
const { getLogger } = require('../observability/logger');

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'NotFound', message: 'The requested resource could not be located.' });
};

// Extract at most some part of error to avoid leaking internals
const serializeError = (error) => ({
  name: error.name,
  message: error.message
});

// eslint-disable-next-line no-unused-vars
const errorHandler = (error, req, res, next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'PayloadTooLarge', message: 'Request payload exceeds the allowed limit.' });
  }

  const status = error.statusCode || error.status || 500;
  const message = status >= 500 ? 'An unexpected error occurred.' : error.message;
  const logger = (res && res.locals && res.locals.logger) || getLogger();
  const logPayload = {
    event: 'http.error',
    statusCode: status,
    error: {
      name: error.name,
      message: error.message
    }
  };

  if (status >= 500) {
    if (process.env.LOG_VERBOSE === 'true' && error.stack) {
      logPayload.error.stack = error.stack;
    }
    logger.error(logPayload, 'Unhandled server error.');
  } else {
    logger.warn(logPayload, 'Handled request error.');
  }

  res.status(status).json({
    error: error.code || error.name || 'InternalServerError',
    details: status >= 500 ? undefined : serializeError(error),
    message
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
