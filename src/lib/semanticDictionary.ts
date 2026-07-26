import type { DictionaryEntry } from '@/types';
import { contentHash } from './contentHash';
import type { ActivationReport } from './dictionaryUtils';
import { EMBEDDING_MODEL_ID } from './memoryRelevance';
import { cosineSimilarity } from './memoryRelevance';

/**
 * Semantic lore activation: dictionary entries whose MEANING is close to the player's action fire
 * without a keyword hit ("the ruined tower on the hill" wakes the Old Beacon entry). Purely additive
 * over the keyword report — a keyword activation is never overridden, and a missing vector just means
 * that entry can't semantically fire this turn (per-entry fail-open; unlike band trimming there is no
 * cross-stage consistency to protect). Pure module: embedding production lives with the caller.
 */

/**
 * Minimum cosine similarity for a semantic activation. Tuned by `semantic-lore-probe.mjs` against the
 * 45-entry Vane Hollow world (`--cases vane-hollow-lore-cases.json`), whose entries sit in five domains so
 * near-neighbors can punish a loose threshold. 0.39 is the F1 peak on both populations — authored, where the
 * name mirrors the keywords, scores 100% precision / 67% recall; imported, with distinct names, 92% / 64%.
 * Both folds of `--holdout` pick 0.38-0.39, so the choice is not fitted to the cases it was picked on.
 *
 * Deliberately below the older, precision-first 0.44: `lore-noise-probe.mjs` measured what a wrong entry
 * actually costs, and the answer is almost nothing. Injecting the entry the embedding really picks at this
 * range, the narrator wrote it into the prose in 11% of runs on Cydonia 24B and 6% on the cloud default,
 * against 75% / 47% for correct lore it was asked about directly — roughly a 7x asymmetry, with zero uptake
 * in the no-injection guard across 72 runs. A false fire is mostly ignored; a miss is the feature not
 * working, so recall is worth more here than the last few points of precision.
 */
export const SEMANTIC_LORE_THRESHOLD = 0.39;

/** Most entries one action may semantically activate — keeps a lore-dense world from flooding the
 *  prompt when everything is topically "near" (keyword activations don't count against it). */
export const SEMANTIC_LORE_CAP = 3;

/** The text an entry is embedded as: name + trigger keys + content. Keys are included because authors
 *  write them as meaning-bearing synonyms; content is capped so one giant entry can't dilute itself
 *  past the model's input window. The name is dropped when it merely repeats the keys — the editor
 *  mirrored `name` from the keyword list before the fields were decoupled, and embedding both weights
 *  those keywords twice against the entry's actual content. */
export function entryEmbedText(entry: DictionaryEntry): string {
  const keys = (entry.key ?? []).join(', ');
  const name = entry.name === keys ? '' : entry.name;
  return [name, keys, (entry.value || '').slice(0, 1000)].filter(Boolean).join(' — ');
}

/** Cache key for one entry's vector — content-hashed, so it survives the id regeneration that
 *  import/duplicate/copy perform, and a text edit is simply a re-embed. */
export function entryVectorKey(entry: DictionaryEntry): string {
  return `${EMBEDDING_MODEL_ID}:${contentHash(entryEmbedText(entry))}`;
}

/** Pick the semantic activations: enabled, non-constant entries whose vector clears the threshold,
 *  best-first, capped. Entries without a cached vector are skipped. */
export function selectSemanticLore(
  entries: DictionaryEntry[],
  queryVec: Float32Array,
  vectorsByKey: Map<string, Float32Array>,
  threshold = SEMANTIC_LORE_THRESHOLD,
  cap = SEMANTIC_LORE_CAP,
): Map<string, number> {
  const scored: Array<{ id: string; sim: number }> = [];
  for (const entry of entries) {
    if (entry.enabled === false || entry.constant) continue;
    const vec = vectorsByKey.get(entryVectorKey(entry));
    if (!vec) continue;
    const sim = cosineSimilarity(queryVec, vec);
    if (sim >= threshold) scored.push({ id: entry.id, sim });
  }
  scored.sort((a, b) => b.sim - a.sim);
  return new Map(scored.slice(0, cap).map((s) => [s.id, s.sim]));
}

/** Fold semantic activations into the keyword report in place: only entries the keyword pass did NOT
 *  activate flip to `reason: 'semantic'` (a keyword/constant/recursive reason always wins, so the
 *  debug view keeps showing the stronger cause). Returns the same report for chaining. */
export function applySemanticLore(report: ActivationReport, similarities: Map<string, number>): ActivationReport {
  for (const rec of report.entries) {
    const sim = similarities.get(rec.entryId);
    if (sim === undefined || rec.activated) continue;
    rec.activated = true;
    rec.reason = 'semantic';
    rec.semanticSimilarity = sim;
  }
  return report;
}
