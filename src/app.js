require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const apiRouter = require('./routes/api');
const adminRouter = require('./routes/admin');
const fileUploadRouter = require('./routes/fileUpload');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandlers');
const { startDocumentParserWorker } = require('./workers/documentParser');
const { requestContextMiddleware } = require('./middleware/requestContext');
const { jobQueue } = require('./services/jobQueue');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.locals.jobQueue = jobQueue;

const requestSizeLimit = process.env.REQUEST_SIZE_LIMIT || '1mb';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 60 * 60 * 24 * 60, preload: true },
    referrerPolicy: { policy: 'no-referrer' }
  })
);

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

app.use(requestContextMiddleware);

app.use(express.json({ limit: requestSizeLimit }));
app.use(express.urlencoded({ extended: true, limit: requestSizeLimit }));
app.use(express.text({ limit: requestSizeLimit }));

app.use((req, res, next) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (process.env.NODE_ENV === 'production' && !isSecure) {
    if (res.locals.logger) {
      res.locals.logger.warn({ event: 'http.insecure', host: req.hostname }, 'Rejected insecure request in production.');
    }

    return res.status(400).json({
      error: 'HTTPSRequired',
      message: 'HTTPS is required for this endpoint.'
    });
  }

  return next();
});

app.use('/api/files', fileUploadRouter);
app.use('/api', apiRouter);
app.use('/admin', adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

if (process.env.DISABLE_BACKGROUND_WORKERS !== 'true') {
  startDocumentParserWorker();
}

module.exports = app;
