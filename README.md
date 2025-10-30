# Secure API Baseline

This project provides a minimal Express application hardened with baseline security controls, schema validation, and automated checks.

## Getting Started

```bash
npm install
npm start
```

Environment variables can be configured via `.env` (see `.env.example`).

## Key Features

- **Input validation** – All API requests are validated with Zod schemas.
- **Content sanitization** – HTML content is sanitized before storage/response.
- **Security headers** – Helmet enforces CSP, HSTS, frameguard, and modern browser protections.
- **HTTPS-only cookies** – Administrative responses set secure cookies.
- **File scanning** – Uploads are scanned for sensitive patterns and can trigger optional content moderation providers.
- **SSRF protection** – Remote crawling is constrained by allow-lists, request timeouts, and size limits.
- **Request limits** – Body parsers restrict incoming payload size.
- **Dependency auditing** – `npm run audit:ci` fails builds on high severity vulnerabilities (see `.github/workflows/dependency-audit.yml`).
- **Privacy controls** – Configurable PII masking, "forget data" workflows, and audit logs for compliance operations.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the HTTP server. |
| `npm test` | Run Jest test suite covering validators and security middleware. |
| `npm run audit:ci` | Run automated dependency audit (fails on high severity issues). |

## Privacy Controls

- Access the privacy control UI at [`/admin/privacy`](http://localhost:3000/admin/privacy) to toggle global or per-workspace PII masking. Changes are tracked in the audit log.
- API endpoints are available for automation:
  - `POST /api/privacy/masking` toggles the global mask (`{ "enabled": true }`).
  - `POST /api/workspaces/:workspaceId/privacy/masking` overrides masking for a workspace.
  - `DELETE /api/workspaces/:workspaceId/data-sources/:dataSourceId` invokes the "forget data" workflow, deleting stored artefacts and re-triggering indexing.
  - `GET /api/privacy/audit` returns audit log entries for privacy actions.
- Register data sources for testing via `POST /api/workspaces/:workspaceId/data-sources` and list current sources with `GET /api/workspaces/:workspaceId/data-sources`.
- Analytics events automatically mask emails and phone numbers when masking is enabled, ensuring observability without leaking PII.

## Security Notes

See [`docs/security-checklist.md`](docs/security-checklist.md) for the complete security controls checklist and secret rotation guidance.
