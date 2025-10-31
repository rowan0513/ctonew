const { logger } = require('./logger');

let telemetryEnabled = false;
let errorTrackingEnabled = false;

const initializeTelemetry = ({ logger: providedLogger } = {}) => {
  const log = providedLogger || logger;

  if (process.env.ENABLE_TELEMETRY === 'true') {
    telemetryEnabled = true;
    log.info({ event: 'telemetry.initialized' }, 'Telemetry hooks prepared (OpenTelemetry stub).');
  } else {
    log.debug({ event: 'telemetry.disabled' }, 'Telemetry is disabled. Set ENABLE_TELEMETRY=true to activate.');
  }

  return { enabled: telemetryEnabled };
};

const initializeErrorTracking = ({ logger: providedLogger } = {}) => {
  const log = providedLogger || logger;

  if (process.env.ENABLE_SENTRY === 'true') {
    errorTrackingEnabled = true;
    log.info({ event: 'error_tracking.initialized' }, 'Error tracking hooks prepared (Sentry stub).');
  } else {
    log.debug({ event: 'error_tracking.disabled' }, 'Error tracking is disabled. Set ENABLE_SENTRY=true to activate.');
  }

  return { enabled: errorTrackingEnabled };
};

const captureException = (error, context = {}) => {
  if (!errorTrackingEnabled) {
    return false;
  }

  const log = context.logger || logger;
  log.error(
    {
      event: 'error_tracking.capture',
      err: error,
      context: { ...context, logger: undefined }
    },
    'Captured exception with error tracking stub.'
  );

  return true;
};

module.exports = {
  initializeTelemetry,
  initializeErrorTracking,
  captureException,
  isTelemetryEnabled: () => telemetryEnabled,
  isErrorTrackingEnabled: () => errorTrackingEnabled
};
