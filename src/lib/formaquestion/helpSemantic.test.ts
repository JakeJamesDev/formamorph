import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { EMBED_BOUND_MS, EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import { sseReply, sseResponse, textSnapshot } from '@/test/aiTextFixtures';
import { pastPicks } from '@/test/helpFixtures';
import { semanticRanking, worldSemanticRanking, type HelpEmbedder } from './helpSemantic';
import { askHelp, type HelpEvent } from './helpSession';
import { helpSettingsOf } from './helpSettings';
import { encodeVector, sectionTexts, type SectionVectorsFile } from './sectionVectors';
import { buildWorldIndex, type WorldIndexInput } from './worldIndex';

const index = createDocsIndex({
  pages: {
    Tools: '# Tools\n\n## How to Try a Tool\n\nTest the tool here.\n',
    Bench: '# Bench\n\n## Checks\n\nTest the world here.\n',
  },
  sidebar: '- [Bench](Bench)\n- [Tools](Tools)\n',
});
const VECTORS: Record<string, [number, number]> = {
  'Bench#checks': [0.8, 0.6], 'Tools#how-to-try-a-tool': [0.6, 0.8], 'Tools#tools': [-0.5, 0.866], 'Bench#bench': [-0.6, 0.8],
};
const file: SectionVectorsFile = {
  model: EMBEDDING_MODEL_ID,
  dims: 2,
  sections: sectionTexts(index).flatMap(({ section, hash }) =>
    (VECTORS[section.id] ? [{ id: section.id, hash, vector: encodeVector(Float32Array.from(VECTORS[section.id])) }] : [])),
};
const embedder: HelpEmbedder = { open: async () => true, embed: async (texts) => texts.map(() => Float32Array.of(1, 0)), vectors: async () => file };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('semanticRanking', () => {
  it('gives up on a hung embedder after the bound and leaves no timer', async () => {
    vi.useFakeTimers();
    try {
      const hung: HelpEmbedder = { ...embedder, embed: () => new Promise(() => {}) };
      const pending = semanticRanking(index, ['test'], { embedder: hung });
      await vi.advanceTimersByTimeAsync(EMBED_BOUND_MS);
      await expect(pending).resolves.toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ranks the sections by their vector against the query, best first, up to the limit', async () => {
    const ranking = await semanticRanking(index, ['test'], { embedder });
    expect(ranking?.('test', 5).map((section) => section.id)).toEqual(['Bench#checks', 'Tools#how-to-try-a-tool', 'Tools#tools', 'Bench#bench']);
    expect(ranking?.('test', 1).map((section) => section.id)).toEqual(['Bench#checks']);
  });

  it('ranks a section of the favored page above a nearer one, and leaves a section that points away where it is', async () => {
    const ranking = await semanticRanking(index, ['test'], { embedder });
    expect(ranking?.('test', 5, { page: 'Tools' }).map((section) => section.id)).toEqual(['Tools#how-to-try-a-tool', 'Bench#checks', 'Tools#tools', 'Bench#bench']);
  });

  it('gives no section for a query it did not embed', async () => {
    const ranking = await semanticRanking(index, ['test'], { embedder });
    expect(ranking?.('another', 5)).toEqual([]);
  });
});

describe('worldSemanticRanking', () => {
  const worldOf = (prefix: string, count: number): WorldIndexInput => ({
    worldOverview: { name: prefix, description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '', tags: [] },
    stats: [], locations: [], traits: [], items: [], dictionaries: [],
    entities: Array.from({ length: count }, (_, at) => ({ id: `${prefix}-${at}`, name: `${prefix} ${at}`, playerDescription: `${prefix} keeps gate ${at}.` })),
  });
  const counting = () => {
    const embedded: string[] = [];
    const spy: HelpEmbedder = { ...embedder, embed: async (texts) => { embedded.push(...texts); return texts.map(() => Float32Array.of(1, 0)); } };
    return { spy, embedded };
  };

  it('embeds only the sections the cache lacks, and drops a closed world once the cache outgrows the open one', async () => {
    const big = buildWorldIndex(worldOf('Larkspur', 6));
    const small = buildWorldIndex(worldOf('Quillon', 1));
    const { spy, embedded } = counting();
    const of = (prefix: string) => embedded.filter((text) => text.includes(prefix)).length;
    await worldSemanticRanking(big, ['gate'], { embedder: spy });
    const first = of('Larkspur');
    expect(first).toBeGreaterThanOrEqual(6);
    await worldSemanticRanking(big, ['gate'], { embedder: spy });
    expect(of('Larkspur')).toBe(first);
    await worldSemanticRanking(small, ['gate'], { embedder: spy });
    await worldSemanticRanking(big, ['gate'], { embedder: spy });
    expect(of('Larkspur')).toBe(2 * first);
  });
});

describe('the semantic source on a device with no embedding model', () => {
  it('is skipped: the question answers from the other sources, and no worker starts, so nothing downloads', async () => {
    const made = vi.fn();
    vi.stubGlobal('Worker', class { constructor() { made(); } });
    // The browser's cache storage, with no model file in it.
    const open = vi.fn(async () => ({ match: async () => undefined }));
    vi.stubGlobal('caches', { open });
    const answers = vi.fn(async (_url: string, _init: RequestInit) => sseResponse(sseReply('Run **Check**.')));

    const events: HelpEvent[] = [];
    for await (const event of askHelp({ question: 'test', settings: helpSettingsOf({ sources: { semantic: true } }), snapshot: textSnapshot(), index, fetchImpl: pastPicks(answers) })) events.push(event);

    const done = events.at(-1);
    expect(done).toMatchObject({ type: 'done', text: 'Run **Check**.', stopped: false });
    expect(done?.type === 'done' && done.sources.map((section) => section.id)).toEqual(index.search('test').map((section) => section.id));
    expect(open).toHaveBeenCalledWith('transformers-cache');
    expect(made).not.toHaveBeenCalled();
    expect(answers).toHaveBeenCalledTimes(1);
  });
});
