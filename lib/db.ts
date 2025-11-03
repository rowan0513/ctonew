import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "@/src/schema";

neonConfig.fetchConnectionCache = true;

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (db) {
    return db;
  }

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_URL or DATABASE_URL environment variable is required");
  }

  pool = new Pool({ connectionString });
  db = drizzle(pool, { schema });

  return db;
}

export function closeDb() {
  if (pool) {
    pool.end();
    pool = null;
    db = null;
  }
}
import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/env.mjs";
import * as schema from "@/src/schema";

const sql = neon(env.POSTGRES_URL);
export const db = drizzle(sql, { schema });
