import { describe, expect, it } from "vitest";

import { buildTimeSeries, computeSummaryMetrics } from "@/lib/analytics/metrics";
import type { AnalyticsEventRecord } from "@/lib/analytics/types";

const sampleEvents: AnalyticsEventRecord[] = [
  {
    id: "event-1",
    workspaceId: "workspace-1",
    conversationId: "conversation-1",
    eventType: "message",
    environment: "production",
    occurredAt: "2024-04-01T10:00:00.000Z",
    confidence: 0.82,
    feedback: "up",
    isFallback: false,
  },
  {
    id: "event-2",
    workspaceId: "workspace-1",
    conversationId: "conversation-1",
    eventType: "message",
    environment: "production",
    occurredAt: "2024-04-01T11:15:00.000Z",
    confidence: 0.71,
    feedback: "down",
    isFallback: true,
  },
  {
    id: "event-3",
    workspaceId: "workspace-1",
    conversationId: "conversation-2",
    eventType: "message",
    environment: "preview",
    occurredAt: "2024-04-02T09:45:00.000Z",
    confidence: 0.64,
    feedback: null,
    isFallback: false,
  },
  {
    id: "event-4",
    workspaceId: "workspace-1",
    conversationId: "conversation-3",
    eventType: "message",
    environment: "test",
    occurredAt: "2024-04-03T14:20:00.000Z",
    confidence: 0.58,
    feedback: "up",
    isFallback: true,
  },
];

describe("computeSummaryMetrics", () => {
  it("aggregates totals, ratios, and environment breakdowns", () => {
    const summary = computeSummaryMetrics(sampleEvents);

    expect(summary.totalChats).toBe(3);
    expect(summary.totalMessages).toBe(4);
    expect(summary.thumbsUp).toBe(2);
    expect(summary.thumbsDown).toBe(1);
    expect(summary.thumbsUpRatio).toBeCloseTo(2 / 3, 5);
    expect(summary.averageConfidence).toBeCloseTo((0.82 + 0.71 + 0.64 + 0.58) / 4, 5);
    expect(summary.fallbackCount).toBe(2);
    expect(summary.fallbackRatio).toBeCloseTo(0.5, 5);

    expect(summary.environmentBreakdown).toEqual([
      { environment: "preview", chats: 1, messages: 1 },
      { environment: "production", chats: 1, messages: 2 },
      { environment: "test", chats: 1, messages: 1 },
    ]);
  });
});

describe("buildTimeSeries", () => {
  it("groups events into daily buckets", () => {
    const daily = buildTimeSeries(sampleEvents, "daily");

    expect(daily).toHaveLength(3);
    expect(daily[0]).toMatchObject({
      totalMessages: 2,
      productionMessages: 2,
      previewMessages: 0,
      testMessages: 0,
    });

    expect(daily[1]).toMatchObject({
      totalMessages: 1,
      productionMessages: 0,
      previewMessages: 1,
      testMessages: 0,
    });

    expect(daily[2]).toMatchObject({
      totalMessages: 1,
      productionMessages: 0,
      previewMessages: 0,
      testMessages: 1,
    });
  });

  it("collapses events into weekly buckets when requested", () => {
    const additional: AnalyticsEventRecord[] = [
      {
        id: "event-5",
        workspaceId: "workspace-1",
        conversationId: "conversation-1",
        eventType: "message",
        environment: "production",
        occurredAt: "2024-04-07T18:30:00.000Z",
        confidence: 0.77,
        feedback: null,
        isFallback: false,
      },
      {
        id: "event-6",
        workspaceId: "workspace-1",
        conversationId: "conversation-4",
        eventType: "message",
        environment: "preview",
        occurredAt: "2024-04-10T09:10:00.000Z",
        confidence: 0.7,
        feedback: "up",
        isFallback: false,
      },
    ];

    const weekly = buildTimeSeries([...sampleEvents, ...additional], "weekly");

    expect(weekly).toHaveLength(2);
    expect(weekly[0].totalMessages).toBe(5);
    expect(weekly[1].totalMessages).toBe(1);
    expect(weekly[0].productionMessages).toBe(3);
    expect(weekly[0].previewMessages).toBe(1);
    expect(weekly[0].testMessages).toBe(1);
    expect(weekly[1].previewMessages).toBe(1);
  });
});
