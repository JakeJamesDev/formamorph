import { describe, it, expect } from 'vitest';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { collectSearchTargets, findMatches, replaceAll, spliceText } from '@/lib/worldSearch';
import type { SearchSources, SearchTarget } from '@/lib/worldSearch';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';

const LOOSE = { matchCase: false, wholeWord: false };

const overview = (over: Partial<WorldOverview> = {}): WorldOverview => ({
  name: '', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '',
  use3DModel: false, tags: [], ...over,
});

/** A sources bag whose updaters record what they were handed. */
function sources(over: Partial<SearchSources> = {}) {
  const writes: Array<[string, unknown]> = [];
  const record = (label: string) => (value: unknown) => { writes.push([label, value]); };
  const src: SearchSources = {
    worldOverview: overview(),
    stats: [], entities: [], entityGroups: [], locations: [], traits: [], traitGroups: [],
    dictionaries: [], placeholders: [],
    updateWorldOverview: record('overview'),
    updateStat: record('stat'),
    updateEntity: record('entity'),
    updateEntityGroup: record('entityGroup'),
    updateLocation: record('location'),
    updateTrait: record('trait'),
    updateTraitGroup: record('traitGroup'),
    updateDictionary: record('dictionary'),
    updateDictionaryEntry: record('dictionaryEntry'),
    updatePlaceholder: record('placeholder'),
    ...over,
  };
  return { src, writes };
}

const entity = (over: Partial<Entity> = {}): Entity => ({ id: 'e1', name: 'Mira', ...over });
const targetFor = (list: SearchTarget[], fieldKey: string) => {
  const found = list.find((t) => t.fieldKey === fieldKey);
  if (!found) throw new Error(`no target for ${fieldKey} (have: ${list.map((t) => t.fieldKey).join(', ')})`);
  return found;
};

describe('collectSearchTargets', () => {
  it('skips ids, media, and stat code', () => {
    const { src } = sources({
      stats: [{
        id: 'stat-uuid-1234', name: 'Vigor', type: 'number', description: 'Stamina',
        min: 0, max: 100, starting: 50, value: 50, regen: 0, descriptors: [],
        code: 'return value + 1;',
      } as Stat],
      entities: [entity({ images: ['data:image/webp;base64,AAAA'] as Entity['images'] })],
    });
    const keys = collectSearchTargets(src).map((t) => t.fieldKey);
    expect(keys).toContain('name');
    expect(keys).not.toContain('id');
    expect(keys).not.toContain('code');
    expect(keys).not.toContain('images');
    expect(collectSearchTargets(src).some((t) => t.value.includes('return value'))).toBe(false);
  });

  it('gives each element of a string-array field its own target', () => {
    const { src } = sources({ entities: [entity({ aliases: ['the Sparrow', 'Mira of Sedge'] })] });
    const targets = collectSearchTargets(src);
    expect(targets.filter((t) => t.fieldKey.startsWith('aliases')).map((t) => t.value))
      .toEqual(['the Sparrow', 'Mira of Sedge']);
  });

  it('writes an array element back as the whole array, leaving its siblings alone', () => {
    const { src, writes } = sources({ entities: [entity({ aliases: ['the Sparrow', 'Mira of Sedge'] })] });
    targetFor(collectSearchTargets(src), 'aliases[1]').write('Mira of Fen');
    expect(writes).toEqual([['entity', expect.objectContaining({ aliases: ['the Sparrow', 'Mira of Fen'] })]]);
  });

  it('marks array entries as chip-list entries and scalars as not', () => {
    // What tells a keyword apart from an entry name that repeats it word for word — the two hold identical
    // text, so only the kind of control the hit lives in can separate them.
    const { src } = sources({
      dictionaries: [{
        id: 'd1', name: 'Lore',
        entries: [{ id: 'x1', name: 'Warp Sigil', key: ['Warp Sigil'], value: 'A mark.' }],
      }],
    });
    // The book carries a `name` too, so pick the entry's by its owner.
    const targets = collectSearchTargets(src).filter((t) => t.itemLabel === 'Warp Sigil');
    expect(targetFor(targets, 'key[0]')).toMatchObject({ value: 'Warp Sigil', inChipList: true });
    expect(targetFor(targets, 'name')).toMatchObject({ value: 'Warp Sigil', inChipList: false });
  });

  it('marks a regex dictionary entry as unable to hold a chip', () => {
    const book = (useRegex: boolean): Dictionary => ({
      id: 'd1', name: 'Lore',
      entries: [{ id: 'x1', name: 'Fen', key: ['fen'], value: 'A marsh.', useRegex }],
    });
    const chipOf = (regex: boolean) =>
      targetFor(collectSearchTargets(sources({ dictionaries: [book(regex)] }).src), 'value').chipCapable;
    expect(chipOf(false)).toBe(true);
    expect(chipOf(true)).toBe(false);
  });

  it('reaches both readmes, each writing back to its own field', () => {
    const { src, writes } = sources({
      worldOverview: overview({ introReadme: 'Before you choose', readme: 'Now you play' }),
    });
    const targets = collectSearchTargets(src);
    expect(targetFor(targets, 'introReadme')).toMatchObject({ value: 'Before you choose', chipCapable: true });
    expect(targetFor(targets, 'readme')).toMatchObject({ value: 'Now you play', chipCapable: true });

    targetFor(targets, 'introReadme').write('Before you pick');
    expect(writes).toEqual([['overview', expect.objectContaining({
      introReadme: 'Before you pick', readme: 'Now you play',
    })]]);
  });

  it('carries a placeholder value weight across an edit to that value', () => {
    const ph: Placeholder = { id: 'p1', name: 'Season', values: ['spring', 'winter'], weights: { spring: 3, winter: 1 } };
    const { src, writes } = sources({ placeholders: [ph] });
    targetFor(collectSearchTargets(src), 'values[0]').write('summer');
    expect(writes[0][1]).toMatchObject({ values: ['summer', 'winter'], weights: { summer: 3, winter: 1 } });
  });
});

describe('findMatches', () => {
  const chipText = (before: string, after: string) =>
    before + encodePlaceholderToken({ id: 'ph-mira-id', mode: 'world', placementId: 'place-1' }) + after;

  it('never matches inside a placeholder chip token', () => {
    const { src } = sources({ entities: [entity({ name: '', aiDescription: chipText('She is ', ' of the fen.') })] });
    const targets = collectSearchTargets(src);
    // "mira" occurs inside the chip's own id, and nowhere in the prose.
    expect(findMatches(targets, 'mira', LOOSE)).toHaveLength(0);
    expect(findMatches(targets, 'ph', LOOSE)).toHaveLength(0);
    expect(findMatches(targets, 'fen', LOOSE)).toHaveLength(1);
  });

  it('reports offsets into the stored string, chips included', () => {
    const stored = chipText('She is ', ' of the fen.');
    const { src } = sources({ entities: [entity({ name: '', aiDescription: stored })] });
    const [match] = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    expect(stored.slice(match.start, match.end)).toBe('fen');
  });

  it('honors match case', () => {
    const { src } = sources({ entities: [entity({ aiDescription: 'A fen, and a Fen.' })] });
    const targets = collectSearchTargets(src);
    expect(findMatches(targets, 'fen', LOOSE)).toHaveLength(2);
    expect(findMatches(targets, 'fen', { matchCase: true, wholeWord: false })).toHaveLength(1);
  });

  it('honors whole word', () => {
    const { src } = sources({ entities: [entity({ aiDescription: 'The fen and the fennel.' })] });
    const targets = collectSearchTargets(src);
    expect(findMatches(targets, 'fen', LOOSE)).toHaveLength(2);
    expect(findMatches(targets, 'fen', { matchCase: false, wholeWord: true })).toHaveLength(1);
  });

  it('finds every occurrence in one field', () => {
    const { src } = sources({ entities: [entity({ aiDescription: 'fen fen fen' })] });
    expect(findMatches(collectSearchTargets(src), 'fen', LOOSE)).toHaveLength(3);
  });

  it('finds nothing for an empty query', () => {
    const { src } = sources({ entities: [entity({ aiDescription: 'fen' })] });
    expect(findMatches(collectSearchTargets(src), '', LOOSE)).toHaveLength(0);
  });
});

describe('replaceAll', () => {
  it('replaces every occurrence in a field and writes it once', () => {
    const { src, writes } = sources({ entities: [entity({ name: '', aiDescription: 'fen, fen, and fen' })] });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    const summary = replaceAll(matches, () => 'marsh');
    expect(summary).toMatchObject({ replaced: 3, fields: 1, skipped: 0 });
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toMatchObject({ aiDescription: 'marsh, marsh, and marsh' });
  });

  it('leaves a chip token intact when replacing text around it', () => {
    const token = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'place-1' });
    const { src, writes } = sources({ entities: [entity({ name: '', aiDescription: `fen ${token} fen` })] });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    replaceAll(matches, () => 'marsh');
    expect(writes[0][1]).toMatchObject({ aiDescription: `marsh ${token} marsh` });
  });

  it('skips fields that cannot hold a chip and counts them', () => {
    const { src, writes } = sources({
      // `type` is a plain input; `aiDescription` renders chips.
      entities: [entity({ type: 'fen creature', aiDescription: 'born in the fen' })],
    });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    const summary = replaceAll(matches, (t) => (t.chipCapable ? '<chip>' : null));
    expect(summary).toMatchObject({ replaced: 1, fields: 1, skipped: 1 });
    expect(summary.skippedFields).toEqual(['Mira · Type']);
    expect(writes).toEqual([['entity', expect.objectContaining({ aiDescription: 'born in the <chip>' })]]);
  });

  it('asks for a fresh insert per occurrence so chip placements are never shared', () => {
    const { src, writes } = sources({ entities: [entity({ name: '', aiDescription: 'fen and fen' })] });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    let n = 0;
    replaceAll(matches, () => `#${n++}`);
    // One call probes for a skip, so the inserted ids are simply distinct rather than 0 and 1.
    const written = (writes[0][1] as Entity).aiDescription ?? '';
    const inserted = [...written.matchAll(/#(\d+)/g)].map((m) => m[1]);
    expect(inserted).toHaveLength(2);
    expect(new Set(inserted).size).toBe(2);
  });

  it('merges edits to two fields of one item into a single write', () => {
    const { src, writes } = sources({
      entities: [entity({ name: '', playerDescription: 'the fen at dusk', aiDescription: 'born in the fen' })],
    });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    const summary = replaceAll(matches, () => 'marsh');
    expect(summary).toMatchObject({ replaced: 2, fields: 2 });
    // One write, carrying both edits — a write per field would have each undo the other.
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toMatchObject({
      playerDescription: 'the marsh at dusk',
      aiDescription: 'born in the marsh',
    });
  });

  it('merges edits to two elements of one array field', () => {
    const { src, writes } = sources({ entities: [entity({ name: '', aliases: ['fen walker', 'fen singer'] })] });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    replaceAll(matches, () => 'marsh');
    expect(writes).toHaveLength(1);
    expect(writes[0][1]).toMatchObject({ aliases: ['marsh walker', 'marsh singer'] });
  });

  it('spans several collections in one pass', () => {
    const { src, writes } = sources({
      entities: [entity({ name: '', aiDescription: 'the fen' })],
      locations: [{ id: 'l1', name: 'Fen Edge' } as GameLocation],
      traits: [{ id: 't1', name: 'Fen-born', statChanges: [] } as Trait],
    });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    const summary = replaceAll(matches, () => 'marsh');
    expect(summary.fields).toBe(3);
    expect(writes.map(([label]) => label).sort()).toEqual(['entity', 'location', 'trait']);
  });
});

describe('spliceText', () => {
  it('replaces the given range only', () => {
    expect(spliceText('a fen here', 2, 5, 'marsh')).toBe('a marsh here');
  });
});
