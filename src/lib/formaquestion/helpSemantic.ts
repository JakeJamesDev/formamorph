/**
 * The semantic search source: ranks guide sections by meaning. The section vectors ship with the app, and
 * the question is embedded on the device with the semantic-memory model.
 */
import { embedTexts, openCachedEmbeddingModel } from '@/lib/embeddingWorkerClient';
import { EMBED_BOUND_MS } from '@/lib/memoryRelevance';
import { contentHash } from '@/lib/contentHash';
import { withTimeout } from '@/lib/withTimeout';
import { FAVORED_PAGE_WEIGHT, type DocSection, type DocsIndex } from '@/lib/docs/docsIndex';
import { rankByVector } from './rankMerge';
import { sectionEntries, type SectionEntry, type SectionVectorsFile } from './sectionVectors';
import type { WorldIndex } from './worldIndex';

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
    return rankingOver(entries, new Map(queries.map((query, at) => [query, embedded[at]])), floor);
  } catch {
    return null;
  }
}

/** A ranking over embedded sections: each query's hits at or over the floor, a favored page's weighed up. */
function rankingOver(entries: readonly SectionEntry[], vectorOf: ReadonlyMap<string, Float32Array>, floor: number): SectionRanking {
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
}

/** The texts one embed call of the world fill holds. */
const WORLD_EMBED_BATCH = 32;

/** World section vectors by the hash of their text, filled on the device as questions need them. */
const worldVectors = new Map<string, Float32Array>();
/** How many times the open world's section count the cache holds before it drops every vector the world lacks. */
const WORLD_VECTOR_SLACK = 2;
/** The newest fill per embedder; a fill waits for the one before it, so two never embed at once. */
const worldFills = new WeakMap<HelpEmbedder, Promise<void>>();

/** Embeds each text the cache lacks, in batches. A failed batch ends the fill; the next question retries. */
function fillWorldVectors(embedder: HelpEmbedder, texts: readonly { text: string; hash: string }[]): Promise<void> {
  const before = worldFills.get(embedder);
  const fill = (async () => {
    await before;
    const missing = [...new Map(texts.filter(({ hash }) => !worldVectors.has(hash)).map((entry) => [entry.hash, entry])).values()];
    for (let at = 0; at < missing.length; at += WORLD_EMBED_BATCH) {
      const batch = missing.slice(at, at + WORLD_EMBED_BATCH);
      const vectors = await embedder.embed(batch.map(({ text }) => text));
      batch.forEach(({ hash }, k) => { if (vectors[k]) worldVectors.set(hash, vectors[k]); });
    }
    if (worldVectors.size > WORLD_VECTOR_SLACK * texts.length) {
      const kept = new Set(texts.map(({ hash }) => hash));
      for (const hash of worldVectors.keys()) if (!kept.has(hash)) worldVectors.delete(hash);
    }
  })().catch(() => {});
  worldFills.set(embedder, fill);
  return fill;
}

/**
 * The semantic ranking of the open world's sections, or none when the source can't run. Sections are embedded on
 * the device and kept by text hash, so an edit embeds only what changed. A section the fill has not reached
 * within the embed bound sits out this question; the fill goes on for the next.
 */
export async function worldSemanticRanking(world: WorldIndex, queries: readonly string[], { embedder = deviceEmbedder, floor = -Infinity }: {
  embedder?: HelpEmbedder;
  floor?: number;
} = {}): Promise<SectionRanking | null> {
  try {
    if (!(await embedder.open())) return null;
    const { lines, sections } = world.pickList();
    const texts = sections.flatMap((parts, at) => parts.map((section) => {
      const text = `${lines[at]}\n\n${section.markdown}`;
      return { section, text, hash: contentHash(text) };
    }));
    const embedded = await withTimeout(embedder.embed([...queries]), EMBED_BOUND_MS, null);
    if (!embedded) return null;
    await withTimeout(fillWorldVectors(embedder, texts), EMBED_BOUND_MS, null);
    const entries = texts.flatMap(({ section, hash }) => {
      const vector = worldVectors.get(hash);
      return vector ? [{ id: section.id, section, vector }] : [];
    });
    if (entries.length === 0) return null;
    return rankingOver(entries, new Map(queries.map((query, at) => [query, embedded[at]])), floor);
  } catch {
    return null;
  }
}
