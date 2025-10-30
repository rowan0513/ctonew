import { format, formatISO, startOfDay, startOfWeek } from "date-fns";

import type {
  AnalyticsEventRecord,
  AnalyticsEnvironment,
  SummaryMetrics,
  TimeSeriesInterval,
  TimeSeriesPoint,
} from "@/lib/analytics/types";

function getChatKey(event: AnalyticsEventRecord): string {
  return event.conversationId ?? event.id;
}

export function computeSummaryMetrics(events: AnalyticsEventRecord[]): SummaryMetrics {
  const messageEvents = events.filter((event) => event.eventType === "message");

  const uniqueChats = new Set<string>();
  let thumbsUp = 0;
  let thumbsDown = 0;
  let confidenceTotal = 0;
  let confidenceCount = 0;
  let fallbackCount = 0;

  const environmentStats = new Map<AnalyticsEnvironment, { chats: Set<string>; messages: number }>();

  for (const event of messageEvents) {
    const chatKey = getChatKey(event);
    uniqueChats.add(chatKey);

    if (!environmentStats.has(event.environment)) {
      environmentStats.set(event.environment, { chats: new Set<string>(), messages: 0 });
    }

    const stats = environmentStats.get(event.environment)!;
    stats.chats.add(chatKey);
    stats.messages += 1;

    if (event.feedback === "up") {
      thumbsUp += 1;
    } else if (event.feedback === "down") {
      thumbsDown += 1;
    }

    if (typeof event.confidence === "number") {
      confidenceTotal += event.confidence;
      confidenceCount += 1;
    }

    if (event.isFallback) {
      fallbackCount += 1;
    }
  }

  const totalThumbs = thumbsUp + thumbsDown;
  const thumbsUpRatio = totalThumbs > 0 ? thumbsUp / totalThumbs : 0;
  const averageConfidence = confidenceCount > 0 ? confidenceTotal / confidenceCount : null;
  const totalMessages = messageEvents.length;
  const fallbackRatio = totalMessages > 0 ? fallbackCount / totalMessages : 0;

  const environmentBreakdown = Array.from(environmentStats.entries())
    .map(([environment, stats]) => ({
      environment,
      chats: stats.chats.size,
      messages: stats.messages,
    }))
    .sort((a, b) => a.environment.localeCompare(b.environment));

  return {
    totalChats: uniqueChats.size,
    totalMessages,
    thumbsUp,
    thumbsDown,
    thumbsUpRatio,
    averageConfidence,
    fallbackCount,
    fallbackRatio,
    environmentBreakdown,
  };
}

export function buildTimeSeries(
  events: AnalyticsEventRecord[],
  interval: TimeSeriesInterval,
): TimeSeriesPoint[] {
  const messageEvents = events.filter((event) => event.eventType === "message");

  const buckets = new Map<string, {
    date: Date;
    productionMessages: number;
    previewMessages: number;
    testMessages: number;
    totalMessages: number;
  }>();

  for (const event of messageEvents) {
    const occurredAt = new Date(event.occurredAt);
    const date = interval === "weekly"
      ? startOfWeek(occurredAt, { weekStartsOn: 1 })
      : startOfDay(occurredAt);

    const bucketKey = formatISO(date);

    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, {
        date,
        productionMessages: 0,
        previewMessages: 0,
        testMessages: 0,
        totalMessages: 0,
      });
    }

    const bucket = buckets.get(bucketKey)!;

    if (event.environment === "production") {
      bucket.productionMessages += 1;
    } else if (event.environment === "preview") {
      bucket.previewMessages += 1;
    } else if (event.environment === "test") {
      bucket.testMessages += 1;
    }

    bucket.totalMessages += 1;
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((bucket) => ({
      bucket: bucket.date.toISOString(),
      label: interval === "weekly" ? format(bucket.date, "MMM d") : format(bucket.date, "MMM d"),
      totalMessages: bucket.totalMessages,
      productionMessages: bucket.productionMessages,
      previewMessages: bucket.previewMessages,
      testMessages: bucket.testMessages,
    }));
}
