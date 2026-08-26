import type { ChatMessage } from '@/types';
import type { ThinkingMode } from '@/contexts/SettingsContext';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { narrationPass } from './turnPipeline/turnPasses';
import { emptyTurnMaterial, type TurnPlanInput, type TurnPrompts } from './turnPipeline/turnPlan';
import { parseTurns, buildBandedHistory, type BandStamp } from './turnBanding';
import { renderPromptTemplate } from './promptTemplate';
import { estimateTokens } from './memoryUtils';
import { buildStamper, hoursByPosition } from './gameClock';
import type { SectionStyle } from './promptPresets';
import type { ParagraphLimit } from './outputLength';
import { toAnatomyBlocks, type AnatomyBlock } from './requestAnatomy';

/**
 * The Request Anatomy shown in Settings → Prompts → Narration → Anatomy: the player's own prompt text run
 * through the real assembly on a canned playthrough, under the player's own generation settings.
 *
 * Nothing here re-describes the pipeline. It calls the same three steps a turn does — the narration system
 * prompt, the history banding, the narration pass's request build — so what the view draws is what a turn
 * would send, and a change to any of them shows up here without being mirrored.
 *
 * The world comes from the caller's preview values (the same pool the prompt editor's Preview panes use, so
 * a loaded game shows its own world and the main menu shows the sample one); the settings come from the
 * caller too. Only what a single save or a single run supplies is canned: the playthrough below, and the
 * turn plan a planning mode's earlier pass would have written.
 */

/** Which conditional pieces the preview is drawn with. Each is a real assembly condition, not a display
 *  switch: turning one off re-runs the chain and the runs it produced simply aren't there. */
export interface AnatomyConditions {
  /** Older turns are condensed into the recap exchange (Memory Summaries). Off = every turn rides full. */
  recap: boolean;
  /** Scene Recall pulled an older scene back word-for-word. Needs a band to pull from, so needs `recap`. */
  recall: boolean;
  /** The action carries a `[bracketed]` authorial direction, which rides the Direction Message. */
  brackets: boolean;
}

/** The player's live generation settings, as plain data — everything the narration assembly reads that a
 *  player can change. Passed in rather than read here, so the builder stays pure and testable. */
export interface AnatomyPreviewSettings {
  thinkingMode: ThinkingMode;
  sectionStyle: SectionStyle;
  markdownOutput: boolean;
  paragraphLimit: ParagraphLimit;
  language: string;
  /** The reply cap the length guidance is sized against. */
  maxTokens: number;
  memoryDigests: boolean;
  semanticMemory: boolean;
  semanticRehydration: boolean;
  /** In-world time riding into context, which is what stamps each remembered moment. */
  timeContext: boolean;
}

/**
 * Which condition toggles this configuration can demonstrate at all. The panel hides the rest, and the
 * builder gates on the same answer, so no toggle can promise something the assembly would ignore.
 *
 * These are the Recap and Recall editor surfaces' own availability conditions. Brackets are never gated:
 * the bracket rides the action in every Thinking mode, and the Direction rider answering it only with
 * thinking off is the thing worth showing.
 */
export function anatomyToggleAvailability(
  settings: AnatomyPreviewSettings,
): Record<keyof AnatomyConditions, boolean> {
  return {
    recap: settings.memoryDigests,
    recall: settings.memoryDigests && settings.semanticMemory && settings.semanticRehydration,
    brackets: true,
  };
}

/** The six editor surfaces this view shows the player their own text in. */
export interface AnatomyPreviewPrompts {
  system: string;
  narrationUser: string;
  recap: string;
  now: string;
  recall: string;
  direction: string;
}

/** The playthrough the preview runs on: four turns in the prompt editor's own sample world, each with the
 *  digest a real turn would have written. Turn two is the one Scene Recall brings back. */
const FIXTURE_TURNS = [
  {
    id: 't1',
    action: 'I ask Wren what the tide left behind last night.',
    narration:
      'Wren does not look up from the pole she is scraping. "Rope, a crate with nothing in it, and you," she says. The lamp at the head of the stair gutters and holds.',
    summary: 'The traveler asked Wren about the night\'s salvage; she answered without looking up.',
    timeDelta: 1,
  },
  {
    id: 't2',
    action: 'I search the tide pools for anything the ebb uncovered.',
    narration:
      'The basins are cold to the wrist. Under the third one, wedged where the stone narrows, a folded oilcloth packet — and inside it, a map with Harrow\'s mark inked in the corner.',
    summary: 'In the tide pools the traveler found an oilcloth packet holding a map marked by Harrow.',
    timeDelta: 2,
  },
  {
    id: 't3',
    action: 'I show Wren the map.',
    narration:
      '"That is his hand," Wren says, and something goes out of her face. "He has not been at that stall in a month." She looks up the stair, toward the town, for a long moment.',
    summary: 'Wren recognized Harrow\'s hand on the map and said he had been gone from his stall a month.',
    timeDelta: 1,
  },
  {
    id: 't4',
    action: 'I ask her where Harrow went.',
    narration:
      'She turns the pole over once in her hands. "Causeway side. He goes when the water is out and comes back when it is not, and this ebb he has not come back."',
    summary: 'Wren said Harrow crosses at the causeway and has not returned from this ebb.',
    timeDelta: 2,
  },
];

/** How far into the story the fixture's last turn sits, for the stamps to be measured back from. */
const FIXTURE_ELAPSED_HOURS = FIXTURE_TURNS.reduce((h, t) => h + t.timeDelta, 0);

/** The turn Scene Recall brings back — the scene the current action returns to. */
const RECALLED_TURN_ID = 't2';

/** This turn's action, and the authorial direction a bracketed one carries. */
const FIXTURE_ACTION = 'I take the map and start down toward the causeway.';
const FIXTURE_BRACKET = ' [keep the tide going out through this scene]';

/** The plan a planning mode hands the narration. Canned with the narrations, and for the same reason: a
 *  plan is what an earlier pass's model wrote this run, not something a setting decides. */
const FIXTURE_TURN_PLAN = `- The traveler pockets the map and leaves the Landing for the stair.
- Wren does not follow. She says the water is still going out, and to be back before it turns.
- The causeway stones are showing; Harrow's stall is still shut.
- The beat to land: the leaving itself, and Wren watching them go.`;

/** The fixture playthrough as flat chat history, in the shape a stored game holds it. */
function fixtureHistory(): ChatMessage[] {
  return FIXTURE_TURNS.flatMap((turn): ChatMessage[] => [
    { role: 'user', content: turn.action },
    {
      role: 'assistant',
      content: JSON.stringify({ turnId: turn.id, narration: turn.narration, summary: turn.summary, timeDelta: turn.timeDelta, choices: [], stat_changes: [] }),
    },
  ]);
}

/** Headroom above the rendered prompt and the player's own reply cap, so the four-turn fixture never
 *  trims under any settings combination: the toggles decide what rides, not a budget the player can't
 *  see. Deliberately pinned — the context window is the one generation setting this view does not read. */
const PREVIEW_HEADROOM = 32_768;

/** Only the narration pass runs here, so the prompts it never reads are left empty rather than filled with
 *  defaults that would imply this preview covers them. */
function previewTurnPrompts(prompts: AnatomyPreviewPrompts): TurnPrompts {
  return {
    locationChange: '', locationChangeUser: '', thinking: '', director: '', directorUser: '',
    character: '', storyboard: '', choices: '', choicesUser: '', statUpdates: '', statUpdatesUser: '',
    summary: '', summaryUser: '', timePassed: '', timePassedUser: '', openingTime: '', openingTimeUser: '',
    diary: '', discoverEntity: '', openingCue: '',
    narrationUser: prompts.narrationUser,
    oocDirective: prompts.direction,
  };
}

/**
 * Run the real narration assembly over the fixture and return it as anatomy blocks, system message first.
 *
 * `values` is the chip value pool (see `composePreviewValues`) — the same one the editor's Preview shows,
 * so the world data the anatomy calls out is the world data the player is already looking at. `settings`
 * is the player's live generation settings, so the request drawn is the one this configuration sends: a
 * surface the player's mode never sends is simply absent, exactly as its editor is.
 */
export function buildAnatomyPreview(
  prompts: AnatomyPreviewPrompts,
  values: Record<string, string>,
  conditions: AnatomyConditions,
  settings: AnatomyPreviewSettings,
): AnatomyBlock[] {
  // A toggle the settings don't offer can't be honored, whatever the caller passes.
  const available = anatomyToggleAvailability(settings);
  const recap = conditions.recap && available.recap;
  const recall = conditions.recall && available.recall;
  const action = conditions.brackets ? FIXTURE_ACTION + FIXTURE_BRACKET : FIXTURE_ACTION;
  const history = fixtureHistory();
  const turns = parseTurns(history);

  const { prompt, runs } = buildNarrationPrompt({
    template: prompts.system,
    ctx: values,
    action,
    history,
    dictionary: [],
    actionVec: null,
    semanticLore: false,
    embedVectors: new Map(),
    language: settings.language,
    paragraphLimit: settings.paragraphLimit,
    maxTokens: settings.maxTokens,
    markdownOutput: settings.markdownOutput,
    sectionStyle: settings.sectionStyle,
    resolvePH: (text) => text,
  });

  // Each fixture turn carries how long it took, so the stamps are resolved through the real clock rather
  // than written out as labels. The durations are canned like the narrations; the gate is the player's own.
  const stamp: BandStamp | undefined = settings.timeContext
    ? buildStamper({ nowHours: FIXTURE_ELAPSED_HOURS, hoursAt: hoursByPosition(turns) })
    : undefined;
  const contextWindow = PREVIEW_HEADROOM + estimateTokens(prompt.length) + settings.maxTokens;

  // Condensing is what creates the band, so the recap toggle is a verbatim floor wide enough to swallow
  // every turn — the same thing a short game does — rather than a flag the assembly doesn't have.
  const band = buildBandedHistory({
    turns,
    contextWindow,
    promptTokens: estimateTokens(prompt.length),
    maxTokens: settings.maxTokens,
    verbatimFloor: recap ? 1 : FIXTURE_TURNS.length,
    keywords: [],
    actionEntities: [],
    rehydrateCap: contextWindow,
    recapPrompt: prompts.recap,
    nowLine: renderPromptTemplate(prompts.now, values),
    semanticRehydrate: recall ? [RECALLED_TURN_ID] : null,
    rehydratePrompt: prompts.recall,
    stamp,
  });

  const input: TurnPlanInput = {
    action,
    isGameStarted: true,
    destinationCount: 0,
    locationCount: 1,
    hasCurrentLocation: true,
    prompts: previewTurnPrompts(prompts),
    settings: {
      thinkingMode: settings.thinkingMode,
      concurrentTurnRequests: true,
      choicesEnabled: false, statUpdatesEnabled: false, statCount: 0,
      locationChangeEnabled: false, locationAutoApply: false,
      aiClock: false, memoryDigests: recap, characterDiaries: false, describeCharacters: false,
      language: settings.language,
    },
  };

  const planningMode = settings.thinkingMode === 'precall' || settings.thinkingMode === 'staged';
  const request = narrationPass.buildRequest(input, {
    ...emptyTurnMaterial({ action, effectiveAction: action, turnId: 'preview', baseCtx: values, destinations: [] }),
    ctx: values,
    narrationSystemPrompt: prompt,
    narrationSystemPromptRuns: runs,
    trimmedHistory: band.messages,
    historyRuns: band.runs,
    turnPlan: planningMode ? FIXTURE_TURN_PLAN : '',
  });

  return toAnatomyBlocks([{ role: 'system', content: request.systemPrompt }, ...request.messages], request.anatomy);
}
