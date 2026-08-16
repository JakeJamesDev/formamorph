import { describe, it, expect } from 'vitest';
import type { Entity, WorldOverview } from '@/types';
import { runRules, groupFindings, RULES, type RuleWorld } from './rules';

// A world an author could plausibly have open: the Bench reads the whole payload, so the fixture is a real
// one with only the entity roster varying between the defective and corrected takes.
const world = (entities: Entity[]): RuleWorld => ({
  worldOverview: { name: 'Sedge Landing', description: '', systemPrompt: '' } as WorldOverview,
  stats: [], locations: [], entities, traits: [], statUpdates: [], dictionaries: [], placeholders: [],
});

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

describe('the rule registry', () => {
  it('gives every rule a unique id', () => {
    expect(new Set(RULES.map((r) => r.id)).size).toBe(RULES.length);
  });
});
