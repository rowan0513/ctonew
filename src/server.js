const app = require('./app');
const { logger } = require('./observability/logger');
const { initializeTelemetry, initializeErrorTracking } = require('./observability/instrumentation');

const PORT = Number(process.env.PORT || 3000);

initializeTelemetry({ logger });
initializeErrorTracking({ logger });

const server = app.listen(PORT, () => {
  logger.info({ event: 'server.start', port: PORT }, 'Secure server listening.');
});

const gracefulShutdown = (signal) => {
  logger.info({ event: 'server.shutdown.signal', signal }, 'Received shutdown signal.');

  server.close(() => {
    logger.info({ event: 'server.shutdown.complete' }, 'HTTP server closed gracefully.');
    process.exit(0);
  });
};

['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => gracefulShutdown(signal));
});

process.on('uncaughtException', (error) => {
  logger.error({ event: 'server.uncaughtException', err: error }, 'Uncaught exception detected.');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ event: 'server.unhandledRejection', reason }, 'Unhandled promise rejection detected.');
  gracefulShutdown('unhandledRejection');
});
