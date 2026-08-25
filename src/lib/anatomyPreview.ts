import type { ChatMessage } from '@/types';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { narrationPass } from './turnPipeline/turnPasses';
import { emptyTurnMaterial, type TurnPlanInput, type TurnPrompts } from './turnPipeline/turnPlan';
import { parseTurns, buildBandedHistory } from './turnBanding';
import { renderPromptTemplate } from './promptTemplate';
import { estimateTokens } from './memoryUtils';
import { toAnatomyBlocks, type AnatomyBlock } from './requestAnatomy';

/**
 * The Request Anatomy shown in Settings → Prompts → Narration → Anatomy: the player's own prompt text run
 * through the real assembly on a canned playthrough.
 *
 * Nothing here re-describes the pipeline. It calls the same three steps a turn does — the narration system
 * prompt, the history banding, the narration pass's request build — so what the view draws is what a turn
 * would send, and a change to any of them shows up here without being mirrored.
 *
 * The world comes from the caller's preview values (the same pool the prompt editor's Preview panes use, so
 * a loaded game shows its own world and the main menu shows the sample one); the playthrough comes from the
 * fixture below. Everything else is pinned, because this view is about the request's shape, not about
 * re-previewing every generation setting.
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
  },
  {
    id: 't2',
    action: 'I search the tide pools for anything the ebb uncovered.',
    narration:
      'The basins are cold to the wrist. Under the third one, wedged where the stone narrows, a folded oilcloth packet — and inside it, a map with Harrow\'s mark inked in the corner.',
    summary: 'In the tide pools the traveler found an oilcloth packet holding a map marked by Harrow.',
  },
  {
    id: 't3',
    action: 'I show Wren the map.',
    narration:
      '"That is his hand," Wren says, and something goes out of her face. "He has not been at that stall in a month." She looks up the stair, toward the town, for a long moment.',
    summary: 'Wren recognized Harrow\'s hand on the map and said he had been gone from his stall a month.',
  },
  {
    id: 't4',
    action: 'I ask her where Harrow went.',
    narration:
      'She turns the pole over once in her hands. "Causeway side. He goes when the water is out and comes back when it is not, and this ebb he has not come back."',
    summary: 'Wren said Harrow crosses at the causeway and has not returned from this ebb.',
  },
];

/** The turn Scene Recall brings back — the scene the current action returns to. */
const RECALLED_TURN_ID = 't2';

/** This turn's action, and the authorial direction a bracketed one carries. */
const FIXTURE_ACTION = 'I take the map and start down toward the causeway.';
const FIXTURE_BRACKET = ' [keep the tide going out through this scene]';

/** The fixture playthrough as flat chat history, in the shape a stored game holds it. */
function fixtureHistory(): ChatMessage[] {
  return FIXTURE_TURNS.flatMap((turn): ChatMessage[] => [
    { role: 'user', content: turn.action },
    {
      role: 'assistant',
      content: JSON.stringify({ turnId: turn.id, narration: turn.narration, summary: turn.summary, choices: [], stat_changes: [] }),
    },
  ]);
}

/** Sized so the fixture never trims: the conditions decide what rides, not a budget the player can't see. */
const PREVIEW_CONTEXT_WINDOW = 32_768;
const PREVIEW_MAX_TOKENS = 800;

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
 * so the world data the anatomy calls out is the world data the player is already looking at.
 */
export function buildAnatomyPreview(
  prompts: AnatomyPreviewPrompts,
  values: Record<string, string>,
  conditions: AnatomyConditions,
): AnatomyBlock[] {
  const action = conditions.brackets ? FIXTURE_ACTION + FIXTURE_BRACKET : FIXTURE_ACTION;
  const history = fixtureHistory();

  const { prompt, runs } = buildNarrationPrompt({
    template: prompts.system,
    ctx: values,
    action,
    history,
    dictionary: [],
    actionVec: null,
    semanticLore: false,
    embedVectors: new Map(),
    language: 'English',
    paragraphLimit: 'none',
    maxTokens: PREVIEW_MAX_TOKENS,
    markdownOutput: true,
    sectionStyle: 'markdown',
    resolvePH: (text) => text,
  });

  // Condensing is what creates the band, so the recap toggle is a verbatim floor wide enough to swallow
  // every turn — the same thing a short game does — rather than a flag the assembly doesn't have.
  const band = buildBandedHistory({
    turns: parseTurns(history),
    contextWindow: PREVIEW_CONTEXT_WINDOW,
    promptTokens: estimateTokens(prompt.length),
    maxTokens: PREVIEW_MAX_TOKENS,
    verbatimFloor: conditions.recap ? 1 : FIXTURE_TURNS.length,
    keywords: [],
    actionEntities: [],
    rehydrateCap: PREVIEW_CONTEXT_WINDOW,
    recapPrompt: prompts.recap,
    nowLine: renderPromptTemplate(prompts.now, values),
    semanticRehydrate: conditions.recall ? [RECALLED_TURN_ID] : null,
    rehydratePrompt: prompts.recall,
  });

  const input: TurnPlanInput = {
    action,
    isGameStarted: true,
    destinationCount: 0,
    locationCount: 1,
    hasCurrentLocation: true,
    prompts: previewTurnPrompts(prompts),
    settings: {
      // Thinking off is the mode the User Message and the Direction rider exist in; the other modes send
      // the bare action, which would leave four of the six surfaces with nothing to show.
      thinkingMode: 'off',
      concurrentTurnRequests: true,
      choicesEnabled: false, statUpdatesEnabled: false, statCount: 0,
      locationChangeEnabled: false, locationAutoApply: false,
      aiClock: false, memoryDigests: conditions.recap, characterDiaries: false, describeCharacters: false,
      language: 'English',
    },
  };

  const request = narrationPass.buildRequest(input, {
    ...emptyTurnMaterial({ action, effectiveAction: action, turnId: 'preview', baseCtx: values, destinations: [] }),
    ctx: values,
    narrationSystemPrompt: prompt,
    narrationSystemPromptRuns: runs,
    trimmedHistory: band.messages,
    historyRuns: band.runs,
  });

  return toAnatomyBlocks([{ role: 'system', content: request.systemPrompt }, ...request.messages], request.anatomy);
}
