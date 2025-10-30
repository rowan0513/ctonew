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
    is_trained BOOLEAN DEFAULT FALSE NOT NULL,
    trained_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    draft_prompt_en TEXT NOT NULL DEFAULT '',
    draft_prompt_nl TEXT NOT NULL DEFAULT '',
    published_prompt_en TEXT,
    published_prompt_nl TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`;

  await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_trained BOOLEAN DEFAULT FALSE NOT NULL`;
  await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS trained_at TIMESTAMPTZ`;
  await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ`;
  await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS draft_prompt_en TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS draft_prompt_nl TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS published_prompt_en TEXT`;
  await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS published_prompt_nl TEXT`;

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

  await sql`CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('production', 'preview', 'test')),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confidence DOUBLE PRECISION,
    feedback TEXT CHECK (feedback IN ('up', 'down')),
    is_fallback BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb
  )`;

  await sql`CREATE INDEX IF NOT EXISTS analytics_events_workspace_date_idx
    ON analytics_events (workspace_id, occurred_at)`;
  await sql`CREATE INDEX IF NOT EXISTS analytics_events_workspace_env_idx
    ON analytics_events (workspace_id, environment)`;
  await sql`CREATE INDEX IF NOT EXISTS analytics_events_conversation_idx
    ON analytics_events (conversation_id)`;
}

async function upsertWorkspace(sql) {
  const workspaceSlug = "ezchat-demo";
  const workspaceName = "EzChat Demo Workspace";
  const workspaceTimezone = "America/New_York";

  const draftPromptEn = [
    "You are EzChat's AI assistant responding on behalf of the demo workspace.",
    "Answer in clear, conversational English and cite supporting sources using markdown links.",
    "If you rely on internal files, label them with the original filename and summarize the relevant excerpt.",
  ].join(" ");

  const draftPromptNl = [
    "Je bent de AI-assistent van EzChat die namens de demo-werkruimte reageert.",
    "Antwoord in helder, natuurlijk Nederlands en verwijs naar bronnen met markdown-links.",
    "Noem bestandsnamen wanneer je interne documenten gebruikt en licht het relevante fragment toe.",
  ].join(" ");

  const publishedPromptEn = [
    "You are EzChat's AI assistant for production users.",
    "Provide concise answers in English and reference approved knowledge base content.",
  ].join(" ");

  const publishedPromptNl = [
    "Je bent de EzChat-assistent voor productiegebruikers.",
    "Geef beknopte antwoorden in het Nederlands en verwijs naar goedgekeurde kennisbankartikelen.",
  ].join(" ");

  const trainedAt = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const publishedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const existing = await sql`SELECT id FROM workspaces WHERE slug = ${workspaceSlug} LIMIT 1`;

  if (existing.length > 0) {
    const workspaceId = existing[0].id;
    await sql`
      UPDATE workspaces
      SET name = ${workspaceName},
          timezone = ${workspaceTimezone},
          is_trained = ${true},
          trained_at = ${trainedAt},
          published_at = ${publishedAt},
          draft_prompt_en = ${draftPromptEn},
          draft_prompt_nl = ${draftPromptNl},
          published_prompt_en = ${publishedPromptEn},
          published_prompt_nl = ${publishedPromptNl}
      WHERE id = ${workspaceId}
    `;
    return workspaceId;
  }

  const workspaceId = randomUUID();

  await sql`
    INSERT INTO workspaces (
      id,
      slug,
      name,
      timezone,
      is_trained,
      trained_at,
      published_at,
      draft_prompt_en,
      draft_prompt_nl,
      published_prompt_en,
      published_prompt_nl
    )
    VALUES (
      ${workspaceId},
      ${workspaceSlug},
      ${workspaceName},
      ${workspaceTimezone},
      ${true},
      ${trainedAt},
      ${publishedAt},
      ${draftPromptEn},
      ${draftPromptNl},
      ${publishedPromptEn},
      ${publishedPromptNl}
    )
  `;

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
  const now = Date.now();

  const conversations = [
    {
      subject: "Priority escalation: Checkout payments failing",
      status: "escalated",
      customerName: "Lena Gomez",
      channel: "web_widget",
      sentiment: "negative",
      environmentTag: "production",
      lastMessageAt: new Date(now - 15 * 60 * 1000).toISOString(),
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
      environmentTag: "production",
      lastMessageAt: new Date(now - 55 * 60 * 1000).toISOString(),
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
      environmentTag: "production",
      lastMessageAt: new Date(now - 5 * 60 * 1000).toISOString(),
      metadata: {
        automation: {
          model: "EzChat-Assist-v4",
          previousAction: "suggest_resolution",
        },
        currentOwner: "Incident Command",
      },
    },
    {
      subject: "Preview validation: Suggested reply coverage",
      status: "testing",
      customerName: "QA Analyst",
      channel: "preview_channel",
      sentiment: "positive",
      environmentTag: "preview",
      lastMessageAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      metadata: {
        environment: "preview",
        scenario: "pre-release evaluation",
      },
    },
    {
      subject: "Test harness: fallback escalation drill",
      status: "closed",
      customerName: "Automation Suite",
      channel: "test_harness",
      sentiment: "neutral",
      environmentTag: "test",
      lastMessageAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      metadata: {
        environment: "test",
        scenario: "fallback coverage",
      },
    },
  ];

  await sql`DELETE FROM conversations WHERE workspace_id = ${workspaceId}`;

  const inserted = [];

  for (const convo of conversations) {
    const conversationId = randomUUID();
    await sql`INSERT INTO conversations (id, workspace_id, subject, status, customer_name, channel, sentiment, last_message_at, metadata)
      VALUES (
        ${conversationId},
        ${workspaceId},
        ${convo.subject},
        ${convo.status},
        ${convo.customerName},
        ${convo.channel},
        ${convo.sentiment},
        ${convo.lastMessageAt},
        ${JSON.stringify(convo.metadata)}::jsonb
      )`;

    inserted.push({ id: conversationId, environmentTag: convo.environmentTag });
  }

  return inserted;
}

async function seedAnalyticsEvents(sql, workspaceId, conversations) {
  await sql`DELETE FROM analytics_events WHERE workspace_id = ${workspaceId}`;

  const productionConversations = conversations.filter((convo) => convo.environmentTag === "production");
  const previewConversation = conversations.find((convo) => convo.environmentTag === "preview");
  const testConversation = conversations.find((convo) => convo.environmentTag === "test");

  const now = new Date();
  const events = [];

  for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
    const base = new Date(now);
    base.setUTCHours(14, 0, 0, 0);
    base.setUTCDate(base.getUTCDate() - dayOffset);

    productionConversations.forEach((conversation, index) => {
      const occurredAt = new Date(base);
      occurredAt.setUTCMinutes(base.getUTCMinutes() + index * 11);

      const variation = (dayOffset + index) % 4;
      const confidence = Math.max(0.45, Math.min(0.98, 0.72 - dayOffset * 0.004 + variation * 0.035));
      const feedbackCycle = (dayOffset + index) % 6;
      const feedback = feedbackCycle === 0 ? "down" : feedbackCycle % 2 === 0 ? "up" : null;
      const isFallback = (dayOffset + index) % 7 === 0;

      events.push({
        conversationId: conversation.id,
        environment: "production",
        occurredAt: occurredAt.toISOString(),
        confidence,
        feedback,
        isFallback,
      });
    });

    if (dayOffset % 3 === 0 && previewConversation) {
      const occurredAt = new Date(base);
      occurredAt.setUTCHours(16, (10 + dayOffset) % 60, 0, 0);

      events.push({
        conversationId: previewConversation.id,
        environment: "preview",
        occurredAt: occurredAt.toISOString(),
        confidence: Math.max(0.5, Math.min(0.9, 0.6 + (dayOffset % 4) * 0.06)),
        feedback: dayOffset % 2 === 0 ? "up" : null,
        isFallback: dayOffset % 6 === 0,
      });
    }

    if (dayOffset % 5 === 0 && testConversation) {
      const occurredAt = new Date(base);
      occurredAt.setUTCHours(10, (20 + dayOffset) % 60, 0, 0);

      events.push({
        conversationId: testConversation.id,
        environment: "test",
        occurredAt: occurredAt.toISOString(),
        confidence: Math.max(0.4, Math.min(0.85, 0.55 + (dayOffset % 5) * 0.04)),
        feedback: null,
        isFallback: true,
      });
    }
  }

  for (const event of events) {
    await sql`INSERT INTO analytics_events (
      id,
      workspace_id,
      conversation_id,
      event_type,
      environment,
      occurred_at,
      confidence,
      feedback,
      is_fallback
    )
    VALUES (
      ${randomUUID()},
      ${workspaceId},
      ${event.conversationId},
      ${"message"},
      ${event.environment},
      ${event.occurredAt},
      ${event.confidence},
      ${event.feedback},
      ${event.isFallback}
    )`;
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
    const conversations = await seedConversations(sql, workspaceId);
    await seedAnalyticsEvents(sql, workspaceId, conversations);

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
