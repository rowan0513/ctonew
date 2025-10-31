import "@testing-library/jest-dom/vitest";

const requiredTestEnv = {
  NODE_ENV: "test",
  OPENAI_API_KEY: "test-openai-key",
  POSTGRES_URL: "https://postgres.test.local",
  REDIS_URL: "https://redis.test.local",
  AWS_S3_ACCESS_KEY_ID: "test-access-key",
  AWS_S3_SECRET_ACCESS_KEY: "test-secret-key",
  AWS_S3_BUCKET: "test-bucket",
  AWS_S3_REGION: "us-east-test",
  INBOUND_WEBHOOK_SECRET: "test-inbound-webhook",
  OUTBOUND_WEBHOOK_SECRET: "test-outbound-webhook",
  ADMIN_EMAIL: "admin@ezchat.io",
  ADMIN_PASSWORD_HASH: "$2b$12$bXzMFF/KQgdsLj1pl9PzY.r1Bv.kfe2zKKKw3n0EoHoRTvUG.iB6a",
  SESSION_SECRET: "test-session-secret-change-me-please-123456789",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
} as const;

for (const [key, value] of Object.entries(requiredTestEnv)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
