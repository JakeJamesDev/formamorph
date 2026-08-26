import type { AIRequestType, ChatMessage, Entity } from '@/types';
import type { ThinkingMode } from '@/contexts/SettingsContext';
import { buildNarrationPrompt } from './turnPipeline/narrationPrompt';
import { narrationPass, sceneTagsPass, TURN_PASSES } from './turnPipeline/turnPasses';
import {
  emptyTurnMaterial,
  type TurnMaterial, type TurnPassId, type TurnPassRecord, type TurnPlanInput, type TurnPrompts,
} from './turnPipeline/turnPlan';
import { parseTurns, buildBandedHistory, type BandStamp } from './turnBanding';
import { renderPromptTemplate } from './promptTemplate';
import { estimateTokens } from './memoryUtils';
import { buildStamper, hoursByPosition } from './gameClock';
import type { SectionStyle } from './promptPresets';
import type { ParagraphLimit } from './outputLength';
import { toAnatomyBlocks, type AnatomyBlock } from './requestAnatomy';

/**
 * The Anatomy hub shown in Settings → Prompts the moment a prompt is selected: the whole request that
 * prompt is part of, run through the real assembly on a canned playthrough, under the player's own
 * generation settings.
 *
 * Nothing here re-describes the pipeline. Every hub calls the pass's own `buildRequest` — the same one a
 * turn calls — so what the view draws is what a turn would send, and a pipeline change shows up here
 * without being mirrored. The narration is the one assembly with steps ahead of its pass (its system
 * prompt and its banded history), so it runs those too.
 *
 * The world comes from the caller's preview values (the same pool the prompt editor's Preview panes use, so
 * a loaded game shows its own world and the main menu shows the sample one); the settings come from the
 * caller too. Only what a single save or a single run supplies is canned: the playthrough below, the turn
 * plan a planning mode's earlier pass would have written, and the cast a scene would have put on stage.
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

/** The player's live generation settings, as plain data — everything the assembly reads that a player can
 *  change. Passed in rather than read here, so the builder stays pure and testable. */
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
  /** Whether the location router resolves the move up front or offers it afterward — which decides which
   *  of the two location requests a turn sends. */
  locationAutoApply: boolean;
}

/**
 * Which conditions this configuration can produce at all. The builder gates on this, so a caller asking
 * for a condition the settings rule out draws the request without it rather than a lie.
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

/** Every prompt surface a hub shows the player their own text in. */
export interface AnatomyPreviewPrompts {
  /** The narration system prompt. Assembled rather than rendered whole, so it is not one of the turn's. */
  system: string;
  /** The three conditional lines that ride the narration history. */
  recap: string;
  now: string;
  recall: string;
  /** Every pass's own templates, exactly as a turn renders them (the Direction Message is `oocDirective`). */
  turn: TurnPrompts;
}

/** The playthrough the preview runs on: four turns in the prompt editor's own sample world, each with the
 *  digest a real turn would have written. Turn two is the one Scene Recall brings back. */
const FIXTURE_TURNS = [
  {
    id: 't1',
    action: 'I ask Wren what the tide left behind last night.',
    narration:
      'Wren does not look up from the pole she is scraping. "Rope, a crate with nothing in it, and you," she says. The lamp at the head of the stair gutters and holds.',
    summary: "The traveler asked Wren about the night's salvage; she answered without looking up.",
    timeDelta: 1,
  },
  {
    id: 't2',
    action: 'I search the tide pools for anything the ebb uncovered.',
    narration:
      "The basins are cold to the wrist. Under the third one, wedged where the stone narrows, a folded oilcloth packet — and inside it, a map with Harrow's mark inked in the corner.",
    summary: 'In the tide pools the traveler found an oilcloth packet holding a map marked by Harrow.',
    timeDelta: 2,
  },
  {
    id: 't3',
    action: 'I show Wren the map.',
    narration:
      '"That is his hand," Wren says, and something goes out of her face. "He has not been at that stall in a month." She looks up the stair, toward the town, for a long moment.',
    summary: "Wren recognized Harrow's hand on the map and said he had been gone from his stall a month.",
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

/** What this turn's narration answered with — canned like the four before it, and for the same reason:
 *  every post-narration pass is fed the story the model just wrote, not something a setting decides. */
const FIXTURE_NARRATION =
  'The stair takes you down past the lamp and out onto the flats, where the causeway stones are showing black and streaming. Behind you Wren has not moved, but she is watching, the pole idle across her knees.';

/** The plan a planning mode hands the narration. Canned with the narrations, and for the same reason: a
 *  plan is what an earlier pass's model wrote this run, not something a setting decides. */
const FIXTURE_TURN_PLAN = `- The traveler pockets the map and leaves the Landing for the stair.
- Wren does not follow. She says the water is still going out, and to be back before it turns.
- The causeway stones are showing; Harrow's stall is still shut.
- The beat to land: the leaving itself, and Wren watching them go.`;

/** What the earlier staged passes put on stage, for the passes that read it. */
const FIXTURE_SCENE = 'Low tide at the Landing. Wren is at the rail with the scraping pole; the lamp is lit.';
const FIXTURE_INTENTS = [
  { name: 'Wren', text: 'I want them back before the water turns, and I will not say so outright.' },
];
const FIXTURE_OVERFLOW = ['Harrow'];

/** The cast member the fan-out hubs stand one request up for. */
const FIXTURE_SUBJECT_ENTITY: Entity = {
  id: 'preview-wren',
  name: 'Wren',
  aiSummary: 'The salvager who works the Landing rail; brusque, and watches the water more than she says.',
};
const FIXTURE_SUBJECT = {
  name: FIXTURE_SUBJECT_ENTITY.name,
  stance: 'at the rail, pole across her knees',
  entity: FIXTURE_SUBJECT_ENTITY,
  diary: ['I told them about the crate and not about Harrow. Let them find the stall shut themselves.'],
};

/** Where the location router could send this turn, and who the picture would have in frame. */
const FIXTURE_DESTINATIONS = ['The Causeway', 'The Town Stair'];
const FIXTURE_SCENE_CAST = ['Wren'];

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

/**
 * The turn shape the hubs are drawn against. Everything a pass's own `isDue` reads is on, so a hub renders
 * for the prompt the player selected rather than for the plan one fixture turn happens to have — the rail
 * already hides a prompt whose feature is off. The settings that change what a request *contains*, and the
 * one that decides which location request a turn sends, are the player's own.
 */
function previewInput(prompts: AnatomyPreviewPrompts, settings: AnatomyPreviewSettings, recap: boolean): TurnPlanInput {
  return {
    action: FIXTURE_ACTION,
    isGameStarted: true,
    destinationCount: FIXTURE_DESTINATIONS.length,
    locationCount: 3,
    hasCurrentLocation: true,
    prompts: prompts.turn,
    settings: {
      thinkingMode: settings.thinkingMode,
      concurrentTurnRequests: true,
      choicesEnabled: true, statUpdatesEnabled: true, statCount: 3,
      locationChangeEnabled: true, locationAutoApply: settings.locationAutoApply,
      aiClock: true, memoryDigests: recap, characterDiaries: true, describeCharacters: true,
      language: settings.language,
    },
  };
}

/** The material every hub but the narration's is drawn from: a mid-story turn whose narration has landed
 *  and whose planning stages have all answered. */
function previewMaterial(values: Record<string, string>, action: string, plannerRecap: string): TurnMaterial {
  return {
    ...emptyTurnMaterial({
      action,
      effectiveAction: action,
      turnId: 'preview',
      baseCtx: values,
      destinations: FIXTURE_DESTINATIONS,
    }),
    ctx: values,
    narration: FIXTURE_NARRATION,
    lastStory: FIXTURE_TURNS[FIXTURE_TURNS.length - 1].narration,
    plannerRecap,
    turnPlan: FIXTURE_TURN_PLAN,
    activeCharacterGuidance: values['<ACTIVE CHARACTER GUIDANCE>'] ?? '',
    directorScene: FIXTURE_SCENE,
    npcCastSize: FIXTURE_INTENTS.length,
    intents: FIXTURE_INTENTS,
    overflow: FIXTURE_OVERFLOW,
    sceneCast: FIXTURE_SCENE_CAST,
    subject: FIXTURE_SUBJECT,
  };
}

/** One request in a hub, ready to draw. */
export interface AnatomyRequestPreview {
  /** Stable across re-renders — the pass that built it. */
  key: string;
  type: AIRequestType;
  /** Said above the request when a hub shows more than one, or when one stands for many. */
  caption?: string;
  blocks: AnatomyBlock[];
}

const passById = (id: TurnPassId): TurnPassRecord => {
  const record = TURN_PASSES.find((p) => p.id === id);
  if (!record) throw new Error(`no pass record for ${id}`);
  return record;
};

/** What each fan-out hub says above the one request it draws, so the repetition is understood rather than
 *  scrolled through. */
const FANOUT_CAPTION = `One request like this is sent per character in the scene. This one is ${FIXTURE_SUBJECT.name}.`;

/** Which pass each prompt's hub draws, beyond the two that decide for themselves. */
const HUB_PASS: Record<string, TurnPassId> = {
  thinking: 'thinking',
  director: 'director',
  character: 'character',
  storyboard: 'storyboard',
  choices: 'choices',
  statupdates: 'statUpdates',
  summary: 'summary',
  timepassed: 'timePassed',
  timeopening: 'openingTime',
  diary: 'diary',
};

const CAPTIONS: Record<string, string> = {
  character: FANOUT_CAPTION,
  diary: FANOUT_CAPTION,
  timeopening: 'Sent once, on the opening turn only — what it settles dates every memory after it.',
};

/** The location prompt drives two different requests; which one a turn sends is the detection mode's call,
 *  so the hub asks the passes themselves rather than restating the rule. */
const LOCATION_PASSES: { id: TurnPassId; caption: string }[] = [
  { id: 'locationAuto', caption: 'Sent before the narration — the move is resolved up front, and the whole turn then runs in the new place.' },
  { id: 'locationSuggest', caption: 'Sent after the narration — the move is offered, and yours to take.' },
];

/**
 * Every request one prompt is part of, drawn under the player's own settings. An empty list means this
 * configuration never sends the prompt's request at all — which the panel says outright, rather than
 * drawing a request that would never leave.
 *
 * `values` is the chip value pool (see `composePreviewValues`) — the same one the editor's Preview shows,
 * so the world data the anatomy calls out is the world data the player is already looking at.
 */
export function buildAnatomyHub(
  tab: string,
  prompts: AnatomyPreviewPrompts,
  values: Record<string, string>,
  conditions: AnatomyConditions,
  settings: AnatomyPreviewSettings,
): AnatomyRequestPreview[] {
  if (tab === 'narration') {
    return [{ key: 'narration', type: 'narration', blocks: buildNarrationAnatomy(prompts, values, conditions, settings) }];
  }
  // A toggle the settings don't offer can't be honored, and no hub but the narration's offers any.
  const recap = anatomyToggleAvailability(settings).recap;
  const input = previewInput(prompts, settings, recap);
  // The banded recap costs a whole narration assembly to produce, and only the planner is led with one.
  const plannerRecap = recap && tab === 'thinking' ? fixtureRecap(prompts, values, settings) : '';
  const material = previewMaterial(values, FIXTURE_ACTION, plannerRecap);
  const draw = (pass: TurnPassRecord, caption?: string): AnatomyRequestPreview => {
    const request = pass.buildRequest(input, material);
    return {
      key: pass.id,
      type: request.type,
      ...(caption ? { caption } : {}),
      blocks: toAnatomyBlocks([{ role: 'system', content: request.systemPrompt }, ...request.messages], request.anatomy),
    };
  };
  if (tab === 'location') {
    return LOCATION_PASSES
      .filter(({ id }) => passById(id).isDue(input))
      .map(({ id, caption }) => draw(passById(id), caption));
  }
  if (tab === 'scenetags') return [draw(sceneTagsPass)];
  const id = HUB_PASS[tab];
  return id ? [draw(passById(id), CAPTIONS[tab])] : [];
}

/** The digested older turns the precall planner is led with — the same band the narration is built on. */
function fixtureRecap(
  prompts: AnatomyPreviewPrompts,
  values: Record<string, string>,
  settings: AnatomyPreviewSettings,
): string {
  return narrationBand(prompts, values, { recap: true, recall: false, brackets: false }, settings).band.recap;
}

/** The narration's two assembly steps ahead of its pass: its system prompt, and the banded history the
 *  turn rides on. Shared, since the planner is led with the same band's recap. */
function narrationBand(
  prompts: AnatomyPreviewPrompts,
  values: Record<string, string>,
  conditions: AnatomyConditions,
  settings: AnatomyPreviewSettings,
) {
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
  return { prompt, runs, band, action, recap };
}

/**
 * Run the real narration assembly over the fixture and return it as anatomy blocks, system message first.
 * Three steps, all the turn's own: the narration system prompt, the history banding, the pass's request.
 */
function buildNarrationAnatomy(
  prompts: AnatomyPreviewPrompts,
  values: Record<string, string>,
  conditions: AnatomyConditions,
  settings: AnatomyPreviewSettings,
): AnatomyBlock[] {
  const { prompt, runs, band, action, recap } = narrationBand(prompts, values, conditions, settings);
  const input = previewInput(prompts, settings, recap);
  const planningMode = settings.thinkingMode === 'precall' || settings.thinkingMode === 'staged';
  const request = narrationPass.buildRequest({ ...input, action }, {
    ...previewMaterial(values, action, band.recap),
    // The narration is what this request asks for, so nothing has been written yet.
    narration: '',
    narrationSystemPrompt: prompt,
    narrationSystemPromptRuns: runs,
    trimmedHistory: band.messages,
    historyRuns: band.runs,
    turnPlan: planningMode ? FIXTURE_TURN_PLAN : '',
  });

  return toAnatomyBlocks([{ role: 'system', content: request.systemPrompt }, ...request.messages], request.anatomy);
}
