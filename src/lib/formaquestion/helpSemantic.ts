/**
 * The semantic search source: ranks guide sections by meaning. The section vectors ship with the app, and
 * the question is embedded on the device with the semantic-memory model.
 */
import { embedTexts, openCachedEmbeddingModel } from '@/lib/embeddingWorkerClient';
import { EMBED_BOUND_MS } from '@/lib/memoryRelevance';
import { withTimeout } from '@/lib/withTimeout';
import { FAVORED_PAGE_WEIGHT, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';
import { rankByVector } from './rankMerge';
import { sectionEntries, type SectionEntry, type SectionVectorsFile } from './sectionVectors';

/** One search source's sections for a query the help session searches for, best first. */
export type SectionRanking = (query: string, limit: number, favor?: { page: string }, onSurface?: boolean) => DocSection[];

/** What the semantic source needs from the device. Tests give their own. */
export interface HelpEmbedder {
  /** Opens the embedding model when it is on the device. False when a load would download it. */
  open(): Promise<boolean>;
  /** One L2-normalized vector per text, in order. */
  embed(texts: string[]): Promise<Float32Array[]>;
  vectors(): Promise<SectionVectorsFile>;
}

export const deviceEmbedder: HelpEmbedder = {
  open: openCachedEmbeddingModel,
  embed: embedTexts,
  vectors: async () => (await import('./sectionVectors.json')).default,
};

const entriesByFile = new WeakMap<SectionVectorsFile, WeakMap<DocsIndex, SectionEntry[]>>();

function entriesOf(index: DocsIndex, file: SectionVectorsFile): SectionEntry[] {
  let byIndex = entriesByFile.get(file);
  if (!byIndex) entriesByFile.set(file, (byIndex = new WeakMap()));
  let entries = byIndex.get(index);
  if (!entries) byIndex.set(index, (entries = sectionEntries(index, file)));
  return entries;
}

/**
 * The semantic ranking for these queries, or none when the source can't run: the model is not on the device,
 * the vectors are from another model, or the embedder fails. It never starts a download. A section under the
 * floor's similarity to the query is left out.
 */
export async function semanticRanking(index: DocsIndex, queries: readonly string[], { embedder = deviceEmbedder, floor = -Infinity }: {
  embedder?: HelpEmbedder;
  /** The least similarity to the query a section needs. */
  floor?: number;
} = {}): Promise<SectionRanking | null> {
  try {
    if (!(await embedder.open())) return null;
    const entries = entriesOf(index, await embedder.vectors());
    if (entries.length === 0) return null;
    const embedded = await withTimeout(embedder.embed([...queries]), EMBED_BOUND_MS, null);
    if (!embedded) return null;
    const vectorOf = new Map(queries.map((query, at) => [query, embedded[at]]));
    const sectionOf = new Map(entries.map((entry) => [entry.id, entry.section]));
    return (query, limit, favor) => {
      const vector = vectorOf.get(query);
      if (!vector) return [];
      return rankByVector(vector, entries)
        .filter((hit) => hit.score >= floor)
        .map((hit) => ({ ...hit, score: hit.score * (hit.score > 0 && sectionOf.get(hit.id)?.page === favor?.page ? FAVORED_PAGE_WEIGHT : 1) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .flatMap((hit) => sectionOf.get(hit.id) ?? []);
    };
  } catch {
    return null;
  }
}
