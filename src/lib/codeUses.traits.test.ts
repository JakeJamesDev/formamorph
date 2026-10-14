import { describe, expect, it } from 'vitest';
import { statBoxLookup, type CodeCardWorld } from './codeWorldLookup';
import { statCodeOwners } from './statCodeTargets';
import type { Entity, Script, Stat, Trait, TraitGroup } from '@/types';

const stat = (id: string, name: string): Stat =>
  ({ id, name, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [] });
const script = (id: string, code: string): Script => ({ id, timing: 'after', code });

// Brave reads Health; Kin is a Blueprint group whose Howl Bram links, his link overriding Howl's scripts.
const kin: TraitGroup = { id: 'kin', name: 'Kin', parentId: 'bp' };
const blueprints: TraitGroup = { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' };
const brave: Trait = { id: 'brave', name: 'Brave', statChanges: [], scripts: [script('b1', 'const x = 1;\nstats.Health.value = 2;')] };
const howl: Trait = { id: 'howl', name: 'Howl', statChanges: [], groupId: 'kin', scripts: [script('h1', 'traits.Brave.enabled = true;')] };
const bram: Entity = {
  id: 'bram', name: 'Bram',
  traitLinks: [{
    id: 'l-kin', originalId: 'kin', kind: 'trait', originalName: 'Kin', groupId: null,
    overrides: { howl: { scripts: { value: [script('h1', 'stats.Health.value = 0;')], blueprint: howl.scripts! } } },
  }],
};
const world: CodeCardWorld = {
  stats: [stat('health', 'Health')], traits: [brave, howl], traitGroups: [blueprints, kin], entities: [bram], placeholders: [],
};
const owners = statCodeOwners(world);
const lookup = statBoxLookup(owners, { owner: null, timing: 'after', self: world.stats![0] }, world);

describe('Find All Uses over trait scripts', () => {
  it('lists a stat’s uses in a world trait’s script and a trait link’s override, each on its trait’s row', () => {
    expect(lookup.uses({ kind: 'stat', statId: 'health' })).toEqual([
      { entityId: null, rowId: 'brave', trait: true, timing: 'after', scriptId: 'b1', name: 'Brave', line: 2, noOwners: false },
      // A trait below the linked group sits on the Link's row for it.
      { entityId: 'bram', rowId: 'l-kin/howl', trait: true, timing: 'after', scriptId: 'h1', name: 'Howl', entity: 'Bram', line: 1, noOwners: false },
    ]);
  });

  it('lists a trait’s uses in another trait’s script, marking a Blueprint trait no owner runs', () => {
    expect(lookup.uses({ kind: 'trait', traitId: 'brave' })).toEqual([
      { entityId: null, rowId: 'howl', trait: true, timing: 'after', scriptId: 'h1', name: 'Howl', line: 1, noOwners: true },
    ]);
  });
});
