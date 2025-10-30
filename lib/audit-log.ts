import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "@/lib/db";

export type AuditLogEntryInput = {
  adminEmail: string;
  action: string;
  ipAddress?: string | null;
  workspaceId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
};

export type AuditLogRecord = {
  id: string;
  adminEmail: string;
  action: string;
  ipAddress: string | null;
  workspaceId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export async function recordAuditLog(entry: AuditLogEntryInput): Promise<AuditLogRecord> {
  const id = randomUUID();
  const detailsPayload = entry.details ? JSON.stringify(entry.details) : "{}";

  const [row] = await sql<
    Array<{
      id: string;
      admin_email: string;
      action: string;
      ip_address: string | null;
      workspace_id: string | null;
      resource_type: string | null;
      resource_id: string | null;
      details: Record<string, unknown> | null;
      created_at: string;
    }>
  >`
    INSERT INTO audit_logs (
      id,
      admin_email,
      action,
      ip_address,
      workspace_id,
      resource_type,
      resource_id,
      details
    )
    VALUES (
      ${id},
      ${entry.adminEmail},
      ${entry.action},
      ${entry.ipAddress ?? null},
      ${entry.workspaceId ?? null},
      ${entry.resourceType ?? null},
      ${entry.resourceId ?? null},
      ${detailsPayload}::jsonb
    )
    RETURNING
      id,
      admin_email,
      action,
      ip_address,
      workspace_id,
      resource_type,
      resource_id,
      details,
      created_at
  `;

  return {
    id: row.id,
    adminEmail: row.admin_email,
    action: row.action,
    ipAddress: row.ip_address,
    workspaceId: row.workspace_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    details: row.details,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
