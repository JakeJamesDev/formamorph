import { describe, expect, it } from 'vitest';
import type { Placeholder, PlayerStat } from '@/types';
import {
  createStatRequest, readStatResponse, applyStatResponse, statResponseChanges, statRequestSchema, GLOBAL_STATS_HEADING,
  type StatRequestSnapshot, type StatResponse, type StatUpdateDiagnostic,
} from './statRequest';
import type { ResponseSchemaNode } from './aiRequest/responseSchema';
import { collectPins } from './placeholderPins';
import { resolvePlaceholders } from './placeholders';
import { resolveStatNames } from './resolveWorldNames';
import { TURN_PASSES } from './turnPipeline/turnPasses';
import { emptyTurnMaterial } from './turnPipeline/turnPlan';
import { testInput } from './turnPipeline/turnTestInputs';
import { defaultStatUpdatesPrompt } from '@/components/game/GamePrompts';
import { planTurn } from './turnPipeline/planTurn';
import { runTurn } from './turnPipeline/turnRunner';
import { computeTurnCommit } from './turnPipeline/computeTurnCommit';

const stat = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100,
  value: 100, regen: 10, descriptors: [], ...over,
});
const apply = (stats: PlayerStat[], raw: string, live = stats) =>
  applyStatResponse(stats, readStatResponse(raw, createStatRequest(stats)), new Set(live.map((s) => s.id)));
/** What a reply skipped, leaving out the mark every text-pass reply carries. */
const skipped = (diagnostics: StatUpdateDiagnostic[]) => diagnostics.filter((d) => d.reason !== 'textPass');

describe('stat request names', () => {
  it.each(['**Health**', '=c=Health==', '==Health==', '[Health](https://example.com)', '`Health`'])('sends plain %s through the real stat pass', (name) => {
    const snapshot = createStatRequest([stat({ name, description: 'Physical condition.' })]);
    const material = emptyTurnMaterial({ action: '', effectiveAction: '', turnId: 'turn', baseCtx: {}, destinations: [] });
    const pass = TURN_PASSES.find((p) => p.id === 'statUpdates')!;
    const request = pass.buildRequest(testInput({ prompts: { ...testInput().prompts, statUpdates: defaultStatUpdatesPrompt } }), {
      ...material, statRequest: snapshot,
    });
    expect(request.systemPrompt).toContain('- **Health:** 100/100 — Physical condition.');
    expect(request.statRequest?.targets).toEqual([{ id: 'health', name, plainName: 'Health', ownerId: null, ownerKey: GLOBAL_STATS_HEADING, key: 'Health', maxKey: 'Health max' }]);
    expect(snapshot.context('<STATS DESCRIPTION>')).not.toContain(name === '`Health`' ? '`' : name);
  });

  it.each(['Health: -25', '**Health:** -25', '=c=Health==: -25', '[Health](https://example.com): -25', '- **Health**: -25'])('accepts plain and formatted replies: %s', (reply) => {
    const result = apply([stat({ name: '=c=Health==' })], reply);
    expect(result.stats[0].value).toBe(75);
    expect(skipped(result.diagnostics)).toEqual([]);
  });

  it('preserves symbols on exact matches and only uses symbol removal as a unique fallback', () => {
    const stats = [stat({ name: 'Health+' }), stat({ id: 'other', name: 'Health−' })];
    expect(apply(stats, 'Health+: -5').stats.map((s) => s.value)).toEqual([95, 100]);
    expect(skipped(apply(stats, 'Health: -5').diagnostics)).toEqual([{ name: 'Health', reason: 'ambiguous' }]);
    expect(apply([stat({ name: '❤️ Health' })], 'Health: -5').stats[0].value).toBe(95);
    expect(apply([stat({ name: '生命力' })], '生命力: -5').stats[0].value).toBe(95);
  });

  it('names colliding stats apart by numbered key, and still accepts an exact colored name', () => {
    const stats = [stat({ name: '=r=Health==' }), stat({ id: 'blue', name: '=b=Health==' })];
    const chip = createStatRequest(stats).context('<STATS DESCRIPTION>');
    expect(chip).toContain('Health (2)');
    expect(apply(stats, 'Health: -5').stats.map((s) => s.value)).toEqual([95, 100]);
    expect(apply(stats, '**Health (2):** -5').stats.map((s) => s.value)).toEqual([100, 95]);
    expect(apply(stats, '=b=Health==: -5').stats.map((s) => s.value)).toEqual([100, 95]);
    expect(skipped(apply(stats, 'Health (2): -5').diagnostics)).toEqual([]);
  });

  it('reports unknown and invalid replies without creating updates', () => {
    const result = apply([stat()], 'Mana: -5\nHealth: 75/100\nNo changes\n   ');
    expect(result.stats[0].value).toBe(100);
    expect(skipped(result.diagnostics).map((d) => d.reason)).toEqual(['unknown', 'invalid', 'invalid']);
    expect(readStatResponse('', createStatRequest([stat()])).updates).toEqual([]);
  });

  it('sums repeated aliases and applies maximum changes before current values', () => {
    const result = apply([stat({ name: '=c=Health==' })], 'Health: +5\n**Health:** +5\nHealth: +20 MAX');
    expect(result.stats[0]).toMatchObject({ value: 110, max: 120, aiMaxDelta: 20 });
  });

  it('honors value and maximum restrictions and percentage caps', () => {
    expect(apply([stat({ noDecrease: true, noIncreaseMax: true })], 'Health: -5\nHealth: +20 MAX').stats[0]).toMatchObject({ value: 100, max: 100 });
    expect(apply([stat({ value: 50, noIncrease: true, noDecreaseMax: true })], 'Health: +5\nHealth: -20 MAX').stats[0]).toMatchObject({ value: 50, max: 100 });
    expect(apply([stat({ type: 'percentage' })], 'Health: +20 MAX').stats[0].max).toBe(100);
    expect(apply([stat()], 'Health: -20 MAX').stats[0]).toMatchObject({ value: 80, max: 80 });
  });

  it('does not retarget disabled or deleted stats to another stat with the same name', () => {
    const response = readStatResponse('Health: -5\nHealth: +10 MAX', createStatRequest([stat()]));
    const replacement = stat({ id: 'replacement' });
    const disabled = applyStatResponse([stat(), replacement], response, new Set(['replacement']));
    expect(disabled.stats.map((s) => s.value)).toEqual([100, 100]);
    expect(skipped(disabled.diagnostics)).toEqual([{ name: 'Health', reason: 'disabled' }]);
    const deleted = applyStatResponse([replacement], response, new Set(['replacement']));
    expect(deleted.stats).toEqual([replacement]);
    expect(skipped(deleted.diagnostics)).toEqual([{ name: 'Health', reason: 'missing' }]);
  });

  it.each([['c', 100], ['g', 90], ['y', 50], ['o', 30], ['r', 10]] as const)('updates the pinned %s band without replacing the authored chip', (color, value) => {
    const placeholders: Placeholder[] = [{ id: 'color', name: 'StatColor', roll: true, values: [
      { id: 'current', text: `=${color}=Health==` }, { id: 'lower', text: '=r=Health==' },
    ] }];
    const chip = '{{ph:color:world:stat-name}}';
    const stats = [stat({ name: chip, value, descriptors: [
      { id: 'lower', threshold: value - 5, description: 'Lower', placeholderPins: [{ placeholderId: 'color', valueId: 'lower', value: '=r=Health==' }] },
      { id: 'current', threshold: value, description: 'Current', placeholderPins: [{ placeholderId: 'color', valueId: 'current', value: `=${color}=Health==` }] },
    ] })];
    const resolve = (raw: PlayerStat[]) => {
      const pins = collectPins({ traits: [], stats: raw, placeholders });
      return resolveStatNames(raw, (text) => resolvePlaceholders(text, { placeholders, pins, rolls: { world: {}, unique: {} } }));
    };
    const response = readStatResponse('Health: -5', createStatRequest(resolve(stats)));
    const result = applyStatResponse(stats, response, new Set(['health']));
    expect(result.stats[0]).toMatchObject({ name: chip, value: value - 5, regen: 10 });
    expect(resolve(result.stats)[0].name).toBe('=r=Health==');
    expect(stats[0].value).toBe(value);
  });

  it('rerolls from the pre-turn baseline without stacking or losing raw names', () => {
    const baseline = [stat({ name: '{{ph:health:world:name}}' })];
    const snapshot = createStatRequest([stat({ name: '=c=Health==' })]);
    const first = applyStatResponse(baseline, readStatResponse('Health: -20', snapshot), new Set(['health']));
    const reroll = applyStatResponse(baseline, readStatResponse('**Health:** -10\nHealth: +20 MAX', snapshot), new Set(['health']));
    expect(first.stats[0].value).toBe(80);
    expect(reroll.stats[0]).toMatchObject({ name: baseline[0].name, value: 90, max: 120 });
  });

  it("stamps each update with its target's owner", () => {
    const response = readStatResponse('Health: -5', createStatRequest([], { persona: { id: 'bram', name: 'Bram', stats: [stat()] } }));
    expect(response.updates).toEqual([{ ownerId: 'bram', id: 'health', name: 'Health', value: -5, max: 0 }]);
  });

  it('keeps two owners of one stat id apart in the reply', () => {
    const snapshot: StatRequestSnapshot = { id: 'r', context: () => undefined, entityKeys: [], inSceneIds: [], targets: [
      { ownerId: null, id: 'health', name: 'Health', plainName: 'Health', ownerKey: GLOBAL_STATS_HEADING, key: 'Health', maxKey: 'Health max' },
      { ownerId: 'bram', id: 'health', name: 'Bram Health', plainName: 'Bram Health', ownerKey: 'Bram', key: 'Health', maxKey: 'Health max' },
    ] };
    expect(readStatResponse('Health: -5\nBram Health: -9', snapshot).updates).toEqual([
      { ownerId: null, id: 'health', name: 'Health', value: -5, max: 0 },
      { ownerId: 'bram', id: 'health', name: 'Bram Health', value: -9, max: 0 },
    ]);
  });

  it("applies only the named owner's updates, matched by owner and stat id", () => {
    // Two owners hold one stat id, as two links to one Blueprint do.
    const response: StatResponse = { requestId: 'r', diagnostics: [], updates: [
      { ownerId: null, id: 'health', name: 'Health', value: -5, max: 0 },
      { ownerId: 'bram', id: 'health', name: 'Health', value: -30, max: 10 },
    ] };
    const live = new Set(['health']);
    expect(applyStatResponse([stat()], response, live).stats[0]).toMatchObject({ value: 95, max: 100 });
    expect(applyStatResponse([stat()], response, live, 'bram').stats[0]).toMatchObject({ value: 70, max: 110 });
  });

  it("reports only the named owner's missing and disabled updates", () => {
    const response: StatResponse = { requestId: 'r', diagnostics: [], updates: [
      { ownerId: 'bram', id: 'trust', name: 'Trust', value: 5, max: 0 },
    ] };
    expect(applyStatResponse([stat()], response, new Set(['health'])).diagnostics).toEqual([]);
    expect(applyStatResponse([stat()], response, new Set(['health']), 'bram').diagnostics)
      .toEqual([{ name: 'Trust', reason: 'missing' }]);
  });

  it('keeps request IDs out of the saved history change map', () => {
    expect(statResponseChanges(readStatResponse('Health: -5', createStatRequest([stat({ id: 'stable-id' })])))).toEqual([{ health: -5 }]);
  });
});

/** Every keyword a schema node uses, at any depth. */
const keywordsIn = (node: ResponseSchemaNode): string[] => [
  ...Object.keys(node),
  ...(node.type === 'object' ? Object.values(node.properties).flatMap(keywordsIn) : []),
];

describe('the schema request', () => {
  const stats = [stat({ name: '**Vigor**' }), stat({ id: 'resolve', name: 'Resolve' }), stat({ id: 'vigor-2', name: 'Vigor' })];
  const json = (body: unknown) => JSON.stringify({ [GLOBAL_STATS_HEADING]: body });

  it('requires every loose stat under Other Stats, each an unbounded change beside an unbounded max change', () => {
    const { name, schema } = statRequestSchema(createStatRequest(stats));
    const change = { type: 'integer' };
    const keys = ['Vigor', 'Vigor max', 'Resolve', 'Resolve max', 'Vigor (2)', 'Vigor (2) max'];
    expect(name).toBe('stat_changes');
    expect(schema).toEqual({ type: 'object', additionalProperties: false, required: [GLOBAL_STATS_HEADING], properties: {
      [GLOBAL_STATS_HEADING]: {
        type: 'object', additionalProperties: false, required: keys,
        properties: Object.fromEntries(keys.map((key) => [key, change])),
      },
    } });
  });

  it("numbers a stat whose name is another stat's max key", () => {
    const snapshot = createStatRequest([stat({ name: 'Vigor' }), stat({ id: 'vm', name: 'Vigor max' }), stat({ id: 'v3', name: 'Vigor max (2)' })]);
    expect(snapshot.targets.map(({ key, maxKey }) => [key, maxKey])).toEqual([
      ['Vigor', 'Vigor max'], ['Vigor max (2)', 'Vigor max (2) max'], ['Vigor max (2) (2)', 'Vigor max (2) (2) max'],
    ]);
    const response = readStatResponse(json({ Vigor: -1, 'Vigor max': -2, 'Vigor max (2)': 3, 'Vigor max (2) max': 4 }), snapshot);
    expect(response.updates.map(({ id, value, max }) => [id, value, max])).toEqual([['health', -1, -2], ['vm', 3, 4]]);
  });

  it('uses only keywords the cloud server takes', () => {
    const allowed = new Set(['type', 'properties', 'required', 'additionalProperties', 'minimum', 'maximum']);
    expect(keywordsIn(statRequestSchema(createStatRequest(stats)).schema).filter((k) => !allowed.has(k))).toEqual([]);
  });

  it('reads a reply by key into updates for moved stats only, with no diagnostics', () => {
    const snapshot = createStatRequest(stats);
    const response = readStatResponse(json({ Vigor: -4, 'Vigor max': 0, Resolve: 0, 'Resolve max': 0, 'Vigor (2)': 2, 'Vigor (2) max': -5 }), snapshot);
    expect(response.updates).toEqual([
      { ownerId: null, id: 'health', name: '**Vigor**', value: -4, max: 0 },
      { ownerId: null, id: 'vigor-2', name: 'Vigor', value: 2, max: -5 },
    ]);
    expect(response.diagnostics).toEqual([]);
  });

  it('reads a fenced reply, and reports keys and values it cannot place', () => {
    const snapshot = createStatRequest(stats);
    const fenced = readStatResponse(`\`\`\`json\n${json({ Resolve: -3, 'Resolve max': 0, Mana: 1, Vigor: 'lots' })}\n\`\`\``, snapshot);
    expect(fenced.updates).toEqual([{ ownerId: null, id: 'resolve', name: 'Resolve', value: -3, max: 0 }]);
    expect(fenced.diagnostics).toEqual([{ name: 'Mana', reason: 'unknown' }, { name: 'Vigor', reason: 'invalid' }]);
    expect(readStatResponse(JSON.stringify({ Bram: { Trust: 2 } }), snapshot).diagnostics)
      .toEqual([{ name: 'Bram', reason: 'unknown' }]);
    expect(readStatResponse('{"Other Stats":{"Vigor":-4,', snapshot)).toMatchObject({
      updates: [], diagnostics: [{ reason: 'invalid' }],
    });
  });

  it('applies a max change before the value change, on the stat the request named', () => {
    const snapshot = createStatRequest([stat({ name: 'Health' })]);
    const response = readStatResponse(json({ Health: 15, 'Health max': 20 }), snapshot);
    // The stat was renamed after the request went out; identity, not the name, finds it.
    const live = [stat({ name: 'Vitality' }), stat({ id: 'other', name: 'Health' })];
    expect(applyStatResponse(live, response, new Set(['health', 'other'])).stats.map(({ name, value, max }) => ({ name, value, max })))
      .toEqual([{ name: 'Vitality', value: 115, max: 120 }, { name: 'Health', value: 100, max: 100 }]);
  });

  it('marks every text-pass reply, an empty one included, and no schema reply', () => {
    const textPass = createStatRequest([stat()], { textPass: true });
    expect(readStatResponse('', textPass).diagnostics).toEqual([{ name: '', reason: 'textPass' }]);
    expect(readStatResponse('Health: -5', createStatRequest([stat()])).diagnostics).toEqual([{ name: '', reason: 'textPass' }]);
    // The first refused turn's retry runs on a schema snapshot; nothing moving still marks it.
    expect(readStatResponse('', createStatRequest([stat()])).diagnostics).toEqual([{ name: '', reason: 'textPass' }]);
    expect(readStatResponse(json({ Health: 0, 'Health max': 0 }), createStatRequest([stat()])).diagnostics).toEqual([]);
  });
});

it.each([false, true])('carries stat identities through a full turn with concurrent requests=%s', async (concurrentTurnRequests) => {
  const snapshot = createStatRequest([stat({ name: '**Health**' })]);
  const input = testInput({}, { concurrentTurnRequests, thinkingMode: 'off' });
  const plan = planTurn(input);
  const material = { ...emptyTurnMaterial({ action: 'Climb', effectiveAction: 'Climb', turnId: 'turn', baseCtx: {}, destinations: [] }), statRequest: snapshot };
  let liveStats = [stat()];
  const result = await runTurn({
    plan, material, signal: new AbortController().signal,
    request: async (request) => {
      if (request.type === 'statUpdates') {
        liveStats = [stat({ name: 'Vitality' }), stat({ id: 'other', name: 'Health' })];
        return 'Health: -5\nHealth: +10 MAX';
      }
      return request.type === 'narration' ? 'The climb leaves you winded.' : '';
    },
    advance: (event) => event.at === 'pass' && event.outcomes[0].id === 'narration'
      ? { narration: event.outcomes[0].raw } : undefined,
  });
  const commit = computeTurnCommit({ result, plan, context: {
    participants: [], knownDiscoveredNames: [], notes: '', reasoning: { text: '', ms: 0 }, gameTime: 0,
  } });
  expect(commit?.statResponse).not.toBeNull();
  const applied = applyStatResponse(liveStats, commit!.statResponse!, new Set(liveStats.map((s) => s.id)));
  expect(applied.stats.map(({ name, value, max }) => ({ name, value, max }))).toEqual([
    { name: 'Vitality', value: 95, max: 110 }, { name: 'Health', value: 100, max: 100 },
  ]);
  expect(commit!.turn).not.toHaveProperty('statResponse');
});
