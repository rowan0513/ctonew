import { z } from "zod";

export const supportedLanguages = ["en", "nl"] as const;

type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageSchema = z.enum(supportedLanguages);

export const workspaceToneOfVoiceOptions = [
  "supportive",
  "professional",
  "friendly",
  "concise",
] as const;

export type WorkspaceTone = (typeof workspaceToneOfVoiceOptions)[number];

export const toneOfVoiceSchema = z.enum(workspaceToneOfVoiceOptions);

const hexColorSchema = z
  .string({ required_error: "Brand color is required" })
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/u, "Enter a valid hex color (e.g. #2563eb)");

export const webhookSettingsSchema = z.object({
  url: z
    .string({ required_error: "Webhook URL is required" })
    .url("Webhook URL must be a valid URL"),
  secret: z
    .string({ required_error: "Webhook secret is required" })
    .min(8, "Webhook secret must be at least 8 characters"),
});

export const brandingSchema = z.object({
  primary: hexColorSchema,
  accent: hexColorSchema,
  background: hexColorSchema,
});

const logoSchema = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (!value) {
        return false;
      }

      if (value.startsWith("data:")) {
        return true;
      }

      try {
        const parsed = new URL(value);
        return Boolean(parsed.protocol.startsWith("http"));
      } catch {
        return false;
      }
    },
    {
      message: "Provide a valid logo URL or upload an image",
    },
  );

export const workspaceStatusSchema = z.enum(["active", "archived"] as const);

export const workspaceInputSchema = z.object({
  name: z
    .string({ required_error: "Workspace name is required" })
    .min(2, "Workspace name must be at least 2 characters")
    .max(80, "Workspace name must be 80 characters or less"),
  description: z
    .string({ required_error: "Workspace description is required" })
    .min(10, "Description must be at least 10 characters")
    .max(400, "Description must be 400 characters or less"),
  logo: logoSchema.nullish(),
  toneOfVoice: toneOfVoiceSchema,
  languages: z
    .array(languageSchema, {
      required_error: "Select at least one language",
    })
    .min(1, "Select at least one language"),
  welcomeMessage: z
    .string({ required_error: "Welcome message is required" })
    .min(5, "Welcome message must be at least 5 characters")
    .max(280, "Welcome message must be 280 characters or less"),
  branding: brandingSchema,
  confidenceThreshold: z
    .number({ invalid_type_error: "Confidence threshold must be a number" })
    .min(0, "Confidence threshold must be at least 0")
    .max(1, "Confidence threshold cannot exceed 1"),
  webhook: webhookSettingsSchema,
});

export const workspaceRecordSchema = workspaceInputSchema.extend({
  id: z.string(),
  status: workspaceStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WorkspaceInput = z.infer<typeof workspaceInputSchema>;
export type WorkspaceRecord = z.infer<typeof workspaceRecordSchema>;
export type WorkspaceStatus = z.infer<typeof workspaceStatusSchema>;
export type WorkspaceLanguage = SupportedLanguage;
