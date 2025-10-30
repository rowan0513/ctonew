import "server-only";

import { neon, neonConfig } from "@neondatabase/serverless";

import { env } from "@/env.mjs";

neonConfig.fetchConnectionCache = true;

export const sql = neon(env.POSTGRES_URL);

export type SqlClient = typeof sql;
