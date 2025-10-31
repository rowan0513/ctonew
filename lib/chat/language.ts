import type { WorkspaceLanguage } from "@/lib/workspaces/schema";

const LANGUAGE_KEYWORDS: Record<WorkspaceLanguage, string[]> = {
  en: ["the", "please", "support", "hello", "thanks", "help", "provide"],
  nl: ["de", "het", "een", "hoi", "bedankt", "alsjeblieft", "gebruik", "waarom", "kunt"],
};

const LANGUAGE_PATTERNS: Record<WorkspaceLanguage, RegExp[]> = {
  en: [/ing\b/gi, /should/gi, /issue/gi],
  nl: [/\bje\b/gi, /\bgeen\b/gi, /\bworden\b/gi, /\bwij\b/gi],
};

function scoreKeyword(text: string, keyword: string): number {
  const pattern = new RegExp(`\\b${keyword}\\b`, "gi");
  const matches = text.match(pattern);

  return matches ? matches.length : 0;
}

function scorePattern(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);

  return matches ? matches.length : 0;
}

function computeLanguageScore(text: string, language: WorkspaceLanguage): number {
  let score = 0;

  for (const keyword of LANGUAGE_KEYWORDS[language] ?? []) {
    score += scoreKeyword(text, keyword) * 2;
  }

  for (const pattern of LANGUAGE_PATTERNS[language] ?? []) {
    score += scorePattern(text, pattern);
  }

  // Encourage Dutch detection for words containing ij combinations.
  if (language === "nl" && /ij/.test(text)) {
    score += 1;
  }

  return score;
}

export function detectLanguage(text: string, allowed: WorkspaceLanguage[]): WorkspaceLanguage {
  if (allowed.length === 0) {
    throw new Error("detectLanguage requires at least one allowed language");
  }

  if (allowed.length === 1) {
    return allowed[0];
  }

  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return allowed[0];
  }

  let bestLanguage = allowed[0];
  let bestScore = -Infinity;

  for (const language of allowed) {
    const score = computeLanguageScore(normalized, language);

    if (score > bestScore) {
      bestLanguage = language;
      bestScore = score;
    }
  }

  return bestLanguage;
}
