#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import process from "node:process";

import { neon, neonConfig } from "@neondatabase/serverless";

import { env } from "../env.mjs";

neonConfig.fetchConnectionCache = true;

async function ensureTables(sql) {
  await sql`CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    timezone TEXT DEFAULT 'UTC' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`;

  await sql`CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (workspace_id, name)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    channel TEXT NOT NULL,
    last_message_at TIMESTAMPTZ NOT NULL,
    sentiment TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`;
}

async function upsertWorkspace(sql) {
  const workspaceSlug = "ezchat-demo";
  const workspaceName = "EzChat Demo Workspace";
  const workspaceTimezone = "America/New_York";

  const existing = await sql`SELECT id FROM workspaces WHERE slug = ${workspaceSlug} LIMIT 1`;

  if (existing.length > 0) {
    const workspaceId = existing[0].id;
    await sql`UPDATE workspaces SET name = ${workspaceName}, timezone = ${workspaceTimezone} WHERE id = ${workspaceId}`;
    return workspaceId;
  }

  const workspaceId = randomUUID();

  await sql`INSERT INTO workspaces (id, slug, name, timezone)
    VALUES (${workspaceId}, ${workspaceSlug}, ${workspaceName}, ${workspaceTimezone})`;

  return workspaceId;
}

async function seedDataSources(sql, workspaceId) {
  const dataSources = [
    {
      name: "Zendesk",
      type: "ticketing",
      config: {
        baseUrl: "https://ezchat.zendesk.com",
        authType: "oauth",
        syncCadenceMinutes: 5,
      },
    },
    {
      name: "Intercom",
      type: "messaging",
      config: {
        workspaceId: "ezchat-ops",
        channels: ["email", "chat", "in-app"],
        syncCadenceMinutes: 2,
      },
    },
    {
      name: "Salesforce",
      type: "crm",
      config: {
        instanceUrl: "https://ezchat.my.salesforce.com",
        integrationUser: "ops-integration@ezchat.io",
        syncCadenceMinutes: 10,
      },
    },
  ];

  for (const source of dataSources) {
    await sql`INSERT INTO data_sources (id, workspace_id, name, type, config)
      VALUES (${randomUUID()}, ${workspaceId}, ${source.name}, ${source.type}, ${JSON.stringify(source.config)}::jsonb)
      ON CONFLICT (workspace_id, name)
      DO UPDATE SET type = EXCLUDED.type, config = EXCLUDED.config`;
  }
}

async function seedConversations(sql, workspaceId) {
  const conversations = [
    {
      subject: "Priority escalation: Checkout payments failing",
      status: "escalated",
      customerName: "Lena Gomez",
      channel: "web_widget",
      sentiment: "negative",
      lastMessageAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      metadata: {
        orderId: "EZ-493021",
        region: "us-east-1",
        automation: {
          triagedBy: "AI Sentiment Classifier",
          confidence: 0.78,
        },
      },
    },
    {
      subject: "Feature inquiry: Conversation summary exports",
      status: "open",
      customerName: "Marcus Chen",
      channel: "email",
      sentiment: "neutral",
      lastMessageAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
      metadata: {
        plan: "Scale",
        seats: 42,
        lastAgent: "Sasha Patel",
      },
    },
    {
      subject: "On-call handoff: AI assistant false positive",
      status: "monitoring",
      customerName: "Priya Kapoor",
      channel: "slack",
      sentiment: "mixed",
      lastMessageAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      metadata: {
        automation: {
          model: "EzChat-Assist-v4",
          previousAction: "suggest_resolution",
        },
        currentOwner: "Incident Command",
      },
    },
  ];

  await sql`DELETE FROM conversations WHERE workspace_id = ${workspaceId}`;

  for (const convo of conversations) {
    await sql`INSERT INTO conversations (id, workspace_id, subject, status, customer_name, channel, sentiment, last_message_at, metadata)
      VALUES (
        ${randomUUID()},
        ${workspaceId},
        ${convo.subject},
        ${convo.status},
        ${convo.customerName},
        ${convo.channel},
        ${convo.sentiment},
        ${convo.lastMessageAt},
        ${JSON.stringify(convo.metadata)}::jsonb
      )`;
  }
}

async function seedAdminUser(sql) {
  const adminEmail = env.ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = env.ADMIN_PASSWORD_HASH;
  
  const existing = await sql`
    SELECT id FROM admin_users WHERE LOWER(email) = ${adminEmail} LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE admin_users 
      SET password_hash = ${passwordHash}, 
          updated_at = NOW()
      WHERE LOWER(email) = ${adminEmail}
    `;
    console.log(`  ↻ Updated existing admin user: ${adminEmail}`);
  } else {
    await sql`
      INSERT INTO admin_users (id, email, password_hash, first_name, last_name, role, status)
      VALUES (
        ${randomUUID()},
        ${adminEmail},
        ${passwordHash},
        'Admin',
        'User',
        'superadmin',
        'active'
      )
    `;
    console.log(`  ✓ Created admin user: ${adminEmail}`);
  }
}

async function main() {
  if (!env.POSTGRES_URL) {
    console.error("❌ POSTGRES_URL is not defined. Did you configure your environment variables?");
    process.exit(1);
  }

  console.log("🌱 Starting EzChat demo database seed...");

  const sql = neon(env.POSTGRES_URL);

  try {
    await sql`BEGIN`;

    await ensureTables(sql);

    const workspaceId = await upsertWorkspace(sql);
    await seedDataSources(sql, workspaceId);
    await seedConversations(sql, workspaceId);
    await seedAdminUser(sql);

    await sql`COMMIT`;

    console.log("✅ Seed data applied successfully.");
  } catch (error) {
    try {
      await sql`ROLLBACK`;
    } catch (rollbackError) {
      console.error("⚠️ Failed to rollback transaction:", rollbackError);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
