import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const languageEnum = pgEnum("language", ["en", "nl"]);

export const adminRoleEnum = pgEnum("admin_role", ["superadmin", "admin"]);
export const adminStatusEnum = pgEnum("admin_status", ["active", "disabled"]);

export const datasourceTypeEnum = pgEnum("datasource_type", [
  "web",
  "file",
  "api",
  "notion",
  "slack",
  "manual",
]);

export const datasourceSyncStatusEnum = pgEnum("datasource_sync_status", [
  "idle",
  "running",
  "failed",
  "completed",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "open",
  "pending",
  "resolved",
  "closed",
]);

export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
  "tool",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    defaultLanguage: languageEnum("default_language").notNull().default("en"),
    isActive: boolean("is_active").notNull().default(true),
    isPublished: boolean("is_published").notNull().default(false),
    confidenceThreshold: numeric("confidence_threshold", { precision: 4, scale: 3 })
      .notNull()
      .default("0.700"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugUnique: uniqueIndex("workspaces_slug_unique").on(table.slug),
    workspaceCreatedAtIdx: index("workspaces_created_at_idx").on(table.createdAt),
  }),
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: adminRoleEnum("role").notNull().default("admin"),
    status: adminStatusEnum("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("admin_users_email_ci_idx").on(
      sql`lower(${table.email})`,
    ),
  }),
);

export const workspaceAdmins = pgTable(
  "workspace_admins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, {
        onDelete: "cascade",
      }),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, {
        onDelete: "cascade",
      }),
    role: adminRoleEnum("role").notNull().default("admin"),
    invitedAt: timestamp("invited_at", { withTimezone: true }).defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceAdminUnique: uniqueIndex("workspace_admins_unique").on(
      table.workspaceId,
      table.adminUserId,
    ),
    workspaceAdminByUserIdx: index("workspace_admins_admin_user_idx").on(
      table.adminUserId,
    ),
  }),
);

export const workspaceSettings = pgTable("workspace_settings", {
  workspaceId: uuid("workspace_id")
    .notNull()
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  tone: text("tone").default("professional"),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  backgroundColor: text("background_color"),
  welcomeMessage: text("welcome_message"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  supportEmail: text("support_email"),
  defaultLanguage: languageEnum("default_language").default("en"),
  fallbackLanguage: languageEnum("fallback_language"),
  watermarkEnabled: boolean("watermark_enabled").notNull().default(false),
  confidenceThreshold: numeric("confidence_threshold", { precision: 4, scale: 3 })
    .default("0.700"),
  webhookUrl: text("webhook_url"),
  webhookSecret: text("webhook_secret"),
  webhookEvents: text("webhook_events", { array: true }).default(sql`'{}'::text[]`),
  isPublished: boolean("is_published").notNull().default(false),
  temperature: numeric("temperature", { precision: 3, scale: 2 }).default("0.70"),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const datasources = pgTable(
  "datasources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: datasourceTypeEnum("type").notNull(),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    syncStatus: datasourceSyncStatusEnum("sync_status").notNull().default("idle"),
    syncCursor: text("sync_cursor"),
    errorMessage: text("error_message"),
    isManaged: boolean("is_managed").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    datasourceWorkspaceIdx: index("datasources_workspace_idx").on(table.workspaceId),
    datasourceTypeIdx: index("datasources_type_idx").on(table.type),
  }),
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    datasourceId: uuid("datasource_id")
      .references(() => datasources.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    title: text("title").notNull(),
    slug: text("slug"),
    summary: text("summary"),
    contentHash: text("content_hash"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("ready"),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentWorkspaceIdx: index("documents_workspace_idx").on(table.workspaceId),
    documentDatasourceIdx: index("documents_datasource_idx").on(table.datasourceId),
    documentExternalIdUnique: uniqueIndex("documents_external_id_unique").on(
      table.workspaceId,
      table.externalId,
    ),
  }),
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    embeddingModel: text("embedding_model")
      .notNull()
      .default("text-embedding-3-large"),
    vector: vector("vector", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    documentChunkUnique: uniqueIndex("document_chunks_unique").on(
      table.documentId,
      table.chunkIndex,
    ),
    documentChunkWorkspaceIdx: index("document_chunks_workspace_idx").on(
      table.workspaceId,
      table.documentId,
    ),
    documentChunkDocumentIdx: index("document_chunks_document_idx").on(
      table.documentId,
    ),
  }),
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    externalUserId: text("external_user_id"),
    title: text("title"),
    status: conversationStatusEnum("status").notNull().default("open"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    firstMessageAt: timestamp("first_message_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => ({
    conversationWorkspaceIdx: index("conversations_workspace_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    conversationStatusIdx: index("conversations_status_idx").on(table.status),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    tokens: integer("tokens"),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    messageConversationIdx: index("messages_conversation_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    messageWorkspaceIdx: index("messages_workspace_idx").on(table.workspaceId),
    messageRoleIdx: index("messages_role_idx").on(table.role),
  }),
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    adminUserId: uuid("admin_user_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    score: integer("score").notNull().default(0),
    label: text("label"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    feedbackMessageUnique: uniqueIndex("feedback_message_unique").on(table.messageId),
    feedbackWorkspaceIdx: index("feedback_workspace_idx").on(table.workspaceId),
    feedbackAdminIdx: index("feedback_admin_idx").on(table.adminUserId),
  }),
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageId: uuid("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    eventType: text("event_type").notNull(),
    userIdentifier: text("user_identifier"),
    source: text("source"),
    properties: jsonb("properties").notNull().default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    analyticsWorkspaceIdx: index("analytics_events_workspace_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),
    analyticsEventTypeIdx: index("analytics_events_type_idx").on(table.eventType),
  }),
);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret"),
    events: text("events", { array: true }).notNull().default(sql`'{}'::text[]`),
    headers: jsonb("headers").notNull().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    webhookWorkspaceIdx: index("webhook_subscriptions_workspace_idx").on(
      table.workspaceId,
    ),
    webhookUrlUnique: uniqueIndex("webhook_subscriptions_url_unique").on(
      table.workspaceId,
      table.url,
    ),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    jobType: text("job_type").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    priority: integer("priority").notNull().default(5),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobsWorkspaceIdx: index("jobs_workspace_idx").on(table.workspaceId),
    jobsStatusIdx: index("jobs_status_idx").on(table.status),
    jobsScheduledIdx: index("jobs_scheduled_idx").on(table.scheduledAt),
  }),
);
