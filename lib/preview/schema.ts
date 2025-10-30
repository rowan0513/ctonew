import { z } from "zod";

export const previewLanguageSchema = z.enum(["en", "nl"]);

export const previewCitationSchema = z.object({
  id: z.string().min(1, "citation id is required"),
  label: z.string().min(1, "citation label is required"),
  type: z.enum(["link", "file"]),
  url: z.string().url().optional(),
  fileName: z.string().min(1).optional(),
});

export const previewHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1, "content cannot be empty"),
  language: previewLanguageSchema,
  responseId: z.string().uuid().optional(),
  citations: z.array(previewCitationSchema).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const previewRequestSchema = z.object({
  prompt: z.string().min(1, "prompt cannot be empty"),
  language: previewLanguageSchema.optional(),
  sessionId: z.string().uuid({ message: "sessionId must be a valid UUID" }),
  history: z.array(previewHistoryMessageSchema).default([]),
});

export const previewRuntimeResponseSchema = z.object({
  responseId: z.string().min(1, "responseId is required"),
  answer: z.string().min(1, "answer is required"),
  language: previewLanguageSchema,
  citations: z.array(previewCitationSchema).default([]),
  confidence: z.number().min(0).max(1),
});

export const previewFeedbackSchema = z.object({
  sessionId: z.string().uuid({ message: "sessionId must be a valid UUID" }),
  responseId: z.string().min(1, "responseId is required"),
  rating: z.enum(["up", "down"]),
});

export type PreviewRequestInput = z.infer<typeof previewRequestSchema>;
export type PreviewRuntimeResponse = z.infer<typeof previewRuntimeResponseSchema>;
export type PreviewFeedbackInput = z.infer<typeof previewFeedbackSchema>;
