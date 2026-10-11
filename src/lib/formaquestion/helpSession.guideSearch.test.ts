import { describe, expect, it, vi } from 'vitest';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import type { HelpEmbedder } from './helpSemantic';
import { GUIDE_SEMANTIC_FLOOR, guideSearch } from './helpSession';
import { encodeVector, sectionTexts, type SectionVectorsFile } from './sectionVectors';

// The keyword search finds the import section for "import"; the note section is the only one along (1, 0).
const PAGES = {
  Library: '# Library\n\nYour tiles.\n\n## How to Import a World\n\n1. Select **Import**.\n',
  Memory: '# Memory\n\nThe AI keeps notes.\n\n## How to Edit a Note\n\n1. Select **Edit**.\n',
};
const index = createDocsIndex({ pages: PAGES, sidebar: '- [Library](Library)\n- [Memory](Memory)\n' });
const KEYWORD_HIT = 'Library#how-to-import-a-world';
const NEAREST = 'Memory#how-to-edit-a-note';
const VECTORS: SectionVectorsFile = {
  model: EMBEDDING_MODEL_ID,
  dims: 2,
  sections: sectionTexts(index).flatMap(({ section, hash }) => {
    const vector = { [NEAREST]: [1, 0], [KEYWORD_HIT]: [0, 1] }[section.id];
    return vector ? [{ id: section.id, hash, vector: encodeVector(Float32Array.from(vector)) }] : [];
  }),
};

/** A model on the device that puts every query at this similarity to the note section, and none to the import section. */
const embedderAt = (similarity: number, over: Partial<HelpEmbedder> = {}) => ({
  open: vi.fn(async () => true),
  embed: vi.fn(async (texts: string[]) => texts.map(() => Float32Array.of(similarity, 0))),
  vectors: vi.fn(async () => VECTORS),
  ...over,
});

const ids = async (query: string, options: Parameters<typeof guideSearch>[2]) => (await guideSearch(index, query, options)).map((section) => section.id);

describe('the Search tab search', () => {
  it('finds a section by meaning alone with Semantic Search on, and not with it off', async () => {
    expect(await ids('jot down remarks', { semantic: true, limit: 20, embedder: embedderAt(1) })).toEqual([NEAREST]);
    const off = embedderAt(1);
    expect(await ids('jot down remarks', { semantic: false, limit: 20, embedder: off })).toEqual([]);
    expect(off.open).not.toHaveBeenCalled();
  });

  it('merges the keyword hit and the semantic hit', async () => {
    expect(new Set(await ids('import', { semantic: true, limit: 20, embedder: embedderAt(1) }))).toEqual(new Set([KEYWORD_HIT, NEAREST]));
  });

  it('keeps to the limit', async () => {
    expect(await ids('import', { semantic: true, limit: 1, embedder: embedderAt(1) })).toHaveLength(1);
  });

  it('uses the keyword search alone when the model is not on the device, and never embeds', async () => {
    const absent = embedderAt(1, { open: vi.fn(async () => false) });
    expect(await ids('import', { semantic: true, limit: 20, embedder: absent })).toEqual([KEYWORD_HIT]);
    expect(absent.embed).not.toHaveBeenCalled();
  });

  it('uses the keyword search alone when the embedder fails', async () => {
    const broken = embedderAt(1, { embed: vi.fn(async () => { throw new Error('worker died'); }) });
    expect(await ids('import', { semantic: true, limit: 20, embedder: broken })).toEqual([KEYWORD_HIT]);
  });

  it('leaves out a semantic-only hit under the similarity floor, and keeps one at it', async () => {
    expect(await ids('zzqqxx', { semantic: true, limit: 20, embedder: embedderAt(GUIDE_SEMANTIC_FLOOR - 0.01) })).toEqual([]);
    expect(await ids('zzqqxx', { semantic: true, limit: 20, embedder: embedderAt(GUIDE_SEMANTIC_FLOOR) })).toEqual([NEAREST]);
  });

  it('keeps a keyword hit whose meaning is under the floor', async () => {
    expect(await ids('import', { semantic: true, limit: 20, embedder: embedderAt(0) })).toEqual([KEYWORD_HIT]);
  });
});
