const express = require('express');
const { validateBody } = require('../middleware/validation');
const { userSchema, postSchema, crawlSchema } = require('../schemas');
const { sanitizeRichText, sanitizePlainText } = require('../utils/sanitize');
const { safeFetch } = require('../utils/urlValidation');

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

module.exports = router;
