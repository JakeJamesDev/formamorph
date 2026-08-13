import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateParityFixture, type ParityRequestRecord, type ParityTurnRecord } from './parityRecorder';
import { planTurn } from './planTurn';
import { TURN_PASSES } from './turnPasses';
import type { TurnMaterial, TurnPassId, TurnPassRecord, TurnPlanInput, TurnPrompts, TurnSettings } from './turnPlan';
import type { AIRequestType, ChatMessage } from '@/types';
import {
  defaultChoicesPrompt, defaultChoicesUserPrompt,
  defaultDiaryPrompt, defaultDirectorPrompt, defaultDirectorUserPrompt,
  defaultCharacterPrompt, defaultStoryboardPrompt, defaultDiscoverEntityPrompt,
  defaultLocationChangePrompt, defaultLocationChangeUserPrompt,
  defaultNarrationUserPrompt, defaultOocDirectivePrompt,
  defaultOpeningTimePrompt, defaultOpeningTimeUserPrompt,
  defaultStatUpdatesPrompt, defaultStatUpdatesUserPrompt,
  defaultSummaryPrompt, defaultSummaryUserPrompt,
  defaultThinkingPrompt, defaultTimePassedPrompt, defaultTimePassedUserPrompt,
  planDirective,
} from '@/components/game/GamePrompts';

/**
 * Parity: the Turn Plan against the run recorded from the code it replaces
 * (testing/parity/turn-pipeline-parity.json, captured before any extraction began). Replaying the
 * recorded actions through the planner must produce the same passes, in the same order, with the same
 * caps and the same messages.
 *
 * What is compared, and what is not:
 * - **Pass sequence** — exact, with fan-out passes (one request per cast member / diarist) collapsed,
 *   since how many the director named is a model answer, not a planner decision.
 * - **Messages** — byte-exact for every pass whose user message is built from the action, the narration
 *   and the recorded plan: the router, the director, the narration, choices, stats, the digest and both
 *   clock passes. Three are excluded — the character and diary passes carry world entity blurbs and a
 *   character's accumulated diary, and the storyboard carries the per-character intents, none of which
 *   the fixture records separately.
 * - **System prompts** — asserted to be renders of the same template (its literal text, in order). The
 *   context values a template renders against are not in the fixture, so byte parity of a system prompt
 *   arrives with the runner, which is handed the real context.
 * - Drainer requests (milestone selection) are not turn passes and are excluded; see the fixture README.
 */

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../testing/parity/turn-pipeline-parity.json',
);
const fixture = validateParityFixture(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as unknown);

// The settings the `parity` harness profile ran with (testing/baseline/harness/profiles.example.json).
const SETTINGS: TurnSettings = {
  thinkingMode: 'staged',
  concurrentTurnRequests: true,
  choicesEnabled: true,
  statUpdatesEnabled: true,
  statCount: 3,
  locationChangeEnabled: true,
  locationAutoApply: true,
  aiClock: true,
  memoryDigests: true,
  characterDiaries: true,
  // The recorded narration never invented a character, so no discovery request was dispatched; the
  // setting's own effect on the plan is covered in planTurn.test.ts.
  describeCharacters: false,
  language: 'English',
};

// The run used the shipped default prompts.
const PROMPTS: TurnPrompts = {
  locationChange: defaultLocationChangePrompt,
  locationChangeUser: defaultLocationChangeUserPrompt,
  thinking: defaultThinkingPrompt,
  director: defaultDirectorPrompt,
  directorUser: defaultDirectorUserPrompt,
  character: defaultCharacterPrompt,
  storyboard: defaultStoryboardPrompt,
  narrationUser: defaultNarrationUserPrompt,
  oocDirective: defaultOocDirectivePrompt,
  choices: defaultChoicesPrompt,
  choicesUser: defaultChoicesUserPrompt,
  statUpdates: defaultStatUpdatesPrompt,
  statUpdatesUser: defaultStatUpdatesUserPrompt,
  summary: defaultSummaryPrompt,
  summaryUser: defaultSummaryUserPrompt,
  timePassed: defaultTimePassedPrompt,
  timePassedUser: defaultTimePassedUserPrompt,
  openingTime: defaultOpeningTimePrompt,
  openingTimeUser: defaultOpeningTimeUserPrompt,
  diary: defaultDiaryPrompt,
  discoverEntity: defaultDiscoverEntityPrompt,
};

/** Request types the turn itself dispatches. Anything else in the recording is an idle drainer. */
const PASS_ID_BY_TYPE: Partial<Record<AIRequestType, TurnPassId>> = {
  locationChange: 'locationAuto', // auto-apply was on, so the router ran up front
  director: 'director',
  character: 'character',
  storyboard: 'storyboard',
  narration: 'narration',
  choices: 'choices',
  statUpdates: 'statUpdates',
  summary: 'summary',
  timePassed: 'timePassed',
  openingTime: 'openingTime',
  diary: 'diary',
};
/** Recorded types this comparison deliberately leaves out. */
const DRAINER_TYPES: AIRequestType[] = ['milestoneSelect'];

const record = (id: TurnPassId): TurnPassRecord => {
  const found = TURN_PASSES.find((p) => p.id === id);
  if (!found) throw new Error(`no pass record for ${id}`);
  return found;
};

const turnPasses = (turn: ParityTurnRecord): { id: TurnPassId; request: ParityRequestRecord }[] =>
  turn.requests
    .filter((r) => PASS_ID_BY_TYPE[r.type])
    .map((r) => ({ id: PASS_ID_BY_TYPE[r.type] as TurnPassId, request: r }));

const inputFor = (index: number): TurnPlanInput => ({
  action: fixture.turns[index].action,
  isGameStarted: index > 0,
  // Sedge Landing: the dock has somewhere to go, and the world has more than one place.
  destinationCount: 2,
  locationCount: 3,
  hasCurrentLocation: true,
  settings: SETTINGS,
  prompts: PROMPTS,
});

const narrationOf = (turn: ParityTurnRecord): ParityRequestRecord => {
  const found = turn.requests.find((r) => r.type === 'narration');
  if (!found) throw new Error(`turn ${turn.index} recorded no narration`);
  return found;
};

/**
 * The material a replay of turn `index` supplies. The context values a system prompt renders against were
 * not recorded, so both scopes are left empty here — every message-level comparison below is independent
 * of them, and the system prompts are compared by template instead.
 */
const materialFor = (index: number, over: Partial<TurnMaterial> = {}): TurnMaterial => {
  const turn = fixture.turns[index];
  const previous = index > 0 ? narrationOf(fixture.turns[index - 1]).response ?? '' : '';
  return {
    action: turn.action,
    effectiveAction: index === 0 ? 'START GAME' : turn.action,
    turnId: turn.turnId ?? '',
    ctx: {},
    baseCtx: {},
    sceneEntityTokens: {},
    destinations: [],
    narrationSystemPrompt: narrationOf(turn).systemPrompt,
    trimmedHistory: [],
    narration: narrationOf(turn).response ?? '',
    lastStory: previous,
    plannerRecap: '',
    turnPlan: '',
    activeCharacterGuidance: '',
    directorScene: '',
    npcCastSize: 0,
    intents: [],
    overflow: [],
    ...over,
  };
};

/** The template's literal text, split on its chips — what any render of it still contains, in order. */
const literalSegments = (template: string): string[] =>
  template
    .split(/<[^<>]+>/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 24);

const assertRendersTemplate = (systemPrompt: string, template: string): void => {
  let from = 0;
  for (const segment of literalSegments(template)) {
    const at = systemPrompt.indexOf(segment, from);
    expect(at, `system prompt is missing: ${segment.slice(0, 60)}…`).toBeGreaterThanOrEqual(0);
    from = at + segment.length;
  }
};

const templateById: Partial<Record<TurnPassId, string>> = {
  locationAuto: PROMPTS.locationChange,
  director: PROMPTS.director,
  character: PROMPTS.character,
  storyboard: PROMPTS.storyboard,
  choices: PROMPTS.choices,
  statUpdates: PROMPTS.statUpdates,
  summary: PROMPTS.summary,
  timePassed: PROMPTS.timePassed,
  openingTime: PROMPTS.openingTime,
  diary: PROMPTS.diary,
};

/** The plan the narrator was handed, recovered from the recorded narration message. */
const recordedTurnPlan = (messages: ChatMessage[]): string => {
  const last = messages[messages.length - 1].content;
  const marker = planDirective('').replace(/\n$/, '');
  const at = last.indexOf(marker);
  return at === -1 ? '' : last.slice(at + marker.length + 1);
};

describe('turn plan parity with the recorded run', () => {
  it('leaves out only the between-turn drainers', () => {
    const excluded = new Set(
      fixture.turns.flatMap((t) => t.requests.map((r) => r.type)).filter((t) => !PASS_ID_BY_TYPE[t]),
    );
    expect([...excluded]).toEqual(DRAINER_TYPES);
  });

  it.each(fixture.turns.map((t) => [t.index, t.action.slice(0, 40)]))(
    'turn %i (%s) plans the passes the run dispatched, in order',
    (index) => {
      const plan = planTurn(inputFor(index as number));
      const recorded = turnPasses(fixture.turns[index as number]).map((p) => p.id);
      // Collapse repeats of a fan-out pass: how many characters the director named is the model's answer.
      const collapsed = recorded.filter((id, i) => id !== recorded[i - 1] || !record(id).fanOut);
      // A due fan-out pass with no subjects sends nothing, so it may be absent from the recording.
      const expected = plan.passes
        .filter((p) => !p.fanOut || collapsed.includes(p.id))
        .map((p) => p.id);
      expect(collapsed).toEqual(expected);
    },
  );

  it.each(fixture.turns.map((t) => [t.index]))('turn %i sends each pass the payload the run sent', (index) => {
    const i = index as number;
    const input = inputFor(i);
    const compared: TurnPassId[] = [];
    for (const { id, request } of turnPasses(fixture.turns[i])) {
      const pass = record(id);
      // Fan-out passes are replayed with the subject the recording names; only their envelope is compared.
      const built = pass.buildRequest(
        input,
        materialFor(i, {
          trimmedHistory: id === 'narration' ? request.messages.slice(0, -1) : [],
          turnPlan: id === 'narration' ? recordedTurnPlan(request.messages) : '',
          subject: pass.fanOut ? { name: 'recorded subject' } : undefined,
        }),
      );
      expect([id, built.type], `${id} request type`).toEqual([id, request.type]);
      expect([id, built.maxTokens], `${id} cap`).toEqual([id, request.maxTokens]);
      expect([id, built.silent], `${id} silent flag`).toEqual([id, request.silent]);
      expect([id, built.attachTurnId ?? null], `${id} attached turn`).toEqual([id, request.attachTurnId]);
      const template = templateById[id];
      if (template) assertRendersTemplate(request.systemPrompt, template);
      // Messages the fixture holds every input for.
      if (!pass.fanOut && id !== 'storyboard') {
        expect(built.messages, `${id} messages`).toEqual(request.messages);
        compared.push(id);
      }
    }
    // Exactly which passes had their messages compared, so the comparison cannot quietly shrink.
    const expected: TurnPassId[] = ['locationAuto', 'director', 'narration', 'choices', 'statUpdates', 'summary', 'timePassed', 'openingTime'];
    expect(compared).toEqual(expected.filter((id) => turnPasses(fixture.turns[i]).some((p) => p.id === id)));
  });

  it('carries the staged plan into the narration exactly as the run did', () => {
    for (const turn of fixture.turns) {
      const narration = narrationOf(turn);
      const plan = recordedTurnPlan(narration.messages);
      expect(plan.length, `turn ${turn.index} narrated without a plan`).toBeGreaterThan(0);
      const built = record('narration').buildRequest(
        inputFor(turn.index),
        materialFor(turn.index, { trimmedHistory: narration.messages.slice(0, -1), turnPlan: plan }),
      );
      expect(built.messages[built.messages.length - 1].content).toBe(
        narration.messages[narration.messages.length - 1].content,
      );
    }
  });
});
