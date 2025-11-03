import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { env } from "@/env.mjs";
import * as schema from "@/src/schema";

const sql = neon(env.POSTGRES_URL);
export const db = drizzle(sql, { schema });
