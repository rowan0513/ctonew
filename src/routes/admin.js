const express = require('express');
const { buildHealthReport } = require('../services/healthCheck');
const { jobQueue } = require('../services/jobQueue');

const router = express.Router();

router.get('/health', async (req, res, next) => {
  try {
    const report = await buildHealthReport();
    const statusCode = report.status === 'ok' ? 200 : 503;

    res.cookie('admin-session', 'placeholder', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 5 * 60 * 1000
    });

    if (res.locals.logger) {
      res.locals.logger.info({ event: 'health.report', status: report.status }, 'Generated health report.');
    }

    res.status(statusCode).json(report);
  } catch (error) {
    if (res.locals.logger) {
      res.locals.logger.error({ event: 'health.report.error', err: error }, 'Failed to generate health report.');
    }

    next(error);
  }
});

router.get('/jobs/summary', (req, res) => {
  const summary = jobQueue.getSummary();

  if (res.locals.logger) {
    res.locals.logger.debug({ event: 'jobs.summary', metrics: summary.metrics }, 'Returning job queue summary.');
  }

  res.status(200).json(summary);
});

router.get('/jobs/metrics', (req, res) => {
  res.type('text/plain; version=0.0.4; charset=utf-8');
  res.send(jobQueue.renderMetrics());
});

router.post('/jobs/:jobId/retry', (req, res, next) => {
  try {
    const job = jobQueue.retryJob(req.params.jobId);

    if (res.locals.logger) {
      res.locals.logger.info({ event: 'jobs.retry', jobId: job.id }, 'Retrying failed job.');
    }

    res.status(202).json({
      job: {
        id: job.id,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts
      }
    });
  } catch (error) {
    if (res.locals.logger) {
      res.locals.logger.warn({ event: 'jobs.retry.error', jobId: req.params.jobId, err: error }, 'Unable to retry job.');
    }

    next(error);
  }
});

module.exports = router;
