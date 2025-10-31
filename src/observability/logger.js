const { AsyncLocalStorage } = require('async_hooks');
const pino = require('pino');

const contextStorage = new AsyncLocalStorage();

const isDev = process.env.NODE_ENV !== 'production';
const baseLogLevel = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
const shouldPrettyPrint = isDev && process.env.LOG_PRETTY !== 'false';

const loggerOptions = {
  level: baseLogLevel,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: 'message',
  enabled: process.env.NODE_ENV !== 'test' || process.env.ENABLE_LOGGING_IN_TESTS === 'true'
};

const transport = shouldPrettyPrint
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  : undefined;

const baseLogger = transport ? pino(loggerOptions, pino.transport(transport)) : pino(loggerOptions);

const sanitizeBindings = (bindings = {}) =>
  Object.fromEntries(Object.entries(bindings).filter(([, value]) => value !== undefined && value !== null));

const runWithContext = (context, callback) => contextStorage.run(sanitizeBindings(context), callback);

const getContext = () => contextStorage.getStore() || {};

const addContext = (additionalContext = {}) => {
  const current = getContext();
  contextStorage.enterWith(sanitizeBindings({ ...current, ...additionalContext }));
};

const getLogger = (bindings = {}) => {
  const contextBindings = getContext();
  return baseLogger.child(sanitizeBindings({ ...contextBindings, ...bindings }));
};

module.exports = {
  logger: baseLogger,
  runWithContext,
  getContext,
  addContext,
  getLogger,
  contextStorage
};
