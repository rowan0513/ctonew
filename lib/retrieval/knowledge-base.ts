import { randomUUID } from "node:crypto";

import { embedText } from "./embeddings";
import type { KnowledgeChunk } from "./types";
import { listWorkspaces } from "@/lib/workspaces/store";
import type { WorkspaceLanguage } from "@/lib/workspaces/schema";

type KnowledgeBaseStore = {
  chunks: KnowledgeChunk[];
};

const globalKnowledgeBase = globalThis as typeof globalThis & {
  __ezchatKnowledgeBase?: KnowledgeBaseStore;
};

function cloneChunk<T extends KnowledgeChunk>(chunk: T): T {
  return structuredClone(chunk);
}

function createChunk(input: {
  workspaceId: string;
  language: WorkspaceLanguage;
  content: string;
  summary: string;
  keywords: string[];
  source: KnowledgeChunk["source"];
  createdAt: string;
}): KnowledgeChunk {
  const embedding = embedText(`${input.summary} ${input.content} ${input.keywords.join(" ")}`);

  return {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    language: input.language,
    content: input.content,
    summary: input.summary,
    keywords: [...input.keywords],
    embedding,
    source: input.source,
    createdAt: input.createdAt,
  };
}

function seedKnowledgeChunks(): KnowledgeChunk[] {
  const workspaces = listWorkspaces();
  const nowIso = new Date().toISOString();

  const chunks: KnowledgeChunk[] = [];

  const byName = new Map(workspaces.map((workspace) => [workspace.name, workspace]));

  const demo = byName.get("EzChat Demo");
  if (demo) {
    const demoChunks: Array<Omit<Parameters<typeof createChunk>[0], "workspaceId"> & { workspaceId?: string }> = [
      {
        workspaceId: demo.id,
        language: "en",
        summary: "Quickstart guide for embedding EzChat on marketing sites",
        content:
          "Outline the required script tags, authentication tokens, and recommended placement for embedding the EzChat widget on a public-facing marketing website.",
        keywords: ["widget", "marketing", "authentication"],
        source: {
          type: "url",
          title: "EzChat Widget Quickstart",
          url: "https://docs.ezchat.io/widget/quickstart",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: demo.id,
        language: "en",
        summary: "Tone of voice guidance for supportive conversations",
        content:
          "Agents should maintain a warm, encouraging tone with empathetic phrasing, mirroring the member's language and offering clear next steps in plain English.",
        keywords: ["tone", "support", "language"],
        source: {
          type: "file",
          title: "Supportive Tone Guidelines",
          filename: "tone-supportive.md",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: demo.id,
        language: "en",
        summary: "Analytics instrumentation requirements",
        content:
          "Tracking must include chat session IDs, response satisfaction scores, and conversion events streamed to the EzChat analytics ingestion endpoint.",
        keywords: ["analytics", "instrumentation", "conversion"],
        source: {
          type: "url",
          title: "Analytics Instrumentation",
          url: "https://docs.ezchat.io/analytics/instrumentation",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: demo.id,
        language: "en",
        summary: "Escalation policy for high-risk conversations",
        content:
          "If a visitor mentions imminent harm, data loss, or billing disputes above $5k, escalate to an on-call manager using the emergency Slack channel.",
        keywords: ["escalation", "risk", "slack"],
        source: {
          type: "file",
          title: "Escalation Playbook",
          filename: "escalation-playbook.pdf",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: demo.id,
        language: "en",
        summary: "Brand styling reminders",
        content:
          "Responses should reference the EzChat brand palette, highlight the new automation builder, and sign off with \"Team EzChat\" when appropriate.",
        keywords: ["branding", "palette", "sign-off"],
        source: {
          type: "url",
          title: "Brand Voice Overview",
          url: "https://brand.ezchat.io/voice",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: demo.id,
        language: "en",
        summary: "Knowledge base ingestion checklist",
        content:
          "Before reindexing, ensure documents are under 6k tokens, include language tags, and avoid duplicate headlines between related playbooks.",
        keywords: ["ingestion", "tokens", "duplicate"],
        source: {
          type: "file",
          title: "Ingestion Checklist",
          filename: "ingestion-checklist.docx",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: demo.id,
        language: "nl",
        summary: "Handleiding voor klantverhalen",
        content:
          "Gebruik warme, ondersteunende taal in het Nederlands en verwijs naar succesvolle klantcases zoals FlowPilot en NovaBank.",
        keywords: ["klantverhalen", "ondersteunend", "tone"],
        source: {
          type: "url",
          title: "Nederlandse Tone of Voice",
          url: "https://docs.ezchat.io/nl/tone",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: demo.id,
        language: "nl",
        summary: "Escalatie instructies voor kritieke meldingen",
        content:
          "Bij meldingen over veiligheidsincidenten binnen de EU moet binnen tien minuten worden opgeschaald via het incidentnummer van EzChat.",
        keywords: ["escalatie", "veiligheid", "incident"],
        source: {
          type: "file",
          title: "Escalatie Richtlijnen NL",
          filename: "escalatie-nl.pdf",
        },
        createdAt: nowIso,
      },
    ];

    demoChunks.forEach((chunk) => {
      chunks.push(createChunk({ ...chunk, workspaceId: demo.id }));
    });
  }

  const qa = byName.get("Internal QA");
  if (qa) {
    const qaChunks: Array<Omit<Parameters<typeof createChunk>[0], "workspaceId"> & { workspaceId?: string }> = [
      {
        workspaceId: qa.id,
        language: "en",
        summary: "Regression checklist for chat runtime",
        content:
          "Validate streaming responses, guardrails, and telemetry after each deployment. Capture screenshots of anomalies in the QA dashboard.",
        keywords: ["regression", "telemetry", "streaming"],
        source: {
          type: "file",
          title: "Runtime QA Checklist",
          filename: "runtime-qa.md",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: qa.id,
        language: "en",
        summary: "Synthetic conversation fixtures",
        content:
          "Use the provided synthetic queries covering authentication, billing, and handover flows to validate assistant behaviour in staging.",
        keywords: ["synthetic", "fixtures", "handover"],
        source: {
          type: "url",
          title: "QA Conversation Fixtures",
          url: "https://internal.ezchat.io/fixtures",
        },
        createdAt: nowIso,
      },
      {
        workspaceId: qa.id,
        language: "en",
        summary: "Observability dashboards",
        content:
          "Monitor latency, error ratios, and PG vector usage in Grafana. Alert thresholds are defined for 95th percentile latency above 4 seconds.",
        keywords: ["observability", "grafana", "latency"],
        source: {
          type: "url",
          title: "QA Observability Overview",
          url: "https://internal.ezchat.io/observability",
        },
        createdAt: nowIso,
      },
    ];

    qaChunks.forEach((chunk) => {
      chunks.push(createChunk({ ...chunk, workspaceId: qa.id }));
    });
  }

  workspaces
    .filter((workspace) => workspace.name !== "EzChat Demo" && workspace.name !== "Internal QA")
    .forEach((workspace) => {
      const genericContent: Array<Omit<Parameters<typeof createChunk>[0], "workspaceId"> & { workspaceId?: string }> = [
        {
          workspaceId: workspace.id,
          language: workspace.languages[0],
          summary: `${workspace.name} onboarding overview`,
          content:
            "Detail the onboarding process for new agents, covering authentication, tone of voice expectations, and data retention controls.",
          keywords: ["onboarding", "agents", "compliance"],
          source: {
            type: "file",
            title: `${workspace.name} Onboarding Guide`,
            filename: "onboarding.pdf",
          },
          createdAt: nowIso,
        },
        {
          workspaceId: workspace.id,
          language: workspace.languages[0],
          summary: `${workspace.name} escalation reference`,
          content:
            "Escalate conversations involving contractual changes, PII exposure, or production outages to the workspace leadership team within ten minutes.",
          keywords: ["escalation", "pii", "contract"],
          source: {
            type: "url",
            title: `${workspace.name} Escalation Policy`,
            url: "https://docs.ezchat.io/escalation",
          },
          createdAt: nowIso,
        },
      ];

      genericContent.forEach((chunk) => {
        chunks.push(createChunk({ ...chunk, workspaceId: workspace.id }));
      });
    });

  return chunks;
}

function getKnowledgeBaseStore(): KnowledgeBaseStore {
  if (!globalKnowledgeBase.__ezchatKnowledgeBase) {
    globalKnowledgeBase.__ezchatKnowledgeBase = {
      chunks: seedKnowledgeChunks(),
    };
  }

  return globalKnowledgeBase.__ezchatKnowledgeBase;
}

export function listKnowledgeChunks(): KnowledgeChunk[] {
  const store = getKnowledgeBaseStore();
  return store.chunks.map((chunk) => cloneChunk(chunk));
}

export function getKnowledgeChunksForWorkspace(
  workspaceId: string,
  language?: WorkspaceLanguage,
): KnowledgeChunk[] {
  const store = getKnowledgeBaseStore();

  return store.chunks
    .filter((chunk) => chunk.workspaceId === workspaceId)
    .filter((chunk) => (language ? chunk.language === language : true))
    .map((chunk) => cloneChunk(chunk));
}

export function resetKnowledgeBaseStore(): void {
  if (globalKnowledgeBase.__ezchatKnowledgeBase) {
    globalKnowledgeBase.__ezchatKnowledgeBase.chunks = seedKnowledgeChunks();
  } else {
    globalKnowledgeBase.__ezchatKnowledgeBase = {
      chunks: seedKnowledgeChunks(),
    };
  }
}

export function setKnowledgeChunksForTesting(chunks: KnowledgeChunk[]): void {
  const cloned = chunks.map((chunk) => cloneChunk(chunk));
  if (!globalKnowledgeBase.__ezchatKnowledgeBase) {
    globalKnowledgeBase.__ezchatKnowledgeBase = {
      chunks: cloned,
    };
    return;
  }

  globalKnowledgeBase.__ezchatKnowledgeBase.chunks = cloned;
}
