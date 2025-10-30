export type AnalyticsEnvironment = "production" | "preview" | "test";

export type AnalyticsEventType = "message" | "preview_feedback";

export type AnalyticsEventRecord = {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  eventType: AnalyticsEventType;
  environment: AnalyticsEnvironment;
  occurredAt: string;
  confidence: number | null;
  feedback: "up" | "down" | null;
  isFallback: boolean;
  metadata?: Record<string, unknown> | null;
};

export type SummaryMetrics = {
  totalChats: number;
  totalMessages: number;
  thumbsUp: number;
  thumbsDown: number;
  thumbsUpRatio: number;
  averageConfidence: number | null;
  fallbackCount: number;
  fallbackRatio: number;
  environmentBreakdown: Array<{
    environment: AnalyticsEnvironment;
    chats: number;
    messages: number;
  }>;
};

export type TimeSeriesInterval = "daily" | "weekly";

export type TimeSeriesPoint = {
  bucket: string;
  label: string;
  totalMessages: number;
  productionMessages: number;
  previewMessages: number;
  testMessages: number;
};

export type AnalyticsFilters = {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
  interval: TimeSeriesInterval;
  environments: AnalyticsEnvironment[];
};
