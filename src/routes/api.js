const express = require('express');
const { validateBody } = require('../middleware/validation');
const { chatSchema, userSchema, postSchema, crawlSchema } = require('../schemas');
const { sanitizeRichText, sanitizePlainText } = require('../utils/sanitize');
const { safeFetch } = require('../utils/urlValidation');
const { chatRateLimit } = require('../middleware/rateLimit');
const { jobQueue } = require('../services/jobQueue');

const router = express.Router();

router.post('/users', validateBody(userSchema), (req, res) => {
  const payload = res.locals.bodyValidated;
  const sanitizedBio = payload.bio ? sanitizeRichText(payload.bio) : undefined;

  const sanitizedUser = {
    name: sanitizePlainText(payload.name),
    email: payload.email,
    bio: sanitizedBio,
    website: payload.website
  };

  res.status(201).json({ user: sanitizedUser });
});

router.post('/posts', validateBody(postSchema), (req, res) => {
  const payload = res.locals.bodyValidated;
  const sanitizedContent = sanitizeRichText(payload.content);

  res.status(201).json({
    post: {
      title: sanitizePlainText(payload.title),
      content: sanitizedContent,
      tags: payload.tags || []
    }
  });
});

router.post('/crawl', validateBody(crawlSchema), async (req, res, next) => {
  try {
    const payload = res.locals.bodyValidated;
    const crawlResult = await safeFetch(payload.url);

    res.status(200).json({
      url: payload.url,
      status: crawlResult.status,
      headers: crawlResult.headers,
      preview: crawlResult.body.slice(0, 2000)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/chat', chatRateLimit, validateBody(chatSchema), async (req, res, next) => {
  const logger = res.locals.logger;

  try {
    const payload = res.locals.bodyValidated;
    const workspaceId = (req.context && req.context.workspaceId) || req.headers['x-workspace-id'] || 'anonymous';
    const requestId = req.context && req.context.requestId;

    const job = jobQueue.enqueue('chat-response', {
      message: payload.message,
      model: payload.model,
      workspaceId,
      requestId
    });

    const result = await job.finished;

    if (logger) {
      logger.info(
        {
          event: 'chat.response.ready',
          jobId: job.id,
          model: result.model
        },
        'Chat response generated.'
      );
    }

    const rateLimitInfo = res.locals.rateLimit
      ? {
          limit: res.locals.rateLimit.limit,
          remaining: res.locals.rateLimit.remaining,
          resetAt: new Date(res.locals.rateLimit.reset).toISOString()
        }
      : undefined;

    res.status(200).json({
      jobId: job.id,
      status: job.status,
      response: result,
      rateLimit: rateLimitInfo
    });
  } catch (error) {
    if (logger) {
      logger.error({ event: 'chat.response.error', err: error }, 'Failed to process chat request.');
    }
    next(error);
  }
});

module.exports = router;
