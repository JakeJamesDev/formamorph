/**
 * The semantic half of the Triggers tracer: what the meaning-based lore pass would make of the pasted text.
 *
 * Which entries activate is `selectSemanticLore`'s answer, unchanged — the same call the narration prompt
 * makes, so the tester can never disagree with play. What this module adds is the part play has no reason to
 * compute: a score for the entries that did *not* activate, and the difference between "too far" and "close
 * enough, but the cap was already full".
 */
import { cosineSimilarity } from '@/lib/memoryRelevance';
import { describePlaceholders } from '@/lib/placeholders';
import {
  entryVectorKey, selectSemanticLore, SEMANTIC_LORE_CAP, SEMANTIC_LORE_THRESHOLD,
} from '@/lib/semanticDictionary';
import type { DictionaryEntry, Placeholder } from '@/types';

/**
 * What the semantic pass made of one entry. `capped` is the class a bare score cannot express: the entry
 * cleared the threshold and still stayed out, because only the closest few are ever injected.
 */
export type SemanticState = 'activates' | 'capped' | 'below' | 'unindexed';

/** One entry's semantic verdict; `score` is absent exactly when there was no vector to score. */
export interface EntrySemantic {
  state: SemanticState;
  score?: number;
}

/** The vectors a trace scores with — the query's, and the index the entries are looked up in. */
export interface SemanticInput {
  /** The pasted text's vector. */
  queryVec: Float32Array;
  /** Cached entry vectors by `entryVectorKey` — the same map play scores against. */
  vectors: Map<string, Float32Array>;
  /** Defaults to the tuned constants; a test names its own so the arithmetic is readable. */
  threshold?: number;
  cap?: number;
}

/** One run of the semantic pass over a world's scanned entries. */
export interface SemanticTrace {
  threshold: number;
  cap: number;
  /** entryId → verdict, for the entries the pass considers at all. */
  states: Map<string, EntrySemantic>;
  /** The selector's own output: entryId → similarity, capped and best-first. */
  activations: Map<string, number>;
  /** How many considered entries had a vector to score — the rest simply cannot fire on meaning. */
  indexed: number;
  eligible: number;
}

/** Whether the semantic pass scores an entry at all. Mirrors `selectSemanticLore`'s own skip: a constant
 *  entry is already injected, and a disabled one is not scanned by anything. */
export const isSemanticEligible = (entry: DictionaryEntry): boolean =>
  entry.enabled !== false && !entry.constant;

/**
 * An entry as play hashes it. The drainer embeds the *resolved* dictionary, and `resolveDictionaryEntryNames`
 * resolves the name and the keywords while leaving the value alone — so a key built from the authored text
 * names a vector the cache never stored, and the entry would read as unindexed forever.
 *
 * An author has no rolls, so a Wildcard chip resolves to a summary rather than to whatever that playthrough
 * drew: those entries genuinely stay unindexed here, which is the truth about text decided at play time.
 */
const asEmbedded = (entry: DictionaryEntry, placeholders: Placeholder[]): DictionaryEntry => ({
  ...entry,
  name: describePlaceholders(entry.name ?? '', placeholders),
  key: (entry.key ?? []).map((k) => describePlaceholders(k, placeholders)),
});

/** The cache keys a world's index is made of — what an availability probe asks the cache for. */
export const semanticIndexKeys = (entries: DictionaryEntry[], placeholders: Placeholder[]): string[] =>
  entries.filter(isSemanticEligible).map((entry) => entryVectorKey(asEmbedded(entry, placeholders)));

/** Score every entry the pass considers, and record which of them the game's selector actually picked. */
export function traceSemantic(
  entries: DictionaryEntry[],
  placeholders: Placeholder[],
  input: SemanticInput,
): SemanticTrace {
  const threshold = input.threshold ?? SEMANTIC_LORE_THRESHOLD;
  const cap = input.cap ?? SEMANTIC_LORE_CAP;
  // The selector runs on the same resolved entries the drainer embedded, so it looks its vectors up under
  // the keys the cache really holds.
  const embedded = entries.map((entry) => asEmbedded(entry, placeholders));
  const activations = selectSemanticLore(embedded, input.queryVec, input.vectors, threshold, cap);
  const states = new Map<string, EntrySemantic>();
  let indexed = 0;
  let eligible = 0;
  for (const entry of embedded) {
    if (!isSemanticEligible(entry)) continue;
    eligible++;
    const vec = input.vectors.get(entryVectorKey(entry));
    if (!vec) {
      states.set(entry.id, { state: 'unindexed' });
      continue;
    }
    indexed++;
    const score = cosineSimilarity(input.queryVec, vec);
    const state: SemanticState = activations.has(entry.id)
      ? 'activates'
      : score >= threshold ? 'capped' : 'below';
    states.set(entry.id, { state, score });
  }
  return { threshold, cap, states, activations, indexed, eligible };
}

/** Similarity as the row prints it — two places, enough to separate neighbors without implying precision. */
const score2 = (value: number) => value.toFixed(2);

/**
 * One entry's semantic verdict as a sentence. Every scored state states the score against the threshold it
 * was judged by: a bare "fired" or "didn't" is exactly the claim an author cannot act on.
 */
export function describeSemantic(semantic: EntrySemantic, threshold: number, cap: number): string {
  if (semantic.score === undefined) return 'Not embedded yet, so it cannot fire on meaning.';
  const against = `${score2(semantic.score)} vs the ${score2(threshold)} threshold`;
  switch (semantic.state) {
    case 'activates':
      return `${against} — close enough to fire on meaning.`;
    case 'capped':
      return `${against}, but only the closest ${cap} fire.`;
    case 'below':
      return `${against} — too far to fire on meaning.`;
    default:
      return '';
  }
}
