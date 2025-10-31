# Workspace Platform Database Schema

This repository defines the multi-tenant Postgres schema used for managing AI workspaces, content ingestion, conversational logs, analytics, and administrative authentication. The schema is implemented with **Drizzle ORM** and ships with SQL migrations that enable the [`pgvector`](https://github.com/pgvector/pgvector) extension for semantic search use cases.

## Key Features

- **Multi-tenant isolation** enforced via `workspace_id` foreign keys and cascading deletes across all content, analytics, and job related tables.
- **Vector search ready**: `document_chunks.vector` uses `pgvector` and includes an IVFFlat index for similarity queries.
- **Comprehensive domain coverage** including workspaces, workspace settings, datasources, documents, chat conversations + messages, user feedback, analytics events, webhook subscriptions, and background jobs.
- **Bootstrap seed data** creates a super admin and demo workspace to accelerate local development.

## Getting Started

### Prerequisites

- Node.js 18+
- Access to a Postgres instance (Neon recommended) with permission to install extensions

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file and configure your database connection string:
   ```bash
   cp .env.example .env
   # Edit .env and set DATABASE_URL=postgres://...
   ```

### Running Migrations

Use the bundled `drizzle-kit` scripts to generate or apply migrations:

- Apply migrations to your database (creates schemas, enables extensions, seeds bootstrap data):
  ```bash
  npm run db:migrate
  ```

- Regenerate SQL migrations from the TypeScript schema (when you change `src/schema.ts`):
  ```bash
  npm run db:generate
  ```

- Inspect data with Drizzle Studio:
  ```bash
  npm run db:studio
  ```

> **Note:** The initial migration enables the `pgcrypto` and `pgvector` extensions. Ensure the target database allows installing extensions (Neon does).

### Bootstrap Credentials

The seed migration creates a default super admin for local development:

- **Email:** `admin@example.com`
- **Password:** `ChangeMe123!`

> These credentials are intended **only for development environments**. Replace them with secure values before deploying to production.

## Schema Overview

| Table | Purpose |
| --- | --- |
| `admin_users` | Platform administrators with hashed credentials and status flags. |
| `workspaces` | Top-level tenant container with language, publish state, and confidence thresholds. |
| `workspace_settings` | Branding, tone, welcome messaging, and webhook configuration per workspace. |
| `workspace_admins` | Many-to-many link between admins and workspaces, enabling delegated access. |
| `datasources` | Configured ingestion sources (manual, web, API, Notion, Slack, etc.). |
| `documents` | Normalized content entities synced from datasources. |
| `document_chunks` | Embedding-ready chunks with `vector(1536)` embeddings and IVFFlat index. |
| `conversations` | Chat sessions scoped to a workspace. |
| `messages` | Individual chat messages including model role, confidence, and metadata. |
| `feedback` | Human feedback on messages for reinforcement and quality review. |
| `analytics_events` | Workspace analytics stream for product usage and observability. |
| `webhook_subscriptions` | Outbound webhook registrations per workspace. |
| `jobs` | Background job queue wiring for long-running tasks (sync, indexing, etc.). |

## Project Structure

```
.
├─ drizzle/                 # SQL migrations and migration journal
├─ src/schema.ts            # Drizzle ORM schema definitions
├─ drizzle.config.ts        # Drizzle configuration (dialect, schema path, output)
├─ package.json             # Scripts and dependencies
└─ README.md
```

## Development Workflow

1. Update `src/schema.ts` with your schema changes.
2. Regenerate migrations via `npm run db:generate` (or hand-edit SQL if preferred).
3. Apply migrations with `npm run db:migrate` against your Neon database.
4. Verify changes with Drizzle Studio or your preferred SQL client.

## Contributing

- Avoid editing generated migration files in place; create new migrations for schema changes.
- Keep data isolation in mind—most tables should include a `workspace_id` foreign key.
- When adding new vector columns, remember to extend the migration to create the appropriate vector index.

---

Happy building! Feel free to extend the schema as your workspace platform evolves.
