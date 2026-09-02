import { describe, it, expect } from 'vitest';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { placementLetters } from '@/lib/placementLetters';
import { collectSearchTargets, findMatches, replaceAll, spliceText } from '@/lib/worldSearch';
import type { SearchSources, SearchTarget } from '@/lib/worldSearch';
import type { Dictionary, Entity, GameLocation, Placeholder, Stat, Trait, WorldOverview } from '@/types';

import { phValueId, phValues } from '@/test/placeholderValues';
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
  it('scans a world whose collections are simply absent without throwing', () => {
    // Hand-edited or third-party world JSON can omit an array the types call required, and the scan runs in
    // the editor's render — so a missing slice has to be nothing to search rather than a blank editor.
    const { src } = sources();
    const updatersOnly = Object.fromEntries(
      Object.entries(src).filter(([, value]) => typeof value === 'function'),
    ) as SearchSources;
    expect(collectSearchTargets(updatersOnly)).toEqual([]);
  });

  it('keeps scanning a placeholder that carries no values array at all', () => {
    // Same reason as the slice above: hand-edited world JSON can omit it, and the scan runs in the render.
    const { src } = sources({ placeholders: [{ id: 'p1', name: 'Season' } as Placeholder] });
    expect(collectSearchTargets(src).map((t) => t.fieldKey)).toEqual(['name']);
  });

  it('keeps scanning the books that have entries when one book has none', () => {
    const { src } = sources({
      dictionaries: [
        { id: 'b0', name: 'Empty Book' } as Dictionary,
        {
          id: 'b1', name: 'Herbs',
          entries: [{ id: 'd1', name: 'Sedge', key: ['sedge'], value: 'A reed.' }],
        } as Dictionary,
      ],
    });
    const labels = collectSearchTargets(src).map((t) => t.itemLabel);
    expect(labels).toContain('Empty Book');
    expect(labels).toContain('Sedge');
  });

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

  it('lets a stat description and each descriptor take a chip', () => {
    const { src } = sources({
      stats: [{
        id: 's1', name: 'Vigor', type: 'number', description: 'Stamina', min: 0, max: 100, regen: 0,
        descriptors: [{ id: 'b1', threshold: 30, description: 'Winded' }],
      } as Stat],
    });
    const targets = collectSearchTargets(src);
    expect(targetFor(targets, 'description')).toMatchObject({ value: 'Stamina', chipCapable: true });
    expect(targetFor(targets, 'descriptors[0].description')).toMatchObject({ value: 'Winded', chipCapable: true });
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

  it('reaches every stored custom prompt, and only the stored ones', () => {
    const { src, writes } = sources({
      worldOverview: overview({
        promptOverrides: {
          systemPrompt: 'You narrate the tide.',
          choicesPrompt: 'You offer choices.',
          // Switched off but still authored — the author can still search their own text.
          statUpdatesPrompt: 'You count the cost.', statUpdatesPromptEnabled: false,
        },
      }),
    });
    const targets = collectSearchTargets(src);
    expect(targetFor(targets, 'promptOverrides.systemPrompt').value).toBe('You narrate the tide.');
    expect(targetFor(targets, 'promptOverrides.choicesPrompt').fieldLabel).toBe('Custom Prompt (Choices)');
    expect(targetFor(targets, 'promptOverrides.statUpdatesPrompt').value).toBe('You count the cost.');

    targetFor(targets, 'promptOverrides.choicesPrompt').write('You offer colder choices.');
    // A write must land on its own key and leave the sibling prompts alone.
    expect(writes).toEqual([['overview', expect.objectContaining({
      promptOverrides: expect.objectContaining({
        systemPrompt: 'You narrate the tide.',
        choicesPrompt: 'You offer colder choices.',
        statUpdatesPrompt: 'You count the cost.',
        statUpdatesPromptEnabled: false,
      }),
    })]]);
  });

  it('reaches a stored opening cue, switched on or not', () => {
    const { src, writes } = sources({
      worldOverview: overview({ openingCue: 'You wake in the reed-beds.', openingCueEnabled: false }),
    });
    const targets = collectSearchTargets(src);
    expect(targetFor(targets, 'openingCue'))
      .toMatchObject({ value: 'You wake in the reed-beds.', fieldLabel: 'Opening Cue', chipCapable: true });

    targetFor(targets, 'openingCue').write('You wake in the reed-beds, already wet.');
    // The switch is the author's; a replace edits their text and leaves it where they set it.
    expect(writes).toEqual([['overview', expect.objectContaining({
      openingCue: 'You wake in the reed-beds, already wet.', openingCueEnabled: false,
    })]]);
  });

  it('offers no target for an opening cue still tracking the default', () => {
    expect(collectSearchTargets(sources().src).map((t) => t.fieldKey)).not.toContain('openingCue');
  });

  it('offers no target for a prompt tab still tracking the preset', () => {
    // Nothing is stored, so there is no world text to find — and a replace would freeze a prompt the
    // author never wrote.
    const keys = collectSearchTargets(sources().src).map((t) => t.fieldKey);
    expect(keys).not.toContain('promptOverrides.systemPrompt');
    expect(keys).not.toContain('promptOverrides.choicesPrompt');
    expect(keys).not.toContain('promptOverrides.statUpdatesPrompt');
  });

  it('keeps a value’s id when it rewrites the text, so the weight stays put with nothing carried', () => {
    const ph: Placeholder = {
      id: 'p1',
      name: 'Season',
      values: phValues(['spring', 'winter']),
      weights: { [phValueId('spring')]: 3, [phValueId('winter')]: 1 },
    };
    const { src, writes } = sources({ placeholders: [ph] });
    targetFor(collectSearchTargets(src), 'values[0]').write('summer');
    // The value keeps its id, so the weight follows it and nothing is carried across the edit.
    expect(writes[0][1]).toMatchObject({
      values: [{ id: phValueId('spring'), text: 'summer' }, { id: phValueId('winter'), text: 'winter' }],
      weights: { [phValueId('spring')]: 3, [phValueId('winter')]: 1 },
    });
  });

  it('names a retyped pin’s value by id when the list carries it, and drops the id when it does not', () => {
    const ph: Placeholder = { id: 'hair', name: 'Hair', values: phValues(['Red', 'Crimson']) };
    const pinned = {
      id: 't1', name: 'Ember', statChanges: [],
      placeholderPins: [{ placeholderId: 'hair', value: 'Red', valueId: phValueId('Red') }],
    } as unknown as Trait;
    const onList = sources({ placeholders: [ph], traits: [pinned] });
    targetFor(collectSearchTargets(onList.src), 'placeholderPins[0].value').write('Crimson');
    expect(onList.writes[0][1]).toMatchObject({
      placeholderPins: [{ placeholderId: 'hair', value: 'Crimson', valueId: phValueId('Crimson') }],
    });
    const offList = sources({ placeholders: [ph], traits: [pinned] });
    targetFor(collectSearchTargets(offList.src), 'placeholderPins[0].value').write('Ash-Gray');
    // Strict, so a stale id left behind on the pin fails rather than reading as absent.
    expect((offList.writes[0][1] as Trait).placeholderPins)
      .toStrictEqual([{ placeholderId: 'hair', value: 'Ash-Gray' }]);
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

describe('findMatches — chips', () => {
  const town: Placeholder = { id: 'ph-town', name: 'Town Name', values: phValues(['Sedge Landing', 'Harrow']) };
  const unique = (placementId: string, label?: string) =>
    encodePlaceholderToken({ id: 'ph-town', mode: 'unique', placementId, ...(label ? { label } : {}) });
  const first = unique('pl-1');
  const second = unique('pl-2', 'Hometown');
  const stored = `The ${second} inn`;
  const setup = () => {
    const { src } = sources({
      entities: [entity({ name: first, aiDescription: stored })],
      placeholders: [town],
    });
    const targets = collectSearchTargets(src);
    const chips = { placeholders: [town], letters: placementLetters([first, stored]) };
    return { targets, chips };
  };

  // The placeholder's own name and values are text targets of their own, so only the chip hits are counted.
  const chipHits = (matches: ReturnType<typeof findMatches>) => matches.filter((m) => m.chip).map((m) => m.chip);

  it('names a chip-named item in the results line by its placement label, never by its token', () => {
    const { targets } = setup();
    expect(targets.find((t) => t.fieldKey === 'name')?.itemLabel).toBe('Town Name (A)');
  });

  it('matches a chip by its placeholder name, its letter label and its author label', () => {
    const { targets, chips } = setup();
    expect(chipHits(findMatches(targets, 'town name', LOOSE, chips))).toEqual([first, second]);
    expect(chipHits(findMatches(targets, '(A)', LOOSE, chips))).toEqual([first]);
    expect(chipHits(findMatches(targets, 'hometown', LOOSE, chips))).toEqual([second]);
  });

  it('matches a chip by any of its values', () => {
    const { targets, chips } = setup();
    expect(chipHits(findMatches(targets, 'harrow', LOOSE, chips))).toEqual([first, second]);
  });

  it('spans the whole token and interleaves with text hits by position', () => {
    const { targets, chips } = setup();
    const hits = findMatches(targets, 'n', LOOSE, chips).filter((m) => m.target.value === stored);
    // "The " has no n; the chip comes next, then the "n" in "inn".
    expect(hits.map((m) => m.chip ?? stored.slice(m.start, m.end))).toEqual([second, 'n', 'n']);
    const chipHit = hits[0];
    expect(stored.slice(chipHit.start, chipHit.end)).toBe(second);
  });

  it('still never reads a token as text, and reads no chip at all without the chip context', () => {
    const { targets, chips } = setup();
    expect(findMatches(targets, 'ph-town', LOOSE, chips)).toHaveLength(0);
    expect(chipHits(findMatches(targets, 'town name', LOOSE))).toEqual([]);
  });

  it('honors whole word against a chip reading', () => {
    const { targets, chips } = setup();
    expect(chipHits(findMatches(targets, 'harr', { matchCase: false, wholeWord: true }, chips))).toEqual([]);
    expect(chipHits(findMatches(targets, 'harrow', { matchCase: false, wholeWord: true }, chips))).toEqual([first, second]);
  });

  it('answers to a label even when the placeholder is gone', () => {
    const { src } = sources({ entities: [entity({ name: second })] });
    const chips = { placeholders: [], letters: placementLetters([]) };
    expect(findMatches(collectSearchTargets(src), 'hometown', LOOSE, chips)).toHaveLength(1);
  });

  it('is left alone by replaceAll, and counted', () => {
    const { targets, chips } = setup();
    const matches = findMatches(targets, 'n', LOOSE, chips).filter((m) => m.target.value === stored);
    const summary = replaceAll(matches, () => 'N');
    expect(summary.chips).toBe(1);
    expect(summary.replaced).toBe(2);
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
