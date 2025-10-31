import { randomUUID } from "node:crypto";

import { logWorkspaceAudit } from "@/lib/audit-log";

import {
  WorkspaceInput,
  WorkspaceRecord,
  workspaceInputSchema,
  workspaceRecordSchema,
  workspaceStatusSchema,
} from "./schema";

type WorkspaceStore = {
  workspaces: WorkspaceRecord[];
};

const globalWorkspaceStore = globalThis as typeof globalThis & {
  __ezchatWorkspaceStore?: WorkspaceStore;
};

const API_KEY_PREFIX = "wk_";

function generateWorkspaceApiKey(): string {
  return `${API_KEY_PREFIX}${randomUUID().replace(/-/g, "")}`;
}

const DEFAULT_WORKSPACE_DRAFT: WorkspaceInput = {
  name: "",
  description: "",
  logo: null,
  toneOfVoice: "supportive",
  languages: ["en"],
  welcomeMessage: "",
  branding: {
    primary: "#2563eb",
    accent: "#f97316",
    background: "#ffffff",
  },
  confidenceThreshold: 0.65,
  webhook: {
    url: "",
    secret: "",
  },
};

export class WorkspaceNotFoundError extends Error {
  constructor(id: string) {
    super(`Workspace with id "${id}" was not found`);
    this.name = "WorkspaceNotFoundError";
  }
}

function getWorkspaceStore(): WorkspaceStore {
  if (!globalWorkspaceStore.__ezchatWorkspaceStore) {
    globalWorkspaceStore.__ezchatWorkspaceStore = {
      workspaces: seedWorkspaces(),
    };
  }

  return globalWorkspaceStore.__ezchatWorkspaceStore;
}

function seedWorkspaces(): WorkspaceRecord[] {
  const now = new Date();
  const isoNow = now.toISOString();

  const examples: Array<Omit<WorkspaceRecord, "id" | "createdAt" | "updatedAt" | "apiKey">> = [
    {
      name: "EzChat Demo",
      description:
        "Flagship workspace powering the public EzChat demo environment with curated AI responses and branded styling.",
      logo: null,
      toneOfVoice: "supportive",
      languages: ["en", "nl"],
      welcomeMessage: "Hey there! I’m here to help you make the most of EzChat.",
      branding: {
        primary: "#2563eb",
        accent: "#f97316",
        background: "#f4f4f5",
      },
      confidenceThreshold: 0.72,
      webhook: {
        url: "https://hooks.ezchat.io/workspaces/ezchat-demo",
        secret: "demo-webhook-secret",
      },
      status: "active",
    },
    {
      name: "Internal QA",
      description:
        "Sandbox workspace for staging features, running regression tests, and validating AI assistant behaviour before rollout.",
      logo: null,
      toneOfVoice: "professional",
      languages: ["en"],
      welcomeMessage: "Welcome to EzChat QA. Let us know what you’re testing today!",
      branding: {
        primary: "#7c3aed",
        accent: "#22d3ee",
        background: "#ffffff",
      },
      confidenceThreshold: 0.64,
      webhook: {
        url: "https://hooks.ezchat.io/workspaces/internal-qa",
        secret: "qa-webhook-secret",
      },
      status: "active",
    },
  ];

  return examples.map((workspace) =>
    workspaceRecordSchema.parse({
      id: randomUUID(),
      createdAt: isoNow,
      updatedAt: isoNow,
      apiKey: generateWorkspaceApiKey(),
      ...workspace,
    }),
  );
}

function cloneWorkspace<T>(value: T): T {
  return structuredClone(value);
}

function normalizeInput(input: WorkspaceInput): WorkspaceInput {
  return {
    ...input,
    logo: input.logo ? input.logo : null,
    languages: [...new Set(input.languages)].sort(),
    branding: {
      ...input.branding,
    },
    webhook: {
      ...input.webhook,
    },
  };
}

function sortWorkspaces(workspaces: WorkspaceRecord[]): WorkspaceRecord[] {
  return [...workspaces].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function diffWorkspaces(previous: WorkspaceRecord, next: WorkspaceRecord): string[] {
  const changed: string[] = [];

  if (previous.name !== next.name) changed.push("name");
  if (previous.description !== next.description) changed.push("description");
  if (previous.logo !== next.logo) changed.push("logo");
  if (previous.toneOfVoice !== next.toneOfVoice) changed.push("toneOfVoice");
  if (previous.welcomeMessage !== next.welcomeMessage) changed.push("welcomeMessage");
  if (previous.confidenceThreshold !== next.confidenceThreshold) changed.push("confidenceThreshold");
  if (previous.status !== next.status) changed.push("status");

  if (JSON.stringify(previous.languages) !== JSON.stringify(next.languages)) {
    changed.push("languages");
  }

  if (JSON.stringify(previous.branding) !== JSON.stringify(next.branding)) {
    changed.push("branding");
  }

  if (JSON.stringify(previous.webhook) !== JSON.stringify(next.webhook)) {
    changed.push("webhook");
  }

  return changed;
}

export function listWorkspaces(): WorkspaceRecord[] {
  const store = getWorkspaceStore();
  return sortWorkspaces(store.workspaces).map((workspace) => cloneWorkspace(workspace));
}

export function getWorkspaceById(id: string): WorkspaceRecord | null {
  const store = getWorkspaceStore();
  const workspace = store.workspaces.find((item) => item.id === id);
  return workspace ? cloneWorkspace(workspace) : null;
}

export function getWorkspaceByApiKey(apiKey: string): WorkspaceRecord | null {
  const store = getWorkspaceStore();
  const workspace = store.workspaces.find((item) => item.apiKey === apiKey);
  return workspace ? cloneWorkspace(workspace) : null;
}

export function createWorkspace(input: WorkspaceInput, actor: string): WorkspaceRecord {
  const normalized = normalizeInput(workspaceInputSchema.parse(input));
  const now = new Date().toISOString();

  const workspace: WorkspaceRecord = workspaceRecordSchema.parse({
    id: randomUUID(),
    status: workspaceStatusSchema.enum.active,
    createdAt: now,
    updatedAt: now,
    apiKey: generateWorkspaceApiKey(),
    ...normalized,
  });

  const store = getWorkspaceStore();
  store.workspaces.unshift(workspace);

  logWorkspaceAudit({
    workspaceId: workspace.id,
    actor,
    action: "workspace.created",
    summary: `${workspace.name} created`,
    metadata: {
      snapshot: workspace,
    },
  });

  return cloneWorkspace(workspace);
}

export function updateWorkspace(id: string, input: WorkspaceInput, actor: string): WorkspaceRecord {
  const store = getWorkspaceStore();
  const index = store.workspaces.findIndex((workspace) => workspace.id === id);

  if (index < 0) {
    throw new WorkspaceNotFoundError(id);
  }

  const existing = store.workspaces[index];
  const normalized = normalizeInput(workspaceInputSchema.parse(input));
  const now = new Date().toISOString();

  const updated: WorkspaceRecord = workspaceRecordSchema.parse({
    ...existing,
    ...normalized,
    status: existing.status,
    updatedAt: now,
  });

  store.workspaces[index] = updated;

  const changedFields = diffWorkspaces(existing, updated);

  logWorkspaceAudit({
    workspaceId: updated.id,
    actor,
    action: "workspace.updated",
    summary: `${updated.name} updated`,
    metadata: {
      changedFields,
      previousVersion: existing,
    },
  });

  return cloneWorkspace(updated);
}

export function archiveWorkspace(id: string, actor: string): WorkspaceRecord {
  const store = getWorkspaceStore();
  const index = store.workspaces.findIndex((workspace) => workspace.id === id);

  if (index < 0) {
    throw new WorkspaceNotFoundError(id);
  }

  const existing = store.workspaces[index];

  if (existing.status === workspaceStatusSchema.enum.archived) {
    return cloneWorkspace(existing);
  }

  const now = new Date().toISOString();

  const archived: WorkspaceRecord = workspaceRecordSchema.parse({
    ...existing,
    status: workspaceStatusSchema.enum.archived,
    updatedAt: now,
  });

  store.workspaces[index] = archived;

  logWorkspaceAudit({
    workspaceId: archived.id,
    actor,
    action: "workspace.archived",
    summary: `${archived.name} archived`,
  });

  return cloneWorkspace(archived);
}

export function createWorkspaceDraft(): WorkspaceInput {
  return cloneWorkspace(DEFAULT_WORKSPACE_DRAFT);
}

export function resetWorkspaceStore(): void {
  if (globalWorkspaceStore.__ezchatWorkspaceStore) {
    globalWorkspaceStore.__ezchatWorkspaceStore.workspaces = seedWorkspaces();
  }
}
