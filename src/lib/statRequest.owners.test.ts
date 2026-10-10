import { describe, expect, it } from 'vitest';
import type { Entity, EntityStatValues, PersonaRef, PlayerStat } from '@/types';
import { defaultStatUpdatesPrompt, defaultStatUpdatesUserPrompt } from '@/components/game/GamePrompts';
import {
  createStatRequest, readStatResponse, statRequestSchema, statResponseChanges, PLAYER_STAT_HEADING,
  type StatRequestSnapshot,
} from './statRequest';
import { applyEntityStatResponse, entityCodeTurns, entityStatDeltas, entityStatOwners, statRequestOwners } from './entityStats';
import { PLAYER_OWNER } from './statOwners';
import { TURN_PASSES, statRequestReady, statSchemaCap, statUpdatesCap } from './turnPipeline/turnPasses';
import { emptyTurnMaterial, type TurnPassRequest } from './turnPipeline/turnPlan';
import { testInput, TEST_PROMPTS } from './turnPipeline/turnTestInputs';
import { planTurn } from './turnPipeline/planTurn';
import { runTurn } from './turnPipeline/turnRunner';
import { computeTurnCommit } from './turnPipeline/computeTurnCommit';

const stat = (over: Partial<PlayerStat> = {}): PlayerStat => ({
  id: 'trust', name: 'Trust', type: 'number', description: '', min: 0, max: 100, value: 20, regen: 0, descriptors: [], ...over,
});

const vigor = stat({ id: 'vigor', name: 'Vigor', value: 50 });
const playerTrust = stat({ id: 'trust', name: 'Trust', value: 10 });
const bram: Entity = { id: 'bram', name: 'Bram' };
const odette: Entity = { id: 'odette', name: 'Odette' };
const mira: Entity = { id: 'mira', name: 'Mira', persona: true };
const values: EntityStatValues = {
  bram: [stat({ value: 30 }), stat({ id: 'grit', name: 'Grit', value: 5, enabled: false })],
  odette: [stat({ value: 40 }), stat({ id: 'stock', name: 'Stock', value: 12 })],
  mira: [stat({ id: 'calm', name: 'Calm' })],
};
const none: PersonaRef = { source: 'none' };
const noTraits = () => [];
const owners = (present: Entity[], persona: PersonaRef = none) => statRequestOwners(present, values, persona, (s) => s, noTraits);
const snapshotFor = (present: Entity[], textPass = false) =>
  createStatRequest([vigor, playerTrust], PLAYER_OWNER, { textPass, entities: owners(present) });

const statPass = TURN_PASSES.find((pass) => pass.id === 'statUpdates')!;
const shipped = testInput({ prompts: { ...TEST_PROMPTS, statUpdates: defaultStatUpdatesPrompt, statUpdatesUser: defaultStatUpdatesUserPrompt } });
const material = emptyTurnMaterial({ action: 'Haul', effectiveAction: 'Haul', turnId: 'turn', baseCtx: {}, destinations: [] });
const build = (snapshot: StatRequestSnapshot | undefined) => statPass.buildRequest(shipped, { ...material, statRequest: snapshot });

describe('the stat request with entities', () => {
  it('renders one section per present owner under the shipped prompt, after the player block', () => {
    const { systemPrompt } = build(snapshotFor([bram, odette]));
    expect(systemPrompt).toContain(
      '### Player Character\n- **Vigor:** 50/100\n- **Trust:** 10/100\n\n### Bram\n- **Trust:** 30/100\n\n### Odette\n- **Trust:** 40/100\n- **Stock:** 12/100\n',
    );
  });

  it('keys the schema by owner, every live stat of each required', () => {
    const { schema } = statRequestSchema(snapshotFor([bram, odette]));
    const required = (node: typeof schema, key: string) => node.type === 'object' && node.properties[key];
    expect(schema.type === 'object' && schema.required).toEqual([PLAYER_STAT_HEADING, 'Bram', 'Odette']);
    expect(required(schema, 'Bram')).toMatchObject({ required: ['Trust', 'Trust max'] });
    expect(required(schema, 'Odette')).toMatchObject({ required: ['Trust', 'Trust max', 'Stock', 'Stock max'] });
  });

  it('leaves out an absent entity, a switched-off stat, and the played persona', () => {
    const snapshot = snapshotFor([bram]);
    expect(snapshot.targets.map((t) => `${t.ownerKey}/${t.key}`)).toEqual(['Player Character/Vigor', 'Player Character/Trust', 'Bram/Trust']);
    expect(build(snapshot).systemPrompt).not.toContain('Odette');
    expect(owners([bram, mira], { source: 'world', entityId: 'mira' }).map((o) => o.id)).toEqual(['bram']);
    expect(owners([bram, bram]).map((o) => o.id)).toEqual(['bram']);
  });

  it('leaves out an entity stat its own trait switches off, and ignores an update to it', () => {
    const wary = { id: 'wary', name: 'Wary', statChanges: [], statToggles: [{ statId: 'stock', enabled: false }] };
    const inForce = (ownerId: string) => (ownerId === 'odette' ? [wary] : []);
    const asked = statRequestOwners([odette], values, none, (s) => s, inForce);
    expect(asked.map((o) => o.stats.map((s) => s.id))).toEqual([['trust']]);

    const full = createStatRequest([vigor, playerTrust], PLAYER_OWNER, { entities: owners([odette]) });
    const reply = JSON.stringify({ You: { Vigor: 0, 'Vigor max': 0, Trust: 0, 'Trust max': 0 }, Odette: { Trust: 0, 'Trust max': 0, Stock: 4, 'Stock max': 0 } });
    const applied = applyEntityStatResponse(values, readStatResponse(reply, full), inForce);
    expect(applied.values.odette[1].value).toBe(12);
  });

  it('numbers an owner key that clashes with the player heading or another owner', () => {
    const snapshot = createStatRequest([vigor], PLAYER_OWNER, { entities: [
      { id: 'a', name: 'Player Character', stats: [stat()] },
      { id: 'b', name: '**Bram**', stats: [stat()] },
      { id: 'c', name: 'Bram', stats: [stat()] },
    ] });
    expect(snapshot.entityKeys).toEqual(['Player Character (2)', 'Bram', 'Bram (2)']);
    expect(snapshot.context['<STATS DESCRIPTION>']).toContain('### Bram (2)\nTrust');
  });

  it('scales the cap with stats and owners', () => {
    expect(build(snapshotFor([])).maxTokens).toBe(statSchemaCap(2, 1));
    expect(build(snapshotFor([bram, odette])).maxTokens).toBe(statSchemaCap(5, 3));
    expect(statSchemaCap(5, 3)).toBeGreaterThan(statSchemaCap(5, 1));
  });

  it("applies each owner's changes to that owner alone, max before value", () => {
    const snapshot = snapshotFor([bram, odette]);
    const reply = JSON.stringify({
      [PLAYER_STAT_HEADING]: { Vigor: -5, 'Vigor max': 0, Trust: 0, 'Trust max': 0 },
      Bram: { Trust: 15, 'Trust max': 10 },
      Odette: { Trust: -3, 'Trust max': 0, Stock: 0, 'Stock max': 0 },
    });
    const response = readStatResponse(reply, snapshot);
    const applied = applyEntityStatResponse(values, response, noTraits);
    // At 30/100, +15 only fits under the raised cap if the max moves first: 45/110, not clamped.
    expect(applied.values.bram.map(({ id, value, max }) => [id, value, max])).toEqual([['trust', 45, 110], ['grit', 5, 100]]);
    expect(applied.values.odette[0].value).toBe(37);
    expect(applied.values.mira).toBe(values.mira);
    expect(statResponseChanges(response)).toEqual([{ vigor: -5 }]);
  });

  it('reports every update to an owner the playthrough no longer holds', () => {
    const response = readStatResponse(JSON.stringify({ Bram: { Trust: 2, 'Trust max': 0 } }), snapshotFor([bram]));
    const applied = applyEntityStatResponse({ odette: values.odette }, response, noTraits);
    expect(applied.values).toEqual({ odette: values.odette });
    expect(applied.diagnostics).toEqual([{ name: 'Trust', reason: 'missing' }]);
  });
});

describe('the text-pass fallback', () => {
  it("sends the player's section alone and skips each present entity with a diagnostic", () => {
    const snapshot = snapshotFor([bram, odette], true);
    const request = build(snapshot);
    expect(request.responseSchema).toBeUndefined();
    expect(request.systemPrompt).not.toContain('Bram');
    expect(request.maxTokens).toBe(statUpdatesCap(2));
    const response = readStatResponse('Trust: +4', snapshot);
    expect(response.updates).toEqual([{ ownerId: PLAYER_OWNER, id: 'trust', name: 'Trust', value: 4, max: 0 }]);
    expect(response.diagnostics).toEqual([
      { name: '', reason: 'textPass' }, { name: 'Bram', reason: 'skipped' }, { name: 'Odette', reason: 'skipped' },
    ]);
  });

  it('asks nothing of a player with no stats: no text pass, and no fallback for a refused schema', () => {
    const textPass = createStatRequest([], PLAYER_OWNER, { textPass: true, entities: owners([bram]) });
    expect(statRequestReady(textPass)).toBe(false);
    const schema = createStatRequest([], PLAYER_OWNER, { entities: owners([bram]) });
    expect(statRequestReady(schema)).toBe(true);
    expect(build(schema).textFallback).toBeUndefined();
    expect(statRequestReady(createStatRequest([], PLAYER_OWNER))).toBe(false);
  });

  it('builds the retry after a mid-turn refusal from the player alone', () => {
    const request = build(snapshotFor([bram]));
    expect(request.systemPrompt).toContain('### Bram');
    expect(request.textFallback?.systemPrompt).not.toContain('Bram');
    expect(request.textFallback?.maxTokens).toBe(statUpdatesCap(2));
  });
});

describe('the stat pass over a turn', () => {
  const run = async (playerStats: PlayerStat[], participants: Entity[]) => {
    const input = testInput({}, { thinkingMode: 'off', concurrentTurnRequests: false });
    const plan = planTurn(input);
    const sent: TurnPassRequest[] = [];
    let confirmed: Entity[] = [];
    const result = await runTurn({
      plan, material, signal: new AbortController().signal,
      request: async (request) => {
        sent.push(request);
        if (request.type === 'narration') return 'Bram hauls the line beside you.';
        if (request.type !== 'statUpdates' || !request.statRequest) return '';
        return JSON.stringify({ [PLAYER_STAT_HEADING]: {}, Bram: { Trust: 2, 'Trust max': 0 } });
      },
      // The view's derivation step: the narration confirms who is present, and the stat request follows them.
      advance: (event) => {
        if (event.at === 'pass' && event.outcomes[0].id === 'narration') {
          confirmed = participants;
          return { narration: event.outcomes[0].raw };
        }
        if (event.at === 'stage' && event.stage === 'postNarration') {
          return { statRequest: createStatRequest(playerStats, PLAYER_OWNER, { entities: owners(confirmed) }) };
        }
      },
    });
    const commit = computeTurnCommit({ result, plan, context: {
      participants: [], knownDiscoveredNames: [], notes: '', reasoning: { text: '', ms: 0 }, gameTime: 0,
    } });
    return { stat: sent.find((r) => r.type === 'statUpdates'), commit };
  };

  it('sends the present entities the narration confirmed, and reads their changes back by owner', async () => {
    const { stat: request, commit } = await run([vigor], [bram]);
    expect(request?.statRequest?.entityKeys).toEqual(['Bram']);
    expect(commit?.statResponse?.updates).toEqual([{ ownerId: 'bram', id: 'trust', name: 'Trust', value: 2, max: 0 }]);
    expect(commit?.turn.stat_changes).toEqual([]);
  });

  it('runs for a player with no stats when a present entity has one, and sends nothing when none does', async () => {
    expect((await run([], [bram])).stat?.statRequest?.targets.map((t) => t.ownerKey)).toEqual(['Bram']);
    expect((await run([], [])).stat).toBeUndefined();
  });
});

describe('entity stats after the request', () => {
  it("hands each owner's asks to its code, over the values from before them", () => {
    const after = { ...values, bram: [{ ...values.bram[0], value: 45 }, values.bram[1]] };
    const asks = { bram: [{ id: 'trust', value: 15, max: 0 }] };
    const [turn] = entityCodeTurns(entityStatOwners(after, [bram], none, noTraits), 0, (_, s) => s, { previous: values, asks });
    expect(turn).toMatchObject({ id: 'bram', asks: asks.bram, previous: values.bram });
    expect(turn.stats[0].value).toBe(45);
  });

  it('records what a turn moved each entity stat, by owner and stat id', () => {
    const after = { ...values, bram: [{ ...values.bram[0], value: 33 }, values.bram[1]], rook: [stat()] };
    expect(entityStatDeltas(after, values)).toEqual({ bram: { trust: 3 } });
    expect(entityStatDeltas(values, values)).toEqual({});
  });
});
