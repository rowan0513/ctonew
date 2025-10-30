const { getEnv } = require('../config/env');

const WORKSPACE_ID_PATTERN = /^[a-zA-Z0-9_-]{3,100}$/;

const requireWorkspaceAuth = (req, res, next) => {
  const { WORKSPACE_HEADER } = getEnv();
  const workspaceId = req.get(WORKSPACE_HEADER);

  if (!workspaceId) {
    return res.status(401).json({
      error: 'WorkspaceUnauthorized',
      message: 'Workspace identifier header is required.'
    });
  }

  if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
    return res.status(400).json({
      error: 'InvalidWorkspaceIdentifier',
      message: 'Workspace identifier format is invalid.'
    });
  }

  res.locals.workspace = {
    id: workspaceId
  };

  return next();
};

module.exports = {
  requireWorkspaceAuth
};
