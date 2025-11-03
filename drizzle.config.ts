import { defineConfig } from "drizzle-kit";
import "dotenv/config";

if (!process.env.POSTGRES_URL) {
  console.warn("Warning: POSTGRES_URL is not set. Drizzle migrations may fail to connect.");
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "",
  },
});
