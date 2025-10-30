import type { PreviewLanguage } from "@/lib/preview/types";

const dutchIndicators: RegExp[] = [
  /\bde\b/i,
  /\bhet\b/i,
  /\been\b/i,
  /\bgeen\b/i,
  /\balsjeblieft\b/i,
  /\bdank je\b/i,
  /\bjij\b/i,
  /\bwij\b/i,
  /\bklant\b/i,
];

const englishIndicators: RegExp[] = [
  /\bthe\b/i,
  /\band\b/i,
  /\bplease\b/i,
  /\bthank\b/i,
  /\bcustomer\b/i,
  /\bhello\b/i,
  /\byou\b/i,
];

function score(text: string, patterns: RegExp[]): number {
  return patterns.reduce((total, pattern) => total + (pattern.test(text) ? 1 : 0), 0);
}

export function detectPreviewLanguage(input: string): PreviewLanguage {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return "en";
  }

  const normalized = ` ${trimmed.toLowerCase()} `;
  const dutchScore = score(normalized, dutchIndicators) + (normalized.includes(" ij") ? 1 : 0);
  const englishScore = score(normalized, englishIndicators);

  if (dutchScore === englishScore) {
    return normalized.includes(" de ") || normalized.includes(" het ") ? "nl" : "en";
  }

  return dutchScore > englishScore ? "nl" : "en";
}
