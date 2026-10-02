/**
 * The semantic search source: ranks guide sections by meaning. The section vectors ship with the app, and
 * the question is embedded on the device with the semantic-memory model.
 */
import { embedTexts, openCachedEmbeddingModel } from '@/lib/embeddingWorkerClient';
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
 * the vectors are from another model, or the embedder fails. It never starts a download.
 */
export async function semanticRanking(index: DocsIndex, queries: readonly string[], embedder: HelpEmbedder = deviceEmbedder): Promise<SectionRanking | null> {
  try {
    if (!(await embedder.open())) return null;
    const entries = entriesOf(index, await embedder.vectors());
    if (entries.length === 0) return null;
    const embedded = await embedder.embed([...queries]);
    const vectorOf = new Map(queries.map((query, at) => [query, embedded[at]]));
    const sectionOf = new Map(entries.map((entry) => [entry.id, entry.section]));
    return (query, limit, favor) => {
      const vector = vectorOf.get(query);
      if (!vector) return [];
      return rankByVector(vector, entries)
        .map((hit) => ({ ...hit, score: hit.score * (hit.score > 0 && sectionOf.get(hit.id)?.page === favor?.page ? FAVORED_PAGE_WEIGHT : 1) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .flatMap((hit) => sectionOf.get(hit.id) ?? []);
    };
  } catch {
    return null;
  }
}
