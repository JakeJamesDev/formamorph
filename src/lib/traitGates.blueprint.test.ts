import { describe, expect, it } from 'vitest';
import type { Entity, PersonaRef, StatRequirement, Trait, TraitGroup, TraitRequirement } from '@/types';
import { resolveOwners } from './owners';
import { requirementStatSections } from './requirementStatOptions';
import { scoped } from './scope';
import {
  NO_ACTIVE, clauseText, conditionClauses, gateOf, gateStates, isBlueprintTrait, ruleStates, type ClauseHost, type GateInput, type GateStat, type GateStatSet,
} from './traitGates';

// Blueprints holds the trait Bold, the group Virtues and the stat Courage. Brave, the group Combat and the stat
// Gold are global. Mira and Wren link Bold; Mira holds Courage.
const stat = (name: string): GateStat => ({ name, value: 5, min: 0, max: 10 });
const T = (id: string, name: string, extra: Partial<Trait> = {}): Trait => ({ id, name, statChanges: [], ...extra });
const groups: TraitGroup[] = [
  { id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' },
  { id: 'virtues', name: 'Virtues', parentId: 'bp' },
  { id: 'combat', name: 'Combat', parentId: null },
];
const courageReq: StatRequirement = { kind: 'stat', id: 'courage', operator: '>=', value: 5, unit: 'raw' };
const goldReq: TraitRequirement = { kind: 'stat', id: 'gold', operator: '>=', value: 5, unit: 'raw' };
const reqs = {
  bold: { kind: 'trait', id: 'bold' } as TraitRequirement,
  virtues: { kind: 'group', id: 'virtues' } as TraitRequirement,
  brave: { kind: 'trait', id: 'brave' } as TraitRequirement,
  combat: { kind: 'group', id: 'combat' } as TraitRequirement,
};
const gate = T('gate', 'Gate', {
  groupId: 'bp',
  requires: [{ all: [reqs.bold, courageReq, reqs.brave, goldReq] }],
});
const traits = [T('brave', 'Brave', { groupId: 'combat' }), T('bold', 'Bold', { groupId: 'virtues' }), gate];
const blueprintStats: GateStatSet = { courage: stat('Courage') };
const stats = scoped<GateStatSet>({ gold: stat('Gold') }, { mira: { courage: stat('Courage') }, wren: {} });
const link = (id: string, originalId: string) => ({ id, originalId, kind: 'trait' as const, originalName: originalId, groupId: null, order: 9 });
const entities = [
  { id: 'mira', name: 'Mira', persona: true, traits: [], traitLinks: [link('l1', 'gate'), link('l2', 'bold')] },
  { id: 'wren', name: 'Wren', traits: [], traitLinks: [link('l3', 'gate'), link('l4', 'bold')] },
] as unknown as Entity[];

function input(persona: PersonaRef = { source: 'none' }, reader?: 'player'): GateInput {
  const { gate: resolved } = resolveOwners({ traits, traitGroups: groups, entities }, persona);
  return { ...resolved, active: NO_ACTIVE, stats, blueprintStats, ...(reader ? { reader } : {}) };
}

const BLUEPRINT: ClauseHost = { kind: 'blueprint' };
const WORLD: ClauseHost = { kind: 'world' };
const read = (req: TraitRequirement, host: ClauseHost, view: Partial<{ sentenceStart: boolean }> = { sentenceStart: true }, gateInput = input()) =>
  clauseText(conditionClauses(gateInput)(req, { host, ...view }));

describe('a Blueprint target on a Blueprint’s own field (Q37)', () => {
  it('reads "This entity" for a Blueprint trait, group and stat with no owner', () => {
    expect(read(reqs.bold, BLUEPRINT)).toBe('This entity has Bold');
    expect(read(reqs.virtues, BLUEPRINT)).toBe('This entity has a trait in Virtues');
    expect(read(courageReq, BLUEPRINT)).toBe("This entity's Courage is at least 5");
    expect(read({ ...reqs.bold, not: true }, BLUEPRINT)).toBe("This entity doesn't have Bold");
  });

  it('keeps the world reading for a Global Trait, group and stat on the same field (Q25)', () => {
    expect(read(reqs.brave, BLUEPRINT)).toBe('Brave is active');
    expect(read(reqs.combat, BLUEPRINT)).toBe('A trait in Combat is active');
    expect(read(goldReq, BLUEPRINT)).toBe('Gold is at least 5');
  });

  it('reads a Blueprint target as a Global one only where the host is not a Blueprint', () => {
    expect(read(reqs.bold, WORLD)).toBe('Bold is active');
  });

  it('keeps a named owner on a Blueprint target', () => {
    const named: StatRequirement = { ...courageReq, owner: { kind: 'entity', id: 'mira', name: 'Mira' } };
    expect(read(named, BLUEPRINT)).toBe("Mira's Courage is at least 5");
  });

  it('reads the same author view for the player view, which has no played entity here', () => {
    const player = input({ source: 'none' }, 'player');
    expect(read(reqs.bold, BLUEPRINT, undefined, player)).toBe('This entity has Bold');
  });

  it('keeps an item rule’s and a location rule’s subject for a Blueprint target', () => {
    expect(read(reqs.bold, { kind: 'item' })).toBe("The item's owner has Bold");
    expect(read(courageReq, { kind: 'item' })).toBe("The item's owner's Courage is at least 5");
    expect(read(reqs.bold, { kind: 'persona' })).toBe('The player has Bold');
    expect(read(courageReq, { kind: 'persona' })).toBe("The player's Courage is at least 5");
  });

  it('reads an item Condition with no owner as the entity that links the Blueprint, as its Link does', () => {
    const withItems = { ...input(), worldItems: [{ id: 'lantern', name: 'Lantern' }] };
    const lantern: TraitRequirement = { kind: 'item', id: 'lantern', status: 'owned' };
    expect(read(lantern, BLUEPRINT, undefined, withItems)).toBe('This entity owns Lantern');
    expect(read(lantern, { kind: 'entity', id: 'mira', name: 'Mira' }, undefined, withItems)).toBe('Mira owns Lantern');
    expect(read({ ...lantern, owner: { kind: 'you' as const } }, BLUEPRINT, undefined, withItems)).toBe('The player owns Lantern');
    expect(read(lantern, WORLD, undefined, withItems)).toBe('The player owns Lantern');
  });

  it('marks no part of a no-owner Blueprint stat broken, and resolves it on the Blueprint’s own gate', () => {
    expect(conditionClauses(input())(courageReq, { host: BLUEPRINT }).filter((p) => p.broken)).toEqual([]);
    const row = ruleStates(input(), null, gate.requires!)[0];
    expect(row.conditions.map((c) => c.unresolved)).toEqual([false, false, false, false]);
  });

  it('says whether a trait is a Blueprint trait', () => {
    expect(isBlueprintTrait(input(), 'bold')).toBe(true);
    expect(isBlueprintTrait(input(), 'brave')).toBe(false);
    expect(isBlueprintTrait(input(), 'nothing')).toBe(false);
  });
});

describe('a Blueprint target on a Link', () => {
  const mira: ClauseHost = { kind: 'entity', id: 'mira', name: 'Mira' };

  it('reads the entity’s name for the trait and the stat alike', () => {
    expect(read(reqs.bold, mira)).toBe('Mira has Bold');
    expect(read(courageReq, mira)).toBe("Mira's Courage is at least 5");
  });

  it('reads "you" for the played entity and its name for another, in the lock line', () => {
    const played = gateOf(gateStates(input({ source: 'world', entityId: 'mira' }, 'player')), 'mira', 'gate')!.rows[0].conditions;
    expect(played.slice(0, 2).map((c) => c.clause)).toEqual(['you have Bold', 'your Courage is at least 5']);
    const other = gateOf(gateStates(input({ source: 'world', entityId: 'mira' }, 'player')), 'wren', 'gate')!.rows[0].conditions;
    expect(other.slice(0, 2).map((c) => c.clause)).toEqual(['Wren has Bold', "Wren's Courage is at least 5"]);
  });
});

describe('the stat sections on a Blueprint’s own field', () => {
  const sectionRows = (blueprintHost: boolean) => requirementStatSections(input(), null, blueprintHost).map((s) => ({
    heading: s.heading, labels: s.options.map((o) => o.label), owner: s.options.map((o) => (o.requirement.kind === 'stat' ? o.requirement.owner : undefined)),
  }));

  it('offers the Blueprint stats first, each adding a Condition with no owner', () => {
    const [first, ...rest] = sectionRows(true);
    expect(first).toEqual({ heading: 'Blueprint Stats', labels: ['Courage'], owner: [undefined] });
    expect(rest.map((s) => s.heading)).toEqual(['Global Stats', 'Persona Stats', 'Mira Stats']);
    expect(rest[2].owner[0]).toMatchObject({ kind: 'entity', id: 'mira' });
  });

  it('offers no Blueprint section on any other host', () => {
    expect(sectionRows(false).map((s) => s.heading)).toEqual(['Global Stats', 'Persona Stats', 'Mira Stats']);
  });
});
