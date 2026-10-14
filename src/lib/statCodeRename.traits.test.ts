import { describe, expect, it } from 'vitest';
import type { Entity, Script, Stat, Trait, TraitGroup } from '@/types';
import { planCodeRename, type CodeRenamePlan } from './statCodeRename';
import type { TraitCodeHome } from './statCodeTargets';

const stat = (id: string, name: string): Stat => ({ id, name, type: 'number', value: 0, min: 0, max: 100 } as Stat);
const script = (id: string, code: string): Script => ({ id, timing: 'after', code });

// Brave is a world trait; Howl a Blueprint trait both entities link, Bram's link overriding its scripts; Grim
// is Bram's own trait. Every script names a stat a rename moves.
const blueprints: TraitGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], scripts: [script('b1', 'stats.Health.value += traits.Brave.enabled ? 1 : 0;')] };
const howl: Trait = { id: 'howl', name: 'Howl', statChanges: [], groupId: 'bp', scripts: [script('h1', 'owner.stats.Grit.value = stats.Health.value;')] };
const grim: Trait = { id: 'grim', name: 'Grim', statChanges: [], scripts: [script('g1', 'owner.stats.Grit.max = 9;')] };
const bram: Entity = {
  id: 'bram', name: 'Bram', stats: [stat('grit', 'Grit')], traits: [grim],
  traitLinks: [{
    id: 'l-bram', originalId: 'howl', kind: 'trait', originalName: 'Howl', groupId: null,
    overrides: { howl: { scripts: { value: [script('h1', 'stats.Health.value = 0;')], blueprint: howl.scripts! } } },
  }],
};
const cass: Entity = { id: 'cass', name: 'Cass', stats: [stat('cass-grit', 'Grit')], traitLinks: [{ id: 'l-cass', originalId: 'howl', kind: 'trait', originalName: 'Howl', groupId: null }] };
const world = { stats: [stat('health', 'Health')], traits: [brave, howl], traitGroups: [blueprints], entities: [bram, cass] };

const codeAt = (plan: CodeRenamePlan | null, home: TraitCodeHome, id: string) =>
  plan?.edits.find((edit) => JSON.stringify(edit.home) === JSON.stringify(home))?.scripts[id];

describe('a stat rename over trait scripts', () => {
  const plan = planCodeRename({
    root: 'stats', oldName: 'Health', newName: 'Vigor', otherNames: [], stat: { id: 'health' },
    stats: world.stats, entities: world.entities, traits: world.traits, traitGroups: world.traitGroups, placeholders: { list: [] },
  });

  it('rewrites a world trait’s script, a Blueprint trait’s and a link’s override', () => {
    expect(codeAt(plan, { kind: 'trait', traitId: 'brave' }, 'b1')).toBe('stats.Vigor.value += traits.Brave.enabled ? 1 : 0;');
    expect(codeAt(plan, { kind: 'trait', traitId: 'howl' }, 'h1')).toBe('owner.stats.Grit.value = stats.Vigor.value;');
    expect(codeAt(plan, { kind: 'traitLink', entityId: 'bram', linkId: 'l-bram', traitId: 'howl' }, 'h1')).toBe('stats.Vigor.value = 0;');
    expect(plan?.references).toBe(3);
  });

  it('follows owner.stats in an entity’s own trait to that entity’s stat', () => {
    const own = planCodeRename({
      root: 'stats', oldName: 'Grit', newName: 'Nerve', otherNames: [], stat: { id: 'grit', entityId: 'bram' },
      stats: world.stats, entities: world.entities, traits: world.traits, traitGroups: world.traitGroups, placeholders: { list: [] },
    });
    expect(codeAt(own, { kind: 'entityTrait', entityId: 'bram', traitId: 'grim' }, 'g1')).toBe('owner.stats.Nerve.max = 9;');
    // Howl's own script runs for Cass alone, whose Grit is another stat; Bram's override never names Grit.
    expect(codeAt(own, { kind: 'trait', traitId: 'howl' }, 'h1')).toBeUndefined();
  });
});

describe('a trait rename over trait scripts', () => {
  it('rewrites traits.Brave in a world trait’s script', () => {
    const plan = planCodeRename({
      root: 'traits', oldName: 'Brave', newName: 'Bold', otherNames: [],
      stats: world.stats, entities: world.entities, traits: world.traits, traitGroups: world.traitGroups,
    });
    expect(codeAt(plan, { kind: 'trait', traitId: 'brave' }, 'b1')).toBe('stats.Health.value += traits.Bold.enabled ? 1 : 0;');
  });
});
