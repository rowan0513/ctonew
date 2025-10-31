import { z } from "zod";

export const envSchema = z.object({
  OPENAI_API_KEY: z
    .string()
    .min(1, "OPENAI_API_KEY is required to run the embedding pipeline"),
  REDIS_URL: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      throw new Error(parsed.error.errors.map((err) => err.message).join(", "));
    }

    cachedEnv = parsed.data;
  }

  return cachedEnv;
}
