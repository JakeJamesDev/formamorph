import { describe, expect, it } from 'vitest';
import {
  actionChoices, actionLabel, defaultAction, diffContent, diffHasChanges, formatValue, markReviewed,
  needsReview,
} from '@/lib/componentUpdates';
import type { Dictionary, DictionaryEntry, Entity } from '@/types';

const entry = (over: Partial<DictionaryEntry> & { name: string }): DictionaryEntry => ({
  id: `entry-${over.name}`, key: [over.name.toLowerCase()], value: 'body', ...over,
});

const book = (entries: DictionaryEntry[], over: Partial<Dictionary> = {}): Dictionary => ({
  id: 'book-1', name: 'Marsh Lore', entries, ...over,
});

const person = (over: Partial<Entity> = {}): Entity => ({ id: 'e-1', name: 'Sedge', ...over });

describe('needsReview', () => {
  it('lists a copy whose held revision is behind the source', () => {
    expect(needsReview({ libraryId: 'lib-1', sourceRevision: 'r1' }, 'r2')).toBe(true);
  });

  it('omits a copy already holding the source revision', () => {
    expect(needsReview({ libraryId: 'lib-1', sourceRevision: 'r2' }, 'r2')).toBe(false);
  });

  it('omits a revision the player already kept, and lists the next one', () => {
    const kept = { libraryId: 'lib-1', sourceRevision: 'r1', reviewedRevision: 'r2' };
    expect(needsReview(kept, 'r2')).toBe(false);
    expect(needsReview(kept, 'r3')).toBe(true);
  });

  it('omits an independent copy and a copy following a listing alone', () => {
    expect(needsReview(undefined, 'r2')).toBe(false);
    expect(needsReview({ sourceId: 'remote-1', sourceRevision: 'r1' }, 'r2')).toBe(false);
  });

  it('omits every copy when the source has no revision to compare', () => {
    expect(needsReview({ libraryId: 'lib-1', sourceRevision: 'r1' }, '')).toBe(false);
  });
});

describe('actions', () => {
  it('defaults an unmodified copy to Update and a local replacement to Keep Mine', () => {
    expect(defaultAction('linked')).toBe('update');
    expect(defaultAction('local-replacement')).toBe('keep');
  });

  it("offers Keep Mine before Use Author's on a local replacement", () => {
    expect(actionChoices('local-replacement').map((choice) => choice.value)).toEqual(['keep', 'update', 'unlink']);
    expect(actionLabel('local-replacement', 'update')).toBe("Use Author's");
  });

  it('names taking the source Update on an unmodified copy', () => {
    expect(actionChoices('linked').map((choice) => choice.value)).toEqual(['update', 'keep', 'unlink']);
    expect(actionLabel('linked', 'update')).toBe('Update');
  });

  it('offers Unlink on both states', () => {
    for (const state of ['linked', 'local-replacement'] as const) {
      expect(actionChoices(state).some((choice) => choice.value === 'unlink')).toBe(true);
    }
  });
});

describe('markReviewed', () => {
  it('records the revision without touching content or the rest of the record', () => {
    const copy = person({ link: { libraryId: 'lib-1', sourceRevision: 'r1', localReplacement: true } });
    const kept = markReviewed(copy, 'r2');
    expect(kept.link).toEqual({
      libraryId: 'lib-1', sourceRevision: 'r1', localReplacement: true, reviewedRevision: 'r2',
    });
    expect(kept.name).toBe('Sedge');
  });

  it('leaves an independent copy alone', () => {
    const copy = person();
    expect(markReviewed(copy, 'r2')).toBe(copy);
  });
});

describe('formatValue', () => {
  it('reports media by size and never by its bytes', () => {
    expect(formatValue('images', ['data:image/webp;base64,AAAA'])).toBe('1 image');
    expect(formatValue('images', ['a', 'b'])).toBe('2 images');
    expect(formatValue('thumbnail', 'data:image/webp;base64,AAAA')).toBe('Set');
    expect(formatValue('sound', { data: 'data:audio/mp3;base64,AAAA', type: 'audio/mp3' })).toBe('Set');
  });

  it('reads a missing value as Not set', () => {
    expect(formatValue('type', undefined)).toBe('Not set');
    expect(formatValue('aliases', [])).toBe('Not set');
  });

  it('reads booleans and lists in words', () => {
    expect(formatValue('enabled', false)).toBe('Off');
    expect(formatValue('tags', ['marsh', 'quiet'])).toBe('marsh, quiet');
  });
});

describe('diffContent', () => {
  it('lists a changed field with both values and leaves the rest unchanged', () => {
    const diff = diffContent(
      person({ aiDescription: 'A quiet ferryman.' }),
      person({ id: 'other', aiDescription: 'A quiet ferryman who sings.' }),
    );
    expect(diff.changed).toEqual([{
      field: 'aiDescription',
      label: 'AI Description',
      current: 'A quiet ferryman.',
      incoming: 'A quiet ferryman who sings.',
    }]);
    expect(diff.unchanged.map((row) => row.field)).toContain('name');
    expect(diffHasChanges(diff)).toBe(true);
  });

  it('ignores the fields the world owns, so a moved copy compares equal', () => {
    const diff = diffContent(
      person({ id: 'local', groupId: 'folder-a', order: 3, locations: ['loc-1'] }),
      person({ id: 'source', groupId: null, order: 0 }),
    );
    expect(diff.changed).toEqual([]);
    expect(diffHasChanges(diff)).toBe(false);
  });

  it('groups added, removed, changed and unchanged dictionary entries', () => {
    const diff = diffContent(
      book([entry({ name: 'Reeds' }), entry({ name: 'Ferry', value: 'old' }), entry({ name: 'Gone' })]),
      book([entry({ name: 'Reeds' }), entry({ name: 'Ferry', value: 'new' }), entry({ name: 'Fresh' })], { id: 'src' }),
    );
    expect(diff.addedEntries.map((row) => row.label)).toEqual(['Fresh']);
    expect(diff.removedEntries.map((row) => row.label)).toEqual(['Gone']);
    expect(diff.changedEntries).toEqual([
      { key: 'ferry', label: 'Ferry', current: 'old', incoming: 'new' },
    ]);
    expect(diff.unchangedEntries.map((row) => row.label)).toEqual(['Reeds']);
  });

  it('pairs entries by name rather than by their minted ids', () => {
    const diff = diffContent(
      book([{ ...entry({ name: 'Reeds' }), id: 'local-mint' }]),
      book([{ ...entry({ name: 'Reeds' }), id: 'source-mint' }], { id: 'src' }),
    );
    expect(diff.changedEntries).toEqual([]);
    expect(diff.unchangedEntries).toHaveLength(1);
  });

  it('pairs duplicate names in order and reports the surplus', () => {
    const diff = diffContent(
      book([entry({ name: 'Note', value: 'one' }), entry({ name: 'Note', value: 'two' })]),
      book([entry({ name: 'Note', value: 'one' })], { id: 'src' }),
    );
    expect(diff.unchangedEntries).toHaveLength(1);
    expect(diff.removedEntries.map((row) => row.current)).toEqual(['two']);
  });

  it('matches a nameless entry on its keywords', () => {
    const nameless = (value: string, id: string): DictionaryEntry => ({ id, name: '', key: ['bog', 'fen'], value });
    const diff = diffContent(
      book([nameless('old', 'a')]),
      book([nameless('new', 'b')], { id: 'src' }),
    );
    expect(diff.changedEntries).toEqual([
      { key: 'bog, fen', label: 'bog, fen', current: 'old', incoming: 'new' },
    ]);
  });

  it('reports an entry whose settings changed but whose text did not', () => {
    const diff = diffContent(
      book([entry({ name: 'Reeds', constant: false })]),
      book([entry({ name: 'Reeds', constant: true })], { id: 'src' }),
    );
    expect(diff.changedEntries).toHaveLength(1);
    expect(diff.unchangedEntries).toEqual([]);
  });

  it('finds nothing to review in two identical copies', () => {
    expect(diffHasChanges(diffContent(book([entry({ name: 'Reeds' })]), book([entry({ name: 'Reeds' })])))).toBe(false);
  });
});
