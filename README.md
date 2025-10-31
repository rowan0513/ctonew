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
- **S3-compatible uploads** – Workspaces obtain presigned URLs backed by S3 or a local emulator; uploads are virus scanned, metadata stored in SQLite, and parsing tasks queued via BullMQ.
- **Automated parsing** – Background workers normalize PDF, DOCX, TXT, and CSV uploads into UTF-8 text for downstream processing.
- **Dependency auditing** – `npm run audit:ci` fails builds on high severity vulnerabilities (see `.github/workflows/dependency-audit.yml`).

## Document Storage Pipeline

1. Clients request a signed upload URL from `POST /api/files/upload-url` with workspace authentication headers.
2. Files upload directly to the configured S3-compatible bucket (or in-memory store for tests) using the returned URL and headers.
3. The client signals completion via `POST /api/files/complete`; the server downloads the object, performs antivirus + MIME validation, persists metadata, and queues a BullMQ parsing job.
4. Background workers retrieve the file, normalize text with format-specific libraries (`pdf-parse`, `mammoth`, `csv-parse`), and update the `documents` table with structured metadata and normalized text.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start the HTTP server. |
| `npm test` | Run Jest test suite covering validators, security middleware, and the storage pipeline. |
| `npm run audit:ci` | Run automated dependency audit (fails on high severity issues). |

## Security Notes

See [`docs/security-checklist.md`](docs/security-checklist.md) for the complete security controls checklist and secret rotation guidance.
