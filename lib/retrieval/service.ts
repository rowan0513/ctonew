import { WorkspaceNotFoundError, getWorkspaceById } from "@/lib/workspaces/store";
import type { WorkspaceLanguage, WorkspaceRecord } from "@/lib/workspaces/schema";

import { embedText, cosineSimilarity } from "./embeddings";
import { getKnowledgeChunksForWorkspace } from "./knowledge-base";
import { applyMaximalMarginalRelevance } from "./mmr";
import { buildPromptPayload } from "./prompt";
import type { Citation, KnowledgeChunk, RetrievalResponse, RetrievedContext, ScoredChunk } from "./types";

export class WorkspaceInactiveError extends Error {
  constructor(workspace: WorkspaceRecord) {
    super(`Workspace \"${workspace.name}\" is not active`);
    this.name = "WorkspaceInactiveError";
  }
}

export class UnsupportedWorkspaceLanguageError extends Error {
  constructor(workspace: WorkspaceRecord, language: WorkspaceLanguage) {
    super(`Workspace \"${workspace.name}\" does not support language \"${language}\"`);
    this.name = "UnsupportedWorkspaceLanguageError";
  }
}

export class EmptyQueryError extends Error {
  constructor() {
    super("Query must contain textual input");
    this.name = "EmptyQueryError";
  }
}

const DEFAULT_MAX_CONTEXTS = 6;
const CANDIDATE_MULTIPLIER = 2;

function createCitation(chunk: KnowledgeChunk): Citation {
  const identifier = `C${chunk.id.slice(0, 5).toUpperCase()}`;
  const snippet = chunk.content.length > 220 ? `${chunk.content.slice(0, 220)}…` : chunk.content;

  if (chunk.source.type === "url") {
    return {
      id: identifier,
      title: chunk.source.title,
      snippet,
      url: chunk.source.url,
    };
  }

  return {
    id: identifier,
    title: chunk.source.title,
    snippet,
    filename: chunk.source.filename,
  };
}

function mapToRetrievedContext(chunk: ScoredChunk): RetrievedContext {
  return {
    id: chunk.id,
    content: chunk.content,
    summary: chunk.summary,
    keywords: [...chunk.keywords],
    language: chunk.language,
    score: chunk.score,
    source: chunk.source,
    citation: createCitation(chunk),
  };
}

type RetrievalInput = {
  workspaceId: string;
  query: string;
  language?: WorkspaceLanguage;
  maxContexts?: number;
  mmrLambda?: number;
};

export function retrieveWorkspaceContext({
  workspaceId,
  query,
  language,
  maxContexts = DEFAULT_MAX_CONTEXTS,
  mmrLambda,
}: RetrievalInput): RetrievalResponse {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new EmptyQueryError();
  }

  const workspace = getWorkspaceById(workspaceId);

  if (!workspace) {
    throw new WorkspaceNotFoundError(workspaceId);
  }

  if (workspace.status !== "active") {
    throw new WorkspaceInactiveError(workspace);
  }

  const resolvedLanguage: WorkspaceLanguage = language ?? workspace.languages[0];

  if (!workspace.languages.includes(resolvedLanguage)) {
    throw new UnsupportedWorkspaceLanguageError(workspace, resolvedLanguage);
  }

  const queryEmbedding = embedText(trimmedQuery);

  const knowledgeChunks = getKnowledgeChunksForWorkspace(workspaceId, resolvedLanguage);

  const scoredCandidates: ScoredChunk[] = knowledgeChunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score);

  const candidateCount = Math.min(
    scoredCandidates.length,
    Math.max(maxContexts, 1) * CANDIDATE_MULTIPLIER,
  );

  const leadingCandidates = scoredCandidates.slice(0, candidateCount);

  const reranked = applyMaximalMarginalRelevance({
    candidates: leadingCandidates,
    queryEmbedding,
    maxResults: Math.max(maxContexts, 1),
    lambda: mmrLambda,
  });

  const contexts = reranked.slice(0, Math.max(maxContexts, 1)).map(mapToRetrievedContext);

  const prompt = buildPromptPayload({
    workspace,
    language: resolvedLanguage,
    query: trimmedQuery,
    contexts,
  });

  const metadata = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    query: trimmedQuery,
    language: resolvedLanguage,
    toneOfVoice: workspace.toneOfVoice,
    retrievedAt: new Date().toISOString(),
    contextCount: contexts.length,
  };

  return {
    metadata,
    contexts,
    prompt,
  };
}
