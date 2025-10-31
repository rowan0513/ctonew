import type { EmbeddingVector } from "./types";

export const EMBEDDING_DIMENSION = 32;

function normalizeVector(vector: number[]): EmbeddingVector {
  const squaredSum = vector.reduce((sum, value) => sum + value * value, 0);
  const norm = Math.sqrt(squaredSum);

  if (norm === 0) {
    return vector.map(() => 0);
  }

  return vector.map((value) => value / norm);
}

function hashToken(token: string): number {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) % 9973;
  }

  return hash;
}

export function embedText(text: string): EmbeddingVector {
  const vector = new Array<number>(EMBEDDING_DIMENSION).fill(0);

  const trimmed = text.trim();
  if (!trimmed) {
    return vector;
  }

  const lower = trimmed.toLowerCase();

  for (let index = 0; index < lower.length; index += 1) {
    const charCode = lower.charCodeAt(index);
    const slot = index % EMBEDDING_DIMENSION;
    const signal = ((charCode % 97) / 97) + ((charCode % 7) * 0.013);
    vector[slot] += signal;
  }

  const tokens = lower.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

  tokens.forEach((token, position) => {
    const hashed = hashToken(token);
    const slot = hashed % EMBEDDING_DIMENSION;
    const weight = 0.45 + (position % 5) * 0.07;
    vector[slot] += (hashed % 257) * 0.0009 * weight;
  });

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const bigram = `${tokens[index]}_${tokens[index + 1]}`;
    const hashed = hashToken(bigram);
    const slot = hashed % EMBEDDING_DIMENSION;
    vector[slot] += (hashed % 193) * 0.0012;
  }

  return normalizeVector(vector);
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  const dimension = Math.min(a.length, b.length);

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < dimension; index += 1) {
    const valueA = a[index];
    const valueB = b[index];
    dot += valueA * valueB;
    magnitudeA += valueA * valueA;
    magnitudeB += valueB * valueB;
  }

  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);

  if (denominator === 0) {
    return 0;
  }

  return dot / denominator;
}

export function l2Distance(a: EmbeddingVector, b: EmbeddingVector): number {
  const dimension = Math.min(a.length, b.length);
  let sum = 0;

  for (let index = 0; index < dimension; index += 1) {
    const delta = a[index] - b[index];
    sum += delta * delta;
  }

  return Math.sqrt(sum);
}
