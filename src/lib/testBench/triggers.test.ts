import { describe, it, expect } from 'vitest';
import { getActivatedDictionary, flattenEnabledBookEntries } from '@/lib/dictionaryUtils';
import type { Dictionary, DictionaryEntry, Entity, Placeholder } from '@/types';
import { buildTriggerReport, describeNearMiss, describeRegion, type TriggerWorld } from './triggers';

const entry = (over: Partial<DictionaryEntry> & { id: string }): DictionaryEntry => ({
  name: '', key: [], value: 'lore', ...over,
});

const book = (entries: DictionaryEntry[], over: Partial<Dictionary> = {}): Dictionary => ({
  id: 'book1', name: 'Sedge Lore', entries, ...over,
});

const ent = (id: string, name: string, over: Partial<Entity> = {}): Entity =>
  ({ id, name, ...over }) as Entity;

const world = (over: Partial<TriggerWorld> = {}): TriggerWorld => ({
  entities: [], dictionaries: [], placeholders: [], ...over,
});

/** The entry row by id — every test reads its verdict through the report, never a hand-built row. */
const row = (report: ReturnType<typeof buildTriggerReport>, id: string) => {
  const found = report.entries.find((e) => e.entryId === id);
  if (!found) throw new Error(`no row for ${id}`);
  return found;
};

describe('buildTriggerReport — what fired', () => {
  it('fires a keyword entry and locates the text behind it', () => {
    const report = buildTriggerReport(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'] })])] }),
      'The tide pulls out past the sedge.',
    );
    const d1 = row(report, 'd1');
    expect(d1.fired).toBe(true);
    expect(d1.reason).toBe('keyword');
    expect(d1.hits[0]).toMatchObject({ keyword: 'tide', matchedText: 'tide', region: 'scene' });
    expect(report.fired).toBe(1);
  });

  it('agrees with the activation the game would run for the same text', () => {
    // The whole point of the instrument: it reports the harness's answer, not a second opinion.
    const books = [book([
      entry({ id: 'd1', key: ['tide'] }),
      entry({ id: 'd2', key: ['storm'] }),
      entry({ id: 'd3', constant: true }),
      entry({ id: 'd4', key: ['tide'], enabled: false }),
    ])];
    const text = 'The tide pulls out past the sedge.';
    const report = buildTriggerReport(world({ dictionaries: books }), text);
    const played = getActivatedDictionary(flattenEnabledBookEntries(books), [text]).map((e) => e.id);
    expect(report.entries.filter((e) => e.fired).map((e) => e.entryId)).toEqual(played);
  });

  it('marks a constant entry as always on and counts it', () => {
    const report = buildTriggerReport(
      world({ dictionaries: [book([entry({ id: 'd1', name: 'House Rules', constant: true })])] }),
      'Nothing here mentions it.',
    );
    expect(row(report, 'd1').fired).toBe(true);
    expect(row(report, 'd1').reason).toBe('constant');
    expect(report.constant).toBe(1);
  });

  it('reports constant entries against empty text, so the empty state is a result', () => {
    const report = buildTriggerReport(
      world({ dictionaries: [book([entry({ id: 'd1', constant: true }), entry({ id: 'd2', key: ['tide'] })])] }),
      '',
    );
    expect(report.fired).toBe(1);
    expect(report.checked).toBe(2);
    expect(row(report, 'd1').fired).toBe(true);
  });

  it('counts every entry it checked when nothing fired', () => {
    const report = buildTriggerReport(
      world({ dictionaries: [book([entry({ id: 'd1', key: ['tide'] }), entry({ id: 'd2', key: ['storm'] })])] }),
      'A quiet morning.',
    );
    expect(report.fired).toBe(0);
    expect(report.checked).toBe(2);
  });

  it('fires a recursive entry off another entry’s value and names where it matched', () => {
    const report = buildTriggerReport(
      world({ dictionaries: [book([
        entry({ id: 'd1', key: ['tide'], value: 'The tide obeys the Moon Wardens.' }),
        entry({ id: 'd2', key: ['Moon Wardens'], recursive: true }),
      ])] }),
      'The tide pulls out.',
    );
    expect(row(report, 'd2').reason).toBe('recursive');
    expect(describeRegion(row(report, 'd2').hits[0].region)).toBe('Another entry');
  });
});

describe('buildTriggerReport — every near-miss class, as the row states it', () => {
  const missOf = (dictionaries: Dictionary[], text: string, id: string, history?: string[]) =>
    row(buildTriggerReport(world({ dictionaries }), text, { history }), id);

  it('names a muted book as the reason nothing in it was scanned', () => {
    const miss = missOf([book([entry({ id: 'd1', key: ['tide'] })], { enabled: false })], 'The tide pulls out.', 'd1');
    expect(miss.nearMiss).toBe('book-disabled');
    expect(miss.bookEnabled).toBe(false);
    expect(describeNearMiss(miss)).toBe('The “Sedge Lore” book is off, so none of its entries are scanned.');
  });

  it('names a muted entry', () => {
    const miss = missOf([book([entry({ id: 'd1', key: ['tide'], enabled: false })])], 'The tide pulls out.', 'd1');
    expect(miss.nearMiss).toBe('entry-disabled');
    expect(describeNearMiss(miss)).toBe('This entry is off.');
  });

  it('names an entry that can never fire', () => {
    const miss = missOf([book([entry({ id: 'd1', name: 'Orphan' })])], 'The tide pulls out.', 'd1');
    expect(miss.nearMiss).toBe('no-keywords');
    expect(describeNearMiss(miss)).toBe('No keywords and not constant, so this entry can never fire.');
  });

  it('flags an uncompilable pattern on the entry instead of failing the run', () => {
    const report = buildTriggerReport(
      world({ dictionaries: [book([
        entry({ id: 'd1', key: ['tide('], useRegex: true }),
        entry({ id: 'd2', key: ['sedge'] }),
      ])] }),
      'The tide pulls out past the sedge.',
    );
    // The run still produced a verdict for the healthy entry beside it.
    expect(row(report, 'd2').fired).toBe(true);
    const miss = row(report, 'd1');
    expect(miss.badPatterns).toEqual(['tide(']);
    expect(miss.nearMiss).toBe('invalid-regex');
    expect(describeNearMiss(miss)).toBe('“tide(” is not valid regex — a pattern that cannot compile never matches.');
  });

  it('blames a broken pattern only when every keyword is one', () => {
    // One bad key among good ones is a flag on the row, not the reason the entry stayed out — saying
    // "invalid regex" for an entry whose healthy keyword simply isn't in the text sends the author to
    // repair a pattern that was never what stopped it.
    const miss = missOf(
      [book([entry({ id: 'd1', key: ['tide(', 'storm'], useRegex: true })])],
      'A quiet morning.',
      'd1',
    );
    expect(miss.badPatterns).toEqual(['tide(']);
    expect(miss.nearMiss).toBe('no-match');
  });

  it('blames a broken secondary pattern only for the gate it breaks, never for a missing primary', () => {
    const miss = missOf(
      [book([entry({ id: 'd1', key: ['tide'], useRegex: true, secondaryKeys: ['sto(rm'] })])],
      'A quiet morning.',
      'd1',
    );
    expect(miss.badPatterns).toEqual(['sto(rm']);
    expect(miss.nearMiss).toBe('no-match');
  });

  it('names the secondary keyword that excluded a match', () => {
    const miss = missOf(
      [book([entry({ id: 'd1', key: ['tide'], secondaryKeys: ['storm'], secondaryExclude: true })])],
      'The tide pulls out ahead of the storm.',
      'd1',
    );
    expect(miss.nearMiss).toBe('secondary-excluded');
    expect(describeNearMiss(miss)).toBe('“storm” is present, and this entry fires only when it is absent.');
  });

  it('names the secondary keyword a match still needed', () => {
    const miss = missOf(
      [book([entry({ id: 'd1', key: ['tide'], secondaryKeys: ['moon'] })])],
      'The tide pulls out past the sedge.',
      'd1',
    );
    expect(miss.nearMiss).toBe('secondary-absent');
    expect(describeNearMiss(miss)).toBe('A keyword matched, but none of its secondary keywords did — needs “moon”.');
  });

  it('names which of an all-secondaries gate was missing', () => {
    const miss = missOf(
      [book([entry({ id: 'd1', key: ['tide'], secondaryKeys: ['moon', 'storm'], secondaryAll: true })])],
      'The tide pulls out under the moon.',
      'd1',
    );
    expect(miss.nearMiss).toBe('secondary-absent');
    expect(describeNearMiss(miss)).toBe('A keyword matched, but every secondary must appear too — “storm” missing.');
  });

  it('names a hit that fell outside the entry’s scan depth', () => {
    const miss = missOf(
      [book([entry({ id: 'd1', key: ['tide'], scanDepth: 1 })])],
      'A quiet morning.',
      'd1',
      ['The tide pulled out.', 'She walked the pier.'],
    );
    expect(miss.nearMiss).toBe('beyond-scan-depth');
    expect(describeNearMiss(miss)).toBe('“tide” matched further back than its scan depth of 1 message.');
  });

  it('fires the same entry once its hit is inside the depth window', () => {
    // The guard on the reason above: it must be the window that decided, not the keyword.
    const near = missOf(
      [book([entry({ id: 'd1', key: ['tide'], scanDepth: 2 })])],
      'A quiet morning.',
      'd1',
      ['The tide pulled out.', 'She walked the pier.'],
    );
    expect(near.fired).toBe(true);
  });

  it('names the word a whole-word rule blocked a substring inside', () => {
    const miss = missOf(
      [book([entry({ id: 'd1', key: ['tide'], matchWholeWords: true })])],
      'The riptides drag the channel.',
      'd1',
    );
    expect(miss.nearMiss).toBe('whole-word-blocked');
    expect(describeNearMiss(miss)).toBe('“tide” appears only inside “riptides”, and whole-word matching is on.');
  });

  it('falls back to plain absence when nothing about the entry is at fault', () => {
    const miss = missOf([book([entry({ id: 'd1', key: ['storm'] })])], 'A quiet morning.', 'd1');
    expect(miss.nearMiss).toBe('no-match');
    expect(describeNearMiss(miss)).toBe('No keyword found in the text.');
  });
});

describe('buildTriggerReport — entities present', () => {
  it('reports each detected entity with the form that matched and where it hit', () => {
    const text = 'Maren watches from the harbor steps.';
    const report = buildTriggerReport(world({ entities: [ent('e1', 'Maren')] }), text);
    expect(report.entities).toHaveLength(1);
    expect(report.entities[0]).toMatchObject({ entityId: 'e1', name: 'Maren', matched: 'Maren', via: 'name' });
    const span = report.entities[0].spans[0];
    expect(text.slice(span.start, span.end)).toBe('Maren');
  });

  it('credits the alias an entity was written as', () => {
    const report = buildTriggerReport(
      world({ entities: [ent('e1', 'Maren', { aliases: ['Matron of Teldoril'] })] }),
      'The Matron of Teldoril inclines her head.',
    );
    expect(report.entities[0]).toMatchObject({ name: 'Maren', matched: 'Matron of Teldoril', via: 'alias' });
  });

  it('reads prose rather than dialogue, and still points into the pasted text', () => {
    const text = '“Maren will be pleased,” Tobb said.';
    const report = buildTriggerReport(world({ entities: [ent('e1', 'Maren'), ent('e2', 'Tobb')] }), text);
    // Named only inside quotes: mentioned, not present — the same verdict a turn reaches.
    expect(report.entities.map((e) => e.name)).toEqual(['Tobb']);
    const span = report.entities[0].spans[0];
    expect(text.slice(span.start, span.end)).toBe('Tobb');
  });

  it('reports both entities when two lay claim to the same words', () => {
    const report = buildTriggerReport(
      world({ entities: [ent('e1', 'Maren'), ent('e2', 'Maren Vosk')] }),
      'Maren crosses the yard.',
    );
    expect(report.entities.map((e) => e.entityId)).toEqual(['e1', 'e2']);
  });

  it('matches on a single-valued placeholder’s real text', () => {
    const placeholders = [{ id: 'p1', name: 'Harbor', type: 'variable', values: ['Sedge Landing'] }] as unknown as Placeholder[];
    const report = buildTriggerReport(
      world({ entities: [ent('e1', '{{ph:p1:world:x}}')], placeholders }),
      'Sedge Landing wakes slowly.',
    );
    expect(report.entities[0].name).toBe('Sedge Landing');
  });
});

describe('buildTriggerReport — highlight segments', () => {
  it('splits the text into plain and claimed runs, in order', () => {
    const text = 'Maren watches the tide.';
    const report = buildTriggerReport(
      world({ entities: [ent('e1', 'Maren')], dictionaries: [book([entry({ id: 'd1', name: 'Tides', key: ['tide'] })])] }),
      text,
    );
    expect(report.segments.map((s) => s.text).join('')).toBe(text);
    const claimed = report.segments.filter((s) => s.marks.length > 0);
    expect(claimed.map((s) => s.text)).toEqual(['Maren', 'tide']);
    expect(claimed[0].marks[0]).toMatchObject({ kind: 'entity', id: 'e1' });
    expect(claimed[1].marks[0]).toMatchObject({ kind: 'entry', id: 'd1', keyword: 'tide' });
  });

  it('keeps both claims when an entity and an entry cover the same words', () => {
    const text = 'Maren crosses the yard.';
    const report = buildTriggerReport(
      world({ entities: [ent('e1', 'Maren')], dictionaries: [book([entry({ id: 'd1', key: ['Maren'] })])] }),
      text,
    );
    const claimed = report.segments.find((s) => s.text === 'Maren');
    expect(claimed?.marks.map((m) => m.kind)).toEqual(['entity', 'entry']);
  });

  it('places no highlight for a hit that is not in the pasted text', () => {
    const report = buildTriggerReport(
      world({ dictionaries: [book([entry({ id: 'd1', key: ['tide'] })])] }),
      'A quiet morning.',
      { history: ['The tide pulled out.'] },
    );
    expect(row(report, 'd1').fired).toBe(true);
    expect(report.segments.every((s) => s.marks.length === 0)).toBe(true);
  });

  it('has nothing to lay out for empty text', () => {
    expect(buildTriggerReport(world(), '').segments).toEqual([]);
  });
});
