import type { WorkspaceLanguage, WorkspaceRecord, WorkspaceTone } from "@/lib/workspaces/schema";

export type EmbeddingVector = number[];

export type KnowledgeChunkSource =
  | {
      type: "url";
      title: string;
      url: string;
    }
  | {
      type: "file";
      title: string;
      filename: string;
    };

export type KnowledgeChunk = {
  id: string;
  workspaceId: string;
  language: WorkspaceLanguage;
  content: string;
  summary: string;
  keywords: string[];
  embedding: EmbeddingVector;
  source: KnowledgeChunkSource;
  createdAt: string;
};

export type ScoredChunk = KnowledgeChunk & {
  score: number;
};

export type Citation = {
  id: string;
  title: string;
  snippet: string;
  url?: string;
  filename?: string;
};

export type RetrievedContext = {
  id: string;
  content: string;
  summary: string;
  keywords: string[];
  language: WorkspaceLanguage;
  score: number;
  source: KnowledgeChunkSource;
  citation: Citation;
};

export type PromptPayload = {
  system: string;
  tone: WorkspaceTone;
  language: WorkspaceLanguage;
  brand: WorkspaceRecord["branding"];
  instructions: string;
  citations: Citation[];
};

export type RetrievalMetadata = {
  workspaceId: string;
  workspaceName: string;
  query: string;
  language: WorkspaceLanguage;
  toneOfVoice: WorkspaceTone;
  retrievedAt: string;
  contextCount: number;
};

export type RetrievalResponse = {
  metadata: RetrievalMetadata;
  contexts: RetrievedContext[];
  prompt: PromptPayload;
};
