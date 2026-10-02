/** The rank math the help search sources share. */

/** The constant of reciprocal rank fusion; 60 is the value of the method's paper. */
const FUSION_K = 60;

/** Merges ranked id lists by reciprocal rank fusion: an id scores 1 / (k + rank) in each list that holds it. */
export function mergeRanks(lists: readonly (readonly string[])[]): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, at) => scores.set(id, (scores.get(id) ?? 0) + 1 / (FUSION_K + at + 1)));
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Ids by the dot product of their vector with the query, best first. An id with several vectors scores by its best. */
export function rankByVector(query: Float32Array, entries: readonly { id: string; vector: Float32Array }[]): { id: string; score: number }[] {
  const best = new Map<string, number>();
  for (const { id, vector } of entries) {
    let dot = 0;
    for (let i = 0; i < query.length; i++) dot += query[i] * vector[i];
    if (dot > (best.get(id) ?? -Infinity)) best.set(id, dot);
  }
  return [...best.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}
