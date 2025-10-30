import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "@/lib/db";
import type { AnalyticsEventInput } from "@/lib/analytics/schema";
import type { AnalyticsEventRecord, AnalyticsFilters } from "@/lib/analytics/types";

export async function insertAnalyticsEvent(
  input: AnalyticsEventInput,
): Promise<AnalyticsEventRecord> {
  const id = randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;

  const [row] = await sql<AnalyticsEventRecord[]>`
    INSERT INTO analytics_events (
      id,
      workspace_id,
      conversation_id,
      event_type,
      environment,
      occurred_at,
      confidence,
      feedback,
      is_fallback,
      metadata
    )
    VALUES (
      ${id},
      ${input.workspaceId},
      ${input.conversationId ?? null},
      ${input.eventType},
      ${input.environment},
      ${occurredAt},
      ${input.confidence ?? null},
      ${input.feedback ?? null},
      ${input.isFallback ?? false},
      ${metadataJson ? metadataJson : sql`'{}'::jsonb`}
    )
    RETURNING
      id,
      workspace_id AS "workspaceId",
      conversation_id AS "conversationId",
      event_type AS "eventType",
      environment,
      occurred_at AS "occurredAt",
      confidence,
      feedback,
      is_fallback AS "isFallback",
      metadata
  `;

  return {
    ...row,
    occurredAt: new Date(row.occurredAt).toISOString(),
    confidence: row.confidence === null ? null : Number(row.confidence),
    metadata: row.metadata ?? null,
  };
}

export async function fetchAnalyticsEvents(
</commentary to=functions.EditFile code>
export async function fetchAnalyticsEvents(
  filters: AnalyticsFilters,
): Promise<AnalyticsEventRecord[]> {
  const rows = await sql<AnalyticsEventRecord[]>`
    SELECT
      id,
      workspace_id AS "workspaceId",
      conversation_id AS "conversationId",
      event_type AS "eventType",
      environment,
      occurred_at AS "occurredAt",
      confidence,
      feedback,
      is_fallback AS "isFallback",
      metadata
    FROM analytics_events
    WHERE workspace_id = ${filters.workspaceId}
      AND occurred_at >= ${filters.startDate.toISOString()}
      AND occurred_at <= ${filters.endDate.toISOString()}
    ORDER BY occurred_at ASC
  `;

  const environments = new Set(filters.environments);

  return rows
    .filter((row) => environments.has(row.environment))
    .map((row) => ({
      ...row,
      occurredAt: new Date(row.occurredAt).toISOString(),
      confidence: row.confidence === null ? null : Number(row.confidence),
      metadata: row.metadata ?? null,
    }));
}
