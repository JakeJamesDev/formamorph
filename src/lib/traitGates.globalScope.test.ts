import { describe, expect, it } from 'vitest';
import type { Entity, PersonaRef, RequirementOwner, Trait, TraitGroup, TraitRequirement } from '@/types';
import { resolveOwners } from './owners';
import { NO_ACTIVE, gateOf, gateStates, type GateInput, type GateStats } from './traitGates';
import { scoped, type OwnerId } from './scope';

// The root offers Brave; Blueprints holds Paladin. Albus (a world persona) links Paladin, Mira (cast) links it
// too, and Wren is the Custom Persona entity. Every gated trait below names its target with Same Owner unless
// the case says otherwise.
const T = (id: string, extra: Partial<Trait> = {}): Trait => ({ id, name: id, statChanges: [], ...extra });
const trait = (id: string, owner?: RequirementOwner): TraitRequirement =>
  ({ kind: 'trait', id, ...(owner ? { owner } : {}) });
const needs = (...reqs: TraitRequirement[]) => [{ all: reqs }];
const link = (id: string, originalId: string) => ({ id, originalId, kind: 'trait' as const, originalName: originalId, groupId: null, order: 9 });

const groups: TraitGroup[] = [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }];
const brave = T('brave');
const paladin = T('paladin', { groupId: 'bp' });

const NONE: PersonaRef = { source: 'none' };
const AS_ALBUS: PersonaRef = { source: 'world', entityId: 'albus' };
const AS_LIB: PersonaRef = { source: 'library', entityId: 'lib' };

function input(
  { traits = [], albus = [], mira = [], wren, links = [] }: { traits?: Trait[]; albus?: Trait[]; mira?: Trait[]; wren?: Trait[]; links?: ReturnType<typeof link>[] },
  persona: PersonaRef,
  active: GateInput['active'],
  stats?: GateStats,
): GateInput {
  const entities: Entity[] = [
    { id: 'albus', name: 'Albus', persona: true, traits: albus, traitLinks: [link('l-albus', 'paladin'), ...links] } as Entity,
    { id: 'mira', name: 'Mira', traits: mira, traitLinks: [link('l-mira', 'paladin')] } as Entity,
    ...(wren ? [{ id: 'wren', name: 'Wren', customPersona: true, traits: wren } as Entity] : []),
  ];
  const lib: Entity[] = persona.source === 'library' ? [{ id: 'lib', name: 'Lib', persona: true } as Entity] : [];
  const { gate } = resolveOwners({ traits: [brave, paladin, ...traits], traitGroups: groups, entities }, persona, lib);
  return { ...gate, active, ...(stats ? { stats } : {}) };
}
const open = (gate: GateInput, ownerId: OwnerId, traitId: string) => gateOf(gateStates(gate), ownerId, traitId)?.unlocked;

describe('a requirement naming a global item (Q10)', () => {
  const oath = T('oath', { requires: needs(trait('brave')) });

  it.each([['None', NONE], ['a world persona', AS_ALBUS], ['a library persona', AS_LIB]] as const)(
    'reads global scope from an entity trait under %s',
    (_, persona) => {
      expect(open(input({ mira: [oath] }, persona, scoped(['brave'])), 'mira', 'oath')).toBe(true);
      expect(open(input({ mira: [oath] }, persona, scoped([])), 'mira', 'oath')).toBe(false);
    },
  );

  it('reads global scope through a stored You or entity owner, with no one played', () => {
    const named = T('oath', { requires: needs(trait('brave', { kind: 'you' })) });
    expect(open(input({ mira: [named] }, NONE, scoped(['brave'])), 'mira', 'oath')).toBe(true);
    const onAlbus = T('oath', { requires: needs(trait('brave', { kind: 'entity', id: 'albus' })) });
    expect(open(input({ mira: [onAlbus] }, NONE, scoped(['brave'])), 'mira', 'oath')).toBe(true);
  });

  // Q19: an importer may keep a stored owner; on a global item it is inert, even for an entity that is gone.
  it('reads global scope through a stored owner of an entity this world lacks, and resolves', () => {
    const gone = { kind: 'entity' as const, id: 'gone', name: 'Old Albus' };
    const oath = T('oath', { requires: needs(trait('brave', gone), { kind: 'stat', id: 'rage', owner: gone, operator: '>=', value: 50, unit: 'raw' }) });
    const stats = scoped({ rage: { name: 'Rage', value: 80, min: 0, max: 100 } });
    const gate = gateOf(gateStates(input({ mira: [oath] }, NONE, scoped(['brave']), stats)), 'mira', 'oath')!;
    expect(gate.unlocked).toBe(true);
    expect(gate.rows[0].conditions.map((c) => c.unresolved)).toEqual([false, false]);
  });

  it('reads a global stat from an entity trait, and an entity\'s own stat of the same id first', () => {
    const calm = T('calm', { requires: [{ all: [{ kind: 'stat', id: 'rage', operator: '>=', value: 50, unit: 'raw' }] }] });
    const stat = (value: number) => ({ name: 'Rage', value, min: 0, max: 100 });
    expect(open(input({ mira: [calm] }, NONE, NO_ACTIVE, scoped({ rage: stat(80) })), 'mira', 'calm')).toBe(true);
    expect(open(input({ mira: [calm] }, NONE, NO_ACTIVE, scoped({ rage: stat(80) }, { mira: { rage: stat(10) } })), 'mira', 'calm')).toBe(false);
  });
});

describe('You (Q13)', () => {
  const squire = T('squire', { requires: needs(trait('paladin', { kind: 'you' })) });

  it('reads the played entity', () => {
    expect(open(input({ mira: [squire] }, AS_ALBUS, scoped([], { albus: ['paladin'] })), 'mira', 'squire')).toBe(true);
    expect(open(input({ mira: [squire] }, AS_ALBUS, scoped([], { albus: [] })), 'mira', 'squire')).toBe(false);
  });

  it('is unmet, not unresolved, with no played entity', () => {
    const gate = gateOf(gateStates(input({ mira: [squire] }, NONE, scoped([], { albus: ['paladin'], mira: ['paladin'] }))), 'mira', 'squire')!;
    expect(gate.unlocked).toBe(false);
    expect(gate.rows[0].conditions[0]).toMatchObject({ text: 'Persona: paladin', holds: false, unresolved: false });
  });

  it('reads the Custom Persona entity under None', () => {
    const wren = [T('paladin')];
    expect(open(input({ mira: [squire], wren }, NONE, scoped([], { wren: ['paladin'] })), 'mira', 'squire')).toBe(true);
  });
});

describe('Same Owner (Q6)', () => {
  it('never pairs a global trait with the played entity\'s trait', () => {
    const squire = T('squire', { requires: needs(trait('paladin')) });
    expect(open(input({ traits: [squire] }, AS_ALBUS, scoped([], { albus: ['paladin'] })), null, 'squire')).toBe(false);
  });

  it('pairs an entity\'s own traits as before', () => {
    const smite = T('smite', { requires: needs(trait('paladin')) });
    expect(open(input({ albus: [smite] }, AS_ALBUS, scoped([], { albus: ['paladin'] })), 'albus', 'smite')).toBe(true);
    expect(open(input({ albus: [smite] }, AS_ALBUS, scoped([], { mira: ['paladin'] })), 'albus', 'smite')).toBe(false);
  });
});

describe('a linked trait the root also holds (Q17, Q29)', () => {
  // Hand-built: the world migration drops root links, so only data built in code holds one.
  const bold = T('bold', { requires: needs(trait('brave')) });
  const oath = T('oath', { requires: needs(trait('brave')) });
  const both = (active: GateInput['active']) => input({ traits: [bold], albus: [oath], links: [link('l-brave', 'brave')] }, AS_ALBUS, active);

  it('counts for the root and the persona, each by its own pick', () => {
    expect(open(both(scoped(['brave'], { albus: [] })), null, 'bold')).toBe(true);
    expect(open(both(scoped(['brave'], { albus: [] })), 'albus', 'oath')).toBe(false);
    expect(open(both(scoped([], { albus: ['brave'] })), null, 'bold')).toBe(false);
    expect(open(both(scoped([], { albus: ['brave'] })), 'albus', 'oath')).toBe(true);
    expect(open(both(scoped(['brave'], { albus: ['brave'] })), 'albus', 'oath')).toBe(true);
  });
});
