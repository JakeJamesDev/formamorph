import { kindOf, listingModels } from './catalogKinds';

/** A model name and how many sources use it. */
export interface RankedName {
  name: string;
  count: number;
}

/** Counts spellings per case-folded key; each key keeps its most-used spelling, first seen on a tie. */
class SpellingTally {
  private keys = new Map<string, Map<string, number>>();

  add(name: string, uses = 1): void {
    const key = name.toLowerCase();
    const spellings = this.keys.get(key) ?? new Map<string, number>();
    spellings.set(name, (spellings.get(name) ?? 0) + uses);
    this.keys.set(key, spellings);
  }

  ranked(): RankedName[] {
    const out: RankedName[] = [];
    for (const spellings of this.keys.values()) {
      let best = '';
      let bestUses = 0;
      let count = 0;
      for (const [name, uses] of spellings) {
        count += uses;
        if (uses > bestUses) { best = name; bestUses = uses; }
      }
      out.push({ name: best, count });
    }
    // Array sort is stable, so equal counts keep first-seen order.
    return out.sort((a, b) => b.count - a.count);
  }
}

const listingTags = (record: { tags?: unknown }): string[] =>
  Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === 'string') : [];

/**
 * The tags and models on the catalog's prompt listings, most-used first. Each listing counts once per value.
 * Tags are lowercased like the Overview stores them; models merge case-insensitively under their most-used
 * spelling.
 */
export function collectPromptSuggestions(records: readonly Record<string, unknown>[]): {
  tags: string[];
  models: string[];
  modelCounts: RankedName[];
} {
  const tags = new SpellingTally();
  const models = new SpellingTally();
  for (const record of records) {
    if (kindOf(record) !== 'prompt') continue;
    for (const tag of new Set(listingTags(record).map((t) => t.trim().toLowerCase()).filter(Boolean))) tags.add(tag);
    const seen = new Set<string>();
    for (const model of listingModels(record).map((m) => m.trim()).filter(Boolean)) {
      if (seen.has(model.toLowerCase())) continue;
      seen.add(model.toLowerCase());
      models.add(model);
    }
  }
  const modelCounts = models.ranked();
  return { tags: tags.ranked().map((t) => t.name), models: modelCounts.map((m) => m.name), modelCounts };
}

/**
 * The catalog's ranked models with the endpoint's names folded in, each endpoint name counting as one use.
 * Case-insensitive duplicates merge under the more common spelling.
 */
export function mergeModelSuggestions(catalog: readonly RankedName[], endpointNames: readonly string[]): string[] {
  const tally = new SpellingTally();
  for (const { name, count } of catalog) tally.add(name, count);
  for (const name of endpointNames) tally.add(name);
  return tally.ranked().map((m) => m.name);
}
