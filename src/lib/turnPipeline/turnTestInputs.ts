import { OPENING_SCENE_CUE } from '@/components/game/GamePrompts';
import type { TurnPlanInput, TurnPrompts, TurnSettings } from './turnPlan';

/**
 * Shared inputs for the Turn Pipeline's tests. The prompt templates carry recognizable literal text around
 * real chips, so a value rendered from the wrong context — or a template swapped for another pass's — is
 * visible in the assertion rather than hidden behind a realistic-looking wall of prose.
 */

export const TEST_PROMPTS: TurnPrompts = {
  locationChange: 'ROUTER <WORLD DESCRIPTION>',
  locationChangeUser: 'Action: <PLAYER ACTION>',
  thinking: 'THINK <WORLD DESCRIPTION>',
  director: 'DIRECTOR <WORLD DESCRIPTION> <ACTIVE CHARACTER GUIDANCE>',
  directorUser: 'Last: <NARRATION> | Now: <PLAYER ACTION>',
  character: 'CHARACTER <WORLD DESCRIPTION> as <CHARACTER NAME>',
  storyboard: 'STORYBOARD <WORLD DESCRIPTION>',
  narrationUser: 'Player: <PLAYER ACTION>',
  oocDirective: 'OOC RIDER',
  openingCue: OPENING_SCENE_CUE,
  choices: 'CHOICES <WORLD DESCRIPTION> <ENTITIES>',
  choicesUser: 'Choices: <PLAYER ACTION> | <NARRATION>',
  statUpdates: 'STATS <WORLD DESCRIPTION>',
  statUpdatesUser: 'Stats: <PLAYER ACTION> | <NARRATION>',
  summary: 'SUMMARY <WORLD DESCRIPTION>',
  summaryUser: 'Digest: <PLAYER ACTION> | <NARRATION>',
  timePassed: 'TIME <WORLD DESCRIPTION>',
  timePassedUser: 'Time: <PLAYER ACTION> | <NARRATION>',
  openingTime: 'OPENING <WORLD DESCRIPTION>',
  openingTimeUser: 'Opening: <NARRATION>',
  diary: 'DIARY <WORLD DESCRIPTION>',
  discoverEntity: 'DISCOVER PROMPT',
  sceneTags: 'TAGS <WORLD DESCRIPTION>',
  sceneTagsUser: 'Draw: <NARRATION> | In frame: <IN FRAME>',
};

/** Everything on — the shape the parity capture ran in, so switching one thing off isolates it. */
export const TEST_SETTINGS: TurnSettings = {
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
  describeCharacters: true,
  language: 'English',
};

/** A mid-story turn with somewhere to go, overridable field by field. */
export const testInput = (
  over: Partial<TurnPlanInput> = {},
  settings: Partial<TurnSettings> = {},
): TurnPlanInput => ({
  action: 'I read the notices.',
  isGameStarted: true,
  destinationCount: 2,
  locationCount: 3,
  hasCurrentLocation: true,
  prompts: TEST_PROMPTS,
  ...over,
  settings: { ...TEST_SETTINGS, ...settings },
});
