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

  await sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready'`;
  await sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ`;
  await sql`ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS last_error TEXT`;

  await sql`CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    language TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
  )`;

  await sql`CREATE INDEX IF NOT EXISTS documents_workspace_type_idx
    ON documents (workspace_id, type)
    WHERE deleted_at IS NULL`;

  await sql`CREATE TABLE IF NOT EXISTS document_revisions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    language TEXT NOT NULL,
    tags JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_by TEXT,
    UNIQUE (document_id, version)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`;

  await sql`CREATE INDEX IF NOT EXISTS audit_logs_workspace_idx
    ON audit_logs (workspace_id, created_at DESC)`;

  await sql`CREATE TABLE IF NOT EXISTS embedding_jobs (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    queued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`;

  await sql`CREATE INDEX IF NOT EXISTS embedding_jobs_workspace_idx
    ON embedding_jobs (workspace_id, queued_at DESC)`;

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
  const now = Date.now();

  const dataSources = [
    {
      name: "Zendesk",
      type: "ticketing",
      status: "ready",
      lastSyncedAt: new Date(now - 15 * 60 * 1000).toISOString(),
      config: {
        baseUrl: "https://ezchat.zendesk.com",
        authType: "oauth",
        syncCadenceMinutes: 5,
      },
    },
    {
      name: "Intercom",
      type: "messaging",
      status: "ready",
      lastSyncedAt: new Date(now - 8 * 60 * 1000).toISOString(),
      config: {
        workspaceId: "ezchat-ops",
        channels: ["email", "chat", "in-app"],
        syncCadenceMinutes: 2,
      },
    },
    {
      name: "Salesforce",
      type: "crm",
      status: "ready",
      lastSyncedAt: new Date(now - 30 * 60 * 1000).toISOString(),
      config: {
        instanceUrl: "https://ezchat.my.salesforce.com",
        integrationUser: "ops-integration@ezchat.io",
        syncCadenceMinutes: 10,
      },
    },
    {
      name: "Manual Q&A",
      type: "manual_qa",
      status: "ready",
      lastSyncedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      config: {
        managed: true,
        documentCount: 2,
        languages: ["en", "nl"],
      },
    },
  ];

  for (const source of dataSources) {
    await sql`INSERT INTO data_sources (id, workspace_id, name, type, config, status, last_synced_at, last_error)
      VALUES (
        ${randomUUID()},
        ${workspaceId},
        ${source.name},
        ${source.type},
        ${JSON.stringify(source.config)}::jsonb,
        ${source.status},
        ${source.lastSyncedAt},
        NULL
      )
      ON CONFLICT (workspace_id, name)
      DO UPDATE SET
        type = EXCLUDED.type,
        config = EXCLUDED.config,
        status = EXCLUDED.status,
        last_synced_at = EXCLUDED.last_synced_at,
        last_error = EXCLUDED.last_error`;
  }
}

async function seedManualQaDocuments(sql, workspaceId) {
  await sql`DELETE FROM documents WHERE workspace_id = ${workspaceId} AND type = ${"manual_qa"}`;

  const now = Date.now();
  const baseTime = new Date(now - 20 * 60 * 1000);

  const documents = [
    {
      question: "How do I process a refund for a customer?",
      answer:
        "Navigate to Billing → Transactions, locate the payment, and select 'Issue refund'. The customer will receive a confirmation email automatically.",
      language: "en",
      tags: ["billing", "refunds"],
      status: "active",
      version: 2,
      revisions: [
        {
          version: 1,
          question: "How can I refund a customer payment?",
          answer:
            "Go to Billing → Transactions, open the payment record, and click 'Refund'.",
          language: "en",
          tags: ["billing"],
          createdAt: new Date(baseTime).toISOString(),
          createdBy: "system",
        },
        {
          version: 2,
          question: "How do I process a refund for a customer?",
          answer:
            "Navigate to Billing → Transactions, locate the payment, and select 'Issue refund'. The customer will receive a confirmation email automatically.",
          language: "en",
          tags: ["billing", "refunds"],
          createdAt: new Date(baseTime.getTime() + 8 * 60 * 1000).toISOString(),
          createdBy: "ops-automation",
        },
      ],
    },
    {
      question: "Welke kanalen ondersteunt de preview-assistent?",
      answer:
        "De preview-assistent ondersteunt momenteel e-mail, chat en Slack. Gebruik het QA-dashboard om scenario's per kanaal te testen.",
      language: "nl",
      tags: ["preview", "channels"],
      status: "active",
      version: 1,
      revisions: [
        {
          version: 1,
          question: "Welke kanalen ondersteunt de preview-assistent?",
          answer:
            "De preview-assistent ondersteunt momenteel e-mail, chat en Slack. Gebruik het QA-dashboard om scenario's per kanaal te testen.",
          language: "nl",
          tags: ["preview", "channels"],
          createdAt: new Date(baseTime.getTime() + 12 * 60 * 1000).toISOString(),
          createdBy: "qa-team",
        },
      ],
    },
  ];

  const inserted = [];

  for (const document of documents) {
    const documentId = randomUUID();
    const firstRevision = document.revisions[0];
    const latestRevision = document.revisions[document.revisions.length - 1];

    await sql`
      INSERT INTO documents (
        id,
        workspace_id,
        type,
        question,
        answer,
        language,
        tags,
        version,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${documentId},
        ${workspaceId},
        ${"manual_qa"},
        ${latestRevision.question},
        ${latestRevision.answer},
        ${latestRevision.language},
        ${JSON.stringify(latestRevision.tags)}::jsonb,
        ${document.version},
        ${document.status},
        ${firstRevision.createdAt},
        ${latestRevision.createdAt}
      )
    `;

    for (const revision of document.revisions) {
      await sql`
        INSERT INTO document_revisions (
          id,
          document_id,
          version,
          question,
          answer,
          language,
          tags,
          created_at,
          created_by
        )
        VALUES (
          ${randomUUID()},
          ${documentId},
          ${revision.version},
          ${revision.question},
          ${revision.answer},
          ${revision.language},
          ${JSON.stringify(revision.tags)}::jsonb,
          ${revision.createdAt},
          ${revision.createdBy ?? "system"}
        )
      `;
    }

    inserted.push({
      id: documentId,
      question: latestRevision.question,
      language: latestRevision.language,
      tags: latestRevision.tags,
      version: document.version,
      createdAt: firstRevision.createdAt,
      updatedAt: latestRevision.createdAt,
      revisions: document.revisions,
    });
  }

  return inserted;
}

async function syncManualQaDataSource(sql, workspaceId, manualDocuments) {
  const languages = Array.from(new Set(manualDocuments.map((doc) => doc.language))).sort();
  const latestUpdate = manualDocuments.reduce((latest, doc) => {
    if (!latest) {
      return doc.updatedAt ?? null;
    }
    const current = doc.updatedAt ?? null;
    if (!current) {
      return latest;
    }
    return new Date(current) > new Date(latest) ? current : latest;
  }, null);

  const config = {
    managed: true,
    documentCount: manualDocuments.length,
    languages,
  };

  await sql`
    UPDATE data_sources
    SET config = ${JSON.stringify(config)}::jsonb,
        last_synced_at = ${latestUpdate},
        status = 'ready',
        last_error = NULL
    WHERE workspace_id = ${workspaceId} AND type = ${"manual_qa"}
  `;
}

async function seedAuditLogs(sql, workspaceId, manualDocuments) {
  await sql`DELETE FROM audit_logs WHERE workspace_id = ${workspaceId}`;

  if (manualDocuments.length === 0) {
    return;
  }

  const [firstDoc, secondDoc] = manualDocuments;
  const logs = [];

  if (firstDoc) {
    const firstCreated = firstDoc.revisions?.find((revision) => revision.version === 1)?.createdAt ?? firstDoc.createdAt;
    logs.push({
      action: "manual_qa.created",
      actor: "admin@ezchat.io",
      entityType: "manual_qa",
      entityId: firstDoc.id,
      metadata: {
        documentId: firstDoc.id,
        question: firstDoc.revisions?.[0]?.question ?? firstDoc.question,
        version: 1,
        language: firstDoc.revisions?.[0]?.language ?? firstDoc.language,
        tags: firstDoc.revisions?.[0]?.tags ?? firstDoc.tags,
      },
      createdAt: firstCreated,
    });

    logs.push({
      action: "manual_qa.updated",
      actor: "admin@ezchat.io",
      entityType: "manual_qa",
      entityId: firstDoc.id,
      metadata: {
        documentId: firstDoc.id,
        question: firstDoc.question,
        version: firstDoc.version,
        language: firstDoc.language,
        tags: firstDoc.tags,
      },
      createdAt: new Date(new Date(firstDoc.updatedAt).getTime() + 90 * 1000).toISOString(),
    });
  }

  if (secondDoc) {
    logs.push({
      action: "manual_qa.created",
      actor: "qa-lead@ezchat.io",
      entityType: "manual_qa",
      entityId: secondDoc.id,
      metadata: {
        documentId: secondDoc.id,
        question: secondDoc.question,
        version: secondDoc.version,
        language: secondDoc.language,
        tags: secondDoc.tags,
      },
      createdAt: secondDoc.createdAt,
    });
  }

  for (const log of logs) {
    await sql`
      INSERT INTO audit_logs (
        id,
        workspace_id,
        action,
        actor,
        entity_type,
        entity_id,
        metadata,
        created_at
      )
      VALUES (
        ${randomUUID()},
        ${workspaceId},
        ${log.action},
        ${log.actor},
        ${log.entityType},
        ${log.entityId},
        ${JSON.stringify(log.metadata)}::jsonb,
        ${log.createdAt}
      )
    `;
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
    const manualDocuments = await seedManualQaDocuments(sql, workspaceId);
    await syncManualQaDataSource(sql, workspaceId, manualDocuments);
    await seedAuditLogs(sql, workspaceId, manualDocuments);
    await sql`DELETE FROM embedding_jobs WHERE workspace_id = ${workspaceId}`;
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
