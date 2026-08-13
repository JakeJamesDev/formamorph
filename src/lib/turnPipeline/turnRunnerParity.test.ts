import { describe, it, expect } from 'vitest';
import { planTurn } from './planTurn';
import { runTurn, type TurnAdvance, type TurnRequestAdapter } from './turnRunner';
import { fixture, recordedPasses, inputFor, narrationOf } from './parityTestInputs';
import type { TurnMaterial, TurnPassId, TurnPassSubject } from './turnPlan';
import type { ChatMessage } from '@/types';
import { parseDirectorCast } from '@/lib/stagedPlanning';
import { planDirective } from '@/components/game/GamePrompts';

/**
 * Parity: planner + runner against the run recorded from the code they replace. Each recorded turn is
 * replayed with an adapter that answers with the very text the models answered with, so the material every
 * later pass renders against is the run's own — and the request sequence the pipeline emits must be the
 * sequence the run dispatched.
 *
 * What is compared: for every request, in order, its type, its token cap, and its silent/attached-turn
 * envelope; plus byte-exact messages for the passes whose every input the fixture holds. What is not: the
 * context values a system prompt renders against were never recorded, so system prompts are compared by
 * template in turnPlanParity.test.ts instead.
 */

/** The plan the narrator was handed, recovered from the recorded narration message. */
const recordedTurnPlan = (messages: ChatMessage[]): string => {
  const last = messages[messages.length - 1].content;
  const marker = planDirective('').replace(/\n$/, '');
  const at = last.indexOf(marker);
  return at === -1 ? '' : last.slice(at + marker.length + 1);
};

/** How many requests one fan-out pass sent in the recording — a model answer, not a planner decision. */
const recordedCount = (index: number, id: TurnPassId): number =>
  recordedPasses(fixture.turns[index]).filter((p) => p.id === id).length;

const materialFor = (index: number): TurnMaterial => {
  const turn = fixture.turns[index];
  const narration = narrationOf(turn);
  return {
    action: turn.action,
    effectiveAction: index === 0 ? 'START GAME' : turn.action,
    turnId: turn.turnId ?? '',
    ctx: {},
    baseCtx: {},
    sceneEntityTokens: {},
    destinations: [],
    narrationSystemPrompt: narration.systemPrompt,
    trimmedHistory: narration.messages.slice(0, -1),
    narration: '',
    lastStory: index > 0 ? narrationOf(fixture.turns[index - 1]).response ?? '' : '',
    plannerRecap: '',
    turnPlan: recordedTurnPlan(narration.messages),
    activeCharacterGuidance: '',
    directorScene: '',
    npcCastSize: 0,
    intents: [],
    overflow: [],
  };
};

/**
 * The caller's derivations for a replay: the cast comes from parsing the recorded director answer, and how
 * many of them were asked comes from the recording — the active-character cap is a setting the plan does
 * not carry.
 */
const replayAdvance = (index: number): TurnAdvance => {
  const cast: TurnPassSubject[] = [];
  return (event) => {
    if (event.at === 'stage' && event.stage === 'postNarration') {
      return { subjects: { diary: cast.slice(0, recordedCount(index, 'diary')) } };
    }
    if (event.at !== 'pass' || event.outcomes.length === 0) return;
    if (event.outcomes[0].id !== 'director') return;
    const { scene, cast: members } = parseDirectorCast(event.outcomes[0].raw);
    cast.push(...members.map((member) => ({ name: member.name, stance: member.stance })));
    const asked = recordedCount(index, 'character');
    expect(asked, `turn ${index} asked more characters than the director named`).toBeLessThanOrEqual(cast.length);
    return {
      directorScene: scene,
      npcCastSize: cast.length,
      subjects: { character: cast.slice(0, asked) },
    };
  };
};

/** One turn replayed: the requests the pipeline emitted, in dispatch order. */
const replay = async (index: number) => {
  const recorded = recordedPasses(fixture.turns[index]);
  const emitted: { type: string; messages: ChatMessage[]; maxTokens: number | null; silent: boolean; attachTurnId: string | null }[] = [];
  const adapter: TurnRequestAdapter = async (request) => {
    emitted.push({
      type: request.type,
      messages: request.messages,
      maxTokens: request.maxTokens,
      silent: request.silent,
      attachTurnId: request.attachTurnId ?? null,
    });
    // Answer with what the run's model answered, so the next pass renders against the run's own material.
    return recorded[emitted.length - 1]?.request.response ?? '';
  };
  const result = await runTurn({
    plan: planTurn(inputFor(index)),
    material: materialFor(index),
    request: adapter,
    signal: new AbortController().signal,
    advance: replayAdvance(index),
  });
  return { recorded, emitted, result };
};

/** Passes whose every message input the fixture holds; the rest carry entity blurbs, diaries or intents. */
const MESSAGE_EXACT: TurnPassId[] = ['locationAuto', 'director', 'narration', 'choices', 'statUpdates', 'summary', 'timePassed', 'openingTime'];

describe('turn pipeline parity with the recorded run', () => {
  it.each(fixture.turns.map((t) => [t.index, t.action.slice(0, 40)]))(
    'turn %i (%s) emits the request sequence the run dispatched',
    async (index) => {
      const { recorded, emitted, result } = await replay(index as number);
      expect(result.status, JSON.stringify(result.status === 'failed' ? result.kind : '')).toBe('ok');
      expect(emitted.map((r) => [r.type, r.maxTokens, r.silent, r.attachTurnId])).toEqual(
        recorded.map((r) => [r.request.type, r.request.maxTokens, r.request.silent, r.request.attachTurnId]),
      );
    },
  );

  it.each(fixture.turns.map((t) => [t.index]))('turn %i sends the payload the run sent', async (index) => {
    const { recorded, emitted } = await replay(index as number);
    const compared: TurnPassId[] = [];
    recorded.forEach((entry, i) => {
      if (!MESSAGE_EXACT.includes(entry.id)) return;
      expect(emitted[i]?.messages, `${entry.id} messages`).toEqual(entry.request.messages);
      compared.push(entry.id);
    });
    // Exactly which passes were compared, so the comparison cannot quietly shrink.
    expect(compared).toEqual(MESSAGE_EXACT.filter((id) => recorded.some((r) => r.id === id)));
  });
});
