import { describe, it, expect } from 'vitest';
import type { Dictionary, DictionaryEntry, Entity, GameLocation, Stat, Trait, WorldOverview } from '@/types';
import { applyRuleFix, runRules, groupFindings, RULES, type RuleWorld } from './rules';

// A structurally sound base world — a flagged starting location and nothing else — so each pack's tests
// see only the defects they author in, and a clean fixture really does raise zero findings.
const base = (overrides: Partial<RuleWorld> = {}): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: 'Narrate the fen.' } as WorldOverview,
  stats: [],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }],
  entities: [],
  traits: [], statUpdates: [], dictionaries: [], placeholders: [],
  ...overrides,
});

// The alias tests' shorthand: the roster, placed at the starting location so presence rules stay quiet.
const world = (entities: Entity[]): RuleWorld =>
  base({ entities: entities.map((e) => ({ locations: ['harbor'], ...e })) });

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
    expect(runRules(base({ entities: [{ id: 'e1', name: 'Maren', locations: ['harbor'] }] }))).toEqual([]);
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
    const chipped = (id: string) => base({
      placeholders: [{ id: 'p1', name: 'Visitor', values: ['Maren'] }],
      entities: [{ id: 'e1', name: 'Maren', locations: ['harbor'], aiDescription: `A {{ph:${id}:world:pl1}} of the fen.` }],
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
    const described = (description: string) => base({
      placeholders: [{ id: 'p1', name: 'Vice', values: ['ale'] }],
      // The placeholder earns its place in a field that does resolve, so removing the stat's chip leaves a
      // world with nothing else wrong with it.
      entities: [{ id: 'e1', name: 'Maren', locations: ['harbor'], aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }],
      stats: [stat({ id: 's1', name: 'Vigor', description })],
    });
    const found = only(described('Craving for {{ph:p1:world:pl1}}.'), 'chip-never-scanned');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].items.map((i) => i.id)).toEqual(['s1']);
    expect(runRules(described('Craving for ale.'))).toEqual([]);
  });

  it('flags a chip in a stat descriptor', () => {
    const described = (description: string) => base({
      placeholders: [{ id: 'p1', name: 'Vice', values: ['ale'] }],
      entities: [{ id: 'e1', name: 'Maren', locations: ['harbor'], aiDescription: 'Fond of {{ph:p1:world:pl1}}.' }],
      stats: [stat({ id: 's1', name: 'Vigor', descriptors: [{ id: 1, threshold: 0, description }] })],
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

    expect(runRules(coded('const a = stats.find(s => s.name === "Vigor")?.value ?? 0;\nreturn a;'))).toEqual([]);
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
    const found = only(base({ locations: [{ id: 'l1', name: 'Fen' }] }), 'no-starting-location');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].section).toBe('locations');
    expect(runRules(base({ locations: [{ id: 'l1', name: 'Fen', isStarting: true }] }))).toEqual([]);
  });

  it('flags the legacy isStartLocation field, which the game no longer reads', () => {
    const withLegacy = base({
      locations: [{ id: 'l1', name: 'Fen', isStarting: true, isStartLocation: true } as GameLocation],
    });
    const found = only(withLegacy, 'legacy-start-location');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('warning');
    expect(found[0].items.map((i) => i.id)).toEqual(['l1']);
    expect(found[0].message).toContain('flag it as a starting location instead');
    expect(runRules(base({ locations: [{ id: 'l1', name: 'Fen', isStarting: true }] }))).toEqual([]);
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
    expect(runRules(base({ entities: [{ id: 'e1', name: 'Farm Visitors', locations: ['harbor'] }] }))).toEqual([]);
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
    expect(runRules(base({
      entities: [{ id: 'e1', name: 'Maren', locations: ['harbor'] }],
      stats: [stat({ id: 's1', name: 'Vigor' })],
      dictionaries: [book([entry({ id: 'd1', name: 'Fen Lore', key: ['fen'] })])],
      traits: [trait({ id: 't1', name: 'Hardy' })],
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
    for (const id of ['no-starting-location', 'entity-match-collision', 'entity-nowhere', 'stat-code-unknown-stat']) {
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

describe('the rule registry', () => {
  it('gives every rule a unique id', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });

  it('round-trips every fix the engine carries', () => {
    // The guard on the table above: a rule that gains a fix without a fixture never gets round-tripped.
    expect(RULES.filter((r) => r.fix).map((r) => r.id).sort()).toEqual(Object.keys(FIX_FIXTURES).sort());
  });
});
