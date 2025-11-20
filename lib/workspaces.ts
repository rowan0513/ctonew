export type WorkspaceThemeOverrides = {
  primaryColor?: string;
  backgroundColor?: string;
  borderRadius?: string;
};

export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPublished: boolean;
  updatedAt: string;
  themeOverrides?: WorkspaceThemeOverrides;
};

type WorkspaceStore = Map<string, WorkspaceRecord>;

type WorkspaceStoreContainer = {
  workspaces: WorkspaceStore;
};

const WORKSPACE_STORE_GLOBAL_KEY = "__EZCHAT_WORKSPACE_STORE__" as const;

const DEFAULT_WORKSPACES: WorkspaceRecord[] = [
  {
    id: "ws_northwind_support",
    name: "Northwind Support",
    slug: "northwind-support",
    description: "Embed snippet configuration for the Northwind support workspace.",
    isPublished: false,
    updatedAt: new Date().toISOString(),
  },
];

type GlobalWithStore = typeof globalThis & {
  [WORKSPACE_STORE_GLOBAL_KEY]?: WorkspaceStoreContainer;
};

function initializeStore(): WorkspaceStoreContainer {
  const workspaces = new Map<string, WorkspaceRecord>();

  DEFAULT_WORKSPACES.forEach((workspace) => {
    workspaces.set(workspace.id, cloneWorkspace(workspace));
  });

  return { workspaces };
}

function getStore(): WorkspaceStoreContainer {
  const globalScope = globalThis as GlobalWithStore;

  if (!globalScope[WORKSPACE_STORE_GLOBAL_KEY]) {
    globalScope[WORKSPACE_STORE_GLOBAL_KEY] = initializeStore();
  }

  return globalScope[WORKSPACE_STORE_GLOBAL_KEY]!;
}

function cloneWorkspace(workspace: WorkspaceRecord): WorkspaceRecord {
  return {
    ...workspace,
    themeOverrides: workspace.themeOverrides ? { ...workspace.themeOverrides } : undefined,
  };
}

function requireWorkspace(workspaceId: string): WorkspaceRecord {
  const store = getStore();
  const workspace = store.workspaces.get(workspaceId);

  if (!workspace) {
    throw new Error(`Workspace with id "${workspaceId}" was not found in the store.`);
  }

  return workspace;
}

export function listWorkspaces(): WorkspaceRecord[] {
  const store = getStore();
  return Array.from(store.workspaces.values()).map(cloneWorkspace);
}

export function findWorkspace(workspaceId: string): WorkspaceRecord | undefined {
  const store = getStore();
  const workspace = store.workspaces.get(workspaceId);

  return workspace ? cloneWorkspace(workspace) : undefined;
}

export function getWorkspaceOrThrow(workspaceId: string): WorkspaceRecord {
  return cloneWorkspace(requireWorkspace(workspaceId));
}

export async function setWorkspacePublished(
  workspaceId: string,
  isPublished: boolean,
): Promise<WorkspaceRecord> {
  const store = getStore();
  const workspace = requireWorkspace(workspaceId);

  const nextWorkspace: WorkspaceRecord = {
    ...workspace,
    isPublished,
    updatedAt: new Date().toISOString(),
  };

  store.workspaces.set(workspaceId, nextWorkspace);

  return cloneWorkspace(nextWorkspace);
}

export async function updateWorkspaceThemeOverrides(
  workspaceId: string,
  themeOverrides: WorkspaceThemeOverrides,
): Promise<WorkspaceRecord> {
  const store = getStore();
  const workspace = requireWorkspace(workspaceId);

  const nextWorkspace: WorkspaceRecord = {
    ...workspace,
    updatedAt: new Date().toISOString(),
    themeOverrides: Object.keys(themeOverrides).length > 0 ? { ...themeOverrides } : undefined,
  };

  store.workspaces.set(workspaceId, nextWorkspace);

  return cloneWorkspace(nextWorkspace);
}

export function resetWorkspaceStore(): void {
  const globalScope = globalThis as GlobalWithStore;
  globalScope[WORKSPACE_STORE_GLOBAL_KEY] = initializeStore();
}
