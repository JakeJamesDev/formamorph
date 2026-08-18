import { describe, it, expect } from 'vitest';
import type { Trait, TraitGroup } from '@/types';
import { buildTraitSections, viewTraitSection } from './traitSections';

const T = (id: string, extra: Partial<Trait> = {}): Trait => ({
  id, name: id, statChanges: [], ...extra,
});
const G = (id: string, extra: Partial<TraitGroup> = {}): TraitGroup => ({
  id, name: id, parentId: null, ...extra,
});

/** Sections as `name → [subheader, ...traitIds]` per block, which is the shape every case reasons about. */
const shape = (traits: Trait[], groups: TraitGroup[]) =>
  buildTraitSections(traits, groups).map((s) => ({
    name: s.name,
    blocks: s.blocks.map((b) => ({ subheader: b.subheader, exclusive: b.exclusive, ids: b.traits.map((t) => t.id) })),
  }));

describe('building the traits panel sections', () => {
  it('gives a world with no groups one unnamed section, so the panel wears no chrome', () => {
    expect(shape([T('a'), T('b')], [])).toEqual([
      { name: null, blocks: [{ subheader: null, exclusive: false, ids: ['a', 'b'] }] },
    ]);
  });

  it('returns nothing when there are no traits to list', () => {
    expect(buildTraitSections([], [G('g1')])).toEqual([]);
  });

  it('gives each top-level group its own section, in authored order', () => {
    const groups = [G('g2', { order: 1 }), G('g1', { order: 0 })];
    const traits = [T('a', { groupId: 'g1' }), T('b', { groupId: 'g2' })];
    expect(shape(traits, groups).map((s) => s.name)).toEqual(['g1', 'g2']);
  });

  it('collects ungrouped traits under General, ahead of the authored groups', () => {
    const traits = [T('loose'), T('a', { groupId: 'g1' })];
    expect(shape(traits, [G('g1')])).toEqual([
      { name: 'General', blocks: [{ subheader: null, exclusive: false, ids: ['loose'] }] },
      { name: 'g1', blocks: [{ subheader: null, exclusive: false, ids: ['a'] }] },
    ]);
  });

  it('leaves a grouped world without loose traits with no General section', () => {
    expect(shape([T('a', { groupId: 'g1' })], [G('g1')]).map((s) => s.name)).toEqual(['g1']);
  });

  it('flattens nested subgroups into subheader blocks rather than nested sections', () => {
    const groups = [G('top'), G('mid', { parentId: 'top' }), G('deep', { parentId: 'mid' })];
    const traits = [T('own', { groupId: 'top' }), T('inner', { groupId: 'mid' }), T('deepest', { groupId: 'deep' })];
    expect(shape(traits, groups)).toEqual([
      {
        name: 'top',
        blocks: [
          { subheader: null, exclusive: false, ids: ['own'] },
          { subheader: 'mid', exclusive: false, ids: ['inner'] },
          { subheader: 'mid › deep', exclusive: false, ids: ['deepest'] },
        ],
      },
    ]);
  });

  it('hides a group whose whole subtree holds no traits', () => {
    const groups = [G('full'), G('empty'), G('emptyChild', { parentId: 'empty' })];
    expect(shape([T('a', { groupId: 'full' })], groups).map((s) => s.name)).toEqual(['full']);
  });

  it('keeps a group that holds traits only in a nested subgroup', () => {
    const groups = [G('top'), G('sub', { parentId: 'top' })];
    expect(shape([T('a', { groupId: 'sub' })], groups)).toEqual([
      { name: 'top', blocks: [{ subheader: 'sub', exclusive: false, ids: ['a'] }] },
    ]);
  });

  it('falls back to the flat section when every authored group is empty', () => {
    expect(shape([T('loose')], [G('empty')])).toEqual([
      { name: null, blocks: [{ subheader: null, exclusive: false, ids: ['loose'] }] },
    ]);
  });

  it('marks the block of an exclusive group, and only that block', () => {
    const groups = [G('picks', { exclusive: true }), G('sub', { parentId: 'picks' })];
    const traits = [T('a', { groupId: 'picks' }), T('b', { groupId: 'sub' })];
    expect(shape(traits, groups)[0].blocks).toEqual([
      { subheader: null, exclusive: true, ids: ['a'] },
      { subheader: 'sub', exclusive: false, ids: ['b'] },
    ]);
  });

  it('marks an exclusive subgroup inside a plain parent', () => {
    const groups = [G('top'), G('sub', { parentId: 'top', exclusive: true })];
    expect(shape([T('a', { groupId: 'sub' })], groups)[0].blocks).toEqual([
      { subheader: 'sub', exclusive: true, ids: ['a'] },
    ]);
  });

  it('orders traits within a block by their authored order, not the array order', () => {
    const traits = [T('second', { groupId: 'g1', order: 1 }), T('first', { groupId: 'g1', order: 0 })];
    expect(shape(traits, [G('g1')])[0].blocks[0].ids).toEqual(['first', 'second']);
  });

  it('surfaces a trait pointing at a deleted group in the flat/General list rather than dropping it', () => {
    const traits = [T('orphan', { groupId: 'gone' }), T('a', { groupId: 'g1' })];
    expect(shape(traits, [G('g1')])).toEqual([
      { name: 'General', blocks: [{ subheader: null, exclusive: false, ids: ['orphan'] }] },
      { name: 'g1', blocks: [{ subheader: null, exclusive: false, ids: ['a'] }] },
    ]);
  });

  it('gives every section and block a distinct key, so a group named General cannot collide', () => {
    const groups = [G('general', { name: 'General' })];
    const sections = buildTraitSections([T('loose'), T('a', { groupId: 'general' })], groups);
    expect(new Set(sections.map((s) => s.key)).size).toBe(2);
    expect(new Set(sections.flatMap((s) => s.blocks.map((b) => b.key))).size).toBe(2);
  });
});

describe('viewing one section against the filter and the enabled set', () => {
  const groups = [G('g1'), G('sub', { parentId: 'g1' })];
  const traits = [
    T('on', { groupId: 'g1', name: 'Iron Stomach' }),
    T('off', { groupId: 'g1', name: 'Bad Knee', playerDescription: 'It aches before rain.' }),
    T('deepOn', { groupId: 'sub', name: 'Webbed Fingers' }),
  ];
  const section = () => buildTraitSections(traits, groups)[0];
  const isOff = (id: string) => id === 'off';

  it('splits a section into enabled blocks first and the disabled remainder', () => {
    const view = viewTraitSection(section(), { query: '', isOff });
    expect(view?.enabled.map((b) => b.traits.map((t) => t.id))).toEqual([['on'], ['deepOn']]);
    expect(view?.disabled.map((b) => b.traits.map((t) => t.id))).toEqual([['off']]);
    expect([view?.enabledCount, view?.disabledCount]).toEqual([2, 1]);
  });

  it('keeps each half under its own subheader, so a split block does not lose its heading', () => {
    const view = viewTraitSection(section(), { query: '', isOff: (id) => id === 'deepOn' });
    expect(view?.enabled.map((b) => b.subheader)).toEqual([null]);
    expect(view?.disabled.map((b) => b.subheader)).toEqual(['sub']);
  });

  it('narrows to traits whose name matches the query, ignoring case', () => {
    const view = viewTraitSection(section(), { query: 'webbed', isOff });
    expect(view?.enabled.flatMap((b) => b.traits.map((t) => t.id))).toEqual(['deepOn']);
    expect(view?.disabledCount).toBe(0);
  });

  it('matches the player description too, so a trait is findable by what it does', () => {
    const view = viewTraitSection(section(), { query: 'aches', isOff });
    expect(view?.disabled.flatMap((b) => b.traits.map((t) => t.id))).toEqual(['off']);
    expect(view?.enabledCount).toBe(0);
  });

  it('matches the description the player actually reads, not the unresolved text', () => {
    const pinned = [T('p', { groupId: 'g1', name: 'Native', playerDescription: '{{ph:town}}' })];
    const view = viewTraitSection(buildTraitSections(pinned, groups)[0], {
      query: 'sedge',
      isOff: () => false,
      describe: () => 'Sedge',
    });
    expect(view?.enabledCount).toBe(1);
  });

  it('drops the section entirely when nothing matches', () => {
    expect(viewTraitSection(section(), { query: 'nothing here', isOff })).toBeNull();
  });

  it('counts only the matches while a filter is on, so a badge never overstates the section', () => {
    const view = viewTraitSection(section(), { query: 'iron', isOff: () => false });
    expect(view?.enabledCount).toBe(1);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(viewTraitSection(section(), { query: '   ', isOff })?.enabledCount).toBe(2);
  });
});
