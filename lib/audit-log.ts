import { randomUUID } from "node:crypto";

export type AuditLogAction = "workspace.created" | "workspace.updated" | "workspace.archived";

export type AuditLogEntry = {
  id: string;
  workspaceId: string;
  actor: string;
  action: AuditLogAction;
  summary: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

type AuditLogStore = {
  entries: AuditLogEntry[];
};

const MAX_ENTRIES_PER_WORKSPACE = 200;

const globalAuditStore = globalThis as typeof globalThis & {
  __ezchatAuditLogStore?: AuditLogStore;
};

function getAuditLogStore(): AuditLogStore {
  if (!globalAuditStore.__ezchatAuditLogStore) {
    globalAuditStore.__ezchatAuditLogStore = {
      entries: [],
    };
  }

  return globalAuditStore.__ezchatAuditLogStore;
}

export function logWorkspaceAudit(entry: {
  workspaceId: string;
  actor: string;
  action: AuditLogAction;
  summary: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntry {
  const store = getAuditLogStore();
  const timestamp = new Date().toISOString();
  const record: AuditLogEntry = {
    id: randomUUID(),
    timestamp,
    ...entry,
  };

  store.entries.unshift(record);

  const workspaceEntries = store.entries.filter((item) => item.workspaceId === entry.workspaceId);
  if (workspaceEntries.length > MAX_ENTRIES_PER_WORKSPACE) {
    const pruneCount = workspaceEntries.length - MAX_ENTRIES_PER_WORKSPACE;
    let removed = 0;

    store.entries = store.entries.filter((item) => {
      if (item.workspaceId !== entry.workspaceId) {
        return true;
      }

      if (removed < pruneCount) {
        removed += 1;
        return false;
      }

      return true;
    });
  }

  return record;
}

export function getWorkspaceAuditLog(workspaceId: string, limit = 25): AuditLogEntry[] {
  const store = getAuditLogStore();
  return store.entries.filter((entry) => entry.workspaceId === workspaceId).slice(0, limit);
}

export function resetAuditLogStore(): void {
  if (globalAuditStore.__ezchatAuditLogStore) {
    globalAuditStore.__ezchatAuditLogStore.entries = [];
  }
}
