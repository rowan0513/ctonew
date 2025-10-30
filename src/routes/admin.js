const express = require('express');
const { getPrivacySettings, setGlobalMasking, setWorkspaceMasking, getAuditLog } = require('../services/privacyService');

const router = express.Router();

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const parseBoolean = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).toLowerCase();
  if (['true', 'on', 'enabled', 'yes', '1'].includes(normalized)) {
    return true;
  }

  if (['false', 'off', 'disabled', 'no', '0'].includes(normalized)) {
    return false;
  }

  return null;
};

const renderPrivacyPage = (settings, workspaceId) => {
  const workspaceOverride =
    settings.workspaceMaskingEnabled === null ? 'inherit' : settings.workspaceMaskingEnabled ? 'true' : 'false';
  const safeWorkspaceId = escapeHtml(workspaceId || '');

  const overridesList =
    settings.workspaceOverrides
      .map(
        (override) =>
          `<li><strong>${escapeHtml(override.workspaceId)}</strong>: ${override.enabled ? 'Enabled' : 'Disabled'}</li>`
      )
      .join('') || '<li>No overrides configured.</li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Privacy Controls</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    h1 { margin-bottom: 0.5rem; }
    section { margin-bottom: 2rem; }
    form { display: flex; flex-direction: column; gap: 0.5rem; max-width: 420px; }
    label { font-weight: 600; }
    input, select, button { padding: 0.5rem; font-size: 1rem; }
    ul { list-style: disc; padding-left: 1.5rem; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; }
  </style>
</head>
<body>
  <h1>Privacy Controls</h1>
  <p>Configure PII masking and invoke "forget data" workflows per workspace.</p>

  <section class="card">
    <h2>Global PII Masking</h2>
    <form method="post" action="/admin/privacy/masking">
      <input type="hidden" name="scope" value="global" />
      <label for="global-enabled">Masking status</label>
      <select id="global-enabled" name="enabled">
        <option value="true" ${settings.globalMaskingEnabled ? 'selected' : ''}>Enabled</option>
        <option value="false" ${!settings.globalMaskingEnabled ? 'selected' : ''}>Disabled</option>
      </select>
      <button type="submit">Update global setting</button>
    </form>
  </section>

  <section class="card">
    <h2>Workspace Overrides</h2>
    <form method="post" action="/admin/privacy/masking">
      <input type="hidden" name="scope" value="workspace" />
      <label for="workspace-id">Workspace ID</label>
      <input id="workspace-id" name="workspaceId" value="${safeWorkspaceId}" placeholder="workspace-123" required />
      <label for="workspace-enabled">Masking status</label>
      <select id="workspace-enabled" name="enabled">
        <option value="true" ${workspaceOverride === 'true' ? 'selected' : ''}>Enabled</option>
        <option value="false" ${workspaceOverride === 'false' ? 'selected' : ''}>Disabled</option>
        <option value="inherit" ${workspaceOverride === 'inherit' ? 'selected' : ''}>Inherit global</option>
      </select>
      <button type="submit">Save workspace setting</button>
    </form>
    <h3>Configured overrides</h3>
    <ul>${overridesList}</ul>
  </section>

  <section class="card">
    <h2>Audit Log</h2>
    <p><a href="/admin/audit" target="_blank">View audit log JSON</a></p>
  </section>
</body>
</html>`;
};

router.get('/health', (req, res) => {
  res.cookie('admin-session', 'placeholder', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 5 * 60 * 1000
  });

  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/privacy', (req, res) => {
  const workspaceId = req.query.workspaceId;
  const settings = getPrivacySettings(workspaceId);

  res.type('html').send(renderPrivacyPage(settings, workspaceId));
});

router.post('/privacy/masking', (req, res) => {
  const scope = req.body.scope === 'workspace' ? 'workspace' : 'global';
  const actorId = req.context?.actorId || 'admin-ui';

  if (scope === 'global') {
    const enabled = parseBoolean(req.body.enabled);
    setGlobalMasking(Boolean(enabled), { id: actorId });
    return res.redirect('/admin/privacy');
  }

  const workspaceId = req.body.workspaceId;
  if (!workspaceId) {
    return res.status(400).send('Workspace ID is required for workspace overrides.');
  }

  const enabledRaw = req.body.enabled;
  const enabled = parseBoolean(enabledRaw);
  const actor = { id: actorId };

  if (enabled === null && enabledRaw === 'inherit') {
    setWorkspaceMasking(workspaceId, null, actor);
  } else {
    setWorkspaceMasking(workspaceId, enabled ?? false, actor);
  }

  res.redirect(`/admin/privacy?workspaceId=${encodeURIComponent(workspaceId)}`);
});

router.get('/audit', (req, res) => {
  res.status(200).json({ entries: getAuditLog() });
});

module.exports = router;
