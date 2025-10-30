const { maskValue } = require('../utils/pii');

const INITIAL_GLOBAL_MASKING = process.env.GLOBAL_PII_MASKING === 'true';

const createInitialState = () => ({
  globalMaskingEnabled: INITIAL_GLOBAL_MASKING,
  workspaceMasking: new Map(),
  dataSources: new Map(),
  analyticsEvents: [],
  auditLog: [],
  reindexJobs: []
});

let state = createInitialState();

const nowIso = () => new Date().toISOString();

const normalizeActor = (actor) => {
  if (!actor) {
    return { id: 'system' };
  }

  if (typeof actor === 'string') {
    return { id: actor };
  }

  if (!actor.id) {
    return { ...actor, id: 'unknown' };
  }

  return actor;
};

const cloneDataSource = (dataSource) => {
  if (!dataSource) {
    return null;
  }

  return {
    ...dataSource,
    originalFile: dataSource.originalFile ? { ...dataSource.originalFile } : null,
    parsedDocuments: dataSource.parsedDocuments.map((doc) => ({ ...doc })),
    chunks: dataSource.chunks.map((chunk) => ({ ...chunk })),
    embeddings: dataSource.embeddings.map((embedding) => ({ ...embedding })),
    indices: dataSource.indices.map((index) => ({ ...index }))
  };
};

const clonePayload = (payload) => {
  if (payload === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(payload));
};

const recordAudit = (action, metadata, actor) => {
  const entry = {
    action,
    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : {},
    actor: normalizeActor(actor),
    timestamp: nowIso()
  };

  state.auditLog.push(entry);
  return entry;
};

const ensureWorkspaceMap = (workspaceId) => {
  if (!state.dataSources.has(workspaceId)) {
    state.dataSources.set(workspaceId, new Map());
  }

  return state.dataSources.get(workspaceId);
};

const isMaskingEnabled = (workspaceId) => {
  if (workspaceId && state.workspaceMasking.has(workspaceId)) {
    return state.workspaceMasking.get(workspaceId);
  }

  return state.globalMaskingEnabled;
};

const maskValueForWorkspace = (workspaceId, value) => {
  if (!isMaskingEnabled(workspaceId)) {
    return value;
  }

  return maskValue(value);
};

const setGlobalMasking = (enabled, actor) => {
  state.globalMaskingEnabled = Boolean(enabled);
  recordAudit('MASKING_TOGGLED', { scope: 'global', enabled: state.globalMaskingEnabled }, actor);
  return getPrivacySettings();
};

const setWorkspaceMasking = (workspaceId, enabled, actor) => {
  if (enabled === null || enabled === undefined) {
    state.workspaceMasking.delete(workspaceId);
    recordAudit('MASKING_TOGGLED', { scope: 'workspace', workspaceId, enabled: null }, actor);
  } else {
    state.workspaceMasking.set(workspaceId, Boolean(enabled));
    recordAudit('MASKING_TOGGLED', { scope: 'workspace', workspaceId, enabled: Boolean(enabled) }, actor);
  }

  return getPrivacySettings(workspaceId);
};

const recordAnalyticsEvent = ({ workspaceId, name, payload = {}, actor }) => {
  const maskedPayload = maskValueForWorkspace(workspaceId, payload);
  const event = {
    id: `${workspaceId || 'global'}:${name}:${state.analyticsEvents.length + 1}`,
    workspaceId: workspaceId || 'global',
    name,
    payload: maskedPayload,
    masked: isMaskingEnabled(workspaceId),
    actor: normalizeActor(actor),
    timestamp: nowIso()
  };

  state.analyticsEvents.push(event);
  return event;
};

const registerDataSource = ({
  workspaceId,
  dataSourceId,
  originalFile = null,
  parsedDocuments = [],
  chunks = [],
  embeddings = [],
  indices = [],
  actor
}) => {
  const workspaceData = ensureWorkspaceMap(workspaceId);

  if (workspaceData.has(dataSourceId)) {
    const error = new Error('Data source already exists.');
    error.statusCode = 409;
    throw error;
  }

  const dataSource = {
    id: dataSourceId,
    workspaceId,
    originalFile: originalFile ? { ...originalFile } : null,
    parsedDocuments: parsedDocuments.map((doc) => ({ ...doc })),
    chunks: chunks.map((chunk) => ({ ...chunk })),
    embeddings: embeddings.map((embedding) => ({ ...embedding })),
    indices: indices.map((index) => ({ ...index })),
    createdAt: nowIso(),
    deletedAt: null,
    lastReindexedAt: null
  };

  workspaceData.set(dataSourceId, dataSource);
  recordAudit('DATA_SOURCE_REGISTERED', { workspaceId, dataSourceId }, actor);
  return cloneDataSource(dataSource);
};

const getDataSource = (workspaceId, dataSourceId) => {
  const workspaceData = ensureWorkspaceMap(workspaceId);
  return workspaceData.get(dataSourceId) || null;
};

const getDataSourceSnapshot = (workspaceId, dataSourceId) => {
  const dataSource = getDataSource(workspaceId, dataSourceId);
  return cloneDataSource(dataSource);
};

const triggerReindex = (workspaceId, dataSourceId, actor) => {
  const dataSource = getDataSource(workspaceId, dataSourceId);

  if (!dataSource) {
    const error = new Error('Data source not found.');
    error.statusCode = 404;
    throw error;
  }

  const triggeredAt = nowIso();
  dataSource.lastReindexedAt = triggeredAt;

  const job = {
    workspaceId,
    dataSourceId,
    triggeredAt,
    actor: normalizeActor(actor)
  };

  state.reindexJobs.push(job);
  recordAudit('REINDEX_TRIGGERED', { workspaceId, dataSourceId }, actor);
  return { ...job };
};

const forgetData = ({ workspaceId, dataSourceId, actor }) => {
  const dataSource = getDataSource(workspaceId, dataSourceId);

  if (!dataSource || dataSource.deletedAt) {
    const error = new Error('Data source not found.');
    error.statusCode = 404;
    throw error;
  }

  dataSource.originalFile = null;
  dataSource.parsedDocuments = [];
  dataSource.chunks = [];
  dataSource.embeddings = [];
  dataSource.indices = [];
  dataSource.deletedAt = nowIso();

  recordAudit('FORGET_DATA', { workspaceId, dataSourceId }, actor);
  triggerReindex(workspaceId, dataSourceId, actor);

  return getDataSourceSnapshot(workspaceId, dataSourceId);
};

const listDataSources = (workspaceId) => {
  const workspaceData = ensureWorkspaceMap(workspaceId);
  return Array.from(workspaceData.values()).map((dataSource) => cloneDataSource(dataSource));
};

const getPrivacySettings = (workspaceId) => ({
  globalMaskingEnabled: state.globalMaskingEnabled,
  workspaceOverrides: Array.from(state.workspaceMasking.entries()).map(([id, enabled]) => ({
    workspaceId: id,
    enabled
  })),
  workspaceMaskingEnabled: workspaceId && state.workspaceMasking.has(workspaceId) ? state.workspaceMasking.get(workspaceId) : null,
  effectiveMaskingEnabled: isMaskingEnabled(workspaceId)
});

const getAnalyticsEvents = () =>
  state.analyticsEvents.map((event) => ({
    ...event,
    payload: clonePayload(event.payload)
  }));

const getReindexJobs = () => state.reindexJobs.map((job) => ({ ...job }));

const getAuditLog = () =>
  state.auditLog.map((entry) => ({
    ...entry,
    metadata: JSON.parse(JSON.stringify(entry.metadata)),
    actor: { ...entry.actor }
  }));

const resetState = () => {
  state = createInitialState();
};

module.exports = {
  forgetData,
  getAnalyticsEvents,
  getAuditLog,
  getDataSourceSnapshot,
  getPrivacySettings,
  getReindexJobs,
  isMaskingEnabled,
  listDataSources,
  maskValueForWorkspace,
  recordAnalyticsEvent,
  registerDataSource,
  resetState,
  setGlobalMasking,
  setWorkspaceMasking,
  triggerReindex
};
