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
      is_fallback
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
      ${input.isFallback ?? false}
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
      is_fallback AS "isFallback"
  `;

  return {
    ...row,
    occurredAt: new Date(row.occurredAt).toISOString(),
    confidence: row.confidence === null ? null : Number(row.confidence),
  };
}

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
      is_fallback AS "isFallback"
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
    }));
}
