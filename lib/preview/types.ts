export type PreviewLanguage = "en" | "nl";
export type PreviewRole = "user" | "assistant";

export type PreviewCitation = {
  id: string;
  label: string;
  type: "link" | "file";
  url?: string;
  fileName?: string;
};

export type PreviewHistoryMessage = {
  role: PreviewRole;
  content: string;
  language: PreviewLanguage;
  responseId?: string;
  citations?: PreviewCitation[];
  confidence?: number | null;
};

export type PreviewResponse = {
  responseId: string;
  answer: string;
  language: PreviewLanguage;
  citations: PreviewCitation[];
  confidence: number;
  sessionId: string;
};

export type PreviewWarning = "workspace_not_published";

export type PreviewResult = {
  response: PreviewResponse;
  warnings: PreviewWarning[];
};
