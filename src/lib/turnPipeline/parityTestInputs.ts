import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateParityFixture, type ParityRequestRecord, type ParityTurnRecord } from './parityRecorder';
import type { TurnPassId, TurnPlanInput, TurnPrompts, TurnSettings } from './turnPlan';
import type { AIRequestType } from '@/types';
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
} from '@/components/game/GamePrompts';

/**
 * The recorded run every parity test replays, plus the settings and prompts it ran with. Shared by the plan's
 * parity test and the runner's, so the two can never disagree about what the recording represents.
 */

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../testing/parity/turn-pipeline-parity.json',
);

export const fixture = validateParityFixture(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as unknown);

/** The settings the `parity` harness profile ran with (testing/baseline/harness/profiles.example.json). */
export const PARITY_SETTINGS: TurnSettings = {
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

/** The run used the shipped default prompts. */
export const PARITY_PROMPTS: TurnPrompts = {
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
export const PASS_ID_BY_TYPE: Partial<Record<AIRequestType, TurnPassId>> = {
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

/** Recorded types the parity comparisons deliberately leave out. */
export const DRAINER_TYPES: AIRequestType[] = ['milestoneSelect'];

/** The recorded turn's requests that are turn passes, in dispatch order. */
export const recordedPasses = (turn: ParityTurnRecord): { id: TurnPassId; request: ParityRequestRecord }[] =>
  turn.requests
    .filter((r) => PASS_ID_BY_TYPE[r.type])
    .map((r) => ({ id: PASS_ID_BY_TYPE[r.type] as TurnPassId, request: r }));

export const inputFor = (index: number): TurnPlanInput => ({
  action: fixture.turns[index].action,
  isGameStarted: index > 0,
  // Sedge Landing: the dock has somewhere to go, and the world has more than one place.
  destinationCount: 2,
  locationCount: 3,
  hasCurrentLocation: true,
  settings: PARITY_SETTINGS,
  prompts: PARITY_PROMPTS,
});

export const narrationOf = (turn: ParityTurnRecord): ParityRequestRecord => {
  const found = turn.requests.find((r) => r.type === 'narration');
  if (!found) throw new Error(`turn ${turn.index} recorded no narration`);
  return found;
};
