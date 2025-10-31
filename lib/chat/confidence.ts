import type { RetrievedContext } from "@/lib/retrieval/types";
import type { ChatModelUsage } from "./types";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeScore(score: number): number {
  // Cosine similarity ranges between -1 and 1. Normalise to 0..1 and guard against NaN.
  const normalised = (score + 1) / 2;
  if (Number.isNaN(normalised)) {
    return 0;
  }

  return clamp(normalised, 0, 1);
}

function computeRetrievalConfidence(contexts: RetrievedContext[]): number {
  if (contexts.length === 0) {
    return 0.25;
  }

  const normalisedScores = contexts.map((context) => normalizeScore(context.score));
  const averageScore = normalisedScores.reduce((sum, value) => sum + value, 0) / contexts.length;
  const topScore = Math.max(...normalisedScores);
  const diversityBonus = clamp(contexts.length / 8, 0, 0.15);

  const confidence = 0.35 + averageScore * 0.45 + topScore * 0.2 + diversityBonus;

  return clamp(confidence, 0, 1);
}

const DISCLAIMER_PATTERNS = [
  /i am not sure/gi,
  /i'm not sure/gi,
  /i cannot/gi,
  /i can't/gi,
  /don't have enough information/gi,
  /not enough information/gi,
  /unable to assist/gi,
  /sorry/gi,
];

function computeAnswerConfidence(answer: string, usage?: ChatModelUsage): number {
  const trimmed = answer.trim();

  if (!trimmed) {
    return 0.2;
  }

  const lengthScore = clamp(trimmed.length / 400, 0, 1);
  const sentenceCount = trimmed
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0).length;
  const structureScore = clamp(sentenceCount / 6, 0, 1);

  let confidence = 0.35 + lengthScore * 0.35 + structureScore * 0.2;

  if (usage?.outputTokens) {
    confidence += clamp(usage.outputTokens / 180, 0, 1) * 0.1;
  }

  for (const pattern of DISCLAIMER_PATTERNS) {
    if (pattern.test(trimmed)) {
      confidence -= 0.25;
    }
    pattern.lastIndex = 0;
  }

  return clamp(confidence, 0, 1);
}

export type ConfidenceScoreInput = {
  contexts: RetrievedContext[];
  answer: string;
  usage?: ChatModelUsage;
  fallbackUsed?: boolean;
};

export function calculateConfidenceScore({
  contexts,
  answer,
  usage,
  fallbackUsed = false,
}: ConfidenceScoreInput): number {
  const retrievalConfidence = computeRetrievalConfidence(contexts);
  const answerConfidence = computeAnswerConfidence(answer, usage);

  let combined = 0.2 + retrievalConfidence * 0.45 + answerConfidence * 0.45;

  if (fallbackUsed) {
    combined -= 0.05;
  }

  return clamp(Number(combined.toFixed(3)), 0, 1);
}
