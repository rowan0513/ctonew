import { franc } from "franc";
import type { DocumentLanguage } from "../types/chunk.js";

const MIN_LANGUAGE_SAMPLE_LENGTH = 24;
const DUTCH_CODES = new Set(["nld", "dut"]);
const ENGLISH_CODES = new Set(["eng"]);

export function detectLanguage(text: string): DocumentLanguage {
  const trimmed = text.trim();

  if (!trimmed) {
    return "unknown";
  }

  const sample = trimmed.length < MIN_LANGUAGE_SAMPLE_LENGTH
    ? trimmed.repeat(Math.ceil(MIN_LANGUAGE_SAMPLE_LENGTH / Math.max(trimmed.length, 1))).slice(0, MIN_LANGUAGE_SAMPLE_LENGTH)
    : trimmed;

  const detection = franc(sample, { minLength: Math.min(sample.length, MIN_LANGUAGE_SAMPLE_LENGTH) });

  if (DUTCH_CODES.has(detection)) {
    return "nl";
  }

  if (ENGLISH_CODES.has(detection)) {
    return "en";
  }

  return "unknown";
}
