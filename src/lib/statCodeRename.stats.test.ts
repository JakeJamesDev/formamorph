import { describe, expect, it } from 'vitest';
import type { Entity, Stat, StatGroup } from '@/types';
import { planCodeRename, type CodeRenamePlan, type RenamedStat } from './statCodeRename';
import type { CodeHome } from './statCodeTargets';
import type { StatCodeTiming } from './statCodeTiming';
import { boxScripts, codeAt } from '@/test/scriptFixtures';

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat =>
  ({ id, name, type: 'number', value: 0, min: 0, max: 100, ...extra } as Stat);

// City Rampage, cut down: The Creature can be played and owns a Rage; Bram owns another Rage; the world has a
// third. Howl is a Blueprint both entities link, and Bram's link overrides its code.
const blueprints: StatGroup = { id: 'bp', name: 'Blueprints', system: 'blueprints' } as StatGroup;
const destruction = stat('destruction', 'Destruction');
const alert = stat('alert', 'Alert', {
  scripts: boxScripts({ after: 'return stats.Destruction.value + stats.Rage.value + entities["The Creature"].stats.Rage.value'
    + ' + entities.Bram.stats.Rage.value + entities[\'Bram\'].stats[\'Rage\'].value + persona.stats.Rage.value;' }),
});
const worldRage = stat('world-rage', 'Rage');
const howl = stat('howl', 'Howl', { groupId: 'bp', scripts: boxScripts({ after: 'return owner.stats.Rage.value + stats.Destruction.value;' }) });
const creatureRage = stat('creature-rage', 'Rage', {
  scripts: boxScripts({ before: 'owner.stats.Rage.max = 50; stats.Rage.value += 1;', after: 'return stats.Destruction.value + owner.stats.Rage.value + entities.Bram.stats.Rage.value;' }),
});
const bramRage = stat('bram-rage', 'Rage', { scripts: boxScripts({ after: 'return owner.stats.Rage.value + entities["The Creature"].stats.Rage.value;' }) });
const howlLink = (id: string, code?: string) => ({
  id, originalId: 'howl', kind: 'stat' as const, originalName: 'Howl', groupId: null, order: 1,
  ...(code === undefined ? {} : { overrides: { howl: { scripts: { value: boxScripts({ after: code }), blueprint: howl.scripts ?? [] } } } }),
});
const creature: Entity = { id: 'creature', name: 'The Creature', persona: true, stats: [creatureRage], statLinks: [howlLink('l-creature')] };
const bram: Entity = {
  id: 'bram', name: 'Bram', stats: [bramRage],
  statLinks: [howlLink('l-bram', 'return owner.stats.Rage.value + stats.Destruction.value + 1;')],
};
const world = { stats: [destruction, alert, worldRage, howl], statGroups: [blueprints], entities: [creature, bram] };

/** One rename of `renamed`, `oldName` to `newName`, over the City Rampage world or a variant of it. */
const rename = (renamed: RenamedStat, oldName: string, newName: string, over: Partial<typeof world> = {}) => {
  const at = { ...world, ...over };
  return planCodeRename({
    root: 'stats', oldName, newName, otherNames: [], stat: renamed,
    stats: at.stats, statGroups: at.statGroups, entities: at.entities, placeholders: { list: [] },
  });
};

/** The rewritten text of one box, or undefined where the rename leaves it alone. */
const boxAt = (plan: CodeRenamePlan | null, home: CodeHome, timing: StatCodeTiming = 'after') =>
  plan?.edits.find((edit) => JSON.stringify(edit.home) === JSON.stringify(home))?.scripts[timing];

const ofWorld = (statId: string): CodeHome => ({ kind: 'stat', statId });
const ofEntity = (entityId: string, statId: string): CodeHome => ({ kind: 'entity', entityId, statId });
const bramLink: CodeHome = { kind: 'link', entityId: 'bram', linkId: 'l-bram', statId: 'howl' };

describe('renaming a world stat', () => {
  const plan = rename({ id: 'destruction' }, 'Destruction', 'Ruin');

  it('rewrites stats.Destruction in a world box and in The Creature’s own box', () => {
    expect(boxAt(plan, ofWorld('alert'))).toContain('stats.Ruin.value + stats.Rage.value');
    expect(boxAt(plan, ofEntity('creature', 'creature-rage')))
      .toBe('return stats.Ruin.value + owner.stats.Rage.value + entities.Bram.stats.Rage.value;');
  });

  it('rewrites a Blueprint box and a link’s override box', () => {
    expect(boxAt(plan, ofWorld('howl'))).toBe('return owner.stats.Rage.value + stats.Ruin.value;');
    expect(boxAt(plan, bramLink)).toBe('return owner.stats.Rage.value + stats.Ruin.value + 1;');
  });

  it('counts every key it rewrites', () => {
    expect(plan?.references).toBe(4);
  });
});

describe('renaming a world stat that shares its name with entity stats', () => {
  it('rewrites only stats.Rage, and leaves every owned Rage alone', () => {
    const plan = rename({ id: 'world-rage' }, 'Rage', 'Wrath');
    expect(boxAt(plan, ofWorld('alert'))).toBe(codeAt(alert)!.replace('stats.Rage.value + entities', 'stats.Wrath.value + entities'));
    expect(boxAt(plan, ofEntity('creature', 'creature-rage'), 'before')).toBe('owner.stats.Rage.max = 50; stats.Wrath.value += 1;');
    expect(boxAt(plan, ofEntity('creature', 'creature-rage'))).toBeUndefined();
    expect(boxAt(plan, ofEntity('bram', 'bram-rage'))).toBeUndefined();
    expect(plan?.references).toBe(2);
  });
});

describe('renaming an entity’s own stat', () => {
  it('rewrites owner.stats in its own boxes, entities by bracket, and persona', () => {
    const plan = rename({ id: 'creature-rage', entityId: 'creature' }, 'Rage', 'Fury');
    expect(boxAt(plan, ofEntity('creature', 'creature-rage'), 'before')).toBe('owner.stats.Fury.max = 50; stats.Rage.value += 1;');
    expect(boxAt(plan, ofEntity('creature', 'creature-rage')))
      .toBe('return stats.Destruction.value + owner.stats.Fury.value + entities.Bram.stats.Rage.value;');
    expect(boxAt(plan, ofWorld('alert'))).toBe(
      'return stats.Destruction.value + stats.Rage.value + entities["The Creature"].stats.Fury.value'
      + ' + entities.Bram.stats.Rage.value + entities[\'Bram\'].stats[\'Rage\'].value + persona.stats.Fury.value;',
    );
    expect(boxAt(plan, ofEntity('bram', 'bram-rage'))).toBe('return owner.stats.Rage.value + entities["The Creature"].stats.Fury.value;');
  });

  it('rewrites a Blueprint box its owner runs, where no other owner reaches a Rage there', () => {
    const plan = rename({ id: 'creature-rage', entityId: 'creature' }, 'Rage', 'Fury');
    expect(boxAt(plan, ofWorld('howl'))).toBe('return owner.stats.Fury.value + stats.Destruction.value;');
    expect(boxAt(plan, bramLink)).toBeUndefined();
  });

  it('rewrites entities by dot and bracket, and leaves persona to the entity that can be played', () => {
    const plan = rename({ id: 'bram-rage', entityId: 'bram' }, 'Rage', 'Spite');
    expect(boxAt(plan, ofWorld('alert'))).toBe(
      'return stats.Destruction.value + stats.Rage.value + entities["The Creature"].stats.Rage.value'
      + ' + entities.Bram.stats.Spite.value + entities[\'Bram\'].stats[\'Spite\'].value + persona.stats.Rage.value;',
    );
    expect(boxAt(plan, ofEntity('bram', 'bram-rage'))).toBe('return owner.stats.Spite.value + entities["The Creature"].stats.Rage.value;');
    expect(boxAt(plan, bramLink)).toBe('return owner.stats.Spite.value + stats.Destruction.value + 1;');
    expect(boxAt(plan, ofWorld('howl'))).toBeUndefined();
  });

  it('resolves against the old name when the world already holds the new one', () => {
    // The offer asks once the field commits, so the world it reads carries the new name.
    const renamed = { ...creature, stats: [{ ...creatureRage, name: 'Fury' }] };
    const plan = rename({ id: 'creature-rage', entityId: 'creature' }, 'Rage', 'Fury', { entities: [renamed, bram] });
    expect(boxAt(plan, ofEntity('bram', 'bram-rage'))).toBe('return owner.stats.Rage.value + entities["The Creature"].stats.Fury.value;');
  });

  it('leaves a duplicated entity’s copy alone, though its stat keeps the same id', () => {
    const copy: Entity = { ...creature, id: 'creature-copy', name: 'Twin', persona: false, statLinks: [] };
    const reader = stat('reader', 'Reader', { scripts: boxScripts({ after: 'return entities.Twin.stats.Rage.value;' }) });
    const plan = rename({ id: 'creature-rage', entityId: 'creature' }, 'Rage', 'Fury', {
      stats: [...world.stats, reader], entities: [creature, bram, copy],
    });
    expect(boxAt(plan, ofWorld('reader'))).toBeUndefined();
    expect(boxAt(plan, ofEntity('creature-copy', 'creature-rage'))).toBeUndefined();
    expect(boxAt(plan, ofEntity('creature', 'creature-rage'))).toContain('owner.stats.Fury.value');
  });

  it('leaves a route alone that also reaches another stat of that name', () => {
    // Both can be played and Bram's link no longer overrides, so persona and Howl's owner reach two Rages.
    const both = [creature, { ...bram, persona: true, statLinks: [howlLink('l-bram')] }];
    const plan = rename({ id: 'creature-rage', entityId: 'creature' }, 'Rage', 'Fury', { entities: both });
    expect(boxAt(plan, ofWorld('alert'))).toContain('persona.stats.Rage.value');
    expect(boxAt(plan, ofWorld('howl'))).toBeUndefined();
  });
});

describe('renaming a Blueprint stat', () => {
  it('follows its owners’ copies and leaves stats, which never reaches a Blueprint', () => {
    const reader = stat('reader', 'Reader', { scripts: boxScripts({ after: 'return stats.Howl.value + entities.Bram.stats.Howl.value;' }) });
    const plan = rename({ id: 'howl' }, 'Howl', 'Roar', { stats: [...world.stats, reader] });
    expect(boxAt(plan, ofWorld('reader'))).toBe('return stats.Howl.value + entities.Bram.stats.Roar.value;');
  });
});

it('offers nothing when no route reaches the renamed stat', () => {
  expect(rename({ id: 'alert' }, 'Alert', 'Alarm')).toBeNull();
});
