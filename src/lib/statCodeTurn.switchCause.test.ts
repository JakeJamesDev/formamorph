/**
 * @vitest-environment node
 * (No DOM needed; node keeps the QuickJS WASM engine loading through its filesystem path.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openOutputRun } from './outputRun';
import { runStatCodeTurn, runSwitchScripts, type StatCodeTurn } from './statCodeTurn';
import { traitSwitchEvents } from './traitRuntime';
import type { ScriptPromptHost, ScriptPromptRequest } from './scriptPrompts';
import type { StatCodeOwners } from './statCodeTraits';
import { inPlayOwners } from './ownedTraitsInPlay';
import type { Entity, PersonaRef, PlayerStat, Script, ScriptTiming, Trait } from '@/types';
import { statCodeTurnOf, type FlatStatCodeTurn } from '@/test/statCodeTurnFixture';

/** `args.by` in When a Trait Switches (Q12): the trait a script wrote reads 'script', what came with it 'rule'. */

const hp: PlayerStat = {
  id: 'hp', name: 'HP', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [],
  baseMin: 0, baseMax: 100, baseRegen: 0, aiMaxDelta: 0,
};

let ids = 0;
const script = (code: string, timing: ScriptTiming = 'switch'): Script => ({ id: `s-${ids++}`, timing, code });

// Bold and Calm share a pick-one group; Aura needs Calm, so it turns off with it.
const bold: Trait = { id: 'bold', name: 'Bold', statChanges: [], playerToggle: true, groupId: 'mood' };
const calm: Trait = { id: 'calm', name: 'Calm', statChanges: [], playerToggle: true, groupId: 'mood' };
const aura: Trait = { id: 'aura', name: 'Aura', statChanges: [], requires: [{ all: [{ kind: 'trait', id: 'calm' }] }] };

/** Calm and Aura on, Bold held off. */
const owners = (): StatCodeOwners => ({
  acquired: [bold, calm, aura], disabledTraitIds: ['bold'], appliedValues: {},
  world: { traits: [bold, calm, aura], groups: [{ id: 'mood', name: 'Mood', parentId: null, maxPicks: 1 }] },
});

/** Each switch run tells `name±:by`, in run order. */
const REPORT = script('player.tell(trait.name + (trait.enabled ? "+" : "-") + ":" + args.by);');

let told: string[] = [];
const prompts: ScriptPromptHost = {
  prompt: (request: ScriptPromptRequest) => {
    if (request.kind === 'tell') told.push(request.text);
    return Promise.resolve(undefined as never);
  },
};

const turnOf = (over: Partial<FlatStatCodeTurn>): StatCodeTurn => statCodeTurnOf({
  stats: [hp], enabled: {}, previous: [hp], asks: [], regenApplied: {}, clock: {}, ownerTraits: owners(),
  statNameOf: (s) => s.name, traitNameOf: (t) => t.name, prompts, ...over,
});

const BOLD_ON = 'traits.Bold.enabled = true;';
/** What a write of Bold switches, in run order: Calm and Aura off first, then Bold on. */
const BOLD_BY_SCRIPT = ['Calm-:rule', 'Aura-:rule', 'Bold+:script'];

beforeEach(() => {
  told = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('args.by on a switch run', () => {
  it.each(['before', 'after'] as const)('reads script for the trait a %s script wrote, and rule for its sibling and cascade', async (timing) => {
    await runStatCodeTurn(turnOf({ timing, worldScripts: [script(BOLD_ON, timing), REPORT] }));
    expect(told).toEqual(BOLD_BY_SCRIPT);
  });

  it('reads script for a World Tool’s write', async () => {
    await runStatCodeTurn(turnOf({ worldScripts: [REPORT], triggers: [{ name: 'Rally', code: BOLD_ON, args: {} }], triggersOnly: true }));
    expect(told).toEqual(BOLD_BY_SCRIPT);
  });

  it('reads script for a During AI Output write, once the run lands', async () => {
    const run = openOutputRun(turnOf({ timing: 'output', worldScripts: [script(BOLD_ON, 'output'), REPORT] }))!;
    await run.rewrite('One.', { index: 0, full: 'One.', earlier: [] });
    await run.landing();
    expect(told).toEqual(BOLD_BY_SCRIPT);
  });

  it('reads script for a switch a switch script made, and rule for what that switch brought along', async () => {
    const chain = script('if (trait.name === "Bold" && trait.enabled) traits.Calm.enabled = true;');
    await runStatCodeTurn(turnOf({ timing: 'before', worldScripts: [script(BOLD_ON, 'before'), chain, REPORT] }));
    // Bold's run puts Calm back: its nested runs tell first. Calm turns Bold off, and Aura comes back with Calm.
    expect(told).toEqual([...BOLD_BY_SCRIPT.slice(0, 2), 'Bold-:rule', 'Calm+:script', 'Aura+:rule', 'Bold+:script']);
  });

  it('reads rule for a trait the script wrote the other way from where it ended', async () => {
    // Aura's write keeps it on, but Calm's switch-off still takes it off.
    await runStatCodeTurn(turnOf({ timing: 'before', worldScripts: [script(`traits.Aura.enabled = true; ${BOLD_ON}`, 'before'), REPORT] }));
    expect(told).toEqual(BOLD_BY_SCRIPT);
  });

  it('reads script for an entity’s trait a script wrote, and rule for the sibling it turned off', async () => {
    const angry: Trait = { id: 'angry', name: 'Angry', statChanges: [], groupId: 'temper' };
    const placid: Trait = { id: 'placid', name: 'Placid', statChanges: [], groupId: 'temper' };
    const rook: Entity = { id: 'rook', name: 'Rook', traits: [angry, placid], traitGroups: [{ id: 'temper', name: 'Temper', parentId: null, maxPicks: 1 }] };
    const persona: PersonaRef = { source: 'none', name: 'You' };
    const ownerTraits: StatCodeOwners = {
      acquired: [], disabledTraitIds: [], appliedValues: {}, ownedTraits: { rook: { chosen: ['placid'] } }, entities: [rook], library: [],
      world: { traits: [], groups: [], entities: [rook], persona, ...inPlayOwners({ traits: [], traitGroups: [], entities: [rook] }, persona, []) },
    };
    const owned = script('player.tell(trait.owner + "." + trait.name + (trait.enabled ? "+" : "-") + ":" + args.by);');
    await runStatCodeTurn(turnOf({ timing: 'before', ownerTraits, worldScripts: [script('entities.Rook.traits.Angry.enabled = true;', 'before'), owned] }));
    expect(told).toEqual(['Rook.Placid-:rule', 'Rook.Angry+:script']);
  });

  it('reads rule for a switch nothing named, as a settle, an Option or a persona change passes it', async () => {
    const turn = turnOf({ ownerTraits: { ...owners(), disabledTraitIds: ['calm', 'aura'] }, worldScripts: [REPORT] });
    const was = { traits: [bold, calm, aura], disabledTraitIds: ['bold'] };
    const now = { traits: [bold, calm, aura], disabledTraitIds: ['calm', 'aura'] };
    await runSwitchScripts(turn, traitSwitchEvents(was, now, owners().world));
    expect(told).toEqual(['Calm-:rule', 'Aura-:rule', 'Bold+:rule']);
  });
});
