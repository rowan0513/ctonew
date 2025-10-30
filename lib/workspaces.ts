import "server-only";

import { sql } from "@/lib/db";

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
};

export async function listWorkspaces(): Promise<Workspace[]> {
  const rows = await sql<Workspace[]>`
    SELECT id, slug, name, timezone
    FROM workspaces
    ORDER BY name
  `;

  return rows;
}

export async function getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  const rows = await sql<Workspace[]>`
    SELECT id, slug, name, timezone
    FROM workspaces
    WHERE id = ${workspaceId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}
