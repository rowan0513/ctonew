const {
  maskValueForWorkspace,
  recordAnalyticsEvent,
  setWorkspaceMasking,
  setGlobalMasking,
  getPrivacySettings
} = require('../services/privacyService');

const getWorkspaceId = (req) => req.headers['x-workspace-id'] || req.query.workspaceId || 'global';
const getActorId = (req) => req.headers['x-actor-id'] || req.headers['x-user-id'] || req.query.actorId || 'anonymous';

const piiMaskingMiddleware = (req, res, next) => {
  const workspaceId = getWorkspaceId(req);
  const actorId = getActorId(req);

  req.context = {
    workspaceId,
    actorId
  };

  req.maskForLogs = (value) => maskValueForWorkspace(workspaceId, value);

  req.analytics = {
    track: (name, payload = {}) =>
      recordAnalyticsEvent({
        workspaceId,
        name,
        payload,
        actor: { id: actorId }
      })
  };

  req.privacy = {
    enableWorkspaceMasking: (enabled) => setWorkspaceMasking(workspaceId, enabled, { id: actorId }),
    enableGlobalMasking: (enabled) => setGlobalMasking(enabled, { id: actorId }),
    settings: () => getPrivacySettings(workspaceId)
  };

  res.locals.workspaceId = workspaceId;
  res.locals.actorId = actorId;

  next();
};

module.exports = piiMaskingMiddleware;
