import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { embedText } from "@/lib/retrieval/embeddings";
import { resetKnowledgeBaseStore, setKnowledgeChunksForTesting } from "@/lib/retrieval/knowledge-base";
import { retrieveWorkspaceContext } from "@/lib/retrieval/service";
import type { KnowledgeChunk } from "@/lib/retrieval/types";
import { listWorkspaces, resetWorkspaceStore } from "@/lib/workspaces/store";

beforeEach(() => {
  resetWorkspaceStore();
  resetKnowledgeBaseStore();
});

afterEach(() => {
  resetKnowledgeBaseStore();
});

describe("retrieveWorkspaceContext", () => {
  it("returns up to six contexts in the requested language with citation metadata", () => {
    const workspace = listWorkspaces().find((item) => item.languages.includes("en") && item.languages.includes("nl"));
    expect(workspace).toBeDefined();
    const activeWorkspace = workspace!;

    const result = retrieveWorkspaceContext({
      workspaceId: activeWorkspace.id,
      query: "analytics instrumentation requirements and brand tone",
      language: "en",
    });

    expect(result.contexts.length).toBeLessThanOrEqual(6);
    expect(result.contexts.length).toBeGreaterThan(0);

    result.contexts.forEach((context) => {
      expect(context.language).toBe("en");
      expect(context.citation.id).toMatch(/^C[A-Z0-9]{5}$/);
      expect(context.citation.snippet.length).toBeGreaterThan(0);
    });

    expect(result.metadata.workspaceId).toBe(activeWorkspace.id);
    expect(result.metadata.language).toBe("en");
    expect(result.prompt.citations.length).toBe(result.contexts.length);
  });

  it("filters contexts by the requested workspace language", () => {
    const workspace = listWorkspaces().find((item) => item.languages.includes("nl"));
    expect(workspace).toBeDefined();
    const activeWorkspace = workspace!;

    const result = retrieveWorkspaceContext({
      workspaceId: activeWorkspace.id,
      query: "Escalatie instructies voor kritieke meldingen",
      language: "nl",
    });

    expect(result.contexts.length).toBeGreaterThan(0);
    result.contexts.forEach((context) => {
      expect(context.language).toBe("nl");
    });

    expect(result.prompt.language).toBe("nl");
    expect(result.prompt.system).toContain("Dutch");
  });

  it("applies MMR reranking to reduce redundant alpha contexts", () => {
    const workspace = listWorkspaces().find((item) => item.languages.includes("en"));
    expect(workspace).toBeDefined();
    const activeWorkspace = workspace!;

    const timestamp = new Date().toISOString();
    const customChunks: KnowledgeChunk[] = [
      {
        id: "alpha-main",
        workspaceId: activeWorkspace.id,
        language: "en",
        summary: "Alpha integration setup",
        content:
          "Detailed alpha integration instructions covering token creation, environment variables, and callback configuration for production launches.",
        keywords: ["alpha", "integration", "tokens"],
        embedding: embedText(
          "Detailed alpha integration instructions covering token creation environment variables callback configuration production",
        ),
        source: {
          type: "url",
          title: "Alpha Integration Guide",
          url: "https://example.com/alpha-integration",
        },
        createdAt: timestamp,
      },
      {
        id: "alpha-quickstart",
        workspaceId: activeWorkspace.id,
        language: "en",
        summary: "Alpha integration quickstart",
        content:
          "Alpha integration quickstart repeating the same setup steps for tokens, callbacks, and environment configuration to mimic duplication.",
        keywords: ["alpha", "integration", "quickstart"],
        embedding: embedText(
          "Alpha integration quickstart repeating same setup steps tokens callbacks environment configuration duplicate",
        ),
        source: {
          type: "file",
          title: "Alpha Integration Quickstart",
          filename: "alpha-quickstart.pdf",
        },
        createdAt: timestamp,
      },
      {
        id: "beta-reporting",
        workspaceId: activeWorkspace.id,
        language: "en",
        summary: "Beta analytics integration",
        content:
          "Beta reporting overview describing analytics integration touchpoints, dashboard configuration, and data synchronisation for leadership visibility.",
        keywords: ["beta", "analytics", "integration"],
        embedding: embedText(
          "Beta reporting overview analytics integration touchpoints dashboard configuration data synchronisation leadership visibility",
        ),
        source: {
          type: "url",
          title: "Beta Reporting Overview",
          url: "https://example.com/beta-reporting",
        },
        createdAt: timestamp,
      },
      {
        id: "gamma-escalation",
        workspaceId: activeWorkspace.id,
        language: "en",
        summary: "Gamma escalation",
        content:
          "Gamma escalation pathway outlining incident hotline numbers, resolver rotations, and integration points with the alpha support team.",
        keywords: ["gamma", "escalation", "integration"],
        embedding: embedText(
          "Gamma escalation pathway incident hotline resolver rotation integration points alpha support team",
        ),
        source: {
          type: "file",
          title: "Gamma Escalation Policy",
          filename: "gamma-escalation.docx",
        },
        createdAt: timestamp,
      },
    ];

    setKnowledgeChunksForTesting(customChunks);

    const result = retrieveWorkspaceContext({
      workspaceId: activeWorkspace.id,
      query: "integration instructions for alpha launches",
      language: "en",
      maxContexts: 3,
      mmrLambda: 0.6,
    });

    expect(result.contexts).toHaveLength(3);

    const topTitles = result.contexts.slice(0, 2).map((context) => context.citation.title.toLowerCase());
    const alphaMentions = topTitles.filter((title) => title.includes("alpha"));
    expect(alphaMentions).toHaveLength(1);
    expect(topTitles).toContain("beta reporting overview".toLowerCase());
  });

  it("builds prompt metadata with tone of voice and citations", () => {
    const workspace = listWorkspaces()[0];

    const result = retrieveWorkspaceContext({
      workspaceId: workspace.id,
      query: "How should we handle escalation scenarios?",
      language: workspace.languages[0],
    });

    expect(result.prompt.tone).toBe(workspace.toneOfVoice);
    expect(result.prompt.citations.length).toBe(result.contexts.length);

    if (result.contexts.length > 0) {
      expect(result.prompt.instructions).toContain(`[${result.contexts[0].citation.id}]`);
    }

    expect(result.prompt.system).toContain(workspace.name);
    expect(result.metadata.toneOfVoice).toBe(workspace.toneOfVoice);
  });
});
