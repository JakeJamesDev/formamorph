import { beforeEach, describe, it, expect } from 'vitest';
import { locationTabForField } from '@/views/locationPanelTabs';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { placementLetters } from '@/lib/placementLetters';
import { isOpeningFieldKey, openingFieldKey } from '@/lib/openings';
import { collectSearchTargets, findMatches, refusesBlueprintInsert, replaceAll, spliceText } from '@/lib/worldSearch';
import type { SearchSources, SearchTarget } from '@/lib/worldSearch';
import type { Connection, Dictionary, Entity, GameLocation, Item, Placeholder, Stat, Tool, Trait, WorldOverview } from '@/types';
import { itemTabForField } from '@/views/itemPanelTabs';
import { blankItem } from '@/lib/items';
import { scriptEntryKey, type ScriptEdit } from '@/lib/worldScripts';

import { phValueId, phValues } from '@/test/placeholderValues';
const LOOSE = { matchCase: false, wholeWord: false };

const overview = (over: Partial<WorldOverview> = {}): WorldOverview => ({
  name: '', description: '', author: '', thumbnail: null, bgm: null, systemPrompt: '',
  tags: [], ...over,
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
      entities: [entity({ images: [{ data: 'data:image/webp;base64,AAAA' }] })],
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

  it('reaches each relationship label as a chip field named for its target', () => {
    const ph: Placeholder = { id: 'p1', name: 'Hometown', values: phValues(['Sedge', 'Fen']) };
    const chipName = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'place-1' });
    const { src } = sources({
      placeholders: [ph],
      entities: [
        entity({ relationships: [{ targetId: 'you', label: 'friend' }, { targetId: 'e2', label: 'rival' }, { targetId: 'gone', label: 'ghost' }] }),
        entity({ id: 'e2', name: chipName }),
      ],
    });
    const targets = collectSearchTargets(src);
    expect(targetFor(targets, 'relationships[0].label')).toMatchObject({
      itemId: 'e1', tab: 'entities', fieldLabel: 'Relationship to Persona', value: 'friend', chipCapable: true,
    });
    expect(targetFor(targets, 'relationships[1].label').fieldLabel).toBe('Relationship to {Sedge|Fen}');
    expect(targetFor(targets, 'relationships[2].label').fieldLabel).toBe('Relationship to Unknown Entity');
  });

  it('reaches an entity’s pronouns as a chip field and writes a replace to that entity', () => {
    const { src, writes } = sources({ entities: [entity({ pronouns: 'she/her' })] });
    const target = targetFor(collectSearchTargets(src), 'pronouns');
    expect(target).toMatchObject({ itemId: 'e1', tab: 'entities', fieldLabel: 'Pronouns', chipCapable: true });
    target.write('they/them');
    expect(writes.at(-1)).toEqual(['entity', expect.objectContaining({ id: 'e1', pronouns: 'they/them' })]);
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

  it('labels the overview descriptions by who reads them, as the editor captions them', () => {
    const { src } = sources({
      worldOverview: overview({ description: 'A drowned town.', systemPrompt: 'The tide never turns.' }),
    });
    const targets = collectSearchTargets(src);
    expect(targetFor(targets, 'description'))
      .toMatchObject({ itemLabel: 'World', fieldLabel: 'Player-Facing Description', chipCapable: false });
    expect(targetFor(targets, 'systemPrompt'))
      .toMatchObject({ itemLabel: 'World', fieldLabel: 'AI-Facing Description', chipCapable: true });
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

  it('reaches every opening row, switched on or not', () => {
    const openings = [
      { id: 'o1', text: 'You wake in the reed-beds.', kind: 'action' as const },
      { id: 'o2', text: 'The ferry bell rings twice.', kind: 'action' as const },
    ];
    const { src, writes } = sources({
      worldOverview: overview({ openings, openingWeights: { o2: 3 }, openingsEnabled: false }),
    });
    const targets = collectSearchTargets(src);
    expect(targetFor(targets, openingFieldKey('o1')))
      .toMatchObject({ value: 'You wake in the reed-beds.', fieldLabel: 'Opening 1', chipCapable: true });
    expect(targetFor(targets, openingFieldKey('o2'))).toMatchObject({ value: 'The ferry bell rings twice.' });

    targetFor(targets, openingFieldKey('o2')).write('The ferry bell rings once.');
    // The switch and the weights are the author's; a replace edits one row's text and nothing else.
    expect(writes).toEqual([['overview', expect.objectContaining({
      openings: [openings[0], { ...openings[1], text: 'The ferry bell rings once.' }],
      openingWeights: { o2: 3 },
      openingsEnabled: false,
    })]]);
  });

  it('reaches an entity’s opening rows and writes a replace to that entity', () => {
    const openings = [{ id: 'o1', text: 'Mira waves from the jetty.', kind: 'narration' as const }];
    const { src, writes } = sources({ entities: [entity({ openings, openingWeights: { o1: 2 } })] });
    const target = targetFor(collectSearchTargets(src), openingFieldKey('o1'));
    expect(target).toMatchObject({ itemId: 'e1', tab: 'entities', fieldLabel: 'Opening 1', chipCapable: true });

    target.write('Mira waves from the pier.');
    expect(writes).toEqual([['entity', expect.objectContaining({
      id: 'e1',
      openings: [{ ...openings[0], text: 'Mira waves from the pier.' }],
      openingWeights: { o1: 2 },
    })]]);
  });

  it('offers no target for the default opening', () => {
    expect(collectSearchTargets(sources().src).some((t) => isOpeningFieldKey(t.fieldKey))).toBe(false);
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

  it('matches the Persona Name chip by its label and never inside its token', () => {
    const { src } = sources({ entities: [entity({ name: '', aiDescription: 'Wren greets {{user}}.' })] });
    const targets = collectSearchTargets(src);
    const chips = { placeholders: [], letters: placementLetters([]) };
    expect(chipHits(findMatches(targets, 'persona name', LOOSE, chips))).toEqual(['{{user}}']);
    expect(findMatches(targets, 'user', LOOSE, chips)).toHaveLength(0);
  });

  it('matches a chip by any of its values', () => {
    const { targets, chips } = setup();
    expect(chipHits(findMatches(targets, 'harrow', LOOSE, chips))).toEqual([first, second]);
  });

  it('takes a dot, a space, or a chevron for the separator an owned chip reads with', () => {
    const mood: Placeholder = { id: 'ph-mood', name: 'Mood', values: phValues(['sour']) };
    const chip = encodePlaceholderToken({ id: 'ph-mood', mode: 'world', placementId: 'pl-9' });
    const { src } = sources({ entities: [entity({ name: '', aiDescription: `She is ${chip}.` })] });
    const chips = {
      placeholders: [mood],
      letters: placementLetters([]),
      owners: new Map([['ph-mood', { kind: 'entity' as const, id: 'keeper', name: 'Keeper' }]]),
    };
    const targets = collectSearchTargets(src);
    for (const query of ['keeper.mood', 'keeper mood', 'keeper>mood', 'keeper › mood', 'mood']) {
      expect(chipHits(findMatches(targets, query, LOOSE, chips)), query).toEqual([chip]);
    }
    expect(chipHits(findMatches(targets, 'fen › mood', LOOSE, chips))).toEqual([]);
    // Folding is for the chip's reading only: prose still reads exactly as it is stored.
    expect(findMatches(targets, 'she.is', LOOSE, chips)).toHaveLength(0);
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

describe('Travel Hints', () => {
  const places: GameLocation[] = [{ id: 'quay', name: 'Quay' }, { id: 'garden', name: 'Hill Garden' }];
  const hinted = (connection: Connection) => sources({
    locations: places, connections: [connection], updateConnection: (c) => written.push(c),
  });
  let written: Connection[] = [];
  beforeEach(() => { written = []; });

  it('finds each unlinked leg on the panel of the location it leaves, as a chip field', () => {
    const { src } = hinted({ id: 'c1', a: 'quay', b: 'garden', aToB: { hint: 'up the steps' }, bToA: { hint: 'down the steps' } });
    const hits = findMatches(collectSearchTargets(src), 'steps', LOOSE).map(({ target }) => target);
    expect(hits.map((t) => [t.itemId, t.fieldLabel, t.chipCapable, locationTabForField(t.fieldKey)])).toEqual([
      ['quay', 'Travel Hint to Hill Garden', true, 'presence'],
      ['garden', 'Travel Hint to Quay', true, 'presence'],
    ]);
    hits[1].write('down the stair');
    expect(written).toEqual([{ id: 'c1', a: 'quay', b: 'garden', aToB: { hint: 'up the steps' }, bToA: { hint: 'down the stair' } }]);
  });

  it('finds a linked pair once, and a replace there writes both legs', () => {
    const { src } = hinted({ id: 'c1', a: 'quay', b: 'garden', aToB: { hint: 'by the bridge' }, bToA: { hint: 'by the bridge' } });
    const matches = findMatches(collectSearchTargets(src), 'bridge', LOOSE);
    expect(matches.map((m) => m.target.itemId)).toEqual(['quay']);
    replaceAll(matches, () => 'ferry');
    expect(written.at(-1)).toMatchObject({ aToB: { hint: 'by the ferry' }, bToA: { hint: 'by the ferry' } });
  });
});

describe('Items, Scripts and Tools', () => {
  const ITEM: Item = {
    ...blankItem('i1', 'Brass Key'), playerDescription: 'Opens the bell tower.', aiDescription: 'A key to the bell tower.',
    aiSummary: 'Tower key.', unidentifiedName: 'Odd Key', unidentifiedDescription: 'It hums near bells.',
    imageTags: 'key, brass', scripts: [{ id: 'is1', name: 'Ring On Use', timing: 'used', code: 'stats.Bells += 1;' }],
  };
  const STAT: Stat = {
    id: 's1', name: 'Bells', type: 'number', description: '', min: 0, max: 10, regen: 0, descriptors: [],
    scripts: [
      { id: 'ss1', timing: 'after', code: 'if (stats.Bells > 3) return 0;' },
      { id: 'ss2', name: 'Bell Echo', timing: 'after', code: 'return stats.Bells;' },
    ],
  };
  const TOOL: Tool = {
    id: 't1', name: 'find_bell', description: 'Looks up a bell by its tower.',
    params: [{ name: 'tower', type: 'string', description: 'The bell tower to search.', required: true, options: [] }],
    handler: { kind: 'lookup', source: 'entities', param: 'tower', returns: 'full' }, emptyResult: '', offeredTo: ['narration'],
  };

  /** A world holding text only in an item, a script and a Tool, with writers that record what they were handed. */
  function logicSources() {
    const items: Item[] = [];
    const scriptEdits: ScriptEdit[][] = [];
    const tools: Tool[] = [];
    const { src, writes } = sources({
      items: [ITEM], scripts: [{ id: 'ws1', name: 'Dusk', timing: 'before', code: 'narration.say("dusk");' }],
      stats: [STAT], tools: [TOOL],
      updateItem: (item) => items.push(item),
      writeScripts: (edits) => scriptEdits.push([...edits]),
      updateTool: (tool) => tools.push(tool),
    });
    return { src, writes, items, scriptEdits, tools };
  }

  it('finds text in an item, a script and a Tool, one hit on each tab', () => {
    const { src } = logicSources();
    const at = (query: string) => findMatches(collectSearchTargets(src), query, LOOSE).map(({ target }) => [target.tab, target.itemId]);
    expect(at('hums near')).toEqual([['items', 'i1']]);
    expect(at('Bells > 3')).toEqual([['scripts', scriptEntryKey({ kind: 'stat', statId: 's1' }, 'ss1')]]);
    expect(at('bell tower to search')).toEqual([['tools', 't1']]);
  });

  it('reaches every item field the panel shows, each on the panel tab that holds it', () => {
    const fields = collectSearchTargets(logicSources().src).filter((t) => t.tab === 'items')
      .map((t) => [t.fieldKey, t.fieldLabel, t.chipCapable, itemTabForField(t.fieldKey)]);
    expect(fields).toEqual([
      ['name', 'Name', true, 'profile'],
      ['imageTags', 'Image Tags', false, 'profile'],
      ['playerDescription', 'Player-Facing Description', true, 'descriptions'],
      ['aiDescription', 'AI-Facing Description', true, 'descriptions'],
      ['aiSummary', 'AI-Facing Summary', true, 'descriptions'],
      ['unidentifiedName', 'Unidentified Name', true, 'profile'],
      ['unidentifiedDescription', 'Unidentified Description', true, 'descriptions'],
      ['scripts[0].name', 'Script Name', false, 'scripts'],
      ['scripts[0].code', 'Script Code', false, 'scripts'],
    ]);
  });

  it('reaches each Scripts-tab row by its name and code, world and stat scripts alike', () => {
    const rows = collectSearchTargets(logicSources().src).filter((t) => t.tab === 'scripts')
      .map((t) => [t.itemLabel, t.fieldLabel, t.chipCapable]);
    expect(rows).toEqual([
      ['Dusk', 'Name', false], ['Dusk', 'Code', false],
      ['Bells · After the AI', 'Code', false],
      ['Bell Echo', 'Name', false], ['Bell Echo', 'Code', false],
    ]);
  });

  it('reaches a Tool’s name, description and each parameter description', () => {
    const fields = collectSearchTargets(logicSources().src).filter((t) => t.tab === 'tools')
      .map((t) => [t.itemLabel, t.fieldKey, t.fieldLabel, t.chipCapable]);
    expect(fields).toEqual([
      ['find_bell', 'name', 'Name', false],
      ['find_bell', 'description', 'Description', false],
      ['find_bell', 'params[0].description', 'Parameter tower', false],
    ]);
  });

  describe('item scripts by editor mode', () => {
    const itemHits = (query: string, advanced: boolean) => {
      const { src } = logicSources();
      return findMatches(collectSearchTargets({ ...src, advanced }), query, LOOSE)
        .filter((m) => m.target.tab === 'items').map(({ target }) => [target.itemId, itemTabForField(target.fieldKey)]);
    };
    const scriptCode = ITEM.scripts?.[0]?.code ?? '';

    it('drops a hit found only in an item script in Simple mode', () => {
      expect(scriptCode).not.toBe('');
      expect(itemHits(scriptCode, false)).toEqual([]);
    });

    it('opens the item’s Scripts panel tab for that hit in Advanced mode', () => {
      expect(itemHits(scriptCode, true)).toEqual([['i1', 'scripts']]);
    });

    it('keeps an item’s name and description hits in Simple mode', () => {
      expect(itemHits('hums near', false)).toEqual([['i1', 'descriptions']]);
      expect(itemHits(ITEM.name, false).length).toBeGreaterThan(0);
    });
  });

  it('writes an item replace through its updater, scripts and other fields in one write', () => {
    const { src, items } = logicSources();
    replaceAll(findMatches(collectSearchTargets(src), 'Bell', LOOSE).filter((m) => m.target.tab === 'items'), () => 'Gong');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      playerDescription: 'Opens the Gong tower.',
      unidentifiedDescription: 'It hums near Gongs.',
      scripts: [{ id: 'is1', code: 'stats.Gongs += 1;' }],
    });
  });

  it('merges a replace across a stat’s name and two of its scripts into one write of that stat', () => {
    // Each write replaces the whole stat from the record it was handed, so apart, the last would undo the rest.
    const { src, writes, scriptEdits } = logicSources();
    const matches = findMatches(collectSearchTargets(src), 'Bells', LOOSE).filter((m) => m.target.tab !== 'items');
    expect(matches.map((m) => m.target.tab)).toEqual(['stats', 'scripts', 'scripts']);
    replaceAll(matches, () => 'Gongs');
    expect(scriptEdits).toEqual([]);
    expect(writes).toEqual([['stat', {
      ...STAT, name: 'Gongs',
      scripts: [
        { id: 'ss1', timing: 'after', code: 'if (stats.Gongs > 3) return 0;' },
        { id: 'ss2', name: 'Bell Echo', timing: 'after', code: 'return stats.Gongs;' },
      ],
    }]]);
  });

  it('writes a world trait’s script replace through the trait’s own updater', () => {
    const trait: Trait = { id: 't1', name: 'Bellringer', scripts: [{ id: 'ts1', timing: 'after', code: 'stats.Bells += 1;' }] } as Trait;
    const { src, writes } = sources({ traits: [trait], writeScripts: () => { throw new Error('not through the script writer'); } });
    replaceAll(findMatches(collectSearchTargets(src), 'stats.Bells', LOOSE), () => 'stats.Gongs');
    expect(writes).toEqual([['trait', { ...trait, scripts: [{ id: 'ts1', timing: 'after', code: 'stats.Gongs += 1;' }] }]]);
  });

  it('merges a replace across two world scripts into one script edit', () => {
    const scriptEdits: ScriptEdit[][] = [];
    const world = [
      { id: 'w1', timing: 'before' as const, code: 'narration.say("dusk");' },
      { id: 'w2', timing: 'after' as const, code: 'if (dusk) return 1;' },
    ];
    const { src } = sources({ scripts: world, writeScripts: (edits) => scriptEdits.push([...edits]) });
    replaceAll(findMatches(collectSearchTargets(src), 'dusk', LOOSE), () => 'dawn');
    expect(scriptEdits).toHaveLength(1);
    const [[edit]] = scriptEdits;
    expect(edit.home).toEqual({ kind: 'world' });
    expect(edit.edit(world).map((s) => s.code)).toEqual(['narration.say("dawn");', 'if (dawn) return 1;']);
  });

  it('skips a Tool name replace the Save Tool check refuses, and writes one it accepts', () => {
    const { src, tools } = logicSources();
    const nameHits = () => findMatches(collectSearchTargets(src), 'find_bell', LOOSE).filter((m) => m.target.tab === 'tools');
    // A space is not allowed in a function name the AI calls.
    expect(replaceAll(nameHits(), () => 'find bell')).toMatchObject({ replaced: 0, refused: 1 });
    expect(tools).toEqual([]);
    expect(replaceAll(nameHits(), () => 'find_gong')).toMatchObject({ replaced: 1, refused: 0 });
    expect(tools).toEqual([{ ...TOOL, name: 'find_gong' }]);
  });

  describe('Tool names across one Replace All', () => {
    const twin = (id: string, name: string): Tool => ({ ...TOOL, id, name });
    /** Tools whose writes land in `src.tools`, as the editor's saved list does. */
    function toolWorld(names: string[]) {
      const { src } = sources({ tools: names.map((n, i) => twin(`t${i + 1}`, n)) });
      src.updateTool = (tool) => { src.tools = (src.tools ?? []).map((t) => (t.id === tool.id ? tool : t)); };
      const nameHits = (query: string) =>
        findMatches(collectSearchTargets(src), query, LOOSE).filter((m) => m.target.tab === 'tools' && m.target.fieldKey === 'name');
      return { src, nameHits, names: () => (src.tools ?? []).map((t) => t.name) };
    }

    it('renames one Tool and skips the one that would take the same name', () => {
      const { nameHits, names } = toolWorld(['bell_2', 'bell__2']);
      // The summary counts hits: `bell_2` has one underscore, the skipped `bell__2` has two.
      expect(replaceAll(nameHits('_'), () => '')).toMatchObject({ replaced: 1, refused: 2 });
      expect(names()).toEqual(['bell2', 'bell__2']);
    });

    it('renames every Tool when the new names stay distinct', () => {
      const { nameHits, names } = toolWorld(['bell_a', 'bell_b']);
      expect(replaceAll(nameHits('bell'), () => 'gong')).toMatchObject({ replaced: 2, refused: 0 });
      expect(names()).toEqual(['gong_a', 'gong_b']);
    });

    it('reads the saved names in a later pass, not the last pass’s', () => {
      const { nameHits, names } = toolWorld(['bell_2', 'bell__2']);
      replaceAll(nameHits('_'), () => '');
      expect(replaceAll(nameHits('bell__2'), () => 'bell2')).toMatchObject({ replaced: 0, refused: 1 });
      expect(replaceAll(nameHits('bell__2'), () => 'bell3')).toMatchObject({ replaced: 1, refused: 0 });
      expect(names()).toEqual(['bell2', 'bell3']);
    });
  });

  it('writes a Tool replace through its updater, parameters included', () => {
    const { src, tools } = logicSources();
    replaceAll(findMatches(collectSearchTargets(src), 'tower', LOOSE).filter((m) => m.target.tab === 'tools'), () => 'spire');
    expect(tools).toEqual([{
      ...TOOL, description: 'Looks up a bell by its spire.',
      params: [{ ...TOOL.params[0], description: 'The bell spire to search.' }],
    }]);
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

  it('replaces inside a relationship label and keeps its chip and the other rows', () => {
    const token = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'place-1' });
    const relationships = [{ targetId: 'you', label: 'old friend' }, { targetId: 'e2', label: `old ${token} rival` }];
    const { src, writes } = sources({ entities: [entity({ relationships }), entity({ id: 'e2', name: 'Bram' })] });
    const matches = findMatches(collectSearchTargets(src), 'old', LOOSE).filter((m) => m.target.fieldKey === 'relationships[1].label');
    replaceAll(matches, () => 'new');
    expect(writes[0][1]).toMatchObject({ relationships: [relationships[0], { targetId: 'e2', label: `new ${token} rival` }] });
  });

  it('leaves a chip token intact when replacing text around it', () => {
    const token = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'place-1' });
    const { src, writes } = sources({ entities: [entity({ name: '', aiDescription: `fen ${token} fen` })] });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    replaceAll(matches, () => 'marsh');
    expect(writes[0][1]).toMatchObject({ aiDescription: `marsh ${token} marsh` });
  });

  it('replaces inside a custom prompt with a chip, and keeps the chips it already holds', () => {
    const token = encodePlaceholderToken({ id: 'p1', mode: 'world', placementId: 'place-1' });
    const { src, writes } = sources({
      worldOverview: overview({ promptOverrides: { systemPrompt: `Narrate the fen. ${token} <NOTES>` } }),
    });
    const matches = findMatches(collectSearchTargets(src), 'fen', LOOSE);
    const summary = replaceAll(matches, (t) => (t.chipCapable ? '<chip>' : null));
    expect(summary).toMatchObject({ replaced: 1, fields: 1, skipped: 0 });
    expect(writes).toEqual([['overview', expect.objectContaining({
      promptOverrides: { systemPrompt: `Narrate the <chip>. ${token} <NOTES>` },
    })]]);
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

describe('replaceAll — blueprint chips', () => {
  const blueprints = new Set(['garb']);
  const garbChip = encodePlaceholderToken({ id: 'garb', mode: 'world', placementId: 'place-g' });
  const townChip = encodePlaceholderToken({ id: 'town', mode: 'world', placementId: 'place-t' });
  const world = () => sources({
    traits: [{ id: 't1', name: 'Paladin', aiDescription: 'sworn in the fen', statChanges: [] } as Trait],
    traitGroups: [{ id: 'g1', name: 'Oaths', aiDescription: 'of the fen', parentId: null }],
    locations: [{ id: 'l1', name: 'Landing', aiDescription: 'a fen shore' } as GameLocation],
  });
  const insert = (text: string) => (target: SearchTarget) => (refusesBlueprintInsert(target, text, blueprints) ? null : text);

  it('puts a blueprint chip only into world trait and group text, and skips the rest', () => {
    const { src, writes } = world();
    const summary = replaceAll(findMatches(collectSearchTargets(src), 'fen', LOOSE), insert(garbChip));
    expect(summary).toMatchObject({ replaced: 2, skipped: 1, skippedFields: ['Landing · AI-Facing Description'] });
    expect(writes.map(([label]) => label).sort()).toEqual(['trait', 'traitGroup']);
  });

  it('takes a blueprint chip in a blueprint’s values and refuses it in a world placeholder’s', () => {
    const { src, writes } = sources({
      placeholders: [
        { id: 'garb', name: 'Garb', groupId: 'bp', values: [{ id: 'v1', text: 'fen cloak' }] },
        { id: 'town', name: 'Town', values: [{ id: 'v2', text: 'fen town' }] },
      ],
      placeholderGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
    });
    const summary = replaceAll(findMatches(collectSearchTargets(src), 'fen', LOOSE), insert(garbChip));
    expect(summary).toMatchObject({ replaced: 1, skipped: 1, skippedFields: ['Town · Values'] });
    expect(writes).toHaveLength(1);
  });

  it('puts any other chip everywhere a chip goes', () => {
    const { src } = world();
    expect(replaceAll(findMatches(collectSearchTargets(src), 'fen', LOOSE), insert(townChip))).toMatchObject({ replaced: 3, skipped: 0 });
  });
});
