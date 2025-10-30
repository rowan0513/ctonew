import "server-only";

import { endOfDay, startOfDay } from "date-fns";

import { analyticsQuerySchema } from "@/lib/analytics/schema";
import { buildTimeSeries, computeSummaryMetrics } from "@/lib/analytics/metrics";
import { fetchAnalyticsEvents } from "@/lib/analytics/repository";
import type {
  AnalyticsFilters,
  SummaryMetrics,
  TimeSeriesInterval,
  TimeSeriesPoint,
} from "@/lib/analytics/types";

export function parseAnalyticsFilters(input: {
  workspaceId: string;
  startDate: string;
  endDate: string;
  interval?: string;
  environments?: string[];
}): AnalyticsFilters {
  const parsed = analyticsQuerySchema.safeParse({
    workspaceId: input.workspaceId,
    startDate: input.startDate,
    endDate: input.endDate,
    interval: (input.interval as TimeSeriesInterval | undefined) ?? "daily",
    environments: (input.environments ?? ["production"]).map((env) => env.trim()),
  });

  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const readable = Object.entries(errors)
      .map(([field, messages]) => `${field}: ${(messages ?? []).join(", ")}`)
      .join("; ");
    throw new Error(`Invalid analytics filters: ${readable}`);
  }

  const start = startOfDay(new Date(parsed.data.startDate));
  const end = endOfDay(new Date(parsed.data.endDate));

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid date range provided");
  }

  if (start > end) {
    throw new Error("startDate must be before endDate");
  }

  const uniqueEnvironments = Array.from(new Set(parsed.data.environments));

  return {
    workspaceId: parsed.data.workspaceId,
    startDate: start,
    endDate: end,
    interval: parsed.data.interval,
    environments: uniqueEnvironments,
  };
}

export async function getAnalyticsSummary(filters: AnalyticsFilters): Promise<SummaryMetrics> {
  const events = await fetchAnalyticsEvents(filters);
  return computeSummaryMetrics(events);
}

export async function getAnalyticsTimeSeries(
  filters: AnalyticsFilters,
): Promise<TimeSeriesPoint[]> {
  const events = await fetchAnalyticsEvents(filters);
  return buildTimeSeries(events, filters.interval);
}

export async function getAnalyticsOverview(filters: AnalyticsFilters): Promise<{
  summary: SummaryMetrics;
  timeSeries: TimeSeriesPoint[];
}> {
  const events = await fetchAnalyticsEvents(filters);
  return {
    summary: computeSummaryMetrics(events),
    timeSeries: buildTimeSeries(events, filters.interval),
  };
}
