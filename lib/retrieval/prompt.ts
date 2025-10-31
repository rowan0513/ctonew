import type { PromptPayload, RetrievedContext } from "./types";
import type { WorkspaceLanguage, WorkspaceRecord } from "@/lib/workspaces/schema";

const LANGUAGE_LABEL: Record<WorkspaceLanguage, string> = {
  en: "English",
  nl: "Dutch",
};

type PromptBuilderInput = {
  workspace: WorkspaceRecord;
  language: WorkspaceLanguage;
  query: string;
  contexts: RetrievedContext[];
};

export function buildPromptPayload({ workspace, language, query, contexts }: PromptBuilderInput): PromptPayload {
  const citations = contexts.map((context) => context.citation);

  const toneDescription = `${workspace.toneOfVoice} tone`;
  const system = [
    `You are the EzChat AI assistant for ${workspace.name}.`,
    `Respond in ${LANGUAGE_LABEL[language]} using a ${toneDescription}.`,
    "Respect the workspace brand voice and do not fabricate sources.",
    "Cite supporting snippets using bracketed identifiers like [C1].",
  ].join(" ");

  const brandDetails = `Brand palette — primary ${workspace.branding.primary}, accent ${workspace.branding.accent}, background ${workspace.branding.background}.`;

  const formattedContexts = contexts
    .map((context) => {
      const keywordLine = context.keywords.length > 0 ? `Keywords: ${context.keywords.join(", ")}` : "";
      return [`[${context.citation.id}] ${context.summary}`, keywordLine, context.content].filter(Boolean).join("\n");
    })
    .join("\n\n");

  const instructions = [
    `User query: ${query}`,
    brandDetails,
    contexts.length > 0
      ? "Reference the following context snippets when forming your answer. Prioritise factual accuracy and cite the most relevant snippet IDs."
      : "No knowledge snippets are available. Rely on general guidance and transparently disclose the lack of context.",
    formattedContexts,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    system,
    tone: workspace.toneOfVoice,
    language,
    brand: workspace.branding,
    instructions,
    citations,
  };
}
