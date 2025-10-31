import type { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { POST } from "@/app/api/chat/route";
import { embedText } from "@/lib/retrieval/embeddings";
import { resetKnowledgeBaseStore, setKnowledgeChunksForTesting } from "@/lib/retrieval/knowledge-base";
import type { KnowledgeChunk } from "@/lib/retrieval/types";
import { getChatAnalytics, resetChatAnalyticsStore } from "@/lib/chat/analytics";
import { listWorkspaces, resetWorkspaceStore } from "@/lib/workspaces/store";

function createRequest(body: unknown, apiKey?: string) {
  const headers = new Headers({
    "content-type": "application/json",
  });

  if (apiKey) {
    headers.set("authorization", `Bearer ${apiKey}`);
  }

  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    resetWorkspaceStore();
    resetKnowledgeBaseStore();
    resetChatAnalyticsStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an answer with confidence, citations, and analytics logging", async () => {
    const workspace = listWorkspaces()[0];
    const timestamp = new Date().toISOString();

    const chunks: KnowledgeChunk[] = [
      {
        id: "support-playbook",
        workspaceId: workspace.id,
        language: workspace.languages[0],
        summary: "Support escalation steps",
        content: "Walk the customer through troubleshooting and cite document [C1] if needed.",
        keywords: ["support", "onboarding"],
        embedding: embedText("support escalation troubleshoot cite document"),
        source: {
          type: "url",
          title: "Support Playbook",
          url: "https://example.com/support-playbook",
        },
        createdAt: timestamp,
      },
    ];

    setKnowledgeChunksForTesting(chunks);

    const fetchMock = vi.spyOn(global, "fetch");

    fetchMock.mockRejectedValueOnce(new Error("primary model failure"));
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: [
            "Follow the support playbook and reassure the customer. Reference [C1] for the documented process.",
          ],
          usage: {
            input_tokens: 120,
            output_tokens: 80,
            total_tokens: 200,
          },
        }),
        { status: 200 },
      ),
    );

    const payload = {
      workspaceId: workspace.id,
      question: "How should we handle onboarding issues for a new EzChat customer?",
      history: [
        { role: "user" as const, content: "Can you remind me of the escalation path?" },
        { role: "assistant" as const, content: "We escalate after confirming the customer rebooted." },
      ],
    };

    const response = await POST(createRequest(payload, workspace.apiKey) as unknown as NextRequest);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      answer: string;
      citations: Array<{ id: string }>;
      confidence: number;
      handover: boolean;
      language: string;
      model: string;
    };

    expect(body.answer).toContain("support playbook");
    expect(body.citations).toHaveLength(1);
    expect(body.citations[0].id).toBe("C" + chunks[0].id.slice(0, 5).toUpperCase());
    expect(body.confidence).toBeGreaterThan(0);
    expect(body.handover).toBe(false);
    expect(body.language).toBe(workspace.languages[0]);
    expect(body.model).toBe("gpt-4o-mini");

    const analytics = getChatAnalytics();
    expect(analytics.conversations).toHaveLength(1);
    expect(analytics.messages).toHaveLength(4);
    expect(analytics.conversations[0].handover).toBe(false);
    expect(analytics.conversations[0].model).toBe("gpt-4o-mini");
  });

  it("flags handover when confidence is below the workspace threshold and masks PII", async () => {
    const workspace = listWorkspaces()[0];

    setKnowledgeChunksForTesting([]);

    const fetchMock = vi.spyOn(global, "fetch");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          output_text: ["I'm not sure we have that information available right now."],
          usage: {
            input_tokens: 60,
            output_tokens: 40,
            total_tokens: 100,
          },
        }),
        { status: 200 },
      ),
    );

    const payload = {
      workspaceId: workspace.id,
      question: "My email is customer@example.com – can you help with advanced analytics limits?",
    };

    const response = await POST(createRequest(payload, workspace.apiKey) as unknown as NextRequest);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { handover: boolean; confidence: number };

    expect(body.handover).toBe(true);
    expect(body.confidence).toBeLessThan(workspace.confidenceThreshold);

    const analytics = getChatAnalytics();
    expect(analytics.messages).toHaveLength(2);
    const questionMessage = analytics.messages.find((message) => message.source === "question");
    expect(questionMessage?.maskedContent).toContain("[REDACTED_EMAIL]");
    expect(questionMessage?.content).toContain("customer@example.com");
  });

  it("returns 401 when the API key is missing or invalid", async () => {
    const workspace = listWorkspaces()[0];

    const payload = {
      workspaceId: workspace.id,
      question: "What is the latest response time target?",
    };

    const response = await POST(createRequest(payload, "invalid-key") as unknown as NextRequest);

    expect(response.status).toBe(401);

    const missingKeyResponse = await POST(createRequest(payload) as unknown as NextRequest);
    expect(missingKeyResponse.status).toBe(401);
  });

  it("returns 404 for an unknown workspace id", async () => {
    const payload = {
      workspaceId: "workspace-does-not-exist",
      question: "Do we support dark mode?",
    };

    const response = await POST(createRequest(payload, "some-key") as unknown as NextRequest);

    expect(response.status).toBe(404);
  });
});
