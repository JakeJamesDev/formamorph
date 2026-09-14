import { describe, it, expect } from 'vitest';
import {
  applyRepair, blockingSources, linkedSourceCopies, missingSources, REPAIR_CHOICES, sourceBlockReason,
  type SourceCheckResults, type SourceCheckWorld,
} from './sourceChecks';
import type { LibrarySource } from './linkedContent';
import type { Dictionary, Entity } from '@/types';

const entity = (id: string, name: string, link?: Entity['link']): Entity =>
  ({ id, name, ...(link ? { link } : {}) }) as Entity;

const book = (id: string, name: string, link?: Dictionary['link']): Dictionary =>
  ({ id, name, entries: [], ...(link ? { link } : {}) }) as Dictionary;

/** A world holding one linked character and one linked book. */
const world = (): SourceCheckWorld => ({
  entities: [entity('e1', 'Marsh Warden', { libraryId: 'lib-a', sourceId: 'src-a', sourceName: 'Marsh Warden' })],
  dictionaries: [book('d1', 'Fen Lore', { libraryId: 'lib-b', sourceId: 'src-b', sourceName: 'Fen Lore' })],
  placeholders: [],
});

describe('linkedSourceCopies', () => {
  it('lists one row per copy that follows a published source', () => {
    expect(linkedSourceCopies(world()).map((c) => c.id)).toEqual(['e1', 'd1']);
  });

  it('leaves out an independent copy and one whose library item was never published', () => {
    const content: SourceCheckWorld = {
      entities: [entity('e1', 'Alone'), entity('e2', 'Local', { libraryId: 'lib-a' })],
    };
    expect(linkedSourceCopies(content)).toEqual([]);
  });

  it('marks a copy required when the world listing declares its source', () => {
    const copies = linkedSourceCopies(world(), ['src-a']);
    expect(copies.map((c) => [c.sourceId, c.required])).toEqual([['src-a', true], ['src-b', false]]);
  });

  it('names a source by what the record recorded, so a gone source can still be named', () => {
    const content: SourceCheckWorld = {
      entities: [entity('e1', 'Renamed Here', { sourceId: 'src-a', sourceName: 'Marsh Warden' })],
    };
    expect(linkedSourceCopies(content)[0].sourceName).toBe('Marsh Warden');
  });
});

describe('missingSources', () => {
  it('reports not found and unavailable, and stays silent about a source that answered', () => {
    const copies = linkedSourceCopies(world(), ['src-a']);
    const results: SourceCheckResults = { 'src-a': 'not_found', 'src-b': 'ok' };
    expect(missingSources(copies, results)).toMatchObject([{ id: 'e1', status: 'not_found' }]);
  });

  it('reports nothing about a source the check never reached', () => {
    expect(missingSources(linkedSourceCopies(world()), {})).toEqual([]);
  });

  it('carries the answer through unchanged for a network failure', () => {
    const copies = linkedSourceCopies(world());
    const found = missingSources(copies, { 'src-a': 'unavailable', 'src-b': 'unavailable' });
    expect(found.map((row) => row.status)).toEqual(['unavailable', 'unavailable']);
  });
});

describe('blockingSources', () => {
  it('blocks on a required source the server answered not found for', () => {
    const copies = linkedSourceCopies(world(), ['src-a']);
    expect(blockingSources(copies, { 'src-a': 'not_found' }).map((r) => r.id)).toEqual(['e1']);
  });

  it('does not block on an unreachable required source', () => {
    const copies = linkedSourceCopies(world(), ['src-a']);
    expect(blockingSources(copies, { 'src-a': 'unavailable' })).toEqual([]);
  });

  it('does not block on an optional source that is gone', () => {
    const copies = linkedSourceCopies(world(), ['src-a']);
    expect(blockingSources(copies, { 'src-b': 'not_found' })).toEqual([]);
  });
});

describe('sourceBlockReason', () => {
  it('names the removed source and where to repair it', () => {
    const copies = linkedSourceCopies(world(), ['src-a']);
    expect(sourceBlockReason(copies, { 'src-a': 'not_found' }))
      .toBe('This world requires Marsh Warden, which the author removed. Repair it in the World Editor.');
  });

  it('is null when nothing blocks', () => {
    expect(sourceBlockReason(linkedSourceCopies(world(), ['src-a']), { 'src-a': 'ok' })).toBeNull();
  });

  it('names one source once however many copies follow it', () => {
    const content: SourceCheckWorld = {
      entities: [
        entity('e1', 'One', { sourceId: 'src-a', sourceName: 'Marsh Warden' }),
        entity('e2', 'Two', { sourceId: 'src-a', sourceName: 'Marsh Warden' }),
      ],
    };
    const reason = sourceBlockReason(linkedSourceCopies(content, ['src-a']), { 'src-a': 'not_found' });
    expect(reason).toBe('This world requires Marsh Warden, which the author removed. Repair it in the World Editor.');
  });
});

describe('REPAIR_CHOICES', () => {
  it('offers the three repairs in order', () => {
    expect(REPAIR_CHOICES.map((c) => c.value)).toEqual(['replace', 'unlink', 'remove']);
  });
});

describe('applyRepair', () => {
  it('removes the copy from the world', () => {
    const repaired = applyRepair(world(), 'e1', 'remove');
    expect(repaired.entities?.map((e) => e.id)).toEqual([]);
    expect(repaired.dictionaries?.map((d) => d.id)).toEqual(['d1']);
  });

  it('removes a book copy from the dictionaries', () => {
    expect(applyRepair(world(), 'd1', 'remove').dictionaries).toEqual([]);
  });

  it('unlinks and keeps the content exactly as it was', () => {
    const repaired = applyRepair(world(), 'e1', 'unlink');
    expect(repaired.entities?.[0]).toEqual({ id: 'e1', name: 'Marsh Warden' });
  });

  it('lifts the block, because the repaired copy follows the removed source no longer', () => {
    const repaired = applyRepair(world(), 'e1', 'unlink');
    expect(blockingSources(linkedSourceCopies(repaired, ['src-a']), { 'src-a': 'not_found' })).toEqual([]);
  });

  it('relinks a Replace to the picked library item and takes its content', () => {
    const source: LibrarySource = { id: 'lib-c', name: 'Fen Warden', revision: 'R9', owned: true, sourceId: 'src-c' };
    const data = entity('other', 'Fen Warden', undefined);
    const repaired = applyRepair(world(), 'e1', 'replace', { source, data });

    expect(repaired.entities?.[0]).toMatchObject({
      id: 'e1',
      name: 'Fen Warden',
      link: { libraryId: 'lib-c', sourceId: 'src-c', sourceName: 'Fen Warden', sourceRevision: 'R9' },
    });
  });

  it('relinks a book Replace in the dictionaries', () => {
    const source: LibrarySource = { id: 'lib-d', name: 'Marsh Lore', revision: 'R2', owned: true };
    const repaired = applyRepair(world(), 'd1', 'replace', { source, data: book('other', 'Marsh Lore') });
    expect(repaired.dictionaries?.[0]).toMatchObject({ id: 'd1', name: 'Marsh Lore', link: { libraryId: 'lib-d' } });
  });

  it('returns the same world when a Replace names no item', () => {
    const before = world();
    expect(applyRepair(before, 'e1', 'replace')).toBe(before);
  });

  it('returns the same world when no copy has that id', () => {
    const before = world();
    expect(applyRepair(before, 'nobody', 'remove')).toBe(before);
    expect(applyRepair(before, 'nobody', 'unlink')).toBe(before);
  });
});
