import { cosineSimilarity } from "./embeddings";
import type { EmbeddingVector, ScoredChunk } from "./types";

type MmrOptions = {
  candidates: ScoredChunk[];
  queryEmbedding: EmbeddingVector;
  maxResults: number;
  lambda?: number;
};

const DEFAULT_LAMBDA = 0.65;

export function applyMaximalMarginalRelevance({
  candidates,
  queryEmbedding,
  maxResults,
  lambda = DEFAULT_LAMBDA,
}: MmrOptions): ScoredChunk[] {
  if (maxResults <= 0 || candidates.length === 0) {
    return [];
  }

  const pool = [...candidates].sort((a, b) => b.score - a.score);
  const selected: ScoredChunk[] = [];

  while (selected.length < maxResults && pool.length > 0) {
    if (selected.length === 0) {
      selected.push(pool.shift()!);
      continue;
    }

    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      const relevance = candidate.score;

      let diversityPenalty = 0;
      for (const chosen of selected) {
        const similarity = cosineSimilarity(candidate.embedding, chosen.embedding);
        if (similarity > diversityPenalty) {
          diversityPenalty = similarity;
        }
      }

      const mmrScore = lambda * relevance - (1 - lambda) * diversityPenalty;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = index;
      }
    }

    const [bestCandidate] = pool.splice(bestIndex, 1);
    if (!bestCandidate) {
      break;
    }

    selected.push(bestCandidate);
  }

  return selected;
}
