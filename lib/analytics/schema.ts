import { z } from "zod";

export const analyticsEnvironments = ["production", "preview", "test"] as const;

export const analyticsEventSchema = z.object({
  workspaceId: z.string().uuid({ message: "workspaceId must be a valid UUID" }),
  conversationId: z.string().uuid().optional().nullable(),
  eventType: z.enum(["message", "preview_feedback"]),
  environment: z.enum(analyticsEnvironments),
  occurredAt: z
    .string()
    .datetime()
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
  isFallback: z.boolean().optional().default(false),
  feedback: z.enum(["up", "down"]).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const analyticsQuerySchema = z.object({
  workspaceId: z.string().uuid({ message: "workspaceId must be a valid UUID" }),
  startDate: z.string().datetime({ message: "startDate must be an ISO timestamp" }),
  endDate: z.string().datetime({ message: "endDate must be an ISO timestamp" }),
  interval: z.enum(["daily", "weekly"]).default("daily"),
  environments: z
    .array(z.enum(analyticsEnvironments))
    .min(1, "At least one environment must be provided"),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
