import { describe, it, expect } from 'vitest';
import {
  parseKeywords,
  getActivatedDictionary,
  buildDictionaryContext,
  flattenEnabledBookEntries,
  matchSpans,
  explainActivation,
  locateMatches,
  type ScanSource,
} from './dictionaryUtils';
import type { Dictionary, DictionaryEntry } from '@/types';

const entry = (over: Partial<DictionaryEntry>): DictionaryEntry => ({
  id: '1',
  name: '',
  key: '',
  value: '',
  ...over,
});

const book = (over: Partial<Dictionary>): Dictionary => ({
  id: 'b',
  name: 'Book',
  entries: [],
  ...over,
});

describe('parseKeywords', () => {
  it('splits, trims, and drops empty keywords', () => {
    expect(parseKeywords(entry({ key: 'dragon,  fire ,, ice ' }))).toEqual(['dragon', 'fire', 'ice']);
  });

  it('returns [] for an empty key', () => {
    expect(parseKeywords(entry({ key: '' }))).toEqual([]);
  });
});

describe('getActivatedDictionary — base matching', () => {
  const dragon = entry({ id: 'd', key: 'dragon, wyrm', value: 'A big lizard.' });
  const castle = entry({ id: 'c', key: 'castle', value: 'A fortress.' });
  const dict = [dragon, castle];

  it('matches case-insensitively across multiple scene texts', () => {
    expect(getActivatedDictionary(dict, ['The DRAGON roars', 'nothing here'])).toEqual([dragon]);
  });

  it('matches on any of an entry keyword', () => {
    expect(getActivatedDictionary(dict, ['a lone wyrm'])).toEqual([dragon]);
  });

  it('returns [] when the dictionary is empty', () => {
    expect(getActivatedDictionary([], ['dragon'])).toEqual([]);
  });

  it('returns [] when there is no usable text', () => {
    expect(getActivatedDictionary(dict, ['', null as unknown as string])).toEqual([]);
  });

  it('preserves declaration order in the result', () => {
    expect(getActivatedDictionary(dict, ['castle and dragon'])).toEqual([dragon, castle]);
  });
});

describe('getActivatedDictionary — lorebook activation fields', () => {
  it('skips disabled entries', () => {
    const off = entry({ id: 'o', key: 'dragon', value: 'x', enabled: false });
    expect(getActivatedDictionary([off], ['dragon here'])).toEqual([]);
  });

  it('always includes constant entries, even with no matching text', () => {
    const always = entry({ id: 'a', key: 'never-matches', value: 'World rule.', constant: true });
    expect(getActivatedDictionary([always], ['unrelated'])).toEqual([always]);
    expect(getActivatedDictionary([always], [''])).toEqual([always]);
  });

  it('honors caseSensitive', () => {
    const cs = entry({ id: 'x', key: 'IT', value: 'the entity', caseSensitive: true });
    expect(getActivatedDictionary([cs], ['it happened'])).toEqual([]);
    expect(getActivatedDictionary([cs], ['IT looms'])).toEqual([cs]);
  });

  it('treats keys as regex with useRegex', () => {
    const rx = entry({ id: 'r', key: 'dragons?\\b', value: 'lizard', useRegex: true });
    expect(getActivatedDictionary([rx], ['a dragon'])).toEqual([rx]);
    expect(getActivatedDictionary([rx], ['dragons roam'])).toEqual([rx]);
    expect(getActivatedDictionary([rx], ['dragonfly'])).toEqual([]); // \b stops the partial word
  });

  it('a malformed regex simply never matches (no throw)', () => {
    const bad = entry({ id: 'b', key: '(', value: 'x', useRegex: true });
    expect(getActivatedDictionary([bad], ['anything ('])).toEqual([]);
  });

  it('requires a secondary key when secondaryKeys is set (primary AND secondary)', () => {
    const red = entry({ id: 'rd', key: 'dragon', secondaryKeys: 'red, crimson', value: 'The Red Dragon.' });
    expect(getActivatedDictionary([red], ['a dragon appears'])).toEqual([]); // primary only
    expect(getActivatedDictionary([red], ['a red dragon appears'])).toEqual([red]); // both present
  });

  it('matchWholeWords matches whole words only', () => {
    const art = entry({ id: 'w', key: 'art', value: 'x', matchWholeWords: true });
    expect(getActivatedDictionary([art], ['the art show'])).toEqual([art]);
    expect(getActivatedDictionary([art], ['a cart'])).toEqual([]);
    expect(getActivatedDictionary([art], ['start here'])).toEqual([]);
  });

  it('secondaryAll requires every secondary keyword', () => {
    const e = entry({ id: 'sa', key: 'dragon', secondaryKeys: 'red, ancient', secondaryAll: true, value: 'x' });
    expect(getActivatedDictionary([e], ['a red dragon'])).toEqual([]); // missing "ancient"
    expect(getActivatedDictionary([e], ['an ancient red dragon'])).toEqual([e]);
  });

  it('secondaryExclude fires only when the secondaries are absent (NOT-ANY)', () => {
    const e = entry({ id: 'sx', key: 'dragon', secondaryKeys: 'friendly', secondaryExclude: true, value: 'x' });
    expect(getActivatedDictionary([e], ['a lone dragon'])).toEqual([e]);
    expect(getActivatedDictionary([e], ['a friendly dragon'])).toEqual([]);
  });

  it('secondaryExclude + secondaryAll fires unless all secondaries appear (NOT-ALL)', () => {
    const e = entry({ id: 'sxa', key: 'dragon', secondaryKeys: 'red, ancient', secondaryExclude: true, secondaryAll: true, value: 'x' });
    expect(getActivatedDictionary([e], ['a red dragon'])).toEqual([e]); // not all present → fires
    expect(getActivatedDictionary([e], ['an ancient red dragon'])).toEqual([]); // all present → excluded
  });
});

describe('getActivatedDictionary — scanDepth over history', () => {
  const ghost = entry({ id: 'g', key: 'ghost', value: 'A specter.' });

  it('scans all history when scanDepth is unset', () => {
    const history = ['a ghost long ago', 'm2', 'm3', 'm4'];
    expect(getActivatedDictionary([ghost], ['calm scene'], { history })).toEqual([ghost]);
  });

  it('caps the lookback to the last N messages when scanDepth is set', () => {
    const shallow = entry({ ...ghost, scanDepth: 2 });
    // ghost is 3 messages back → outside a depth of 2
    expect(getActivatedDictionary([shallow], ['calm scene'], { history: ['a ghost', 'm2', 'm3', 'm4'] })).toEqual([]);
    // ghost within the last 2
    expect(getActivatedDictionary([shallow], ['calm scene'], { history: ['m1', 'm2', 'a ghost', 'm4'] })).toEqual([shallow]);
  });

  it('scanDepth 0 scans the current scene only, not history', () => {
    const none = entry({ ...ghost, scanDepth: 0 });
    expect(getActivatedDictionary([none], ['calm scene'], { history: ['a ghost'] })).toEqual([]);
    expect(getActivatedDictionary([none], ['a ghost in the room'], { history: ['old'] })).toEqual([none]);
  });
});

describe('getActivatedDictionary — recursive activation', () => {
  it("chains through recursive entries' content, bounded", () => {
    const a = entry({ id: 'a', key: 'gate', value: 'Beyond the gate lies the Keep.' });
    const b = entry({ id: 'b', key: 'keep', value: 'The Keep houses the Warden.', recursive: true });
    const c = entry({ id: 'c', key: 'warden', value: 'The Warden guards it.', recursive: true });
    // scene mentions only "gate" → a fires; a's text mentions "Keep" → b; b's text mentions "Warden" → c.
    expect(getActivatedDictionary([a, b, c], ['the gate creaks'])).toEqual([a, b, c]);
  });

  it('does not recursively activate a non-recursive entry', () => {
    const a = entry({ id: 'a', key: 'gate', value: 'Beyond the gate lies the Keep.' });
    const b = entry({ id: 'b', key: 'keep', value: 'The Keep.' }); // not recursive
    expect(getActivatedDictionary([a, b], ['the gate creaks'])).toEqual([a]);
  });
});

describe('buildDictionaryContext', () => {
  it('labels entries by name (falling back to key) under the "Foreground Lore" heading', () => {
    const named = entry({ name: 'Dragon', key: 'dragon', value: 'Big.' });
    const keyed = entry({ name: '', key: 'castle', value: 'Stone.' });
    expect(buildDictionaryContext([named, keyed])).toBe('## Foreground Lore\nDragon: Big.\ncastle: Stone.');
  });

  it('omits the heading with includeHeading: false (the chip body)', () => {
    const named = entry({ name: 'Dragon', key: 'dragon', value: 'Big.' });
    expect(buildDictionaryContext([named], false)).toBe('Dragon: Big.');
  });

  it('renders entries in the given array order (position/order is the caller\'s job)', () => {
    const a = entry({ name: 'A', value: 'a' });
    const b = entry({ name: 'B', value: 'b' });
    expect(buildDictionaryContext([b, a], false)).toBe('B: b\nA: a');
  });

  it('skips entries with no value', () => {
    expect(buildDictionaryContext([entry({ name: 'Empty', key: 'x', value: '' })])).toBe('');
    expect(buildDictionaryContext([entry({ name: 'Empty', key: 'x', value: '' })], false)).toBe('');
  });

  it('returns "" for no entries', () => {
    expect(buildDictionaryContext([])).toBe('');
    expect(buildDictionaryContext([], false)).toBe('');
  });
});

describe('matchSpans — located occurrences under an entry\'s flags', () => {
  it('finds every case-insensitive substring occurrence with offsets and the exact matched text', () => {
    const e = entry({ key: 'dragon' });
    expect(matchSpans(e, 'The Dragon eyes a dragon.')).toEqual([
      { start: 4, end: 10, text: 'Dragon', keyword: 'dragon' },
      { start: 18, end: 24, text: 'dragon', keyword: 'dragon' },
    ]);
  });

  it('respects matchWholeWords — no mid-word hits', () => {
    const e = entry({ key: 'art', matchWholeWords: true });
    expect(matchSpans(e, 'art cart start art')).toEqual([
      { start: 0, end: 3, text: 'art', keyword: 'art' },
      { start: 15, end: 18, text: 'art', keyword: 'art' },
    ]);
  });

  it('treats the key as a regex with useRegex and reports the real matched text', () => {
    const e = entry({ key: 'dragons?', useRegex: true });
    expect(matchSpans(e, 'dragon and dragons')).toEqual([
      { start: 0, end: 6, text: 'dragon', keyword: 'dragons?' },
      { start: 11, end: 18, text: 'dragons', keyword: 'dragons?' },
    ]);
  });

  it('respects caseSensitive', () => {
    const e = entry({ key: 'IT', caseSensitive: true });
    expect(matchSpans(e, 'IT is not it')).toEqual([{ start: 0, end: 2, text: 'IT', keyword: 'IT' }]);
  });

  it('a malformed regex yields no spans (no throw)', () => {
    expect(matchSpans(entry({ key: '(', useRegex: true }), 'a ( b')).toEqual([]);
  });

  it('does not loop on a zero-length-capable regex', () => {
    // `a*` can match empty; the scanner must still terminate and only report the real "aa" run.
    const spans = matchSpans(entry({ key: 'a*', useRegex: true }), 'aa');
    expect(spans.some((s) => s.text === 'aa')).toBe(true);
    expect(spans.length).toBeLessThan(10);
  });

  it('collects hits across multiple keywords', () => {
    const e = entry({ key: 'fire, ice' });
    expect(matchSpans(e, 'ice then fire').map((s) => s.keyword)).toEqual(['fire', 'ice']);
  });
});

describe('explainActivation — report matches getActivatedDictionary and attributes hits', () => {
  const scene = (...texts: string[]): ScanSource[] =>
    texts.map((text, i) => ({ region: ['location', 'entities', 'action', 'notes'][i] ?? `scene:${i}`, text }));

  it('activation membership agrees with getActivatedDictionary across a mixed dictionary', () => {
    const dict = [
      entry({ id: 'const', key: 'zzz', value: 'x', constant: true }),
      entry({ id: 'hit', key: 'dragon', value: 'x' }),
      entry({ id: 'miss', key: 'castle', value: 'x' }),
      entry({ id: 'off', key: 'dragon', value: 'x', enabled: false }),
    ];
    const sceneTexts = ['a dragon roars'];
    const report = explainActivation(dict, scene(...sceneTexts));
    const fromReport = dict.filter((e) => report.byId.get(e.id)?.activated).map((e) => e.id);
    const fromWrapper = getActivatedDictionary(dict, sceneTexts).map((e) => e.id);
    expect(fromReport).toEqual(fromWrapper);
    expect(fromReport).toEqual(['const', 'hit']);
  });

  it('records every entry, including disabled and non-activated ones, in declaration order', () => {
    const dict = [
      entry({ id: 'a', key: 'dragon' }),
      entry({ id: 'b', key: 'castle' }),
      entry({ id: 'c', key: 'dragon', enabled: false }),
    ];
    const report = explainActivation(dict, scene('a dragon'));
    expect(report.entries.map((e) => e.entryId)).toEqual(['a', 'b', 'c']);
    expect(report.byId.get('a')).toMatchObject({ activated: true, reason: 'keyword' });
    expect(report.byId.get('b')).toMatchObject({ activated: false, reason: 'none', hits: [] });
    expect(report.byId.get('c')).toMatchObject({ activated: false, reason: 'none', hits: [] });
  });

  it('attributes each hit to the scene region it was found in', () => {
    const dict = [entry({ id: 'd', key: 'dragon' })];
    const report = explainActivation(dict, scene('quiet town', 'a dragon here'));
    const hits = report.byId.get('d')!.hits;
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ region: 'entities', keyword: 'dragon', matchedText: 'dragon' });
  });

  it('attributes history hits to their history region and honors scanDepth', () => {
    const dict = [entry({ id: 'g', key: 'ghost', scanDepth: 2 })];
    const history: ScanSource[] = ['m1 ghost', 'm2', 'a ghost', 'm4'].map((text, i) => ({ region: `history:${i}`, text }));
    const report = explainActivation(dict, scene('calm'), { history });
    const hits = report.byId.get('g')!.hits;
    // only the ghost within the last 2 messages (index 2) is in scope
    expect(hits).toHaveLength(1);
    expect(hits[0].region).toBe('history:2');
  });

  it('marks constant entries with reason "constant" even when nothing matches', () => {
    const dict = [entry({ id: 'k', key: 'never', value: 'rule', constant: true })];
    const report = explainActivation(dict, scene('unrelated'));
    expect(report.byId.get('k')).toMatchObject({ activated: true, reason: 'constant', hits: [] });
  });

  it('records secondary-gate status (present, requireAll, exclude)', () => {
    const dict = [entry({ id: 's', key: 'dragon', secondaryKeys: 'red, ancient', secondaryAll: true })];
    const present = explainActivation(dict, scene('an ancient red dragon')).byId.get('s')!;
    expect(present).toMatchObject({ activated: true });
    expect(present.secondary).toEqual({ keywords: ['red', 'ancient'], requireAll: true, exclude: false, present: true });

    const absent = explainActivation(dict, scene('a red dragon')).byId.get('s')!;
    expect(absent.activated).toBe(false);
    expect(absent.secondary).toMatchObject({ present: false });
  });

  it('attributes a recursive hit to the source entry\'s value region', () => {
    const gate = entry({ id: 'gate', key: 'gate', value: 'Beyond the gate lies the Keep.' });
    const keep = entry({ id: 'keep', key: 'Keep', value: 'The Keep houses a warden.', recursive: true });
    const report = explainActivation([gate, keep], scene('the gate creaks'));
    const rec = report.byId.get('keep')!;
    expect(rec).toMatchObject({ activated: true, reason: 'recursive' });
    expect(rec.hits).toHaveLength(1);
    expect(rec.hits[0]).toMatchObject({ region: 'recursion:gate', keyword: 'Keep', matchedText: 'Keep' });
  });

  it('reports the interpreted match rule per entry', () => {
    const dict = [
      entry({ id: 'plain', key: 'a' }),
      entry({ id: 'rx', key: 'a', useRegex: true, matchWholeWords: true }),
      entry({ id: 'ww', key: 'a', matchWholeWords: true, caseSensitive: true }),
    ];
    const report = explainActivation(dict, scene('a'));
    expect(report.byId.get('plain')!.rule).toEqual({ regex: false, wholeWord: false, caseSensitive: false });
    // useRegex wins over matchWholeWords
    expect(report.byId.get('rx')!.rule).toEqual({ regex: true, wholeWord: false, caseSensitive: false });
    expect(report.byId.get('ww')!.rule).toEqual({ regex: false, wholeWord: true, caseSensitive: true });
  });
});

describe('locateMatches — maps real hits onto displayed text, only in scanned regions', () => {
  const reportFor = (entries: DictionaryEntry[], sources: ScanSource[]) =>
    explainActivation(entries, sources).entries;

  it('marks the keyword only inside the scanned source, not a coincidental echo elsewhere', () => {
    const dragon = entry({ id: 'd', key: 'dragon', value: 'x' });
    const action = 'look at the dragon';
    const report = reportFor([dragon], [{ region: 'action', text: action }]);
    const displayed = `A dragon statue looms.\n${action}`;
    const segs = locateMatches(displayed, report, [{ region: 'action', text: action }]);
    const chips = segs.filter((s) => s.chip);
    expect(chips).toHaveLength(1); // the statue's "dragon" is not a scanned source → left plain
    expect(chips[0].text).toBe('dragon');
    const before = segs.slice(0, segs.indexOf(chips[0])).map((s) => s.text).join('');
    expect(before).toContain('A dragon statue looms.'); // first "dragon" survives as plain text
  });

  it('offsets the hit into the located source within a larger block', () => {
    const e = entry({ id: 'e', key: 'ghost' });
    const loc = 'a quiet ghost town';
    const report = reportFor([e], [{ region: 'location', text: loc }]);
    const segs = locateMatches(`## Location\n${loc}\n## End`, report, [{ region: 'location', text: loc }]);
    const chip = segs.find((s) => s.chip)!;
    expect(chip.text).toBe('ghost');
    expect(chip.chip!.entryId).toBe('e');
  });

  it('resolves overlaps longest-first', () => {
    const short = entry({ id: 's', key: 'dragon' });
    const long = entry({ id: 'l', key: 'fire dragon' });
    const src = 'a fire dragon roars';
    const report = reportFor([short, long], [{ region: 'action', text: src }]);
    const chips = locateMatches(src, report, [{ region: 'action', text: src }]).filter((s) => s.chip);
    expect(chips).toHaveLength(1);
    expect(chips[0].text).toBe('fire dragon');
    expect(chips[0].chip!.entryId).toBe('l');
  });

  it('omits entries the skip predicate rejects', () => {
    const e = entry({ id: 'e', key: 'ghost' });
    const src = 'a ghost';
    const report = reportFor([e], [{ region: 'action', text: src }]);
    expect(locateMatches(src, report, [{ region: 'action', text: src }], (id) => id === 'e')).toEqual([{ text: src }]);
  });

  it("locates a recursive hit inside the source entry's value region", () => {
    const gate = entry({ id: 'gate', key: 'gate', value: 'Beyond the gate lies the Keep.' });
    const keep = entry({ id: 'keep', key: 'Keep', value: 'The Keep.', recursive: true });
    const report = reportFor([gate, keep], [{ region: 'action', text: 'the gate creaks' }]);
    const displayed = `## Foreground Lore\ngate: ${gate.value}`;
    const segs = locateMatches(displayed, report, [{ region: 'recursion:gate', text: gate.value }]);
    const chip = segs.find((s) => s.chip)!;
    expect(chip.text).toBe('Keep');
    expect(chip.chip!.entryId).toBe('keep');
    expect(chip.chip!.activation.reason).toBe('recursive');
  });

  it('returns [] for empty text and a single plain segment when nothing locates', () => {
    expect(locateMatches('', [], [])).toEqual([]);
    const report = reportFor([entry({ id: 'e', key: 'ghost' })], [{ region: 'action', text: 'a ghost' }]);
    expect(locateMatches('unrelated', report, [{ region: 'action', text: 'a ghost' }])).toEqual([{ text: 'unrelated' }]);
  });
});

describe('flattenEnabledBookEntries', () => {
  const a = entry({ id: 'a', value: 'a' });
  const b = entry({ id: 'b', value: 'b' });
  const c = entry({ id: 'c', value: 'c' });

  it('concatenates books in order, entries in per-book order', () => {
    const books = [book({ id: 'b1', entries: [a, b] }), book({ id: 'b2', entries: [c] })];
    expect(flattenEnabledBookEntries(books).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops every entry of a disabled book, including entries with enabled unset', () => {
    const books = [book({ id: 'b1', enabled: false, entries: [a] }), book({ id: 'b2', entries: [b] })];
    expect(flattenEnabledBookEntries(books).map((e) => e.id)).toEqual(['b']);
  });

  it('includes books with enabled unset or true', () => {
    const books = [book({ id: 'b1', entries: [a] }), book({ id: 'b2', enabled: true, entries: [b] })];
    expect(flattenEnabledBookEntries(books).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('keeps a per-entry disabled entry (activation filters it, not the flatten)', () => {
    const off = entry({ id: 'off', value: 'x', enabled: false });
    expect(flattenEnabledBookEntries([book({ entries: [off] })])).toContainEqual(off);
  });

  it('returns [] for undefined or empty input', () => {
    expect(flattenEnabledBookEntries(undefined)).toEqual([]);
    expect(flattenEnabledBookEntries([])).toEqual([]);
  });
});
