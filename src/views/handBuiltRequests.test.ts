import { describe, expect, it } from 'vitest';
import type { Entity, PlayerStat } from '@/types';
import { createStatRequest } from '@/lib/statRequest';
import { PLAYER_OWNER } from '@/lib/statOwners';
import { TURN_PASSES, TURN_PASS_CAPS, statSchemaCap, statUpdatesCap } from '@/lib/turnPipeline/turnPasses';
import { emptyTurnMaterial, type TurnMaterial, type TurnPassId, type TurnPassRequest } from '@/lib/turnPipeline/turnPlan';
import { TEST_PROMPTS, testInput } from '@/lib/turnPipeline/turnTestInputs';
import {
  choicesRerollRequest, diaryRequest, digestRequest, statsRerollRequest, type HandBuiltRequest,
} from './handBuiltRequests';

// Characterizes the four hand-built requests against their pass records. Goes away with the builders.

const passOf = (id: TurnPassId) => TURN_PASSES.find((p) => p.id === id)!;

type Comparable = Pick<TurnPassRequest, 'systemPrompt' | 'messages' | 'type' | 'maxTokens'> & Partial<Pick<TurnPassRequest, 'silent' | 'quiet' | 'attachTurnId'>>;

/** The fields a request carries to the model's door. The defaults are the ones the request path applies to an absent field. */
const wire = (r: Comparable) => ({
  systemPrompt: r.systemPrompt,
  messages: r.messages,
  type: r.type,
  maxTokens: r.maxTokens,
  silent: r.silent ?? false,
  quiet: r.quiet ?? false,
  attachTurnId: r.attachTurnId,
});

const WORLD = { '<WORLD DESCRIPTION>': 'Sedge Landing' };
const TURN_ID = 'turn-7';
const ACTION = 'I read the notices.';
const NARRATION = 'The notice board creaks. Odette waves from the ferry.';
const sequential = testInput({ action: ACTION }, { concurrentTurnRequests: false });

const material = (over: Partial<TurnMaterial> = {}): TurnMaterial => ({
  ...emptyTurnMaterial({ action: ACTION, effectiveAction: ACTION, turnId: TURN_ID, baseCtx: WORLD, destinations: [] }),
  narration: NARRATION,
  ...over,
});

const odette: Entity = { id: 'odette', name: 'Odette', aiDescription: 'A ferry hand with a limp.' };
const keepText = (_owner: Entity, text: string) => text;

/** A silent pass sets `quiet`, which a silent request never reads, so the drainers leave it unset. */
const wireWithPassQuiet = (hand: HandBuiltRequest, pass: TurnPassRequest) => {
  expect(hand.quiet).toBeUndefined();
  expect(pass.quiet).toBe(true);
  return { ...wire(hand), quiet: true };
};

describe('the digest drainer request against the summary pass', () => {
  const hand = digestRequest({
    summaryPrompt: TEST_PROMPTS.summary, summaryUserPrompt: TEST_PROMPTS.summaryUser,
    ctx: WORLD, playerAction: ACTION, narration: NARRATION, turnId: TURN_ID,
  });
  const pass = passOf('summary').buildRequest(sequential, material());

  it('matches on the prompt, messages, type, cap, silent flag and attach turn id', () => {
    expect(wireWithPassQuiet(hand, pass)).toEqual(wire(pass));
    expect(pass.systemPrompt).toBe('SUMMARY Sedge Landing');
    expect(pass.messages).toEqual([{ role: 'user', content: `Digest: ${ACTION} | ${NARRATION}` }]);
    expect(pass).toMatchObject({ type: 'summary', maxTokens: TURN_PASS_CAPS.summary, silent: true, attachTurnId: TURN_ID });
  });

  it('differs by Request Anatomy alone, which only the pass record carries', () => {
    expect(hand).not.toHaveProperty('anatomy');
    expect(pass.anatomy).toBeDefined();
  });

  it('differs by the context values: the view\'s own against the turn\'s base context', () => {
    const viewSide = digestRequest({
      summaryPrompt: TEST_PROMPTS.summary, summaryUserPrompt: TEST_PROMPTS.summaryUser,
      ctx: { '<WORLD DESCRIPTION>': 'Sedge Landing, after the move' }, playerAction: ACTION, narration: NARRATION, turnId: TURN_ID,
    });
    expect(viewSide.systemPrompt).toBe('SUMMARY Sedge Landing, after the move');
    expect(pass.systemPrompt).toBe('SUMMARY Sedge Landing');
    expect(viewSide.messages).toEqual(pass.messages);
  });

  it('differs by the action: the paired user message against the effective action', () => {
    const opening = digestRequest({
      summaryPrompt: TEST_PROMPTS.summary, summaryUserPrompt: TEST_PROMPTS.summaryUser,
      ctx: WORLD, playerAction: 'Begin at the ferry.', narration: NARRATION, turnId: TURN_ID,
    });
    const openingPass = passOf('summary').buildRequest(sequential, material({ effectiveAction: 'START GAME' }));
    expect(opening.messages).toEqual([{ role: 'user', content: `Digest: Begin at the ferry. | ${NARRATION}` }]);
    expect(openingPass.messages).toEqual([{ role: 'user', content: `Digest: START GAME | ${NARRATION}` }]);
  });
});

describe('the diary drainer request against the diary pass', () => {
  const build = (name: string, allEntities: Entity[]) => diaryRequest({
    diaryPrompt: TEST_PROMPTS.diary, ctx: WORLD, name, narration: NARRATION, turnId: TURN_ID, allEntities, resolveEntityText: keepText,
  });
  const passFor = (subject: { name: string; entity?: Entity }) => passOf('diary').buildRequest(sequential, material({ subject }));

  it('matches for a known name on the prompt, messages, type, cap, silent flag and attach turn id', () => {
    const hand = build('Odette', [odette]);
    const pass = passFor({ name: 'Odette', entity: odette });
    expect(wireWithPassQuiet(hand, pass)).toEqual(wire(pass));
    expect(pass.messages[0].content).toContain('Who you are: A ferry hand with a limp.');
    expect(pass).toMatchObject({ type: 'diary', maxTokens: TURN_PASS_CAPS.diary, silent: true, attachTurnId: TURN_ID });
  });

  it('matches for a name the world does not define', () => {
    const hand = build('Stranger', [odette]);
    const pass = passFor({ name: 'Stranger' });
    expect(wireWithPassQuiet(hand, pass)).toEqual(wire(pass));
    expect(pass.messages[0].content).not.toContain('Who you are');
  });

  it('differs by the entity text: an unknown name carries none, a pass subject may carry one', () => {
    const hand = build('Stranger', [odette]);
    const pass = passFor({ name: 'Stranger', entity: odette });
    expect(hand.messages[0].content).not.toContain('Who you are');
    expect(pass.messages[0].content).toContain('Who you are: A ferry hand with a limp.');
  });

  it('differs by Request Anatomy alone, which only the pass record carries', () => {
    expect(build('Odette', [odette])).not.toHaveProperty('anatomy');
    expect(passFor({ name: 'Odette', entity: odette }).anatomy).toBeDefined();
  });

  it('differs by the context values: the view\'s own against the turn\'s base context', () => {
    const viewSide = diaryRequest({
      diaryPrompt: TEST_PROMPTS.diary, ctx: { '<WORLD DESCRIPTION>': 'Sedge Landing, after the move' },
      name: 'Odette', narration: NARRATION, turnId: TURN_ID, allEntities: [odette], resolveEntityText: keepText,
    });
    expect(viewSide.systemPrompt).toBe('DIARY Sedge Landing, after the move');
    expect(passFor({ name: 'Odette', entity: odette }).systemPrompt).toBe('DIARY Sedge Landing');
  });
});

describe('the choices re-roll request against the choices pass', () => {
  const ctx = { ...WORLD };
  const sceneEntityTokens = { '<ENTITIES>': 'Odette, a ferry hand' };
  const reroll = (over: Partial<Parameters<typeof choicesRerollRequest>[0]> = {}) => choicesRerollRequest({
    choicesPrompt: TEST_PROMPTS.choices, choicesUserPrompt: TEST_PROMPTS.choicesUser, language: 'English',
    ctx, sceneEntityTokens, action: ACTION, narration: NARRATION, quiet: false, ...over,
  });
  const pass = passOf('choices').buildRequest(sequential, material({ ctx, sceneEntityTokens }));

  it('matches on the prompt, messages, type, cap, silent flag, quiet flag and attach turn id', () => {
    expect(wire(reroll())).toEqual(wire(pass));
    expect(pass.systemPrompt).toBe('CHOICES Sedge Landing Odette, a ferry hand');
    expect(pass.messages).toEqual([{ role: 'user', content: `Choices: ${ACTION} | ${NARRATION}` }]);
    expect(pass).toMatchObject({ type: 'choices', maxTokens: TURN_PASS_CAPS.choices, silent: false, quiet: false });
  });

  it('matches under a non-English language directive', () => {
    const choices = 'CHOICES <LANGUAGE>';
    const french = passOf('choices').buildRequest(
      testInput({ action: ACTION, prompts: { ...TEST_PROMPTS, choices } }, { language: 'French', concurrentTurnRequests: false }),
      material({ ctx, sceneEntityTokens }),
    );
    const hand = reroll({ choicesPrompt: choices, language: 'French' });
    expect(french.systemPrompt).toBe('CHOICES Write all choices in French.');
    expect(wire(hand)).toEqual(wire(french));
  });

  it('differs by Request Anatomy alone, which only the pass record carries', () => {
    expect(reroll()).not.toHaveProperty('anatomy');
    expect(pass.anatomy).toBeDefined();
  });

  it('differs by the quiet flag when Concurrent Requests is on: the re-roll keeps its own label', () => {
    const batched = passOf('choices').buildRequest(testInput({ action: ACTION }, { concurrentTurnRequests: true }), material({ ctx, sceneEntityTokens }));
    expect(batched.quiet).toBe(true);
    expect(reroll().quiet).toBe(false);
  });

  it('differs by the action: the raw one against the effective one', () => {
    const openingPass = passOf('choices').buildRequest(sequential, material({ ctx, sceneEntityTokens, effectiveAction: 'START GAME' }));
    expect(reroll({ action: 'Begin at the ferry.' }).messages[0].content).toBe(`Choices: Begin at the ferry. | ${NARRATION}`);
    expect(openingPass.messages[0].content).toBe(`Choices: START GAME | ${NARRATION}`);
  });
});

describe('the stats re-roll request against the stat-updates pass', () => {
  const vigor: PlayerStat = { id: 'vigor', name: 'Vigor', type: 'number', description: '', min: 0, max: 100, value: 50, regen: 0, descriptors: [] };
  const ctx = { ...WORLD };
  const reroll = (statRequest: ReturnType<typeof createStatRequest>, over: Partial<Parameters<typeof statsRerollRequest>[0]> = {}) =>
    statsRerollRequest({
      statUpdatesPrompt: TEST_PROMPTS.statUpdates, statUpdatesUserPrompt: TEST_PROMPTS.statUpdatesUser,
      ctx, action: ACTION, narration: NARRATION, statCount: 3, statRequest, quiet: false, ...over,
    });
  const pass = (statRequest: ReturnType<typeof createStatRequest>, over: Partial<TurnMaterial> = {}) =>
    passOf('statUpdates').buildRequest(sequential, material({ ctx, statRequest, ...over }));

  it('matches on the schema path in every field, anatomy and text fallback included', () => {
    const snapshot = createStatRequest([vigor], PLAYER_OWNER);
    const hand = reroll(snapshot);
    expect(hand).toEqual(pass(snapshot));
    expect(hand).toMatchObject({ type: 'statUpdates', maxTokens: statSchemaCap(1), silent: false, quiet: false });
    expect(hand.responseSchema).toBeDefined();
    expect(hand.textFallback?.maxTokens).toBe(statUpdatesCap(1));
    expect(hand.anatomy).toBeDefined();
  });

  it('matches on the text path in every field', () => {
    const snapshot = createStatRequest([vigor], PLAYER_OWNER, { textPass: true });
    const hand = reroll(snapshot);
    expect(hand).toEqual(pass(snapshot));
    expect(hand).toMatchObject({ type: 'statUpdates', maxTokens: statUpdatesCap(1), silent: false, quiet: false });
    expect(hand.responseSchema).toBeUndefined();
  });

  it('differs by the quiet flag when Concurrent Requests is on: the re-roll keeps its own label', () => {
    const snapshot = createStatRequest([vigor], PLAYER_OWNER);
    const batched = passOf('statUpdates').buildRequest(
      testInput({ action: ACTION }, { concurrentTurnRequests: true }), material({ ctx, statRequest: snapshot }),
    );
    expect(batched.quiet).toBe(true);
    expect(reroll(snapshot).quiet).toBe(false);
  });

  it('differs by the action: the raw one against the effective one', () => {
    const snapshot = createStatRequest([vigor], PLAYER_OWNER);
    const hand = reroll(snapshot, { action: 'Begin at the ferry.' });
    const openingPass = pass(snapshot, { effectiveAction: 'START GAME' });
    expect(hand.messages[0].content).toBe(`Stats: Begin at the ferry. | ${NARRATION}`);
    expect(openingPass.messages[0].content).toBe(`Stats: START GAME | ${NARRATION}`);
  });
});
