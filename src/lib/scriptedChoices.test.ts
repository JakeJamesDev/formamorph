import { describe, expect, it } from 'vitest';
import type { Entity, Script, Stat, StatGroup, Trait, TraitGroup } from '@/types';
import { sameChoices, scriptsChangeChoices } from './scriptedChoices';
import type { ScriptTreeWorld } from './worldScripts';

const stat = (id: string, scripts: Script[], extra: Partial<Stat> = {}): Stat =>
  ({ id, name: id, type: 'number', description: '', min: 0, max: 100, value: 0, regen: 0, descriptors: [], scripts, ...extra });
const trait = (id: string, scripts: Script[], extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], scripts, ...extra });
const after = (code: string): Script[] => [{ id: 'a', timing: 'after', code }];
const statBlueprints = { id: 'sbp', name: 'Blueprints', parentId: null, system: 'blueprints' } as StatGroup;
const traitBlueprints = { id: 'tbp', name: 'Blueprints', parentId: null, system: 'blueprints' } as TraitGroup;

const WRITE = 'turn.choices.push("x");';
const QUIET = 'stats.Health.value += 1;';
type Home = 'world' | 'global stat' | 'entity stat' | 'blueprint stat' | 'stat link override' | 'trait link override' | 'global trait' | 'entity trait' | 'blueprint trait';

/** A world with one After the AI box on every home; `home` holds `code` and the others a write that names no `turn`. */
function worldWith(home: Home | null, code = WRITE): ScriptTreeWorld {
  const at = (here: Home) => after(here === home ? code : QUIET);
  const howl = stat('howl', at('blueprint stat'), { groupId: 'sbp' });
  const fury = trait('fury', at('blueprint trait'), { groupId: 'tbp' });
  const entity: Entity = {
    id: 'ann', name: 'Ann', stats: [stat('rage', at('entity stat'))], traits: [trait('calm', at('entity trait'))],
    statLinks: [{
      id: 'ann-howl', originalId: 'howl', kind: 'stat', originalName: 'howl', groupId: null, order: 0,
      overrides: { howl: { scripts: { value: at('stat link override'), blueprint: howl.scripts! } } },
    }],
    traitLinks: [{
      id: 'ann-fury', originalId: 'fury', kind: 'trait', originalName: 'fury', groupId: null,
      overrides: { fury: { scripts: { value: at('trait link override'), blueprint: fury.scripts! } } },
    }],
  };
  return {
    scripts: at('world'),
    stats: [stat('health', at('global stat')), howl], statGroups: [statBlueprints],
    traits: [trait('brave', at('global trait')), fury], traitGroups: [traitBlueprints],
    entities: [entity], placeholders: [],
  };
}

describe('scriptsChangeChoices', () => {
  it.each<Home>(['world', 'global stat', 'entity stat', 'blueprint stat', 'stat link override', 'trait link override', 'global trait', 'entity trait', 'blueprint trait'])(
    'marks a world whose %s After the AI box writes turn.choices',
    (home) => expect(scriptsChangeChoices(worldWith(home))).toBe(true),
  );

  it('leaves a world with no turn in any After the AI box unmarked', () => {
    expect(scriptsChangeChoices(worldWith(null))).toBe(false);
  });

  it.each([
    ['an alias', 'const t = turn; t.choices = [];'],
    ['a destructure', 'const { choices } = turn; choices.pop();'],
    ['a read of turn.action alone', 'if (turn.action.includes("run")) stats.Health.value -= 1;'],
    ['a template slot', 'log(`${turn.number}`);'],
  ])('marks a box that names turn through %s', (_name, code) => {
    expect(scriptsChangeChoices(worldWith('global stat', code))).toBe(true);
  });

  it.each([
    ['a comment', '// turn.choices = [];'],
    ['a string', 'log("turn.choices");'],
    ['a member', 'entities.Ann.turn = 1;'],
    ['a bracket key', 'entities["turn"].stats.Health.value = 1;'],
    ['a longer name', 'const turnCount = 1;'],
  ])('leaves a box that names turn only in %s unmarked', (_name, code) => {
    expect(scriptsChangeChoices(worldWith('global stat', code))).toBe(false);
  });

  it('leaves a world whose turn write sits in a Before the AI box unmarked', () => {
    const world = worldWith(null);
    expect(scriptsChangeChoices({ ...world, scripts: [{ id: 'b', timing: 'before', code: WRITE }] })).toBe(false);
  });
});

describe('sameChoices', () => {
  it('holds for equal lists, including two empty ones', () => {
    expect(sameChoices(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameChoices([], [])).toBe(true);
  });

  it('fails when the order differs', () => {
    expect(sameChoices(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('fails when an item is edited, added or dropped', () => {
    expect(sameChoices(['a', 'b'], ['a', 'c'])).toBe(false);
    expect(sameChoices(['a'], ['a', 'b'])).toBe(false);
    expect(sameChoices(['a', 'b'], ['a'])).toBe(false);
  });
});
