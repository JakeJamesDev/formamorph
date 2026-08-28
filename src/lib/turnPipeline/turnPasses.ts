import type { ChatMessage } from '@/types';
import type { TurnPassRecord, TurnPassRequest, TurnPlanInput, TurnMaterial, TurnPassSubject } from './turnPlan';
import { renderPromptTemplate, renderPromptTemplateRuns, promptTemplatePieces } from '@/lib/promptTemplate';
import {
  tilePieces, trimEndTiled,
  type AnatomyPiece, type ContextLabel, type TiledRuns,
} from '@/lib/requestAnatomy';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import {
  buildCharacterUserMessage,
  buildDiaryUserMessage,
  buildStoryboardUserMessage,
  parseDirectorCast,
  type ParsedDirector,
} from '@/lib/stagedPlanning';
import { languageDirective } from '@/lib/languages';
import { matchLocationResponse } from '@/lib/locationMatch';
import { parseChoices } from '@/lib/choices';
import { parseStatUpdates } from '@/lib/statChanges';
import { parseTimeDelta, parseOpeningDaypart } from '@/lib/gameClock';
import { cleanDiscoveredDescription, DISCOVER_NAME_LABEL, DISCOVER_PASSAGE_LABEL } from '@/lib/runtimeCharacters';
import {
  hasOocDirective,
  stripOocDirectives,
  planDirective,
  INLINE_THINKING_DIRECTIVE,
} from '@/components/game/GamePrompts';

/**
 * The turn's passes as data records. Each one owns its eligibility rule, its request assembly and its
 * response parse; nothing here reaches for React state, a clock, or a global.
 */

/**
 * Output caps per pass. The narration takes the request type's own default (null); every other pass pins
 * its own — sized for the verbose small tier (Rocinante 12B) so a cast list or an intent completes rather
 * than truncating mid-word; a cut cast member is lost from the whole turn.
 */
export const TURN_PASS_CAPS = {
  director: 320,
  character: 256,
  storyboard: 300,
  /** The precall planner's single call. */
  thinking: 256,
  summary: 200,
  /** One value like "2h"; anything longer is stray prose the parser ignores. */
  timePassed: 12,
  /** One daypart word. */
  openingTime: 8,
  /** A diary entry is one or two first-person sentences. */
  diary: 80,
  /** ~2 short paragraphs, trimmed to the last full sentence — headroom against a mid-word cut. */
  discoverEntity: 200,
  /** One line of tags: enough for a rich action line, not for prose. */
  sceneTags: 120,
} as const;

/** What `<IN FRAME>` renders to when the turn put nobody in the picture. */
export const SCENE_TAGS_EMPTY_CAST = 'nobody - an empty scene';

/**
 * The Request Anatomy sidecar (see lib/requestAnatomy). Every pass below assembles its request from
 * labeled pieces rather than describing it afterward, so the content IS the pieces joined and the runs
 * cannot drift from the text they index.
 */

/** A system prompt and the runs over it: what the author typed, against the values its chips inject. */
const systemTiled = (template: string, values: Record<string, string>): TiledRuns =>
  renderPromptTemplateRuns(template, values, { source: 'system-template' });

/** A user-message template and the runs over it. A few of the chips a user message carries hold what an
 *  earlier prompt wrote — the action, the narration, who is in frame — so those name what wrote them. */
const userTiled = (
  template: string,
  values: Record<string, string>,
  tokens?: Record<string, ContextLabel>,
): TiledRuns =>
  renderPromptTemplateRuns(template, values, {
    source: 'user-template',
    tokens: { '<PLAYER ACTION>': 'action', '<NARRATION>': 'narration', ...tokens },
  });

/** A user message the app assembles outright, with nothing authored in it to point at. */
const assembledTiled = (text: string, contextLabel: ContextLabel): TiledRuns =>
  tilePieces([{ text, contextLabel }]);

/** One system prompt and one user message, joined to the sidecar that tiles them. */
const labeledRequest = (
  base: Omit<TurnPassRequest, 'systemPrompt' | 'messages' | 'anatomy'>,
  system: TiledRuns,
  message: TiledRuns,
): TurnPassRequest => ({
  ...base,
  systemPrompt: system.content,
  messages: [{ role: 'user', content: message.content }],
  anatomy: { system: system.runs, messages: [message.runs] },
});

const isOpening = (input: TurnPlanInput): boolean => !input.isGameStarted;

/** The action every consumer but the narration sees: the opening turn's cue is a narrator directive that
 *  derails the other prompts, so they get the terse proxy instead. */
export const effectiveActionFor = (input: TurnPlanInput): string =>
  isOpening(input) ? 'START GAME' : input.action;

const user = (content: string): ChatMessage[] => [{ role: 'user', content }];

/**
 * The four assemblies a pass shares with a caller that asks the same thing outside a turn — the idle
 * drainers, which work on a turn that has already been stored, and the standalone re-rolls. Those callers
 * have no Turn Plan to run, so they call these directly rather than fabricating one; what matters is that
 * the wording, and the conditions on it, exist once.
 */

/**
 * The choices system prompt, rendered against the scene's own entity roster. The language directive rides
 * the template's own `<LANGUAGE>` chip, so an author who moved or deleted it gets what they wrote; the
 * trailing trim is what lets that chip sit last and cost an English game nothing.
 */
export const choicesSystemTiled = (
  template: string,
  language: string,
  values: Record<string, string>,
): TiledRuns =>
  trimEndTiled(systemTiled(template, { ...values, '<LANGUAGE>': languageDirective('choices', language) }));

export const choicesSystemPrompt = (
  template: string,
  language: string,
  values: Record<string, string>,
): string => choicesSystemTiled(template, language, values).content;

/**
 * The stat system prompt. Nothing is appended for any language: the parsing contract is that each line
 * echoes a stat's exact name from the list above it, and that list carries the world's authored names
 * whatever language they are written in — so an "answer in English" rider only invited the model to
 * translate the very names the parser matches on.
 */
export const statUpdatesSystemPrompt = (template: string, ctx: Record<string, string>): string =>
  renderPromptTemplate(template, ctx);

/** The digest's user message. A bracketed authorial direction never reaches it — it records story content. */
export const summaryUserTiled = (template: string, action: string, narration: string): TiledRuns =>
  userTiled(template, { '<PLAYER ACTION>': stripOocDirectives(action), '<NARRATION>': narration });

export const summaryUserMessage = (template: string, action: string, narration: string): string =>
  summaryUserTiled(template, action, narration).content;

/** The discovery pass's user message: who to describe, and the passage they appeared in. */
export const discoverUserMessage = (name: string, narration: string): string =>
  `${DISCOVER_NAME_LABEL} ${name}\n\n${DISCOVER_PASSAGE_LABEL}\n${narration}`;

/**
 * A foreground post-narration request's label behavior. Dispatched together, the batch shows one steady
 * label instead of three racing writes; dispatched one at a time, each pass names itself.
 */
const quietInBatch = (input: TurnPlanInput): boolean => input.settings.concurrentTurnRequests;

const stageValues = (material: TurnMaterial): Record<string, string> => ({
  ...material.ctx,
  '<ACTIVE CHARACTER GUIDANCE>': material.activeCharacterGuidance,
});

const subjectOf = (material: TurnMaterial): TurnPassSubject => {
  if (!material.subject) throw new Error('this pass runs once per subject, and none was given');
  return material.subject;
};

// A silent pass never shows a label at all, so `quiet` is moot for it.
const silentOn = (material: TurnMaterial): Pick<TurnPassRequest, 'silent' | 'attachTurnId' | 'quiet'> => ({
  silent: true,
  attachTurnId: material.turnId,
  quiet: true,
});

/** Resolve the move up front, from the action alone, so the whole turn runs in the new location. */
const locationAutoPass: TurnPassRecord<string | null> = {
  id: 'locationAuto',
  type: 'locationChange',
  stage: 'preNarration',
  fanOut: false,
  // Nowhere to go means nothing to route: the reply is matched against the destination list, so with it
  // empty the call cannot produce a move however the model answers.
  isDue: (input) =>
    !isOpening(input) &&
    input.settings.locationAutoApply &&
    input.settings.locationChangeEnabled &&
    input.destinationCount > 0 &&
    input.prompts.locationChange !== '' &&
    input.hasCurrentLocation,
  // Rendered against the pre-move context: no narration exists yet, and the move it decides is what
  // scopes every later pass.
  buildRequest: (input, material) => labeledRequest(
    { type: 'locationChange', maxTokens: null, silent: false, quiet: false },
    systemTiled(input.prompts.locationChange, material.baseCtx),
    userTiled(input.prompts.locationChangeUser, { '<PLAYER ACTION>': material.action }),
  ),
  parseResponse: (raw, material) => matchLocationResponse(raw, material.destinations),
};

/** After the narration, ask whether the player should move and offer it. Suggest mode only. */
const locationSuggestPass: TurnPassRecord<string | null> = {
  id: 'locationSuggest',
  type: 'locationChange',
  stage: 'postNarration',
  fanOut: false,
  // A single-location world has nowhere to move, so don't run it even when enabled.
  isDue: (input) =>
    !isOpening(input) &&
    !input.settings.locationAutoApply &&
    input.settings.locationChangeEnabled &&
    input.locationCount > 1 &&
    input.prompts.locationChange !== '',
  buildRequest: (input, material) => labeledRequest(
    { type: 'locationChange', maxTokens: null, silent: false, quiet: quietInBatch(input) },
    systemTiled(input.prompts.locationChange, material.ctx),
    userTiled(input.prompts.locationChangeUser, {
      '<PLAYER ACTION>': material.action,
      '<NARRATION>': material.narration,
    }),
  ),
  parseResponse: (raw, material) => matchLocationResponse(raw, material.destinations),
};

/** The precall planner: one call that lays out the turn before the narration. */
const thinkingPass: TurnPassRecord<ParsedDirector> = {
  id: 'thinking',
  type: 'thinking',
  stage: 'planning',
  fanOut: false,
  isDue: (input) => input.settings.thinkingMode === 'precall',
  // Framed as a single instruction: reusing the narration's message history primes the model to continue
  // the story instead of planning it.
  buildRequest: (input, material) => {
    const pieces: AnatomyPiece[] = [];
    if (material.plannerRecap) pieces.push({ text: material.plannerRecap, contextLabel: 'condensed' }, { text: '\n\n', glue: true });
    if (material.lastStory) pieces.push({ text: `What just happened:\n${material.lastStory}`, contextLabel: 'past-narration' }, { text: '\n\n', glue: true });
    pieces.push(
      { text: `The player's next action: ${material.effectiveAction}`, contextLabel: 'action' },
      { text: '\n\n', glue: true },
      { text: 'List the cast and lay out the beats now. Do not narrate.', contextLabel: 'mode-directive' },
    );
    return labeledRequest(
      { type: 'thinking', maxTokens: TURN_PASS_CAPS.thinking, silent: false, quiet: false },
      systemTiled(input.prompts.thinking, material.ctx),
      tilePieces(pieces),
    );
  },
  parseResponse: (raw) => parseDirectorCast(raw),
};

/** Staged pass 1: who is in the scene and what carries over. */
const directorPass: TurnPassRecord<ParsedDirector> = {
  id: 'director',
  type: 'director',
  stage: 'planning',
  fanOut: false,
  isDue: (input) => input.settings.thinkingMode === 'staged',
  buildRequest: (input, material) => labeledRequest(
    { type: 'director', maxTokens: TURN_PASS_CAPS.director, silent: false, quiet: false },
    systemTiled(input.prompts.director, stageValues(material)),
    // The narration the director reads is the previous turn's, so it is named as the past rather than as
    // this turn's own — nothing has been written yet.
    userTiled(
      input.prompts.directorUser,
      { '<NARRATION>': material.lastStory || NONE_PLACEHOLDER, '<PLAYER ACTION>': material.effectiveAction },
      { '<NARRATION>': 'past-narration' },
    ),
  ),
  parseResponse: (raw) => parseDirectorCast(raw),
};

/** Staged pass 2: what one cast member wants and does this turn. One request per chosen character. */
const characterPass: TurnPassRecord<string> = {
  id: 'character',
  type: 'character',
  stage: 'planning',
  fanOut: true,
  isDue: (input) => input.settings.thinkingMode === 'staged',
  buildRequest: (input, material) => {
    const subject = subjectOf(material);
    return labeledRequest(
      { type: 'character', maxTokens: TURN_PASS_CAPS.character, silent: false, quiet: false },
      systemTiled(input.prompts.character, { ...stageValues(material), '<CHARACTER NAME>': subject.name }),
      assembledTiled(
        buildCharacterUserMessage({
          character: { name: subject.name, stance: subject.stance, entity: subject.entity },
          scene: material.directorScene,
          action: material.effectiveAction,
          diary: subject.diary,
          recap: material.lastStory,
        }),
        'character-brief',
      ),
    );
  },
  parseResponse: (raw) => raw,
};

/** Staged pass 3: reconcile the cast's independent intents into one plan for the turn. */
const storyboardPass: TurnPassRecord<string> = {
  id: 'storyboard',
  type: 'storyboard',
  stage: 'planning',
  fanOut: false,
  isDue: (input) => input.settings.thinkingMode === 'staged',
  // With nobody in the cast there is nothing to reconcile, and a storyboard would only invent filler.
  isReady: (material) => material.npcCastSize > 0,
  buildRequest: (input, material) => labeledRequest(
    { type: 'storyboard', maxTokens: TURN_PASS_CAPS.storyboard, silent: false, quiet: false },
    systemTiled(input.prompts.storyboard, stageValues(material)),
    assembledTiled(
      buildStoryboardUserMessage({
        recap: material.lastStory,
        scene: material.directorScene,
        intents: material.intents,
        overflow: material.overflow,
        action: material.effectiveAction,
      }),
      'intents',
    ),
  ),
  parseResponse: (raw) => raw,
};

/**
 * The turn's story text. Its system prompt is assembled by the caller (dictionary scan, banded history,
 * notes fallback); what the pass owns is the final user turn — the action as the model receives it, plus
 * whatever this turn's mode rides on it.
 */
export const narrationPass: TurnPassRecord<string> = {
  id: 'narration',
  type: 'narration',
  stage: 'narration',
  fanOut: false,
  isDue: () => true,
  buildRequest: (input, material) => {
    // The opening turn sends the player's (editable) cue verbatim; the legacy "START GAME" sentinel maps
    // to the cue this world opens on. Later turns send the bare action, matching the stored history shape.
    const actionText = isOpening(input)
      ? material.action === 'START GAME'
        ? input.prompts.openingCue
        : material.action
      : material.action;
    // The user template and the OOC rider apply only with thinking off — plan and inline modes append
    // their own directives, which must never sandwich against custom text.
    const ridden = hasOocDirective(actionText) && input.prompts.oocDirective.trim();
    // The message is assembled as labeled pieces, so the Request Anatomy sidecar below cannot describe a
    // message the model isn't sent: the content IS the pieces joined.
    const pieces: AnatomyPiece[] =
      input.settings.thinkingMode === 'off'
        ? [
            ...promptTemplatePieces(
              input.prompts.narrationUser,
              { '<PLAYER ACTION>': actionText },
              { source: 'user-template', tokens: { '<PLAYER ACTION>': 'action' } },
            ),
            ...(ridden
              ? [{ text: '\n\n', glue: true }, { text: input.prompts.oocDirective, source: 'direction' as const }]
              : []),
          ]
        : [{ text: actionText, contextLabel: 'action' }];
    // Both directives ride the final user turn, adjacent to where the model writes — recency is what makes
    // small models actually honor them.
    if (input.settings.thinkingMode === 'inline') pieces.push({ text: INLINE_THINKING_DIRECTIVE, contextLabel: 'mode-directive' });
    if (material.turnPlan) pieces.push({ text: planDirective(material.turnPlan), contextLabel: 'turn-plan' });
    const finalTurn = tilePieces(pieces);
    // A caller that assembled the history without a sidecar leaves those messages unlabeled rather than
    // misaligning the ones this pass does own.
    const historyRuns =
      material.historyRuns.length === material.trimmedHistory.length
        ? material.historyRuns
        : material.trimmedHistory.map(() => []);
    return {
      type: 'narration',
      systemPrompt: material.narrationSystemPrompt,
      messages: [...material.trimmedHistory, { role: 'user', content: finalTurn.content }],
      maxTokens: null,
      silent: false,
      quiet: false,
      anatomy: { system: material.narrationSystemPromptRuns, messages: [...historyRuns, finalTurn.runs] },
    };
  },
  parseResponse: (raw) => raw,
};

/** What the player could do next. Sees only who is in the scene, never the whole location roster. */
const choicesPass: TurnPassRecord<string[]> = {
  id: 'choices',
  type: 'choices',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.choicesEnabled,
  buildRequest: (input, material) => labeledRequest(
    { type: 'choices', maxTokens: null, silent: false, quiet: quietInBatch(input) },
    choicesSystemTiled(input.prompts.choices, input.settings.language, {
      ...material.ctx,
      ...material.sceneEntityTokens,
    }),
    userTiled(input.prompts.choicesUser, {
      '<PLAYER ACTION>': material.effectiveAction,
      '<NARRATION>': material.narration,
    }),
  ),
  parseResponse: (raw) => parseChoices(raw),
};

/** How the turn moved the player's stats. */
const statUpdatesPass: TurnPassRecord<ReturnType<typeof parseStatUpdates>> = {
  id: 'statUpdates',
  type: 'statUpdates',
  stage: 'postNarration',
  fanOut: false,
  // A world with no live stats would only get hallucinated stat names that match nothing.
  isDue: (input) => input.settings.statUpdatesEnabled && input.settings.statCount > 0,
  buildRequest: (input, material) => labeledRequest(
    { type: 'statUpdates', maxTokens: null, silent: false, quiet: quietInBatch(input) },
    systemTiled(input.prompts.statUpdates, material.ctx),
    userTiled(input.prompts.statUpdatesUser, {
      '<PLAYER ACTION>': material.effectiveAction,
      '<NARRATION>': material.narration,
    }),
  ),
  parseResponse: (raw) => parseStatUpdates(raw),
};

/**
 * This turn's memory digest. Only runs in the batch — dispatched one at a time, it is the idle drainer's job.
 */
const summaryPass: TurnPassRecord<string> = {
  id: 'summary',
  type: 'summary',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.memoryDigests && input.settings.concurrentTurnRequests,
  buildRequest: (input, material) => labeledRequest(
    { type: 'summary', maxTokens: TURN_PASS_CAPS.summary, ...silentOn(material) },
    systemTiled(input.prompts.summary, material.baseCtx),
    summaryUserTiled(input.prompts.summaryUser, material.effectiveAction, material.narration),
  ),
  parseResponse: (raw) => raw.trim(),
};

/** How much in-world time this turn consumed. */
const timePassedPass: TurnPassRecord<number | null> = {
  id: 'timePassed',
  type: 'timePassed',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.aiClock,
  buildRequest: (input, material) => labeledRequest(
    { type: 'timePassed', maxTokens: TURN_PASS_CAPS.timePassed, ...silentOn(material) },
    systemTiled(input.prompts.timePassed, material.ctx),
    userTiled(input.prompts.timePassedUser, {
      '<PLAYER ACTION>': stripOocDirectives(material.effectiveAction),
      '<NARRATION>': material.narration,
    }),
  ),
  parseResponse: (raw) => parseTimeDelta(raw),
};

/**
 * What time of day the story starts at. Opening turn only: it reads the scene the world was written to
 * open on, and a retroactive answer would re-date every memory stamp already written.
 */
const openingTimePass: TurnPassRecord<number | null> = {
  id: 'openingTime',
  type: 'openingTime',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.aiClock && isOpening(input),
  buildRequest: (input, material) => labeledRequest(
    { type: 'openingTime', maxTokens: TURN_PASS_CAPS.openingTime, ...silentOn(material) },
    systemTiled(input.prompts.openingTime, material.ctx),
    userTiled(input.prompts.openingTimeUser, { '<NARRATION>': material.narration }),
  ),
  parseResponse: (raw) => parseOpeningDaypart(raw),
};

/**
 * One participant's private record of the turn. Diaries are read only by the staged character pass, so
 * they are only written in that mode; like the digest, they are the drainer's job outside the batch.
 */
const diaryPass: TurnPassRecord<string> = {
  id: 'diary',
  type: 'diary',
  stage: 'postNarration',
  fanOut: true,
  isDue: (input) =>
    input.settings.characterDiaries &&
    input.settings.thinkingMode === 'staged' &&
    input.settings.concurrentTurnRequests,
  buildRequest: (input, material) => {
    const subject = subjectOf(material);
    return labeledRequest(
      { type: 'diary', maxTokens: TURN_PASS_CAPS.diary, ...silentOn(material) },
      systemTiled(input.prompts.diary, material.baseCtx),
      assembledTiled(
        buildDiaryUserMessage({ name: subject.name, entity: subject.entity, narration: material.narration }),
        'diary-brief',
      ),
    );
  },
  parseResponse: (raw) => raw.trim(),
};

/**
 * A lasting description for a participant the narration invented. The prompt is not a preset surface, so
 * it is sent as authored rather than rendered.
 */
const discoverEntityPass: TurnPassRecord<string> = {
  id: 'discoverEntity',
  type: 'discoverEntity',
  stage: 'postNarration',
  fanOut: true,
  isDue: (input) => input.settings.describeCharacters && input.settings.concurrentTurnRequests,
  buildRequest: (input, material) => {
    const subject = subjectOf(material);
    return {
      type: 'discoverEntity',
      systemPrompt: input.prompts.discoverEntity,
      messages: user(discoverUserMessage(subject.name, material.narration)),
      maxTokens: TURN_PASS_CAPS.discoverEntity,
      ...silentOn(material),
    };
  },
  parseResponse: (raw, material) => cleanDiscoveredDescription(raw, subjectOf(material).name),
};

/**
 * What is happening in a scene, for the image model to draw. Its subjects and its location bring their own
 * tags; this pass writes only the action layer over them.
 *
 * A pass record for its request assembly, not for the turn runner: a picture is drawn when the player asks
 * for one, so this one is dispatched by the scene-image flow and is deliberately absent from
 * {@link TURN_PASSES}.
 */
export const sceneTagsPass: TurnPassRecord<string> = {
  id: 'sceneTags',
  type: 'sceneTags',
  stage: 'postNarration',
  fanOut: false,
  isDue: () => true,
  buildRequest: (input, material) => labeledRequest(
    { type: 'sceneTags', maxTokens: TURN_PASS_CAPS.sceneTags, ...silentOn(material) },
    systemTiled(input.prompts.sceneTags, material.ctx),
    userTiled(
      input.prompts.sceneTagsUser,
      {
        '<NARRATION>': material.narration,
        '<IN FRAME>': material.sceneCast.length ? material.sceneCast.join(', ') : SCENE_TAGS_EMPTY_CAST,
      },
      { '<IN FRAME>': 'scene-cast' },
    ),
  ),
  parseResponse: (raw) => raw,
};

/**
 * Every pass, in dispatch order: the up-front move, the planning stages, the narration, then the passes
 * that depend on it. The runner keeps this order in both concurrency modes.
 */
export const TURN_PASSES: TurnPassRecord[] = [
  locationAutoPass,
  thinkingPass,
  directorPass,
  characterPass,
  storyboardPass,
  narrationPass,
  choicesPass,
  statUpdatesPass,
  locationSuggestPass,
  summaryPass,
  timePassedPass,
  openingTimePass,
  diaryPass,
  discoverEntityPass,
];
