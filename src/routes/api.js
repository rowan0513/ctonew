const express = require('express');
const { validateBody, validateParams } = require('../middleware/validation');
const {
  userSchema,
  postSchema,
  crawlSchema,
  privacyToggleSchema,
  workspaceParamsSchema,
  workspaceDataSourceParamsSchema,
  dataSourceSchema
} = require('../schemas');
const { sanitizeRichText, sanitizePlainText } = require('../utils/sanitize');
const { safeFetch } = require('../utils/urlValidation');
const {
  registerDataSource,
  getDataSourceSnapshot,
  listDataSources,
  forgetData,
  setGlobalMasking,
  setWorkspaceMasking,
  getPrivacySettings,
  getAuditLog
} = require('../services/privacyService');

const router = express.Router();

const getActorId = (req) => req.context?.actorId || 'api-client';

router.post('/users', validateBody(userSchema), (req, res) => {
  const payload = res.locals.bodyValidated;
  const sanitizedBio = payload.bio ? sanitizeRichText(payload.bio) : undefined;

  const sanitizedUser = {
    name: sanitizePlainText(payload.name),
    email: payload.email,
    bio: sanitizedBio,
    website: payload.website,
    phone: payload.phone ? sanitizePlainText(payload.phone) : undefined
  };

  req.analytics.track('user.created', {
    email: sanitizedUser.email,
    phone: sanitizedUser.phone,
    name: sanitizedUser.name
  });

  res.status(201).json({ user: sanitizedUser });
});

router.post('/posts', validateBody(postSchema), (req, res) => {
  const payload = res.locals.bodyValidated;
  const sanitizedContent = sanitizeRichText(payload.content);
  const sanitizedTitle = sanitizePlainText(payload.title);

  req.analytics.track('post.created', {
    title: sanitizedTitle,
    tags: payload.tags || []
  });

  res.status(201).json({
    post: {
      title: sanitizedTitle,
      content: sanitizedContent,
      tags: payload.tags || []
    }
  });
});

router.post('/crawl', validateBody(crawlSchema), async (req, res, next) => {
  try {
    const payload = res.locals.bodyValidated;
    const crawlResult = await safeFetch(payload.url);

    req.analytics.track('crawl.completed', {
      url: payload.url,
      status: crawlResult.status
    });

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

router.post('/privacy/masking', validateBody(privacyToggleSchema), (req, res) => {
  const payload = res.locals.bodyValidated;
  const actorId = getActorId(req);

  const settings = setGlobalMasking(payload.enabled, { id: actorId });

  res.status(200).json({ settings });
});

router.post(
  '/workspaces/:workspaceId/privacy/masking',
  validateParams(workspaceParamsSchema),
  validateBody(privacyToggleSchema),
  (req, res) => {
    const { workspaceId } = res.locals.paramsValidated;
    const { enabled } = res.locals.bodyValidated;
    const actorId = getActorId(req);

    const settings = setWorkspaceMasking(workspaceId, enabled, { id: actorId });

    res.status(200).json({ settings });
  }
);

router.get('/privacy/settings', (req, res) => {
  const { workspaceId } = req.query;
  const settings = getPrivacySettings(workspaceId);

  res.status(200).json({ settings });
});

router.get('/privacy/audit', (req, res) => {
  const entries = getAuditLog();
  res.status(200).json({ entries });
});

router.post(
  '/workspaces/:workspaceId/data-sources',
  validateParams(workspaceParamsSchema),
  validateBody(dataSourceSchema),
  (req, res, next) => {
    try {
      const { workspaceId } = res.locals.paramsValidated;
      const payload = res.locals.bodyValidated;
      const actorId = getActorId(req);

      const dataSource = registerDataSource({
        workspaceId,
        dataSourceId: payload.id,
        originalFile: payload.originalFile ?? null,
        parsedDocuments: payload.parsedDocuments ?? [],
        chunks: payload.chunks ?? [],
        embeddings: payload.embeddings ?? [],
        indices: payload.indices ?? [],
        actor: { id: actorId }
      });

      res.status(201).json({ dataSource });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/workspaces/:workspaceId/data-sources', validateParams(workspaceParamsSchema), (req, res) => {
  const { workspaceId } = res.locals.paramsValidated;
  const dataSources = listDataSources(workspaceId).filter((dataSource) => !dataSource.deletedAt);

  res.status(200).json({ dataSources });
});

router.get(
  '/workspaces/:workspaceId/data-sources/:dataSourceId',
  validateParams(workspaceDataSourceParamsSchema),
  (req, res) => {
    const { workspaceId, dataSourceId } = res.locals.paramsValidated;
    const dataSource = getDataSourceSnapshot(workspaceId, dataSourceId);

    if (!dataSource || dataSource.deletedAt) {
      return res.status(404).json({ error: 'NotFound', message: 'Data source not found.' });
    }

    res.status(200).json({ dataSource });
  }
);

router.delete(
  '/workspaces/:workspaceId/data-sources/:dataSourceId',
  validateParams(workspaceDataSourceParamsSchema),
  async (req, res, next) => {
    try {
      const { workspaceId, dataSourceId } = res.locals.paramsValidated;
      const actorId = getActorId(req);

      const dataSource = forgetData({
        workspaceId,
        dataSourceId,
        actor: { id: actorId }
      });

      res.status(202).json({ dataSource });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
