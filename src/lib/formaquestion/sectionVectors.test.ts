import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex } from '@/lib/docs/docsIndex';
import { EMBEDDING_MODEL_ID } from '@/lib/memoryRelevance';
import shipped from './sectionVectors.json';
import { decodeVector, encodeVector, sectionEntries, sectionTexts, type SectionVectorsFile } from './sectionVectors';

describe('the section vectors that ship', () => {
  it('come from the model the app embeds a question with', () => {
    expect(shipped.model).toBe(EMBEDDING_MODEL_ID);
  });

  it('hold one whole vector for each entry, for sections of the guide', () => {
    expect(shipped.sections.length).toBeGreaterThan(0);
    for (const entry of shipped.sections) expect(decodeVector(entry.vector)).toHaveLength(shipped.dims);
    // Drift is allowed: a section the docs changed since the build has no entry here.
    expect(sectionEntries(bundledDocsIndex(), shipped).length).toBeGreaterThan(0);
  });
});

describe('a vector as text', () => {
  it('comes back with the same values', () => {
    const vector = Float32Array.from([0.25, -1, 3.5e-8, 0, 0.1]);
    expect([...decodeVector(encodeVector(vector))]).toEqual([...vector]);
  });

  it('encodes a slice of a longer array as that slice alone', () => {
    const all = Float32Array.from([9, 1, 2, 9]);
    expect([...decodeVector(encodeVector(all.subarray(1, 3)))]).toEqual([1, 2]);
  });
});

describe('sectionTexts', () => {
  const index = createDocsIndex({
    pages: { Library: '# 📚 Library\n\nYour tiles.\n\n## How to Make a Group\n\n1. Select **New Group**.\n', Changelog: '# Changelog\n\n## 3.1.0\n\n- A thing.\n' },
  });

  it('gives each guide section its heading line, then its text, and leaves the changelog out', () => {
    expect(sectionTexts(index).map(({ section, text }) => [section.id, text])).toEqual([
      ['Library#-library', 'Library\n\n# 📚 Library\n\nYour tiles.'],
      ['Library#how-to-make-a-group', 'Library › How to Make a Group\n\n## How to Make a Group\n\n1. Select **New Group**.'],
    ]);
  });
});

describe('sectionEntries', () => {
  const pages = { Library: '# Library\n\nYour tiles.\n\n## Groups\n\nA group holds tiles.\n' };
  const index = createDocsIndex({ pages });
  const fileOf = (source: ReturnType<typeof createDocsIndex>, model = EMBEDDING_MODEL_ID): SectionVectorsFile => ({
    model, dims: 2, sections: sectionTexts(source).map(({ section, hash }, at) => ({ id: section.id, hash, vector: encodeVector(Float32Array.of(at, 1)) })),
  });

  it('gives each section the vector the file holds for it', () => {
    const entries = sectionEntries(index, fileOf(index));
    expect(entries.map((entry) => [entry.id, [...entry.vector]])).toEqual([['Library#library', [0, 1]], ['Library#groups', [1, 1]]]);
  });

  it('leaves out a section whose text changed since the file was built, and keeps the others', () => {
    const edited = createDocsIndex({ pages: { Library: pages.Library.replace('holds tiles', 'holds worlds') } });
    expect(sectionEntries(edited, fileOf(index)).map((entry) => entry.id)).toEqual(['Library#library']);
  });

  it('leaves out a section the file does not hold', () => {
    const grown = createDocsIndex({ pages: { Library: `${pages.Library}\n## Tiles\n\nA tile is a world.\n` } });
    expect(sectionEntries(grown, fileOf(index)).map((entry) => entry.id)).not.toContain('Library#tiles');
  });

  it('gives no section from a file of another model', () => {
    expect(sectionEntries(index, fileOf(index, 'other/model'))).toEqual([]);
  });
});
