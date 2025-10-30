import { z } from "zod";

export const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"], {
      errorMap: () => ({ message: "NODE_ENV must be development, test, or production" }),
    })
    .default("development"),
  OPENAI_API_KEY: z
    .string({ required_error: "OPENAI_API_KEY is required" })
    .min(1, "OPENAI_API_KEY cannot be empty"),
  POSTGRES_URL: z
    .string({ required_error: "POSTGRES_URL is required" })
    .url("POSTGRES_URL must be a valid URL"),
  REDIS_URL: z
    .string({ required_error: "REDIS_URL is required" })
    .url("REDIS_URL must be a valid URL"),
  AWS_S3_ACCESS_KEY_ID: z
    .string({ required_error: "AWS_S3_ACCESS_KEY_ID is required" })
    .min(1, "AWS_S3_ACCESS_KEY_ID cannot be empty"),
  AWS_S3_SECRET_ACCESS_KEY: z
    .string({ required_error: "AWS_S3_SECRET_ACCESS_KEY is required" })
    .min(1, "AWS_S3_SECRET_ACCESS_KEY cannot be empty"),
  AWS_S3_BUCKET: z
    .string({ required_error: "AWS_S3_BUCKET is required" })
    .min(1, "AWS_S3_BUCKET cannot be empty"),
  AWS_S3_REGION: z
    .string({ required_error: "AWS_S3_REGION is required" })
    .min(1, "AWS_S3_REGION cannot be empty"),
  INBOUND_WEBHOOK_SECRET: z
    .string({ required_error: "INBOUND_WEBHOOK_SECRET is required" })
    .min(1, "INBOUND_WEBHOOK_SECRET cannot be empty"),
  OUTBOUND_WEBHOOK_SECRET: z
    .string({ required_error: "OUTBOUND_WEBHOOK_SECRET is required" })
    .min(1, "OUTBOUND_WEBHOOK_SECRET cannot be empty"),
  ADMIN_API_TOKEN: z
    .string({ required_error: "ADMIN_API_TOKEN is required" })
    .min(1, "ADMIN_API_TOKEN cannot be empty"),
  RUNTIME_API_URL: z
    .string({ required_error: "RUNTIME_API_URL is required" })
    .url("RUNTIME_API_URL must be a valid URL"),
  RUNTIME_PREVIEW_TOKEN: z
    .string({ required_error: "RUNTIME_PREVIEW_TOKEN is required" })
    .min(1, "RUNTIME_PREVIEW_TOKEN cannot be empty"),
});

export const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string({ required_error: "NEXT_PUBLIC_APP_URL is required" })
    .url("NEXT_PUBLIC_APP_URL must be a valid URL"),
});

const isTest = process.env.NODE_ENV === "test";
const skipValidation = process.env.SKIP_ENV_VALIDATION === "1";
const allowFallbackValues = isTest || skipValidation;

function formatErrors(flattenedErrors) {
  return Object.entries(flattenedErrors)
    .map(([field, messages]) => {
      const readable = (messages ?? []).filter(Boolean).join(", ") || "Unknown error";
      return `${field}: ${readable}`;
    })
    .join("\n");
}

const serverEnvResult = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  OPENAI_API_KEY:
    process.env.OPENAI_API_KEY ?? (allowFallbackValues ? "test-openai-key" : undefined),
  POSTGRES_URL:
    process.env.POSTGRES_URL ??
    (allowFallbackValues ? "postgresql://demo_user:demo_pass@postgres.test.local:5432/ezchat_demo" : undefined),
  REDIS_URL:
    process.env.REDIS_URL ??
    (allowFallbackValues ? "redis://redis.test.local:6379" : undefined),
  AWS_S3_ACCESS_KEY_ID:
    process.env.AWS_S3_ACCESS_KEY_ID ?? (allowFallbackValues ? "test-access-key" : undefined),
  AWS_S3_SECRET_ACCESS_KEY:
    process.env.AWS_S3_SECRET_ACCESS_KEY ?? (allowFallbackValues ? "test-secret-key" : undefined),
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ?? (allowFallbackValues ? "test-bucket" : undefined),
  AWS_S3_REGION: process.env.AWS_S3_REGION ?? (allowFallbackValues ? "us-east-test" : undefined),
  INBOUND_WEBHOOK_SECRET:
    process.env.INBOUND_WEBHOOK_SECRET ??
    (allowFallbackValues ? "test-inbound-webhook" : undefined),
  OUTBOUND_WEBHOOK_SECRET:
    process.env.OUTBOUND_WEBHOOK_SECRET ??
    (allowFallbackValues ? "test-outbound-webhook" : undefined),
  ADMIN_API_TOKEN:
    process.env.ADMIN_API_TOKEN ?? (allowFallbackValues ? "test-admin-token" : undefined),
  RUNTIME_API_URL:
    process.env.RUNTIME_API_URL ??
    (allowFallbackValues ? "https://runtime.ezchat.local" : undefined),
  RUNTIME_PREVIEW_TOKEN:
    process.env.RUNTIME_PREVIEW_TOKEN ?? (allowFallbackValues ? "test-preview-token" : undefined),
});

if (!serverEnvResult.success) {
  const errorMessage = formatErrors(serverEnvResult.error.flatten().fieldErrors);
  console.error("❌ Invalid server environment variables\n" + errorMessage);
  throw new Error("Server environment validation failed. See logs for details.");
}

const clientEnvResult = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? (allowFallbackValues ? "http://localhost:3000" : undefined),
});

if (!clientEnvResult.success) {
  const errorMessage = formatErrors(clientEnvResult.error.flatten().fieldErrors);
  console.error("❌ Invalid client environment variables\n" + errorMessage);
  throw new Error("Client environment validation failed. See logs for details.");
}

export const serverEnv = serverEnvResult.data;
export const publicEnv = clientEnvResult.data;
export const env = { ...serverEnvResult.data, ...clientEnvResult.data };

export const isDevelopment = serverEnv.NODE_ENV === "development";
export const isProduction = serverEnv.NODE_ENV === "production";
export const isTestEnv = serverEnv.NODE_ENV === "test";
