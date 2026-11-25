import { describe, expect, it } from 'vitest';
import { openingFold, type OpeningFoldWorld } from './openingState';
import { clauseText, conditionClauses, gateOf, gateStates, requirementOptions, ruleStates, type GateInput } from './traitGates';
import { libraryGateInput } from './libraryGateInput';
import { traitGateInput } from './traitRuntime';
import { editorGateInput } from './owners';
import { liveOpeningKey, readOpeningKey, type OpeningKey } from './drawnOpening';
import { openingPickGroups } from './testBench/openingPick';
import { gateLine } from './traitGateLine';
import { inPlayWorldOf } from './inPlayWorld';
import type { Entity, GameLocation, Opening, OpeningRequirement, Trait, TraitRequirementRow, WorldOverview } from '@/types';

const ambush: Opening = { id: 'o1', text: 'Ambush!', kind: 'action', name: 'ambush' };
const quiet: Opening = { id: 'o2', text: 'Quiet.', kind: 'action' };
// A playthrough's state with no picks: only the Condition decides.
const NO_PICKS = { traits: [], disabledTraitIds: [], ownedTraits: {}, stats: [] };
const AMBUSH: OpeningKey = { ownerId: null, openingId: 'o1' };
const QUIET: OpeningKey = { ownerId: null, openingId: 'o2' };

const onOpening = (openings: OpeningKey[], not?: true): OpeningRequirement => ({ kind: 'opening', openings, ...(not && { not }) });
const gated = (id: string, req: OpeningRequirement): Trait =>
  ({ id, name: id, statChanges: [], playerToggle: true, requires: [{ all: [req] }] });

const overview = { openings: [ambush, quiet] } as WorldOverview;
const traits = [gated('route', onOpening([AMBUSH])), gated('notRoute', onOpening([AMBUSH], true))];
const world: OpeningFoldWorld = { traits, worldOverview: overview };
const picks = { traits: ['route', 'notRoute'], owned: {} };

// The picked traits whose gate holds on page one, after the settle under the drawn row.
const started = (key: OpeningKey | null) => {
  const fold = openingFold(world, picks, undefined, undefined, key && (key.openingId === 'o1' ? ambush : quiet), key);
  return picks.traits.filter((id) => gateOf(gateStates(fold.gate), null, id)?.unlocked);
};

describe('the Opening Condition on page one', () => {
  it('holds a trait gated on the drawn Opening and fails it under another', () => {
    expect(started(AMBUSH)).toEqual(['route']);
    expect(started(QUIET)).toEqual(['notRoute']);
  });

  it('re-settles on a redraw to another Opening', () => {
    expect(started(AMBUSH)).toContain('route');
    expect(started(QUIET)).not.toContain('route');
  });

  it('holds only under Not with no Drawn Opening', () => {
    expect(started(null)).toEqual(['notRoute']);
  });
});

describe('the Opening Condition on later turns', () => {
  const unlocked = (opening: OpeningKey | null, id: string) => {
    const gate = traitGateInput(NO_PICKS, {
      traits, groups: [], entities: [], persona: { source: 'none' }, opening,
    });
    return gateOf(gateStates(gate), null, id)!.unlocked;
  };

  it('keeps holding from the save record after a round trip', () => {
    const saved = JSON.parse(JSON.stringify({ drawnOpening: AMBUSH })) as { drawnOpening: unknown };
    const loaded = liveOpeningKey(readOpeningKey(saved.drawnOpening), { overview, entities: [], locations: [] });
    expect(unlocked(loaded, 'route')).toBe(true);
    expect(unlocked(loaded, 'notRoute')).toBe(false);
  });

  it('reads a deleted Drawn Opening as none', () => {
    const live = liveOpeningKey(AMBUSH, { overview: { openings: [quiet] } as WorldOverview, entities: [], locations: [] });
    expect(live).toBeNull();
    expect(unlocked(live, 'route')).toBe(false);
    expect(unlocked(live, 'notRoute')).toBe(true);
  });

  it('never holds an empty list, Not or not', () => {
    const empty = [gated('none', onOpening([])), gated('notNone', onOpening([], true))];
    const gate = traitGateInput(NO_PICKS, {
      traits: empty, groups: [], entities: [], persona: { source: 'none' }, opening: AMBUSH,
    });
    expect(gateOf(gateStates(gate), null, 'none')!.unlocked).toBe(false);
    expect(gateOf(gateStates(gate), null, 'notNone')!.unlocked).toBe(false);
  });
});

describe('an image Visibility rule on the Opening', () => {
  const rows: TraitRequirementRow[] = [{ all: [onOpening([AMBUSH])] }];
  const input = (opening: OpeningKey | null): GateInput =>
    traitGateInput(NO_PICKS, { traits: [], groups: [], entities: [], persona: { source: 'none' }, opening });

  it('shows under the drawn Opening and hides under another', () => {
    expect(ruleStates(input(AMBUSH), null, rows)[0].holds).toBe(true);
    expect(ruleStates(input(QUIET), null, rows)[0].holds).toBe(false);
  });
});

describe('the Opening Condition outside play', () => {
  const aki = { id: 'aki', name: 'Aki', openings: [{ id: 'a1', text: 'Hi.', kind: 'action' }] } as Entity;
  const authored = { traits, traitGroups: [], entities: [aki], locations: [], placeholders: [], stats: [], worldOverview: overview };
  const groups = openingPickGroups(authored);

  it('reads the shared Opening pick, else none', () => {
    const states = (opening: OpeningKey | null) => gateStates(editorGateInput({ traits, traitGroups: [], entities: [aki], opening, openings: groups }));
    expect(gateOf(states(AMBUSH), null, 'route')!.unlocked).toBe(true);
    expect(gateOf(states(null), null, 'route')!.unlocked).toBe(false);
    expect(gateOf(states(null), null, 'notRoute')!.unlocked).toBe(true);
  });

  it('reads the picked names or derived labels, and a deleted key as unresolved', () => {
    const input = editorGateInput({ traits, traitGroups: [], entities: [aki], openings: groups });
    const text = (req: OpeningRequirement) => clauseText(conditionClauses(input)(req));
    expect(text(onOpening([AMBUSH, { ownerId: 'aki', openingId: 'a1' }]))).toBe('the opening is ambush or Aki · Opening 1');
    expect(text(onOpening([QUIET], true))).toBe('the opening is not World · Opening 2');
    const dead = ruleStates(input, null, [{ all: [onOpening([{ ownerId: null, openingId: 'gone' }])] }])[0].conditions[0];
    expect(dead).toMatchObject({ clause: 'the opening is a missing Opening', unresolved: true, holds: false });
  });

  it('offers a library entity its own Openings, and reads none drawn there', () => {
    const route = gated('route', onOpening([{ ownerId: 'aki', openingId: 'a1' }]));
    const input = libraryGateInput({ ...aki, traits: [route] }, null);
    expect(requirementOptions(input).openings?.map((g) => [g.label, g.options.map((o) => o.label)])).toEqual([['Aki', ['Aki · Opening 1']]]);
    expect(gateOf(gateStates(input), 'aki', 'route')!.unlocked).toBe(false);
  });

  it('drives the Test Bench readout of who is in play', () => {
    const guard = { id: 'guard', name: 'Guard', description: '', locations: [], enabledWhen: [{ all: [onOpening([AMBUSH])] }] } as Entity;
    const bench = { entities: [guard], locations: [] as GameLocation[] };
    const onstage = (benchOpening: OpeningKey | null) => inPlayWorldOf({ ...bench, benchOpening }, null).entities.map((e) => e.id);
    expect(onstage(AMBUSH)).toEqual(['guard']);
    expect(onstage(QUIET)).toEqual([]);
    expect(onstage(null)).toEqual([]);
  });

  it('stays out of the player line, which then reads Locked', () => {
    const gate = traitGateInput(NO_PICKS, {
      traits, groups: [], entities: [], persona: { source: 'none' }, opening: QUIET,
    });
    expect(gateLine(gateOf(gateStates({ ...gate, reader: 'player' }), null, 'route'))).toBe('Locked');
    expect(gateLine(gateOf(gateStates(gate), null, 'route'), { revealHidden: true })).toBe('Requires: the opening is an opening.');
  });
});
