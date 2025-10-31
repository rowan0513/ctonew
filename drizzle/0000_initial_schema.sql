BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE language AS ENUM ('en', 'nl');
CREATE TYPE admin_role AS ENUM ('superadmin', 'admin');
CREATE TYPE admin_status AS ENUM ('active', 'disabled');
CREATE TYPE datasource_type AS ENUM ('web', 'file', 'api', 'notion', 'slack', 'manual');
CREATE TYPE datasource_sync_status AS ENUM ('idle', 'running', 'failed', 'completed');
CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'resolved', 'closed');
CREATE TYPE message_role AS ENUM ('system', 'user', 'assistant', 'tool');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

CREATE TABLE admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    first_name text,
    last_name text,
    role admin_role NOT NULL DEFAULT 'admin',
    status admin_status NOT NULL DEFAULT 'active',
    last_login_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX admin_users_email_ci_idx ON admin_users (LOWER(email));

CREATE TABLE workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    default_language language NOT NULL DEFAULT 'en',
    is_active boolean NOT NULL DEFAULT true,
    is_published boolean NOT NULL DEFAULT false,
    confidence_threshold numeric(4,3) NOT NULL DEFAULT 0.700 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workspaces_slug_unique UNIQUE (slug)
);

CREATE TABLE workspace_settings (
    workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    tone text DEFAULT 'professional',
    primary_color text,
    accent_color text,
    background_color text,
    welcome_message text,
    logo_url text,
    banner_url text,
    support_email text,
    default_language language DEFAULT 'en',
    fallback_language language,
    watermark_enabled boolean NOT NULL DEFAULT false,
    confidence_threshold numeric(4,3) DEFAULT 0.700 CHECK (
        confidence_threshold IS NULL
        OR (confidence_threshold >= 0 AND confidence_threshold <= 1)
    ),
    webhook_url text,
    webhook_secret text,
    webhook_events text[] NOT NULL DEFAULT ARRAY[]::text[],
    is_published boolean NOT NULL DEFAULT false,
    temperature numeric(3,2) DEFAULT 0.70 CHECK (
        temperature IS NULL OR (temperature >= 0 AND temperature <= 2)
    ),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    role admin_role NOT NULL DEFAULT 'admin',
    invited_at timestamptz NOT NULL DEFAULT now(),
    joined_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT workspace_admins_unique UNIQUE (workspace_id, admin_user_id)
);

CREATE TABLE datasources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    type datasource_type NOT NULL,
    config jsonb NOT NULL DEFAULT '{}'::jsonb,
    sync_status datasource_sync_status NOT NULL DEFAULT 'idle',
    sync_cursor text,
    error_message text,
    is_managed boolean NOT NULL DEFAULT true,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT datasources_workspace_id_unique UNIQUE (workspace_id, id)
);

CREATE TABLE documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    datasource_id uuid REFERENCES datasources(id) ON DELETE CASCADE,
    external_id text,
    title text NOT NULL,
    slug text,
    summary text,
    content_hash text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'ready' CHECK (
        status IN ('draft', 'processing', 'ready', 'archived', 'error')
    ),
    is_published boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT documents_workspace_id_unique UNIQUE (workspace_id, id),
    CONSTRAINT documents_external_id_unique UNIQUE (workspace_id, external_id),
    CONSTRAINT documents_datasource_fk FOREIGN KEY (workspace_id, datasource_id)
        REFERENCES datasources(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE document_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index integer NOT NULL,
    content text NOT NULL,
    token_count integer CHECK (token_count IS NULL OR token_count >= 0),
    embedding_model text NOT NULL DEFAULT 'text-embedding-3-large',
    vector vector(1536) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT document_chunks_unique UNIQUE (document_id, chunk_index),
    CONSTRAINT document_chunks_workspace_document_fk FOREIGN KEY (workspace_id, document_id)
        REFERENCES documents(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    external_user_id text,
    title text,
    status conversation_status NOT NULL DEFAULT 'open',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    first_message_at timestamptz,
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    CONSTRAINT conversations_workspace_id_unique UNIQUE (workspace_id, id)
);

CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    content text NOT NULL,
    tokens integer CHECK (tokens IS NULL OR tokens >= 0),
    confidence numeric(3,2) CHECK (
        confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
    ),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT messages_workspace_id_unique UNIQUE (workspace_id, id),
    CONSTRAINT messages_workspace_conversation_fk FOREIGN KEY (workspace_id, conversation_id)
        REFERENCES conversations(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    admin_user_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
    score smallint NOT NULL DEFAULT 0 CHECK (score BETWEEN -1 AND 1),
    label text,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT feedback_message_unique UNIQUE (message_id),
    CONSTRAINT feedback_workspace_message_fk FOREIGN KEY (workspace_id, message_id)
        REFERENCES messages(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE analytics_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
    message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    user_identifier text,
    source text,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT analytics_events_workspace_conversation_fk FOREIGN KEY (workspace_id, conversation_id)
        REFERENCES conversations(workspace_id, id) ON DELETE SET NULL,
    CONSTRAINT analytics_events_workspace_message_fk FOREIGN KEY (workspace_id, message_id)
        REFERENCES messages(workspace_id, id) ON DELETE SET NULL
);

CREATE TABLE webhook_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    url text NOT NULL,
    secret text,
    events text[] NOT NULL DEFAULT ARRAY[]::text[],
    headers jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT webhook_subscriptions_url_unique UNIQUE (workspace_id, url)
);

CREATE TABLE jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
    job_type text NOT NULL,
    status job_status NOT NULL DEFAULT 'queued',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
    priority integer NOT NULL DEFAULT 5 CHECK (priority >= 0),
    scheduled_at timestamptz DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX workspaces_created_at_idx ON workspaces (created_at);

CREATE INDEX datasources_workspace_idx ON datasources (workspace_id);
CREATE INDEX datasources_type_idx ON datasources (type);

CREATE INDEX documents_workspace_idx ON documents (workspace_id);
CREATE INDEX documents_datasource_idx ON documents (datasource_id);

CREATE INDEX document_chunks_workspace_idx ON document_chunks (workspace_id, document_id);
CREATE INDEX document_chunks_document_idx ON document_chunks (document_id);
CREATE INDEX document_chunks_vector_idx ON document_chunks USING ivfflat (vector vector_l2_ops) WITH (lists = 100);

CREATE INDEX conversations_workspace_idx ON conversations (workspace_id, created_at);
CREATE INDEX conversations_status_idx ON conversations (status);

CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);
CREATE INDEX messages_workspace_idx ON messages (workspace_id);
CREATE INDEX messages_role_idx ON messages (role);

CREATE INDEX feedback_workspace_idx ON feedback (workspace_id);
CREATE INDEX feedback_admin_idx ON feedback (admin_user_id);

CREATE INDEX analytics_events_workspace_idx ON analytics_events (workspace_id, occurred_at);
CREATE INDEX analytics_events_type_idx ON analytics_events (event_type);

CREATE INDEX webhook_subscriptions_workspace_idx ON webhook_subscriptions (workspace_id);

CREATE INDEX jobs_workspace_idx ON jobs (workspace_id);
CREATE INDEX jobs_status_idx ON jobs (status);
CREATE INDEX jobs_scheduled_idx ON jobs (scheduled_at);

-- Seed data for development bootstrap
WITH inserted_admin AS (
    INSERT INTO admin_users (email, password_hash, first_name, last_name, role, status)
    SELECT
        'admin@example.com',
        '$2b$12$9fLCGXGpDoZ0IHTOn95uHOEUvLhouM.TzFy4Q78wbaqBFPH/7lmd.',
        'Bootstrap',
        'Admin',
        'superadmin',
        'active'
    WHERE NOT EXISTS (
        SELECT 1 FROM admin_users WHERE LOWER(email) = LOWER('admin@example.com')
    )
    RETURNING id
),
admin_source AS (
    SELECT id FROM inserted_admin
    UNION
    SELECT id FROM admin_users WHERE LOWER(email) = LOWER('admin@example.com')
),
inserted_workspace AS (
    INSERT INTO workspaces (slug, name, description, default_language, is_published, confidence_threshold)
    SELECT
        'acme',
        'Acme Demo Workspace',
        'Starter workspace for local development and onboarding',
        'en',
        false,
        0.700
    WHERE NOT EXISTS (
        SELECT 1 FROM workspaces WHERE slug = 'acme'
    )
    RETURNING id
),
workspace_source AS (
    SELECT id FROM inserted_workspace
    UNION
    SELECT id FROM workspaces WHERE slug = 'acme'
),
settings_insert AS (
    INSERT INTO workspace_settings (
        workspace_id,
        tone,
        primary_color,
        accent_color,
        background_color,
        welcome_message,
        is_published,
        confidence_threshold,
        temperature,
        metadata
    )
    SELECT
        ws.id,
        'friendly',
        '#111827',
        '#6366F1',
        '#F9FAFB',
        'Welcome to your AI workspace! Update this copy to match your brand.',
        false,
        0.700,
        0.70,
        '{}'::jsonb
    FROM workspace_source ws
    WHERE NOT EXISTS (
        SELECT 1 FROM workspace_settings s WHERE s.workspace_id = ws.id
    )
    RETURNING workspace_id
),
datasource_insert AS (
    INSERT INTO datasources (
        workspace_id,
        name,
        description,
        type,
        config,
        sync_status,
        is_managed
    )
    SELECT
        ws.id,
        'Getting Started',
        'Manual datasource seeded for onboarding. Replace with your own connections.',
        'manual',
        jsonb_build_object('note', 'Replace this datasource with production connectors'),
        'completed',
        true
    FROM workspace_source ws
    WHERE NOT EXISTS (
        SELECT 1 FROM datasources d WHERE d.workspace_id = ws.id AND d.name = 'Getting Started'
    )
    RETURNING workspace_id
)
INSERT INTO workspace_admins (workspace_id, admin_user_id, role)
SELECT
    ws.id,
    au.id,
    'superadmin'
FROM workspace_source ws
CROSS JOIN admin_source au
WHERE NOT EXISTS (
    SELECT 1
    FROM workspace_admins wa
    WHERE wa.workspace_id = ws.id AND wa.admin_user_id = au.id
);

COMMIT;
