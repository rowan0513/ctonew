import "server-only";

import { sql } from "@/lib/db";
import type { PreviewLanguage } from "@/lib/preview/types";

type WorkspacePreviewRow = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  isTrained: boolean;
  trainedAt: string | null;
  publishedAt: string | null;
  draftPromptEn: string;
  draftPromptNl: string;
  publishedPromptEn: string | null;
  publishedPromptNl: string | null;
};

export type WorkspacePreviewConfig = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  isTrained: boolean;
  trainedAt: string | null;
  publishedAt: string | null;
  draftPrompts: Record<PreviewLanguage, string>;
  publishedPrompts: Record<PreviewLanguage, string> | null;
};

export async function getWorkspacePreviewConfig(
  identifier: string,
): Promise<WorkspacePreviewConfig | null> {
  const rows = await sql<WorkspacePreviewRow[]>`
    SELECT
      id,
      slug,
      name,
      timezone,
      is_trained AS "isTrained",
      trained_at AS "trainedAt",
      published_at AS "publishedAt",
      draft_prompt_en AS "draftPromptEn",
      draft_prompt_nl AS "draftPromptNl",
      published_prompt_en AS "publishedPromptEn",
      published_prompt_nl AS "publishedPromptNl"
    FROM workspaces
    WHERE id::text = ${identifier} OR slug = ${identifier}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const [row] = rows;

  const publishedPrompts =
    row.publishedPromptEn && row.publishedPromptNl
      ? {
          en: row.publishedPromptEn,
          nl: row.publishedPromptNl,
        }
      : null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    timezone: row.timezone,
    isTrained: Boolean(row.isTrained),
    trainedAt: row.trainedAt ? new Date(row.trainedAt).toISOString() : null,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    draftPrompts: {
      en: row.draftPromptEn,
      nl: row.draftPromptNl,
    },
    publishedPrompts,
  };
}
