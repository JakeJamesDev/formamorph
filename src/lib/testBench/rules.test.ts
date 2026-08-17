import { describe, it, expect } from 'vitest';
import type { Dictionary, DictionaryEntry, Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';
import { estimateTokens } from '@/lib/memoryUtils';
import {
  applyRuleFix, runRules, groupFindings, isAdvancedRule, isRuleFixable, selectMatchingFindings,
  MATCHING_RULES, RULES, STAT_CODE_EXECUTION, type RuleWorld,
} from './rules';

/** A described entity at the starting location — what keeps the completeness rules quiet about a fixture
 *  that is about something else entirely. */
const resident: Entity = {
  id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.',
  aiDescription: 'Keeps the harbor lamps lit.', locations: ['harbor'],
};

// A structurally sound base world — a flagged starting location, a readme, and one resident keeping the
// harbor occupied — so each pack's tests see only the defects they author in, and a clean fixture really
// does raise zero findings.
const base = (overrides: Partial<RuleWorld> = {}): RuleWorld => ({
  worldOverview: {
    name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.', readme: 'A fen primer.',
  } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [resident],
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
  ...overrides,
});

// The alias tests' shorthand: the roster, placed at the starting location and described so presence and
// completeness rules stay quiet; a test overrides exactly the fields its defect is about.
const world = (entities: Entity[]): RuleWorld =>
  base({
    entities: entities.map((e) => ({
      locations: ['harbor'], playerDescription: 'Seen around.', aiDescription: 'A fen regular.', ...e,
    })),
  });

const stat = (overrides: Partial<Stat> & { id: string; name: string }): Stat => ({
  type: 'number', description: '', min: 0, max: 100, regen: 0, descriptors: [], ...overrides,
});

const trait = (overrides: Partial<Trait> & { id: string; name: string }): Trait =>
  ({ statChanges: [], ...overrides });

const entry = (overrides: Partial<DictionaryEntry> & { id: string; name: string }): DictionaryEntry =>
  ({ key: [], value: 'Some lore.', ...overrides });

const book = (entries: DictionaryEntry[]): Dictionary => ({ id: 'b1', name: 'Book', entries });

const only = (w: RuleWorld, ruleId: string) => runRules(w).filter((f) => f.ruleId === ruleId);

// Every defect the alias-hygiene pack was written for, in one roster: three articled aliases, a
// plural-tolerant collision between two of them, and an alias repeating its own entity's name.
const defective: Entity[] = [
  { id: 'e1', name: 'Maren', aliases: ['the visitor', 'Maren'] },
  { id: 'e2', name: 'Old Tobb', aliases: ['the fishmonger'] },
  { id: 'e3', name: 'Harbor Cats', aliases: ['the visitors'] },
];

// The same roster with each defect actually repaired — articles stripped, the collision renamed away,
// the self-duplicate dropped.
const corrected: Entity[] = [
  { id: 'e1', name: 'Maren', aliases: ['visitor'] },
  { id: 'e2', name: 'Old Tobb', aliases: ['fishmonger'] },
  { id: 'e3', name: 'Harbor Cats', aliases: ['strays'] },
];

const ofRule = (entities: Entity[], ruleId: string) =>
  runRules(world(entities)).filter((f) => f.ruleId === ruleId);

describe('alias hygiene rules', () => {
  it('flags every alias that begins with an article', () => {
    const found = ofRule(defective, 'alias-leading-article');
    expect(found.map((f) => f.items.map((i) => i.id))).toEqual([['e1'], ['e2'], ['e3']]);
    expect(found[0].message).toContain('the visitor');
    expect(found[0].severity).toBe('warning');
  });

  it('leaves an alias alone when the article is part of a word', () => {
    // "Theodora" starts with the letters of "the" but is not an articled phrase.
    expect(ofRule([{ id: 'e1', name: 'Maren', aliases: ['Theodora', 'Anvil'] }], 'alias-leading-article')).toEqual([]);
  });

  it('flags two entities whose written forms match the same text, plurals included', () => {
    const found = ofRule(defective, 'entity-match-collision');
    expect(found).toHaveLength(1);
    // "the visitor" and "the visitors" are one text to the matcher, so a mention of either detects both.
    expect(found[0].items.map((i) => i.id)).toEqual(['e1', 'e3']);
    expect(found[0].message).toContain('Maren');
    expect(found[0].message).toContain('Harbor Cats');
  });

  it('does not say “either … both” when three entities share the text', () => {
    const [found] = ofRule([
      { id: 'e1', name: 'Gull' },
      { id: 'e2', name: 'Harbor Cats', aliases: ['gulls'] },
      { id: 'e3', name: 'Maren', aliases: ['Gull'] },
    ], 'entity-match-collision');
    expect(found.items).toHaveLength(3);
    expect(found.message).toContain('any one detects them all');
  });

  it('does not read an entity as colliding with itself', () => {
    // Name and alias share a key here; that is the self-duplicate rule's business, not a collision.
    expect(ofRule([{ id: 'e1', name: 'Maren', aliases: ['Maren'] }], 'entity-match-collision')).toEqual([]);
  });

  it('flags an alias that repeats its own entity name', () => {
    const found = ofRule(defective, 'alias-self-duplicate');
    expect(found).toHaveLength(1);
    expect(found[0].items.map((i) => i.id)).toEqual(['e1']);
    expect(found[0].severity).toBe('info');
  });

  it('counts a plural of the entity name as a repeat', () => {
    expect(ofRule([{ id: 'e1', name: 'Harbor Cats', aliases: ['Harbor Cat'] }], 'alias-self-duplicate')).toHaveLength(1);
  });

  it('says nothing about a world whose aliases are clean', () => {
    expect(runRules(world(corrected))).toEqual([]);
  });

  it('says nothing about entities with no aliases, or blank ones', () => {
    expect(runRules(world([
      { id: 'e1', name: 'Maren' },
      { id: 'e2', name: 'Old Tobb', aliases: ['', '   '] },
    ]))).toEqual([]);
  });

  it('reads placeholder chips as the text they stand for', () => {
    // A name written as a chip has to be compared as its resolved value, or an authored collision hides.
    const chip = '{{ph:p1:world:Visitor}}';
    const findings = runRules({
      ...world([
        { id: 'e1', name: chip },
        { id: 'e2', name: 'Maren', aliases: ['Maren'] },
      ]),
      placeholders: [{ id: 'p1', name: 'Visitor', values: ['Maren'] }],
    });
    const collision = findings.filter((f) => f.ruleId === 'entity-match-collision');
    expect(collision).toHaveLength(1);
    expect(collision[0].items.map((i) => i.name)).toEqual(['Maren', 'Maren']);
  });
});

describe('grouping findings for the Issues list', () => {
  it('collapses same-rule findings into one row naming every item', () => {
    const groups = groupFindings(runRules(world(defective)));
    const articles = groups.find((g) => g.ruleId === 'alias-leading-article')!;
    expect(articles.findings).toHaveLength(3);
    expect(articles.items.map((i) => i.name)).toEqual(['Maren', 'Old Tobb', 'Harbor Cats']);
    // Three findings read as one problem, so the row's headline counts rather than naming one alias.
    expect(articles.headline).toContain('3');
  });

  it('keeps a lone finding’s own wording as the headline', () => {
    const groups = groupFindings(runRules(world([
      { id: 'e1', name: 'Maren', aliases: ['the visitor'] },
    ])));
    expect(groups).toHaveLength(1);
    expect(groups[0].headline).toContain('the visitor');
  });

  it('orders groups errors first, then warnings, then info', () => {
    const groups = groupFindings(runRules(world(defective)));
    expect(groups.map((g) => g.severity)).toEqual(['warning', 'warning', 'info']);
  });

  it('counts collisions in the row rather than naming one of them', () => {
    const groups = groupFindings(runRules(world([
      { id: 'e1', name: 'Maren', aliases: ['Tobb'] },
      { id: 'e2', name: 'Old Tobb', aliases: ['Tobb'] },
      { id: 'e3', name: 'Harbor Cats', aliases: ['Gull'] },
      { id: 'e4', name: 'Gulls' },
    ])));
    const collisions = groups.find((g) => g.ruleId === 'entity-match-collision')!;
    expect(collisions.findings).toHaveLength(2);
    expect(collisions.headline).toContain('2 written forms');
  });

  it('names each item once even when several findings share it', () => {
    const groups = groupFindings(runRules(world([
      { id: 'e1', name: 'Maren', aliases: ['the visitor', 'the stranger'] },
    ])));
    expect(groups[0].findings).toHaveLength(2);
    expect(groups[0].items).toHaveLength(1);
  });
});

describe('reference-integrity rules', () => {
  it('flags an entity placed at a location that no longer exists', () => {
    const found = only(base({ entities: [{ id: 'e1', name: 'Maren', locations: ['gone'] }] }), 'entity-location-orphan');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].items.map((i) => i.id)).toEqual(['e1']);
  });

  it('is silent once the entity is placed at a real location', () => {
    expect(runRules(world([{ id: 'e1', name: 'Maren' }]))).toEqual([]);
  });

  it('flags a trait toggling a stat that doesn’t exist, and quiets when it points at a real one', () => {
    const toggled = (statId: string) => base({
      stats: [stat({ id: 's1', name: 'Mana' })],
      traits: [trait({ id: 't1', name: 'Blessed', statToggles: [{ statId, enabled: true }] })],
    });
    const found = only(toggled('gone'), 'trait-toggle-missing-stat');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].items.map((i) => i.id)).toEqual(['t1']);
    expect(runRules(toggled('s1'))).toEqual([]);
  });

  it('flags a pin to a placeholder that doesn’t exist', () => {
    const found = only(base({
      placeholders: [{ id: 'p1', name: 'Hue', values: ['red', 'blue'] }],
      traits: [trait({ id: 't1', name: 'Dyed', placeholderPins: [{ placeholderId: 'gone', value: 'red' }] })],
    }), 'trait-pin-invalid');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('doesn’t exist');
  });

  it('flags a pin to a value the placeholder doesn’t offer, and accepts one it does', () => {
    const pinned = (value: string) => base({
      placeholders: [{ id: 'p1', name: 'Hue', values: ['red', 'blue'] }],
      traits: [trait({ id: 't1', name: 'Dyed', placeholderPins: [{ placeholderId: 'p1', value }] })],
    });
    const found = only(pinned('green'), 'trait-pin-invalid');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('green');
    expect(runRules(pinned('red'))).toEqual([]);
  });

  it('flags a chip pointing at a placeholder that doesn’t exist, opening on the owner’s own tab', () => {
    const chipped = (id: string) => ({
      ...world([{ id: 'e1', name: 'Maren', aiDescription: `A {{ph:${id}:world:pl1}} of the fen.` }]),
      placeholders: [{ id: 'p1', name: 'Visitor', values: ['Maren'] }],
    });
    const found = only(chipped('gone'), 'chip-unknown-placeholder');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    // The rule lives on the Placeholders tab, but this finding's item is an entity — Open lands there.
    expect(found[0].section).toBe('placeholders');
    expect(found[0].items[0]).toMatchObject({ id: 'e1', section: 'entities' });
    expect(runRules(chipped('p1'))).toEqual([]);
  });

  it('collapses two broken pins into one counted row', () => {
    const groups = groupFindings(runRules(base({
      traits: [
        trait({ id: 't1', name: 'Dyed', placeholderPins: [{ placeholderId: 'gone', value: 'red' }] }),
        trait({ id: 't2', name: 'Woven', placeholderPins: [{ placeholderId: 'lost', value: 'blue' }] }),
      ],
    })));
    const pins = groups.find((g) => g.ruleId === 'trait-pin-invalid')!;
    expect(pins.headline).toContain('2 trait placeholder pins');
    expect(pins.items.map((i) => i.id)).toEqual(['t1', 't2']);
  });

  it('finds a broken chip in a trait group name', () => {
    const found = only(base({
      traitGroups: [{ id: 'g1', name: 'Callings {{ph:gone:world:pl1}}', parentId: null }],
    }), 'chip-unknown-placeholder');
    expect(found).toHaveLength(1);
    expect(found[0].items[0]).toMatchObject({ id: 'g1', section: 'traits' });
  });

  it('reports a broken chip in the overview as the overview', () => {
    const found = only(base({
      worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'You are {{ph:gone:world:pl1}}.' } as WorldOverview,
    }), 'chip-unknown-placeholder');
    expect(found).toHaveLength(1);
    expect(found[0].items[0]).toMatchObject({ id: 'overview', section: 'overview' });
  });

  it('flags a chip in a stat description even when its placeholder exists — nothing resolves it there', () => {
    const described = (description: string) => ({
      // The placeholder earns its place in a field that does resolve, so removing the stat's chip leaves a
      // world with nothing else wrong with it.
      ...world([{ id: 'e1', name: 'Maren', aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }]),
      placeholders: [{ id: 'p1', name: 'Vice', values: ['ale'] }],
      stats: [stat({ id: 's1', name: 'Vigor', description })],
    });
    const found = only(described('Craving for {{ph:p1:world:pl1}}.'), 'chip-never-scanned');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].items.map((i) => i.id)).toEqual(['s1']);
    expect(runRules(described('Craving for ale.'))).toEqual([]);
  });

  it('flags a chip in a stat descriptor', () => {
    const described = (description: string) => ({
      ...world([{ id: 'e1', name: 'Maren', aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }]),
      placeholders: [{ id: 'p1', name: 'Vice', values: ['ale'] }],
      // Threshold at Max so this fixture is banding-clean — the defect under test is the chip alone.
      stats: [stat({ id: 's1', name: 'Vigor', descriptors: [{ id: 1, threshold: 100, description }] })],
    });
    const found = only(described('Weak from {{ph:p1:world:pl1}}.'), 'chip-never-scanned');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('descriptors');
    expect(runRules(described('Weak from ale.'))).toEqual([]);
  });

  it('flags stat code looking up a stat name that doesn’t exist, in either comparison direction', () => {
    const coded = (code: string) => base({
      stats: [
        stat({ id: 's1', name: 'Mana', code }),
        stat({ id: 's2', name: 'Vigor' }),
      ],
    });
    const typo = coded('const a = stats.find(s => s.name === "Manna")?.value ?? 0;\nreturn a;');
    const found = only(typo, 'stat-code-unknown-stat');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('Manna');
    expect(found[0].items.map((i) => i.id)).toEqual(['s1']);

    const reversed = only(coded('const v = stats.filter(s => "Vigour" == s.name);\nreturn v.length;'), 'stat-code-unknown-stat');
    expect(reversed).toHaveLength(1);
    expect(reversed[0].message).toContain('Vigour');

    const chained = only(coded('const v = stats.filter(s => "Vigour" === s?.name);\nreturn v.length;'), 'stat-code-unknown-stat');
    expect(chained).toHaveLength(1);

    // Scoped to this rule: the fixture's code reads no clock variable, which is the stat-sanity pack's business.
    expect(only(coded('const a = stats.find(s => s.name === "Vigor")?.value ?? 0;\nreturn a;'), 'stat-code-unknown-stat')).toEqual([]);
  });

  it('leaves dynamic name lookups alone — there is no literal to check', () => {
    const w = base({
      stats: [stat({ id: 's1', name: 'Mana', code: 'const n = "Ma";\nconst a = stats.find(s => s.name === `${n}na`);\nreturn a?.value ?? 0;' })],
    });
    expect(only(w, 'stat-code-unknown-stat')).toEqual([]);
  });
});

describe('dictionary rules', () => {
  it('flags an entry with no keywords that isn’t constant, and quiets once either is supplied', () => {
    const found = only(base({ dictionaries: [book([entry({ id: 'd1', name: 'Herbs' })])] }), 'dictionary-entry-inert');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].items.map((i) => i.id)).toEqual(['d1']);
    expect(runRules(base({ dictionaries: [book([entry({ id: 'd1', name: 'Herbs', constant: true })])] }))).toEqual([]);
    expect(runRules(base({ dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['herb'] })])] }))).toEqual([]);
  });

  it('flags secondary keywords with no primary ones as their own sharper problem', () => {
    const w = base({ dictionaries: [book([entry({ id: 'd1', name: 'Herbs', secondaryKeys: ['fen'] })])] });
    const found = only(w, 'dictionary-secondary-without-primary');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    // The sharper diagnosis owns this entry; the bare no-keywords rule stays out of it.
    expect(only(w, 'dictionary-entry-inert')).toEqual([]);
    expect(runRules(base({
      dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['herb'], secondaryKeys: ['fen'] })])],
    }))).toEqual([]);
  });

  it('flags a regex keyword that doesn’t compile, primary or secondary, only under useRegex', () => {
    const broken = base({ dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['(unclosed'], useRegex: true })])] });
    const found = only(broken, 'dictionary-regex-invalid');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('(unclosed');

    const secondary = base({
      dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['herb'], secondaryKeys: ['('], useRegex: true })])],
    });
    expect(only(secondary, 'dictionary-regex-invalid')).toHaveLength(1);

    // Without useRegex the same text is a literal substring, and a valid pattern is fine.
    expect(runRules(base({ dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['(unclosed'] })])] }))).toEqual([]);
    expect(runRules(base({
      dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['herb(s)?'], useRegex: true })])],
    }))).toEqual([]);
  });
});

describe('reachability rules', () => {
  it('flags a world where no location is a starting location, with the Locations tab as the way in', () => {
    const found = only(base({ locations: [{ id: 'harbor', name: 'Fen' }] }), 'no-starting-location');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].section).toBe('locations');
    expect(runRules(base({ locations: [{ id: 'harbor', name: 'Fen', isStarting: true }] }))).toEqual([]);
  });

  it('flags the legacy isStartLocation field, which the game no longer reads', () => {
    const withLegacy = base({
      locations: [{ id: 'harbor', name: 'Fen', isStartLocation: true } as GameLocation],
    });
    const found = only(withLegacy, 'legacy-start-location');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].items.map((i) => i.id)).toEqual(['harbor']);
    expect(found[0].message).toContain('flag it as a starting location instead');
    expect(runRules(base({ locations: [{ id: 'harbor', name: 'Fen', isStarting: true }] }))).toEqual([]);
  });

  it('only advises deleting the field once a live flag already carries the start intent', () => {
    // The checkbox is checked and the warning still shows — right, the dead key still ships in every
    // export — but "flag it as a starting location instead" would be telling the author to do a done thing.
    const found = only(base({
      locations: [{ id: 'harbor', name: 'Fen', isStarting: true, isStartLocation: true } as GameLocation],
    }), 'legacy-start-location');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('delete the field');
    expect(found[0].message).not.toContain('starting location instead');
  });

  it('fires on a false-valued legacy field too, but only advises deleting it', () => {
    // Presence is the defect — a dead key lingering — but a false value carries no start intent.
    const found = only(base({
      locations: [{ id: 'l1', name: 'Fen', isStarting: true, isStartLocation: false } as GameLocation],
    }), 'legacy-start-location');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('delete the field');
    expect(found[0].message).not.toContain('starting location instead');
  });

  it('flags an entity placed in no location, and quiets once it is placed', () => {
    const found = only(base({ entities: [{ id: 'e1', name: 'Farm Visitors' }] }), 'entity-nowhere');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].items.map((i) => i.id)).toEqual(['e1']);
    expect(runRules(world([{ id: 'e1', name: 'Farm Visitors' }]))).toEqual([]);
  });

  it('flags a disabled stat no trait ever enables, and quiets when one does', () => {
    const disabled = (toggles: Trait[]) => base({
      stats: [stat({ id: 's1', name: 'Corruption', enabled: false })],
      traits: toggles,
    });
    const found = only(disabled([]), 'stat-disabled-forever');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');

    // A toggle that switches it OFF is not an enable.
    const offOnly = disabled([trait({ id: 't1', name: 'Pure', statToggles: [{ statId: 's1', enabled: false }] })]);
    expect(only(offOnly, 'stat-disabled-forever')).toHaveLength(1);

    expect(runRules(disabled([trait({ id: 't1', name: 'Cursed', statToggles: [{ statId: 's1', enabled: true }] })]))).toEqual([]);
  });

  it('catches the Centaur Breeder class of defects together', () => {
    // The real pre-sweep shape: a legacy start flag standing in for isStarting, and a cast member in no location.
    const w = base({
      locations: [{ id: 'pasture', name: 'Pasture', isStartLocation: true } as GameLocation],
      entities: [{ id: 'e1', name: 'Farm Visitors' }],
    });
    const ids = new Set(runRules(w).map((f) => f.ruleId));
    expect(ids).toContain('no-starting-location');
    expect(ids).toContain('legacy-start-location');
    expect(ids).toContain('entity-nowhere');
  });

  it('stays silent on a plain world that uses none of the advanced features', () => {
    expect(runRules({
      ...world([{ id: 'e1', name: 'Maren' }]),
      stats: [stat({ id: 's1', name: 'Vigor' })],
      dictionaries: [book([entry({ id: 'd1', name: 'Fen Lore', key: ['fen'] })])],
      traits: [trait({ id: 't1', name: 'Hardy' })],
    })).toEqual([]);
  });
});

describe('stat sanity rules', () => {
  const oneStat = (over: Partial<Stat>, traits: Trait[] = []) =>
    base({ stats: [stat({ id: 's1', name: 'Fertility', ...over })], traits });

  it('flags a starting value outside the stat’s own range, either end', () => {
    const high = only(oneStat({ starting: 120 }), 'stat-starting-out-of-range');
    expect(high).toHaveLength(1);
    expect(high[0].severity).toBe('error');
    expect(high[0].items.map((i) => i.id)).toEqual(['s1']);
    expect(high[0].message).toContain('120');
    expect(only(oneStat({ starting: -5 }), 'stat-starting-out-of-range')).toHaveLength(1);
    // Both bounds are inclusive, and a stat with no authored start opens at its floor.
    expect(runRules(oneStat({ starting: 100 }))).toEqual([]);
    expect(runRules(oneStat({ starting: 0 }))).toEqual([]);
    expect(runRules(oneStat({}))).toEqual([]);
  });

  it('reads a stat with no starting value but a live one from that live value', () => {
    // The seeder's own order: starting, then value, then the floor (lib/statBackfill).
    expect(only(oneStat({ value: 250 }), 'stat-starting-out-of-range')).toHaveLength(1);
    expect(only(oneStat({ starting: 50, value: 250 }), 'stat-starting-out-of-range')).toEqual([]);
  });

  const banded = (over: Partial<Stat>) => oneStat({
    descriptors: [{ id: 'd1', threshold: 30, description: 'barren' }, { id: 'd2', threshold: 60, description: 'fertile' }],
    ...over,
  });

  it('flags a starting value that lands above every descriptor band', () => {
    const found = only(banded({ starting: 80 }), 'stat-start-no-descriptor');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('Fertility');
    // A band at 60 covers the value 60 and nothing above it.
    expect(only(banded({ starting: 60 }), 'stat-start-no-descriptor')).toEqual([]);
  });

  it('states the start and where coverage stops in the same units, so the two are comparable', () => {
    const message = only(banded({ starting: 80 }), 'stat-start-no-descriptor')[0].message;
    // Raw thresholds, so both numbers are stat values: the start, and the top band's own ceiling.
    expect(message).toContain('starts at 80 of 100');
    expect(message).toContain('stops at 60 of 100');
  });

  it('reads thresholds as raw stat values, so a wider range leaves the bands where they were', () => {
    // The rockets case: raising max cannot move a raw band, so 80 stays above the 60 band either way.
    expect(only(banded({ max: 200, starting: 80 }), 'stat-start-no-descriptor')).toHaveLength(1);
    expect(only(banded({ max: 200, starting: 50 }), 'stat-start-no-descriptor')).toEqual([]);
  });

  it('reads them as percentages of min→max when the stat opts in, and says so in percent', () => {
    // Min 0 / max 200 puts the value 80 at 40% — inside the 60 band.
    const proportional = (over: Partial<Stat>) => banded({ max: 200, thresholdUnit: 'percent', ...over });
    expect(only(proportional({ starting: 80 }), 'stat-start-no-descriptor')).toEqual([]);
    const found = only(proportional({ starting: 140 }), 'stat-start-no-descriptor');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('starts at 70%');
    expect(found[0].message).toContain('stops at 60%');
  });

  it('flags a threshold that sits outside the values the stat can ever hold', () => {
    // A 0–10 stat still banded 30/60: the percent numbers the old reading left behind.
    const found = only(banded({ max: 10 }), 'stat-descriptor-out-of-range');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('30 of 10');
    expect(found[0].message).toContain('never climb that far');
  });

  it('flags a threshold under the floor, which no value can reach downward', () => {
    const found = only(banded({ min: 50, max: 100, starting: 60, descriptors: [
      { id: 'd1', threshold: 20, description: 'barren' },
      { id: 'd2', threshold: 100, description: 'fertile' },
    ] }), 'stat-descriptor-out-of-range');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('never fall that low');
  });

  it('says nothing about thresholds inside the range, under either unit', () => {
    expect(only(banded({ max: 100 }), 'stat-descriptor-out-of-range')).toEqual([]);
    expect(only(banded({ max: 10, thresholdUnit: 'percent' }), 'stat-descriptor-out-of-range')).toEqual([]);
  });

  it('measures a percent stat’s thresholds against 0–100, not against its own ceiling', () => {
    const found = only(banded({
      max: 10, thresholdUnit: 'percent',
      descriptors: [{ id: 'd1', threshold: 150, description: 'impossible' }],
    }), 'stat-descriptor-out-of-range');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('150%');
  });

  it('flags bands that stop short of Max, naming where coverage ends in the stat’s own unit', () => {
    // The Vane Hollow shape: thresholds read as band floors, so the author's top band covers nothing above it.
    const found = only(banded({ starting: 50 }), 'stat-descriptor-coverage-gap');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('stop at 60 of 100');
  });

  it('says nothing when the bands reach Max, or when there are no bands at all', () => {
    expect(only(banded({ descriptors: [
      { id: 'd1', threshold: 30, description: 'barren' }, { id: 'd2', threshold: 100, description: 'fertile' },
    ] }), 'stat-descriptor-coverage-gap')).toEqual([]);
    expect(only(oneStat({}), 'stat-descriptor-coverage-gap')).toEqual([]);
  });

  it('reads the gap through the stat’s unit, so a percent stat is judged against 100%', () => {
    const found = only(banded({ max: 10, thresholdUnit: 'percent', starting: 5 }), 'stat-descriptor-coverage-gap');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('stop at 60%');
    expect(only(banded({
      max: 10, thresholdUnit: 'percent', starting: 5,
      descriptors: [{ id: 'd1', threshold: 100, description: 'full' }],
    }), 'stat-descriptor-coverage-gap')).toEqual([]);
  });

  it('fires alongside the start finding when the game also opens in the gap — this row carries the fix', () => {
    const ids = runRules(banded({ starting: 80 })).map((f) => f.ruleId);
    expect(ids).toContain('stat-start-no-descriptor');
    expect(ids).toContain('stat-descriptor-coverage-gap');
  });

  it('raises only the top band to Max, in the stat’s own unit, leaving the rest untouched', () => {
    const fixedRaw = applyRuleFix(banded({ starting: 50 }), 'stat-descriptor-coverage-gap');
    expect(fixedRaw.stats[0].descriptors.map((d) => d.threshold)).toEqual([30, 100]);
    const fixedPct = applyRuleFix(
      banded({ max: 10, thresholdUnit: 'percent', starting: 5 }), 'stat-descriptor-coverage-gap');
    expect(fixedPct.stats[0].descriptors.map((d) => d.threshold)).toEqual([30, 100]);
  });

  it('says nothing about a stat that carries no descriptors at all', () => {
    // Descriptors are optional; a stat without them isn't missing a band, it just has no status to report.
    expect(runRules(oneStat({ starting: 80 }))).toEqual([]);
  });

  it('leaves the descriptor band alone when the starting value is out of range in the first place', () => {
    // Out-of-range is the sharper diagnosis and already fires; a second row about its band is noise.
    expect(only(banded({ starting: 500 }), 'stat-start-no-descriptor')).toEqual([]);
  });

  it('flags two descriptors sharing a threshold, since only the first can ever apply', () => {
    const found = only(oneStat({
      descriptors: [
        { id: 'd1', threshold: 30, description: 'barren' },
        { id: 'd2', threshold: 60, description: 'fertile' },
        { id: 'd3', threshold: 60, description: 'teeming' },
        { id: 'd4', threshold: 100, description: 'brimming' },
      ],
    }), 'stat-descriptor-duplicate-threshold');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('60');
    expect(found[0].message).toContain('teeming');
  });

  it('says nothing about descriptors listed out of order — the band lookup sorts them', () => {
    // Verified against lib/statContext: the matcher sorts ascending before picking, so authored order
    // never decides which band wins.
    expect(runRules(oneStat({
      descriptors: [
        { id: 'd1', threshold: 100, description: 'brimming' },
        { id: 'd2', threshold: 30, description: 'barren' },
      ],
    }))).toEqual([]);
  });

  it('flags a percentage stat whose bounds aren’t 0 and 100', () => {
    const found = only(oneStat({ type: 'percentage', min: 10, max: 50, starting: 20 }), 'stat-percentage-bounds');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('10');
    expect(found[0].message).toContain('50');
    expect(runRules(oneStat({ type: 'percentage', min: 0, max: 100 }))).toEqual([]);
    // A number stat is free to use any range it likes.
    expect(runRules(oneStat({ min: 10, max: 50, starting: 20 }))).toEqual([]);
  });

  it('flags coded stats when nothing in the world reads the clock, once per coded stat', () => {
    const coded = base({
      stats: [
        stat({ id: 's1', name: 'Fertility', code: 'return 25;' }),
        stat({ id: 's2', name: 'Weave', code: 'return Math.round(Math.random() * 100);' }),
        stat({ id: 's3', name: 'Vigor' }),
      ],
    });
    const found = only(coded, 'stat-code-never-ticks');
    expect(found).toHaveLength(2);
    expect(found.map((f) => f.items[0].id)).toEqual(['s1', 's2']);
    expect(found[0].severity).toBe('warning');
    expect(groupFindings(found)[0].headline).toContain('2');
  });

  it('quiets the clock rule as soon as any one stat’s code names a clock variable', () => {
    // The gate is world-wide (GameViewer's anyStatUsesClock), so one reference puts every coded stat on
    // the every-turn schedule.
    expect(only(base({
      stats: [
        stat({ id: 's1', name: 'Fertility', code: 'return 25;' }),
        stat({ id: 's2', name: 'Weave', code: 'return elapsedHours % 2;' }),
      ],
    }), 'stat-code-never-ticks')).toEqual([]);
  });

  it('doesn’t count a stat no trait ever switches on as reading the clock, or as coded', () => {
    // The gate reads the enabled stats, so a clock reference parked on a stat that is never live grants the
    // rest of the world nothing — and that stat's own code never runs, so it isn't a finding of its own.
    const found = only(base({
      stats: [
        stat({ id: 's1', name: 'Fertility', code: 'return 25;' }),
        stat({ id: 's2', name: 'Dust', code: 'return elapsedHours;', enabled: false }),
      ],
    }), 'stat-code-never-ticks');
    expect(found.map((f) => f.items[0].id)).toEqual(['s1']);

    // A trait that switches it on puts it back in play, clock reference and all.
    expect(only(base({
      stats: [
        stat({ id: 's1', name: 'Fertility', code: 'return 25;' }),
        stat({ id: 's2', name: 'Dust', code: 'return elapsedHours;', enabled: false }),
      ],
      traits: [trait({ id: 't1', name: 'Cursed', statToggles: [{ statId: 's2', enabled: true }] })],
    }), 'stat-code-never-ticks')).toEqual([]);
  });

  it('flags a trait’s negative starting delta on a stat already resting at its floor', () => {
    // The Centaur Breeder shape: a race penalty written against a stat that opens at zero, so the clamp
    // eats the whole thing and every race starts identical.
    const found = only(
      oneStat({ starting: 0 }, [trait({ id: 't1', name: 'Ashen', statChanges: [{ statId: 's1', type: 'starting', value: -10 }] })]),
      'stat-trait-delta-clamped',
    );
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].items.map((i) => i.id)).toEqual(['s1', 't1']);
    expect(found[0].items[1].section).toBe('traits');
  });

  it('counts the floor the trait itself raises, not just the authored min', () => {
    // A trait that lifts the min to where the stat already sits leaves its own penalty nowhere to go.
    const raises = trait({
      id: 't1',
      name: 'Ashen',
      statChanges: [{ statId: 's1', type: 'min', value: 10 }, { statId: 's1', type: 'starting', value: -5 }],
    });
    expect(only(oneStat({ starting: 10 }, [raises]), 'stat-trait-delta-clamped')).toHaveLength(1);
  });

  it('says nothing when part of the delta actually lands', () => {
    // 12 − 5 clamps to the floor at 10, so 2 points moved: the penalty is real, just smaller than written.
    // Only a delta that moves nothing at all is the defect.
    const partial = trait({ id: 't1', name: 'Ashen', statChanges: [{ statId: 's1', type: 'starting', value: -5 }] });
    expect(runRules(oneStat({ min: 10, starting: 12 }, [partial]))).toEqual([]);
    expect(runRules(oneStat({ starting: 40 }, [partial]))).toEqual([]);
  });

  it('says nothing about a positive delta, or one on a stat the trait leaves room under', () => {
    const bonus = trait({ id: 't1', name: 'Blessed', statChanges: [{ statId: 's1', type: 'starting', value: 10 }] });
    expect(runRules(oneStat({ starting: 0 }, [bonus]))).toEqual([]);
  });

  it('flags a trait’s starting delta on a stat whose code recomputes it from scratch', () => {
    // Fertility's code recovers toward a fixed number, healing every race's penalty away within two turns.
    const ashen = trait({ id: 't1', name: 'Ashen', statChanges: [{ statId: 's1', type: 'starting', value: -10 }] });
    const found = only(oneStat({ starting: 40, code: 'return Math.round((stats.find(s => s.name === "Vigor")?.value ?? 0) / 2);' }, [ashen]), 'stat-code-overrides-trait');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].items.map((i) => i.id)).toEqual(['s1', 't1']);
    expect(found[0].items[1].section).toBe('traits');
  });

  it('says nothing when the code builds on the stat’s own value, which is what the trait moved', () => {
    const ashen = trait({ id: 't1', name: 'Ashen', statChanges: [{ statId: 's1', type: 'starting', value: -10 }] });
    // Both ways code can find itself: the injected id, and its own name as a literal.
    const byId = 'const me = stats.find(s => s.id === currentStatId); return Math.min(me.value + 1, me.max);';
    const byName = 'const me = stats.find(s => s.name === "Fertility"); return me.value + 1;';
    expect(only(oneStat({ starting: 40, code: byId }, [ashen]), 'stat-code-overrides-trait')).toEqual([]);
    expect(only(oneStat({ starting: 40, code: byName }, [ashen]), 'stat-code-overrides-trait')).toEqual([]);
  });

  it('reads a stat’s own id as a lookup only where it is quoted', () => {
    // A short legacy id inside an ordinary number would otherwise read as a self-lookup and quiet the rule.
    const ashen = trait({ id: 't1', name: 'Ashen', statChanges: [{ statId: '1', type: 'starting', value: -10 }] });
    const shortId = (code: string) => base({
      stats: [stat({ id: '1', name: 'Fertility', min: 0, max: 100, starting: 40, code })],
      traits: [ashen],
    });
    expect(only(shortId('return 100;'), 'stat-code-overrides-trait')).toHaveLength(1);
    expect(only(shortId('return stats.find(s => s.id === "1").value + 1;'), 'stat-code-overrides-trait')).toEqual([]);
  });

  it('says nothing when a trait moves a bound rather than the value', () => {
    const wider = trait({ id: 't1', name: 'Ashen', statChanges: [{ statId: 's1', type: 'max', value: -10 }] });
    expect(only(oneStat({ starting: 40, code: 'return 25;' }, [wider]), 'stat-code-overrides-trait')).toEqual([]);
  });

  it('flags a codeless stat locked in both directions with nothing else able to move it', () => {
    const found = only(oneStat({ noIncrease: true, noDecrease: true }), 'stat-ai-lock-frozen');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('Fertility');
  });

  it('says nothing when something can still move the locked stat', () => {
    const locks = { noIncrease: true, noDecrease: true } as const;
    // Each of the three movers on its own is enough.
    expect(runRules(oneStat({ ...locks, regen: 2 }))).toEqual([]);
    expect(only(oneStat({ ...locks, code: 'return 25;', starting: 25 }), 'stat-ai-lock-frozen')).toEqual([]);
    expect(runRules(oneStat(
      { ...locks, starting: 40 },
      [trait({ id: 't1', name: 'Ashen', statChanges: [{ statId: 's1', type: 'starting', value: -10 }] })],
    ))).toEqual([]);
    // And a lock in one direction only leaves the other direction open.
    expect(runRules(oneStat({ noIncrease: true }))).toEqual([]);
  });

  it('stays silent on a plain, well-formed set of stats', () => {
    expect(runRules(base({
      stats: [
        stat({
          id: 's1',
          name: 'Fertility',
          starting: 20,
          descriptors: [{ id: 'd1', threshold: 30, description: 'barren' }, { id: 'd2', threshold: 100, description: 'fertile' }],
        }),
        stat({ id: 's2', name: 'Vigor', type: 'percentage', min: 0, max: 100, starting: 50 }),
      ],
      traits: [trait({ id: 't1', name: 'Hardy', statChanges: [{ statId: 's2', type: 'starting', value: 10 }] })],
    }))).toEqual([]);
  });
});

describe('the unused-placeholder rule', () => {
  it('flags a placeholder nothing in the world reaches for', () => {
    const found = only(base({ placeholders: [{ id: 'p1', name: 'Hue', values: ['red', 'blue'] }] }), 'placeholder-unused');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].items.map((i) => i.id)).toEqual(['p1']);
    expect(found[0].message).toContain('Hue');
  });

  it('counts a trait pin as a use', () => {
    expect(runRules(base({
      placeholders: [{ id: 'p1', name: 'Hue', values: ['red', 'blue'] }],
      traits: [trait({ id: 't1', name: 'Dyed', placeholderPins: [{ placeholderId: 'p1', value: 'red' }] })],
    }))).toEqual([]);
  });

  it('counts a chip parked where it never resolves as a use — the chip is the problem, not the placeholder', () => {
    // A chip in a stat description is its own error; reading it as "no mention" would offer to delete the
    // placeholder underneath it and turn that error into a broken reference.
    const w = base({
      placeholders: [{ id: 'p1', name: 'Vice', values: ['ale'] }],
      stats: [stat({ id: 's1', name: 'Vigor', description: 'Craving for {{ph:p1:world:pl1}}.' })],
    });
    expect(only(w, 'placeholder-unused')).toEqual([]);
    expect(only(w, 'chip-never-scanned')).toHaveLength(1);
  });

  it('counts a chip in the world blurb as a use', () => {
    expect(only(base({
      worldOverview: { name: 'Sedge Landing', description: 'A fen of {{ph:p1:world:pl1}}.', systemPrompt: '' } as WorldOverview,
      placeholders: [{ id: 'p1', name: 'Weather', values: ['rain'] }],
    }), 'placeholder-unused')).toEqual([]);
  });
});

describe('the deferred reference checks', () => {
  const nested = (parentId: string) => base({
    locations: [
      { id: 'harbor', name: 'Harbor Steps', isStarting: true },
      { id: 'loft', name: 'The Loft', parentId },
    ],
    entities: [resident, { ...resident, id: 'e-loft', name: 'Tallow', locations: ['loft'] }],
  });

  it('flags a location whose parent points at nothing, and quiets under a real parent', () => {
    const found = only(nested('gone'), 'location-parent-orphan');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].section).toBe('locations');
    expect(found[0].items.map((i) => i.id)).toEqual(['loft']);
    expect(runRules(nested('harbor'))).toEqual([]);
  });

  it('leaves a top-level location alone, null or absent alike', () => {
    const flat = base({
      locations: [
        { id: 'harbor', name: 'Harbor Steps', isStarting: true, parentId: null },
        { id: 'loft', name: 'The Loft' },
      ],
      entities: [resident, { ...resident, id: 'e-loft', name: 'Tallow', locations: ['loft'] }],
    });
    expect(runRules(flat)).toEqual([]);
  });

  it('promotes the orphan to top-level as its fix — the dead parent already contributed nothing', () => {
    const before = nested('gone');
    const fixed = applyRuleFix(before, 'location-parent-orphan');
    expect(fixed.locations[1].parentId).toBeNull();
    // The location that was fine keeps its identity, so only the repair is written back.
    expect(fixed.locations[0]).toBe(before.locations[0]);
    expect(only(fixed, 'location-parent-orphan')).toEqual([]);
  });

  const linked = (from: string, to: string) => base({
    locations: [
      { id: 'harbor', name: 'Harbor Steps', isStarting: true },
      { id: 'market', name: 'The Long Market' },
    ],
    entities: [resident, { ...resident, id: 'e-m', name: 'Stallkeep', locations: ['market'] }],
    connections: [{ id: 'c1', from, to, twoWay: true }],
  });

  it('flags a travel link with a dead endpoint, naming the end that still exists', () => {
    const found = only(linked('harbor', 'gone'), 'connection-endpoint-orphan');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('from “Harbor Steps”');
    expect(found[0].items.map((i) => i.id)).toEqual(['harbor']);
    expect(only(linked('gone', 'market'), 'connection-endpoint-orphan')[0].message).toContain('to “The Long Market”');
    expect(runRules(linked('harbor', 'market'))).toEqual([]);
  });

  it('still reports a link both of whose ends are gone', () => {
    const found = only(linked('gone', 'lost'), 'connection-endpoint-orphan');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('between two locations that don’t exist');
  });

  const updating = (target: string) => base({
    stats: [stat({ id: 's1', name: 'Mana' })],
    statUpdates: [{ id: 'u1', name: 'Hourly Drain', prompt: 'Drain it.', stats: [target], messageHistory: [] }],
  });

  it('flags a stat update targeting a stat name that doesn’t exist — a rename detaches silently', () => {
    const found = only(updating('Manna'), 'stat-update-unknown-stat');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('Manna');
    expect(found[0].items.map((i) => i.id)).toEqual(['u1']);
    expect(runRules(updating('Mana'))).toEqual([]);
  });
});

describe('entity completeness rules', () => {
  it('flags a lowercase multi-word alias with no capitalized twin, and quiets once the twin exists', () => {
    const aliased = (aliases: string[]) => world([{ id: 'e1', name: 'Maren', aliases }]);
    const found = only(aliased(['old fishmonger']), 'alias-lowercase-no-twin');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('“Old fishmonger”');
    expect(runRules(aliased(['old fishmonger', 'Old fishmonger']))).toEqual([]);
  });

  it('leaves single-word and already-capitalized aliases alone', () => {
    expect(only(world([{ id: 'e1', name: 'Maren', aliases: ['fishmonger', 'Old Hand'] }]), 'alias-lowercase-no-twin')).toEqual([]);
  });

  it('leaves an articled alias to the sharper article rule until its fix strips it', () => {
    const articled = world([{ id: 'e1', name: 'Maren', aliases: ['the old hand'] }]);
    expect(only(articled, 'alias-lowercase-no-twin')).toEqual([]);
    // Once the article fix runs, what remains is a lowercase phrase — and this rule picks it up.
    expect(only(applyRuleFix(articled, 'alias-leading-article'), 'alias-lowercase-no-twin')).toHaveLength(1);
  });

  it('flags an entity name that doubles as a Wildcard value, plural tolerance included', () => {
    const pooled = (values: string[]) => ({
      ...world([{ id: 'e1', name: 'Gull', aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }]),
      placeholders: [{ id: 'p1', name: 'Coin Bird', values }],
    });
    const found = only(pooled(['gulls', 'wren']), 'entity-name-in-wildcard-pool');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].items.map((i) => i.id)).toEqual(['e1', 'p1']);
    expect(found[0].items[1].section).toBe('placeholders');
    expect(only(pooled(['heron', 'wren']), 'entity-name-in-wildcard-pool')).toEqual([]);
  });

  it('leaves a Variable alone — one fixed value is not a roll that can impersonate anyone', () => {
    const w = {
      ...world([{ id: 'e1', name: 'Gull', aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }]),
      placeholders: [{ id: 'p1', name: 'Coin Bird', values: ['gull'] }],
    };
    expect(only(w, 'entity-name-in-wildcard-pool')).toEqual([]);
  });

  it('flags each description gap under its own rule, naming which audience is blind', () => {
    const bare = only(world([{ id: 'e1', name: 'Maren', playerDescription: '', aiDescription: '' }]), 'entity-missing-both-descriptions');
    expect(bare).toHaveLength(1);
    expect(bare[0].severity).toBe('info');
    expect(bare[0].message).toContain('neither a player nor an AI description');
    expect(bare[0].message).toContain('the prompt carries only its name');
    const aiOnly = only(world([{ id: 'e1', name: 'Maren', aiDescription: '' }]), 'entity-missing-ai-description');
    expect(aiOnly[0].message).toContain('no AI description');
    expect(aiOnly[0].message).toContain('the prompt carries only its name');
    const playerOnly = only(world([{ id: 'e1', name: 'Maren', playerDescription: ' ' }]), 'entity-missing-player-description');
    expect(playerOnly[0].message).toContain('no player description');
    expect(runRules(world([{ id: 'e1', name: 'Maren' }]))).toEqual([]);
  });

  it('raises exactly one description rule per entity — a double gap is the both-rule alone', () => {
    const descriptionRules = new Set([
      'entity-missing-player-description', 'entity-missing-ai-description', 'entity-missing-both-descriptions',
    ]);
    const raisedFor = (entity: Entity) =>
      runRules(world([entity])).filter((f) => descriptionRules.has(f.ruleId)).map((f) => f.ruleId);
    expect(raisedFor({ id: 'e1', name: 'Maren', playerDescription: '', aiDescription: '' }))
      .toEqual(['entity-missing-both-descriptions']);
    expect(raisedFor({ id: 'e1', name: 'Maren', playerDescription: '' }))
      .toEqual(['entity-missing-player-description']);
    expect(raisedFor({ id: 'e1', name: 'Maren', aiDescription: '' }))
      .toEqual(['entity-missing-ai-description']);
  });

  it('still flags a missing AI description behind a summary, but says what the summary does reach', () => {
    // The delivery asymmetry, told straight: the summary-preferring prompts are served, the narrator's
    // here-roster is not. "Only its name" would be flatly untrue of an entity carrying a summary.
    const found = only(
      world([{ id: 'e1', name: 'Maren', aiDescription: '', aiSummary: 'A fen trader.' }]),
      'entity-missing-ai-description',
    );
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('no AI description');
    expect(found[0].message).toContain('roster of who is here carries only its name');
    expect(found[0].message).toContain('every other prompt serves the summary');
    expect(found[0].message).not.toContain('the prompt carries only its name');
  });

  it('flags a long AI description with no AI summary, in ~tokens', () => {
    const longText = 'A fen tale. '.repeat(60);
    const found = only(world([{ id: 'e1', name: 'Maren', aiDescription: longText }]), 'entity-long-description-no-summary');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toMatch(/~\d+ tokens/);
    // A summary redirects the summary-reading passes, which is what the rule asks for — nothing left to say.
    expect(only(
      world([{ id: 'e1', name: 'Maren', aiDescription: longText, aiSummary: 'A fen tale.' }]),
      'entity-long-description-no-summary',
    )).toEqual([]);
    expect(runRules(world([{ id: 'e1', name: 'Maren', aiDescription: 'Short.' }]))).toEqual([]);
  });

  it('flags a long location description too — the same field at the same per-turn cost', () => {
    const longText = 'Reeds and black water. '.repeat(40);
    const found = only(base({
      locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true, aiDescription: longText }],
    }), 'entity-long-description-no-summary');
    expect(found).toHaveLength(1);
    expect(found[0].items[0]).toMatchObject({ id: 'harbor', section: 'locations' });
    expect(only(base({
      locations: [{
        id: 'harbor', name: 'Harbor Steps', isStarting: true, aiDescription: longText, aiSummary: 'The steps.',
      }],
    }), 'entity-long-description-no-summary')).toEqual([]);
  });

  it('flags a summary that saves almost nothing, and prints the whole trade', () => {
    // 600 characters of description leave every prompt to save ~30 tokens a turn. The old bound saw a long
    // description, assumed the summary was earning its place, and said nothing.
    const found = only(world([{
      id: 'e1', name: 'Maren', aiDescription: 'A fen tale. '.repeat(50), aiSummary: 'A fen tale. '.repeat(40),
    }]), 'ai-summary-hides-description');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('~150-token AI description and a ~120-token AI summary');
    expect(found[0].message).toContain('only saves ~30 tokens a turn');
  });

  it('lets a marginal ratio pass once the absolute savings are real', () => {
    // The Rhea Belle case: a summary a hair over half its description, still clearing the savings floor
    // every turn. Calling that "saves almost nothing" was flatly untrue, so the rule stays quiet.
    const found = only(world([{
      id: 'e1', name: 'Maren', aiDescription: 'A fen tale. '.repeat(32), aiSummary: 'A fen tale. '.repeat(17),
    }]), 'ai-summary-hides-description');
    expect(found).toEqual([]);
  });

  it('collapses several of them into a row that still names the failed trade', () => {
    const poor = { aiDescription: 'A fen tale. '.repeat(50), aiSummary: 'A fen tale. '.repeat(40) };
    const groups = groupFindings(runRules(world([
      { id: 'e1', name: 'Maren', ...poor }, { id: 'e2', name: 'Old Tobb', ...poor },
    ])));
    const row = groups.find((g) => g.ruleId === 'ai-summary-hides-description');
    expect(row?.headline).toContain('2');
    expect(row?.headline).toContain('save almost nothing');
  });

  it('flags a summary longer than the description it hides — a strictly worse trade', () => {
    const found = only(world([{
      id: 'e1', name: 'Maren', aiDescription: 'A fen tale. '.repeat(20), aiSummary: 'A fen tale. '.repeat(30),
    }]), 'ai-summary-hides-description');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('~90-token AI summary');
    expect(found[0].message).toContain('~60-token AI description');
    expect(found[0].message).toContain('~30 tokens more');
  });

  it('says nothing about a summary that really compresses, short description or long', () => {
    // Both directions the old absolute bound got wrong: it nagged the tight summary over a short
    // description, and it could never praise one over a long description because it never looked.
    for (const aiDescription of ['A fen tale. '.repeat(20), 'A fen tale. '.repeat(60)]) {
      expect(only(
        world([{ id: 'e1', name: 'Maren', aiDescription, aiSummary: 'A trader.' }]),
        'ai-summary-hides-description',
      )).toEqual([]);
    }
    // A summary with no full description hides nothing.
    expect(only(
      world([{ id: 'e1', name: 'Maren', aiDescription: '', aiSummary: 'A trader.' }]),
      'ai-summary-hides-description',
    )).toEqual([]);
  });

  it('stays quiet under the floor however bad the ratio is', () => {
    // A description repeated verbatim as its own summary is the worst ratio there is, saving nothing at
    // all — and still not worth a row while the whole description costs less than a sentence of narration.
    const under = 'A fen tale. '.repeat(13);
    expect(estimateTokens(under.length)).toBe(39);
    expect(only(
      world([{ id: 'e1', name: 'Maren', aiDescription: under, aiSummary: under }]),
      'ai-summary-hides-description',
    )).toEqual([]);
    // One token more of description, the same ratio, and the row is worth showing.
    const atFloor = `${under}word`;
    expect(estimateTokens(atFloor.length)).toBe(40);
    expect(only(
      world([{ id: 'e1', name: 'Maren', aiDescription: atFloor, aiSummary: atFloor }]),
      'ai-summary-hides-description',
    )).toHaveLength(1);
  });

  it('never raises both summary rules over one item, whatever the author wrote', () => {
    const lengths = ['', 'A fen trader.', 'A fen tale. '.repeat(13), 'A fen tale. '.repeat(20),
      'A fen tale. '.repeat(40), 'A fen tale. '.repeat(60)];
    for (const aiDescription of lengths) {
      for (const aiSummary of lengths) {
        const raised = runRules(world([{ id: 'e1', name: 'Maren', aiDescription, aiSummary }]))
          .filter((f) => f.ruleId === 'entity-long-description-no-summary' || f.ruleId === 'ai-summary-hides-description');
        expect(raised.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('measures both rules on resolved chip text, not the chip syntax the author typed', () => {
    const chips = (count: number) => '{{ph:p1:world:pl1}}'.repeat(count);
    const chipWorld = (aiDescription: string, values: string[], over: Partial<Entity> = {}): RuleWorld => ({
      ...world([{ id: 'e1', name: 'Maren', aiDescription, ...over }]),
      placeholders: [{ id: 'p1', name: 'Coin Bird', values }],
    });
    // 480 characters of prose and ten chips: 670 raw, so a raw-length estimate calls it long — and 520 once
    // the chips resolve to a bird, which is what the prompt actually pays for.
    const wordy = `${'A fen tale. '.repeat(40)}${chips(10)}`;
    expect(estimateTokens(wordy.length)).toBeGreaterThan(150);
    expect(only(chipWorld(wordy, ['gull']), 'entity-long-description-no-summary')).toEqual([]);
    // The same text with a chip that really is long resolves past the bound, and the rule fires.
    expect(only(
      chipWorld(wordy, ['A fen tale. '.repeat(20)]), 'entity-long-description-no-summary',
    )).toHaveLength(1);
    // Both sides of the ratio resolve. One chip of summary is five tokens of syntax and sixty tokens of
    // delivered text, so measuring what the author typed would hide a summary that compresses nothing.
    const brief = 'A fen tale. '.repeat(20);
    expect(only(
      chipWorld(brief, ['A fen tale. '.repeat(20)], { aiSummary: chips(1) }), 'ai-summary-hides-description',
    )).toHaveLength(1);
    expect(only(
      chipWorld(brief, ['gull'], { aiSummary: chips(1) }), 'ai-summary-hides-description',
    )).toEqual([]);
  });

  it('covers a location’s AI summary too, opening on the Locations tab', () => {
    const found = only(base({
      locations: [{
        id: 'harbor', name: 'Harbor Steps', isStarting: true,
        aiDescription: 'Reeds and black water. '.repeat(20), aiSummary: 'Reeds and black water. '.repeat(15),
      }],
    }), 'ai-summary-hides-description');
    expect(found).toHaveLength(1);
    expect(found[0].items[0]).toMatchObject({ id: 'harbor', section: 'locations' });
  });

  it('flags a location containing no entities, and quiets once someone lives there', () => {
    const market = (occupants: Entity[]) => base({
      locations: [
        { id: 'harbor', name: 'Harbor Steps', isStarting: true },
        { id: 'market', name: 'The Long Market' },
      ],
      entities: [resident, ...occupants],
    });
    const found = only(market([]), 'location-no-entities');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].items.map((i) => i.id)).toEqual(['market']);
    expect(runRules(market([{ ...resident, id: 'e-m', name: 'Stallkeep', locations: ['market'] }]))).toEqual([]);
  });
});

describe('trait group rules', () => {
  const grouped = (over: { exclusive?: boolean; defaults?: number; members?: number }) => {
    const { exclusive = true, defaults = 0, members = 2 } = over;
    return base({
      traitGroups: [{ id: 'g1', name: 'Origin', parentId: null, exclusive }],
      traits: Array.from({ length: members }, (_, i) => trait({
        id: `t${i + 1}`, name: `Origin ${i + 1}`, groupId: 'g1', isDefault: i < defaults,
      })),
    });
  };

  it('flags an exclusive group defaulting two traits at once', () => {
    const found = only(grouped({ defaults: 2 }), 'trait-group-multiple-defaults');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('Origin 1 and Origin 2');
    expect(found[0].items.map((i) => i.id)).toEqual(['g1', 't1', 't2']);
    expect(runRules(grouped({ defaults: 1 }))).toEqual([]);
  });

  it('lets a non-exclusive group default whatever it likes', () => {
    expect(only(grouped({ exclusive: false, defaults: 2 }), 'trait-group-multiple-defaults')).toEqual([]);
  });

  it('flags an exclusive group holding fewer than two traits — a choice that isn’t a choice', () => {
    const one = only(grouped({ members: 1 }), 'trait-group-too-small');
    expect(one).toHaveLength(1);
    expect(one[0].severity).toBe('info');
    expect(one[0].message).toContain('only one trait');
    expect(only(grouped({ members: 0 }), 'trait-group-too-small')[0].message).toContain('no traits');
    expect(runRules(grouped({ members: 2 }))).toEqual([]);
  });

  it('leaves a small non-exclusive group alone — a folder is not a choice', () => {
    expect(only(grouped({ exclusive: false, members: 1 }), 'trait-group-too-small')).toEqual([]);
  });
});

describe('placeholder pool rules', () => {
  // No rule counts Unique chips against the pool size: Unique mode is independent rolls per placement,
  // not sampling without replacement, so repeats are normal at any chip count — never a defect.
  const weighted = (weights: Record<string, number>) => ({
    ...world([{ id: 'e1', name: 'Maren', aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }]),
    placeholders: [{ id: 'p1', name: 'Vice', values: ['ale', 'dice'], weights }],
  });

  it('flags a weight naming a value the pool doesn’t contain', () => {
    const found = only(weighted({ ale: 2, grog: 3 }), 'placeholder-weight-unknown-value');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('grog');
    expect(runRules(weighted({ ale: 2, dice: 1 }))).toEqual([]);
  });

  it('drops only the dead weights as its fix, keeping the live ones', () => {
    const fixed = applyRuleFix(weighted({ ale: 2, grog: 3 }), 'placeholder-weight-unknown-value');
    expect(fixed.placeholders?.[0].weights).toEqual({ ale: 2 });
  });

  it('removes an emptied weight map entirely — absent already means a uniform draw', () => {
    const fixed = applyRuleFix(weighted({ grog: 3 }), 'placeholder-weight-unknown-value');
    expect(fixed.placeholders?.[0] && 'weights' in fixed.placeholders[0]).toBe(false);
  });

  it('flags a Wildcard whose weights bench every value but one, so it never varies', () => {
    const found = only(weighted({ dice: 0 }), 'wildcard-single-value');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('“ale”');
  });

  it('reads an all-benched pool as the uniform fallback it actually is, not as a single value', () => {
    // Zeroing everything still draws uniformly (weightedPick), so the Wildcard varies after all.
    expect(only(weighted({ ale: 0, dice: 0 }), 'wildcard-single-value')).toEqual([]);
    expect(runRules(weighted({ ale: 2, dice: 1 }))).toEqual([]);
  });
});

describe('dictionary visibility rules', () => {
  const twoEntries = (first: Partial<DictionaryEntry>, second: Partial<DictionaryEntry>) => base({
    dictionaries: [book([
      entry({ id: 'd1', name: 'Cat Lore', key: ['cat'], ...first }),
      entry({ id: 'd2', name: 'Storm Lore', key: ['catastrophe'], ...second }),
    ])],
  });

  it('flags a keyword that is a substring of another entry’s keyword while whole-word matching is off', () => {
    const found = only(twoEntries({}, {}), 'dictionary-keyword-substring');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].message).toContain('“cat”');
    expect(found[0].message).toContain('“catastrophe”');
    expect(found[0].items.map((i) => i.id)).toEqual(['d1', 'd2']);
  });

  it('quiets once whole-word matching bounds the shorter keyword', () => {
    expect(runRules(twoEntries({ matchWholeWords: true }, {}))).toEqual([]);
  });

  it('respects the entry’s own case flag, and leaves regex entries to their own semantics', () => {
    expect(only(twoEntries({ key: ['Cat'], caseSensitive: true }, {}), 'dictionary-keyword-substring')).toEqual([]);
    expect(only(twoEntries({ key: ['Cat'] }, {}), 'dictionary-keyword-substring')).toHaveLength(1);
    expect(only(twoEntries({ useRegex: true }, {}), 'dictionary-keyword-substring')).toEqual([]);
  });

  it('does not read two entries sharing one keyword as a substring of each other', () => {
    expect(only(twoEntries({}, { key: ['cat'] }), 'dictionary-keyword-substring')).toEqual([]);
  });

  it('flags a disabled entry, and a disabled book as one row rather than one per entry', () => {
    const muted = only(base({
      dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['herb'], enabled: false })])],
    }), 'dictionary-disabled');
    expect(muted).toHaveLength(1);
    expect(muted[0].severity).toBe('info');
    expect(muted[0].message).toContain('“Herbs” is disabled');

    const mutedBook = only(base({
      dictionaries: [{
        ...book([
          entry({ id: 'd1', name: 'Herbs', key: ['herb'], enabled: false }),
          entry({ id: 'd2', name: 'Tides', key: ['tide'] }),
        ]),
        enabled: false,
      }],
    }), 'dictionary-disabled');
    expect(mutedBook).toHaveLength(1);
    expect(mutedBook[0].message).toContain('The book “Book” is disabled');
    expect(runRules(base({
      dictionaries: [book([entry({ id: 'd1', name: 'Herbs', key: ['herb'] })])],
    }))).toEqual([]);
  });
});

describe('world-level rules', () => {
  const overview = (over: Partial<WorldOverview>) => base({
    worldOverview: {
      name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.', readme: 'A fen primer.', ...over,
    } as WorldOverview,
  });

  it('flags an empty system prompt as the one world-level warning', () => {
    const found = only(overview({ systemPrompt: '  ' }), 'world-empty-system-prompt');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].section).toBe('overview');
    expect(runRules(overview({}))).toEqual([]);
  });

  it('flags a world with no readme, counting an introduction readme as one', () => {
    const found = only(overview({ readme: '' }), 'world-no-readme');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(only(overview({ readme: '', introReadme: 'Welcome to the fen.' }), 'world-no-readme')).toEqual([]);
  });

  it('flags an embedded image over its byte budget and points at Optimize Images', () => {
    const big = `data:image/png;base64,${'A'.repeat(280_000)}`;
    const found = only(overview({ thumbnail: big }), 'world-oversized-images');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('info');
    expect(found[0].message).toContain('Optimize Images');
    expect(runRules(overview({ thumbnail: `data:image/png;base64,${'A'.repeat(1_000)}` }))).toEqual([]);
  });

  it('budgets an entity portrait against the entity cap, opening on the entity', () => {
    const big = `data:image/webp;base64,${'A'.repeat(900_000)}`;
    const found = only(world([{ id: 'e1', name: 'Maren', images: [big] }]), 'world-oversized-images');
    expect(found).toHaveLength(1);
    expect(found[0].items[0]).toMatchObject({ id: 'e1', section: 'entities' });
    expect(runRules(world([{ id: 'e1', name: 'Maren', images: [`data:image/webp;base64,${'A'.repeat(1_000)}`] }]))).toEqual([]);
  });

  it('leaves a linked image alone — it contributes no bytes to the world', () => {
    expect(only(
      world([{ id: 'e1', name: 'Maren', images: ['https://example.com/a-very-large-portrait.png'] }]),
      'world-oversized-images',
    )).toEqual([]);
  });
});

/**
 * A world as hand-edited or third-party JSON delivers one: the arrays the types call required are simply
 * absent. The cast is the fixture — this is exactly the shape TypeScript cannot stop from reaching the rules,
 * and the pass runs inside the editor's render, so one throw here is a blank editor rather than a row.
 */
const STRIPPED = {
  worldOverview: { name: 'Sedge Landing' },
  // No descriptors, and a chip in the description — the chip rule reads both fields on every stat.
  stats: [{
    id: 's1', name: 'Vigor', type: 'number', min: 0, max: 100, starting: 40, regen: 0,
    description: 'Craving for {{ph:p1:world:pl1}}.',
  }],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [{ id: 'e1', name: 'Maren', locations: ['harbor'] }],
  // No statChanges, and a pin at a placeholder that carries no values.
  traits: [{ id: 't1', name: 'Hardy', placeholderPins: [{ placeholderId: 'p1', value: 'red' }] }],
  dictionaries: [{ id: 'b1', name: 'Book' }],
  statUpdates: [{ id: 'u1', name: 'Hourly' }],
  placeholders: [{ id: 'p1', name: 'Hue' }],
} as unknown as RuleWorld;

describe('a world whose “required” arrays are absent', () => {
  it('diagnoses it rather than throwing on it', () => {
    const ids = new Set(runRules(STRIPPED).map((f) => f.ruleId));
    // The chip parked in a stat description is a finding; the descriptors the stat never carried are not.
    expect(ids).toContain('chip-never-scanned');
    expect(ids).not.toContain('stat-start-no-descriptor');
  });

  it('reads a stat with no descriptors exactly as a stat with an empty band list', () => {
    const withBands = {
      ...STRIPPED, stats: [{ ...STRIPPED.stats[0], descriptors: [] }],
    } as RuleWorld;
    expect(runRules(STRIPPED)).toEqual(runRules(withBands));
  });

  it('reads a placeholder with no values as one offering none, so a pin at it is still broken', () => {
    const found = only(STRIPPED, 'trait-pin-invalid');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('isn’t one of its values');
  });

  it('diagnoses a stat that lost its id instead of tripping over the missing lookup', () => {
    const idless = {
      ...base(),
      stats: [{ name: 'Vigor', type: 'number', min: 0, max: 100, regen: 0, descriptors: [], code: 'return 50;' }],
      traits: [{ name: 'Hardy', statChanges: [{ value: 5, type: 'starting' }] }],
    } as unknown as RuleWorld;
    expect(only(idless, 'stat-code-overrides-trait')).toHaveLength(1);
  });

  it('resolves a chip in a name against a placeholder that lost its values', () => {
    // Names route through describePlaceholders inside the pass, so a valueless def must read as empty
    // there too — this is the one path STRIPPED's stat-description chip never exercises.
    const chipNamed = {
      ...base(),
      // The articled alias raises a finding that has to *name* the entity, forcing the chip resolve.
      entities: [{ id: 'e1', name: '{{ph:p1:world:pl1}}', aliases: ['the visitor'], locations: ['harbor'] }],
      placeholders: [{ id: 'p1', name: 'Hue' }],
    } as unknown as RuleWorld;
    const found = only(chipNamed, 'alias-leading-article');
    // The chip resolves to nothing, so the entity reads as Untitled rather than taking the pass down.
    expect(found).toHaveLength(1);
    expect(found[0].items[0].name).toBe('Untitled');
  });

  it('diagnoses a world carrying no collections at all', () => {
    const findings = runRules({} as RuleWorld);
    // A world with no locations has no starting one — the pass still has something true to say about it.
    expect(findings.map((f) => f.ruleId)).toEqual([
      'no-starting-location', 'world-empty-system-prompt', 'world-no-readme',
    ]);
    expect(findings[0].items[0].name).toBe('This World');
  });

  it('offers every quick fix on one, and a fix with nothing to repair never backfills an absent slice', () => {
    // `toBe`, not just not-throwing: a fix that returns `{ ...world, entities: [] }` for a world that never
    // had entities would write that array into the author's world through the editor's write-back.
    const bare = {} as RuleWorld;
    for (const rule of RULES) {
      expect(applyRuleFix(bare, rule.id)).toBe(bare);
    }
    // STRIPPED raises real findings, but none of them fixable with the slices it has — same world back.
    for (const rule of RULES) {
      expect(applyRuleFix(STRIPPED, rule.id)).toBe(STRIPPED);
    }
  });
});

/**
 * One fixture per fixable rule, each raising that rule and nothing the fix can't reach. The round-trip and
 * idempotence checks below run over this table, so a fix added without a fixture fails the registry test.
 */
const FIX_FIXTURES: Record<string, RuleWorld> = {
  'alias-leading-article': world([{ id: 'e1', name: 'Maren', aliases: ['the visitor', 'An Old Hand'] }]),
  'alias-self-duplicate': world([{ id: 'e1', name: 'Harbor Cats', aliases: ['Harbor Cat', 'strays'] }]),
  // The Centaur Breeder shape: the legacy flag is the world's only surviving record of where play starts.
  'legacy-start-location': base({ locations: [{ id: 'pasture', name: 'Pasture', isStartLocation: true } as GameLocation] }),
  'entity-location-orphan': base({ entities: [{ id: 'e1', name: 'Maren', locations: ['harbor', 'gone'] }] }),
  'placeholder-unused': base({ placeholders: [{ id: 'p1', name: 'Hue', values: ['red', 'blue'] }] }),
  // A percentage stat whose range was authored before the editor pinned it, with a start the pinning moves.
  'stat-percentage-bounds': base({ stats: [stat({ id: 's1', name: 'Fertility', type: 'percentage', min: 0, max: 200, starting: 150 })] }),
  // The floor-misreading shape: "from 70, Steady" leaves 70–100 silent; the fix stretches Steady to Max.
  'stat-descriptor-coverage-gap': base({ stats: [stat({ id: 's1', name: 'Vigor', starting: 40, descriptors: [
    { id: 'd1', threshold: 35, description: 'Winded' }, { id: 'd2', threshold: 70, description: 'Steady' },
  ] })] }),
  'location-parent-orphan': base({
    locations: [
      { id: 'harbor', name: 'Harbor Steps', isStarting: true },
      { id: 'loft', name: 'The Loft', parentId: 'gone' },
    ],
    entities: [resident, { ...resident, id: 'e-loft', name: 'Tallow', locations: ['loft'] }],
  }),
  'placeholder-weight-unknown-value': {
    ...world([{ id: 'e1', name: 'Maren', aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }]),
    placeholders: [{ id: 'p1', name: 'Vice', values: ['ale', 'dice'], weights: { ale: 2, grog: 3 } }],
  },
};

describe('quick fixes', () => {
  for (const [ruleId, before] of Object.entries(FIX_FIXTURES)) {
    it(`${ruleId}: repairs its own finding and raises nothing new`, () => {
      expect(only(before, ruleId).length).toBeGreaterThan(0);
      const after = applyRuleFix(before, ruleId);
      expect(only(after, ruleId)).toEqual([]);
      // Whatever else the fixture had wrong, the fix must not have added to it.
      const raised = new Set(runRules(before).map((f) => f.ruleId));
      expect(runRules(after).filter((f) => !raised.has(f.ruleId))).toEqual([]);
    });

    it(`${ruleId}: fixing twice equals fixing once`, () => {
      const once = applyRuleFix(before, ruleId);
      const twice = applyRuleFix(once, ruleId);
      expect(twice).toEqual(once);
      // Nothing left to repair means nothing rebuilt, so the second pass hands the world straight back.
      expect(twice).toBe(once);
    });
  }

  it('strips the article and leaves the rest of the alias list alone', () => {
    const fixed = applyRuleFix(FIX_FIXTURES['alias-leading-article'], 'alias-leading-article');
    expect(fixed.entities[0].aliases).toEqual(['visitor', 'Old Hand']);
  });

  it('collapses a strip that lands on an alias the entity already carries, in either order', () => {
    const stripTo = (aliases: string[]) =>
      applyRuleFix(world([{ id: 'e1', name: 'Maren', aliases }]), 'alias-leading-article').entities[0].aliases;
    expect(stripTo(['the visitor', 'visitor'])).toEqual(['visitor']);
    expect(stripTo(['visitor', 'the visitor'])).toEqual(['visitor']);
    expect(stripTo(['the visitor', 'a visitor'])).toEqual(['visitor']);
  });

  it('leaves an entity the finding never named untouched, duplicate aliases and all', () => {
    // The row is about articled aliases; tidying anything else would edit items the author was never shown.
    const before = world([
      { id: 'e1', name: 'Maren', aliases: ['the visitor'] },
      { id: 'e2', name: 'Old Tobb', aliases: ['Tobb', 'Tobb'] },
    ]);
    const fixed = applyRuleFix(before, 'alias-leading-article');
    expect(fixed.entities[0].aliases).toEqual(['visitor']);
    expect(fixed.entities[1]).toBe(before.entities[1]);
  });

  it('leaves an article that arrives from a chip’s value — there is nothing in the text to strip', () => {
    const chipped = {
      ...world([{ id: 'e1', name: 'Maren', aliases: ['{{ph:p1:world:pl1}} visitor'] }]),
      placeholders: [{ id: 'p1', name: 'Article', values: ['the'] }],
    };
    expect(only(chipped, 'alias-leading-article')).toHaveLength(1);
    expect(applyRuleFix(chipped, 'alias-leading-article').entities[0].aliases).toEqual(['{{ph:p1:world:pl1}} visitor']);
  });

  it('pins a percentage stat to 0–100 and brings its start along, exactly as retyping the type would', () => {
    const after = applyRuleFix(FIX_FIXTURES['stat-percentage-bounds'], 'stat-percentage-bounds');
    expect(after.stats[0]).toMatchObject({ min: 0, max: 100, starting: 100 });
  });

  it('drops the alias that repeats the entity name and keeps the rest', () => {
    const fixed = applyRuleFix(FIX_FIXTURES['alias-self-duplicate'], 'alias-self-duplicate');
    expect(fixed.entities[0].aliases).toEqual(['strays']);
  });

  it('carries a truthy legacy start flag onto isStarting rather than deleting the world’s only start intent', () => {
    const fixed = applyRuleFix(FIX_FIXTURES['legacy-start-location'], 'legacy-start-location');
    expect(fixed.locations[0]).toEqual({ id: 'pasture', name: 'Pasture', isStarting: true });
    expect('isStartLocation' in fixed.locations[0]).toBe(false);
  });

  it('just deletes the legacy flag when a real starting location already claims the world', () => {
    const fixed = applyRuleFix(base({
      locations: [
        { id: 'harbor', name: 'Harbor Steps', isStarting: true },
        { id: 'pasture', name: 'Pasture', isStartLocation: true } as GameLocation,
      ],
    }), 'legacy-start-location');
    expect(fixed.locations[1]).toEqual({ id: 'pasture', name: 'Pasture' });
    expect(fixed.locations.filter((l) => l.isStarting)).toHaveLength(1);
  });

  it('deletes a false-valued legacy flag without promoting anything', () => {
    const fixed = applyRuleFix(base({
      locations: [{ id: 'pasture', name: 'Pasture', isStartLocation: false } as GameLocation],
    }), 'legacy-start-location');
    expect(fixed.locations[0]).toEqual({ id: 'pasture', name: 'Pasture' });
  });

  it('drops only the dead placements from an entity that still has a live one', () => {
    const fixed = applyRuleFix(FIX_FIXTURES['entity-location-orphan'], 'entity-location-orphan');
    expect(fixed.entities[0].locations).toEqual(['harbor']);
  });

  it('leaves an entity whose only placement is dead — where it belongs instead is the author’s call', () => {
    const stranded = base({ entities: [{ id: 'e1', name: 'Maren', locations: ['gone'] }] });
    const fixed = applyRuleFix(stranded, 'entity-location-orphan');
    expect(fixed.entities[0].locations).toEqual(['gone']);
    // The finding stands rather than being traded for an entity placed nowhere at all.
    expect(only(fixed, 'entity-location-orphan')).toHaveLength(1);
    expect(only(fixed, 'entity-nowhere')).toEqual([]);
  });

  it('deletes every unreferenced placeholder and keeps the referenced ones', () => {
    const fixed = applyRuleFix({
      ...world([{ id: 'e1', name: 'Maren', aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }]),
      placeholders: [
        { id: 'p1', name: 'Vice', values: ['ale'] },
        { id: 'p2', name: 'Hue', values: ['red', 'blue'] },
      ],
    }, 'placeholder-unused');
    expect(fixed.placeholders?.map((p) => p.id)).toEqual(['p1']);
  });

  it('hands back the very same world when the rule has nothing to repair', () => {
    const clean = world([{ id: 'e1', name: 'Maren', aliases: ['Wren'] }]);
    for (const rule of RULES) expect(applyRuleFix(clean, rule.id)).toBe(clean);
  });

  it('leaves every slice it did not touch identical, so only the repair is written back', () => {
    const before = FIX_FIXTURES['alias-leading-article'];
    const after = applyRuleFix(before, 'alias-leading-article');
    expect(after.entities).not.toBe(before.entities);
    expect(after.locations).toBe(before.locations);
    expect(after.placeholders).toBe(before.placeholders);
    expect(after.worldOverview).toBe(before.worldOverview);
  });

  it('offers no fix where the repair is a judgment call', () => {
    // Which location should start, which of two colliding entities should be renamed, where a placeless
    // entity belongs — none of these has one right answer, so those rows offer Open and nothing else.
    for (const id of ['no-starting-location', 'entity-match-collision', 'entity-nowhere', 'stat-code-unknown-stat',
      'stat-starting-out-of-range', 'stat-descriptor-duplicate-threshold', 'stat-trait-delta-clamped']) {
      expect(RULES.find((r) => r.id === id)?.fix).toBeUndefined();
    }
  });

  it('marks a row fixable exactly when its rule carries a fix', () => {
    const groups = groupFindings(runRules({
      ...world([{ id: 'e1', name: 'Maren', aliases: ['the visitor'] }]),
      locations: [{ id: 'harbor', name: 'Harbor Steps' }],
    }));
    expect(groups.find((g) => g.ruleId === 'alias-leading-article')?.fixable).toBe(true);
    expect(groups.find((g) => g.ruleId === 'no-starting-location')?.fixable).toBe(false);
  });
});

describe('the matching subset Triggers surfaces', () => {
  // The world behind every case here: an articled alias, a self-duplicate, two entities matched by one
  // word, an entry that can never fire — and a structural defect that has no business in a matching tracer.
  const mixed: RuleWorld = {
    ...world([
      { id: 'e1', name: 'Maren', aliases: ['the visitor', 'Maren'] },
      { id: 'e2', name: 'Maren Vosk', aliases: ['Maren'] },
    ]),
    dictionaries: [book([entry({ id: 'd1', name: 'Orphan' })])],
    placeholders: [{ id: 'p1', name: 'Harbor', values: ['Sedge Landing'] }],
  };

  it('carries every matching rule and nothing structural', () => {
    expect(MATCHING_RULES.map((r) => r.id).sort()).toEqual([
      'alias-leading-article', 'alias-lowercase-no-twin', 'alias-self-duplicate',
      'dictionary-entry-inert', 'dictionary-keyword-substring',
      'dictionary-secondary-without-primary', 'entity-match-collision', 'entity-name-in-wildcard-pool',
    ]);
  });

  it('selects those findings out of a pass that already ran, leaving the rest to Issues', () => {
    const all = runRules(mixed);
    const matching = selectMatchingFindings(all);
    expect(new Set(matching.map((f) => f.ruleId))).toEqual(new Set([
      'alias-leading-article', 'alias-self-duplicate', 'entity-match-collision', 'dictionary-entry-inert',
    ]));
    // The unused placeholder is a real finding — it just isn't about matching, so the tracer never shows it.
    expect(all.some((f) => f.ruleId === 'placeholder-unused')).toBe(true);
    expect(matching.some((f) => f.ruleId === 'placeholder-unused')).toBe(false);
  });

  it('is the same finding Issues shows, item for item and word for word', () => {
    const all = runRules(mixed);
    for (const finding of selectMatchingFindings(all)) expect(all).toContain(finding);
  });

  it('reports a rule’s repair from the same registry the Issues row reads', () => {
    expect(isRuleFixable('alias-leading-article')).toBe(true);
    expect(isRuleFixable('entity-match-collision')).toBe(false);
    expect(isRuleFixable('no-such-rule')).toBe(false);
  });
});

/**
 * Every row the Issues list can show, classified by hand: `advanced` where acting on the finding needs a
 * field or tab Simple mode hides, `simple` where the author can fix it in either mode. A new rule is in
 * neither list until its author puts it in one, which is the point — an unclassified rule would default to
 * Simple and leak an Advanced concept to an author who has never seen the field.
 */
const RULE_SCOPE: Record<string, 'simple' | 'advanced'> = {
  // Aliases, chips, stat code and descriptors, the Advanced dictionary options, trait wiring, AI summaries.
  'alias-leading-article': 'advanced',
  'alias-lowercase-no-twin': 'advanced',
  'alias-self-duplicate': 'advanced',
  'ai-summary-hides-description': 'advanced',
  'chip-never-scanned': 'advanced',
  'chip-unknown-placeholder': 'advanced',
  'dictionary-disabled': 'advanced',
  'dictionary-regex-invalid': 'advanced',
  'dictionary-secondary-without-primary': 'advanced',
  'entity-long-description-no-summary': 'advanced',
  'entity-name-in-wildcard-pool': 'advanced',
  'placeholder-unused': 'advanced',
  'placeholder-weight-unknown-value': 'advanced',
  'stat-ai-lock-frozen': 'advanced',
  'stat-code-execution': 'advanced',
  'stat-code-never-ticks': 'advanced',
  'stat-code-overrides-trait': 'advanced',
  'stat-code-unknown-stat': 'advanced',
  'stat-descriptor-coverage-gap': 'advanced',
  'stat-descriptor-duplicate-threshold': 'advanced',
  'stat-descriptor-out-of-range': 'advanced',
  'stat-start-no-descriptor': 'advanced',
  'stat-trait-delta-clamped': 'advanced',
  'trait-pin-invalid': 'advanced',
  'trait-toggle-missing-stat': 'advanced',
  'wildcard-single-value': 'advanced',
  // Names, placement, structure, stat bounds, lore keywords, the world itself.
  'connection-endpoint-orphan': 'simple',
  'dictionary-entry-inert': 'simple',
  'dictionary-keyword-substring': 'simple',
  'entity-location-orphan': 'simple',
  // Rule-level granularity: a name-vs-name collision is Simple-fixable, and an alias-caused one riding the
  // same rule into Simple is the accepted cost of not classifying per finding.
  'entity-match-collision': 'simple',
  'entity-missing-ai-description': 'simple',
  'entity-missing-both-descriptions': 'simple',
  'entity-missing-player-description': 'simple',
  'entity-nowhere': 'simple',
  // Its field is invisible in both modes, and the repair is the row's own one-click fix.
  'legacy-start-location': 'simple',
  'location-no-entities': 'simple',
  'location-parent-orphan': 'simple',
  'no-starting-location': 'simple',
  'stat-disabled-forever': 'simple',
  'stat-percentage-bounds': 'simple',
  'stat-starting-out-of-range': 'simple',
  'stat-update-unknown-stat': 'simple',
  'trait-group-multiple-defaults': 'simple',
  'trait-group-too-small': 'simple',
  'world-empty-system-prompt': 'simple',
  'world-no-readme': 'simple',
  'world-oversized-images': 'simple',
};

describe('the rule registry', () => {
  it('gives every rule a unique id', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it('makes every rule decide whether Simple mode can act on it', () => {
    const heads = [...RULES, STAT_CODE_EXECUTION].map((r) => r.id);
    expect(heads.slice().sort()).toEqual(Object.keys(RULE_SCOPE).sort());
  });

  it('folds exactly the rules classified Advanced, execution head included', () => {
    for (const [ruleId, scope] of Object.entries(RULE_SCOPE)) {
      expect([ruleId, isAdvancedRule(ruleId)]).toEqual([ruleId, scope === 'advanced']);
    }
    // An id no rule owns is shown rather than folded — the fold is a decision, never a default.
    expect(isAdvancedRule('no-such-rule')).toBe(false);
  });

  it('round-trips every fix the engine carries', () => {
    // The guard on the table above: a rule that gains a fix without a fixture never gets round-tripped.
    expect(RULES.filter((r) => r.fix).map((r) => r.id).sort()).toEqual(Object.keys(FIX_FIXTURES).sort());
  });
});
