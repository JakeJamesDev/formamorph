import type { ChatMessage } from '@/types';
import type { TurnPassRecord, TurnPassRequest, TurnPlanInput, TurnMaterial, TurnPassSubject } from './turnPlan';
import type { StatText, StatTextPrompts } from '@/lib/statTextPrompts';
import { renderPromptTemplateRuns, promptTemplatePieces } from '@/lib/promptTemplate';
import { layerValues, type TokenValues } from '@/lib/promptValues';
import {
  tilePieces, trimEndTiled, trimTiled, collapseBlankLines,
  type AnatomyPiece, type ContextLabel, type TiledRuns,
} from '@/lib/requestAnatomy';
import { NONE_PLACEHOLDER } from '@/lib/promptFallbacks';
import { estimateTokens } from '@/lib/memoryUtils';
import {
  buildCharacterUserMessage,
  buildDiaryUserMessage,
  buildStoryboardUserMessage,
  parseDirectorCast,
  type ParsedDirector,
} from '@/lib/stagedPlanning';
import { languageDirective } from '@/lib/languages';
import { stripLinksAndImages } from '@/lib/stripLinksAndImages';
import { matchLocationResponse, matchNarratedMoveResponse, matchRouterResponse } from '@/lib/locationMatch';
import {
  entityMoveCandidates, entityMoveOptions, entityMoveOptionsText, entityMoveStateText, entityMoveTimeLine, type EntityMove,
  type EntityReply,
} from '@/lib/entityFollowing';
import type { ResponseSchema } from '@/lib/aiRequest/responseSchema';
import { parseJsonReply } from '@/lib/aiRequest/jsonReply';
import { parseChoices } from '@/lib/choices';
import { parseStatUpdates } from '@/lib/statChanges';
import { INVENTORY_JSON_FORMAT, INVENTORY_TEXT_FORMAT, inventoryPassSchema, parseInventoryReply } from '@/lib/inventory/pass';
import { backingStatIds } from '@/lib/currency';
import { toldLines, type ToldAction } from '@/lib/actionList';
import type { Currency, InventoryPassOp } from '@/types';
import { statRequestSchema, textPassTargets, type StatRequestSnapshot } from '@/lib/statRequest';
import {
  CLOCK_SCHEMA_FORMAT, CLOCK_TEXT_FORMAT, clockReadingSchema, parseClockReply, parseOpeningDaypart, type ClockReading,
} from '@/lib/gameClock';
import { cleanDiscoveredDescription, DISCOVER_LATER_LABEL, DISCOVER_PASSAGE_LABEL } from '@/lib/runtimeCharacters';
import {
  milestoneMomentValues, milestoneReplyFormat, parseIncrementalMilestoneReply, type IncrementalVerdict,
} from '@/lib/milestoneMemory';
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
 * Output caps per pass. The narration takes the request type's own default (null); the stat and location
 * passes size theirs from the world (below). The rest are sized for the verbose small tier (Rocinante 12B)
 * so a cast list or an intent completes rather than truncating mid-word.
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
  /** The clock pass's three-field JSON reply, with room for spacing. */
  timePassedSchema: 60,
  /** One daypart word. */
  openingTime: 8,
  /** A diary entry is one or two first-person sentences. */
  diary: 80,
  /** ~2 short paragraphs, trimmed to the last full sentence — headroom against a mid-word cut. */
  discoverEntity: 200,
  /** One line of tags: enough for a rich action line, not for prose. */
  sceneTags: 120,
  /** A handful of short options; room for the last one on a verbose model. */
  choices: 256,
  /** Three short number lines. */
  milestoneSelect: 300,
  /** A handful of item operations: a busy turn moves five or six. */
  inventory: 320,
} as const;

/** One stat line (a name, a sign and a number) per live stat, plus slack for a stray word. */
export const statUpdatesCap = (statCount: number): number => 16 * statCount + 16;

/** A `"Name":n,"Name max":n` pair per stat, each owner's key and braces, and the outer braces. */
export const statSchemaCap = (statCount: number, ownerCount = 1): number => 32 * statCount + 16 * ownerCount + 16;

/** The longest destination name the reply may echo, plus slack for quoting or a NONE. */
export const locationChangeCap = (destinations: readonly string[]): number =>
  estimateTokens(Math.max(0, ...destinations.map((name) => name.length))) + 8;

/** What `<IN FRAME>` renders to when the turn put nobody in the picture. */
export const SCENE_TAGS_EMPTY_CAST = 'nobody - an empty scene';

/**
 * The Request Anatomy sidecar (see lib/requestAnatomy). Every pass below assembles its request from
 * labeled pieces rather than describing it afterward, so the content IS the pieces joined and the runs
 * cannot drift from the text they index.
 */

/** A system prompt and the runs over it: what the author typed, against the values its chips inject. */
const systemTiled = (template: string, values: TokenValues): TiledRuns =>
  renderPromptTemplateRuns(template, values, { source: 'system-template' });

/** A user-message template and the runs over it. A few of the chips a user message carries hold what an
 *  earlier prompt wrote — the action, the narration, who is in frame — so those name what wrote them. */
const userTiled = (
  template: string,
  values: TokenValues,
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
  base: Omit<TurnPassRequest<ChatMessage>, 'systemPrompt' | 'messages' | 'anatomy'>,
  system: TiledRuns,
  message: TiledRuns,
): TurnPassRequest<ChatMessage> => ({
  ...base,
  systemPrompt: system.content,
  messages: [{ role: 'user', content: message.content }],
  anatomy: { system: system.runs, messages: [message.runs] },
});

const isOpening = (input: TurnPlanInput): boolean => !input.isGameStarted;

/** The opening turn's action as history and every prompt but the narration's hold it. */
export const OPENING_STAND_IN = 'START GAME';

/** The action every consumer but the narration sees: the opening turn's cue is a narrator directive that
 *  derails the other prompts, so they get the terse proxy instead. */
export const effectiveActionFor = (input: TurnPlanInput): string =>
  isOpening(input) ? OPENING_STAND_IN : input.action;

/** What a script's `turn.action` reads: the action the narration gets, trimmed. A written page one reads empty. */
export const scriptActionFor = (input: TurnPlanInput): string => {
  if (!isOpening(input)) return input.action.trim();
  if (input.writtenNarration?.trim()) return '';
  return (input.action === OPENING_STAND_IN ? input.prompts.openingCue : input.action).trim();
};

/**
 * The four assemblies a pass shares with a caller that asks the same thing outside a turn — the
 * Background Pass Queue, which works on a turn that has already been stored, and the standalone
 * re-rolls. Those callers have no Turn Plan to run, so they call these directly rather than
 * fabricating one; what matters is that the wording, and the conditions on it, exist once.
 */

/**
 * The choices system prompt, rendered against the scene's own entity roster. The language directive rides
 * the template's own `<LANGUAGE>` chip, so an author who moved or deleted it gets what they wrote; the
 * trailing trim is what lets that chip sit last and cost an English game nothing.
 */
export const choicesSystemTiled = (
  template: string,
  language: string,
  values: TokenValues,
): TiledRuns =>
  trimEndTiled(systemTiled(template, layerValues(values, { '<LANGUAGE>': languageDirective('choices', language) })));

export const choicesSystemPrompt = (
  template: string,
  language: string,
  values: TokenValues,
): string => choicesSystemTiled(template, language, values).content;

/** The digest's user message. A bracketed authorial direction never reaches it — it records story content. */
export const summaryUserTiled = (template: string, action: string, narration: string): TiledRuns =>
  userTiled(template, { '<PLAYER ACTION>': stripOocDirectives(action), '<NARRATION>': narration });

/** A headed block chip's value: its header over the text, or nothing at all. */
const headedBlock = (header: string, text: string): string => (text.trim() ? `${header}\n${text}` : '');

/**
 * The character note's user message. Blank lines left by an empty block collapse, and both ends are
 * trimmed, so a rewrite with nothing later sends exactly what a first note sends.
 */
const discoverUserTiled = (template: string, subject: TurnPassSubject, firstPassage: string): TiledRuns =>
  trimTiled(tilePieces(collapseBlankLines(promptTemplatePieces(
    template,
    {
      '<CHARACTER NAME>': subject.name.trim(),
      '<FIRST PASSAGE>': headedBlock(DISCOVER_PASSAGE_LABEL, firstPassage),
      '<LATER MATERIAL>': headedBlock(DISCOVER_LATER_LABEL, (subject.laterMaterial ?? []).join('\n\n')),
    },
    { source: 'user-template', tokens: { '<FIRST PASSAGE>': 'narration' } },
  ))));

/**
 * A foreground post-narration request's label behavior. Dispatched together, the batch shows one steady
 * label instead of three racing writes; dispatched one at a time, each pass names itself.
 */
const quietInBatch = (input: TurnPlanInput): boolean => input.settings.concurrentTurnRequests;

/** Past narration text as the Strip Links And Images setting sends it. */
const strippedText = (text: string, input: TurnPlanInput): string =>
  input.settings.stripLinksAndImages ? stripLinksAndImages(text) : text;

const strippedEntries = (entries: string[], input: TurnPlanInput): string[] =>
  entries.map((entry) => strippedText(entry, input));

const stageValues = (material: TurnMaterial): TokenValues =>
  layerValues(material.ctx, { '<ACTIVE CHARACTER GUIDANCE>': material.activeCharacterGuidance });

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
    { type: 'locationChange', maxTokens: locationChangeCap(material.destinations), silent: false, quiet: false },
    systemTiled(input.prompts.locationChange, material.baseCtx),
    userTiled(input.prompts.locationChangeUser, { '<PLAYER ACTION>': material.action }),
  ),
  parseResponse: (raw, material) => matchRouterResponse(raw, material.destinations, material.farDestinations ?? [], material.here),
  fold: (parsed) => (parsed === null ? {} : { moved: true }),
};

/** The narrated-move request: where the narration left the player, among the places they can go. The opening
 *  has no action of the player's. */
const narratedMoveRequest = (input: TurnPlanInput, material: TurnMaterial, quiet: boolean) => labeledRequest(
  { type: 'narratedMove', maxTokens: locationChangeCap(material.destinations), silent: false, quiet },
  systemTiled(input.prompts.narratedMove, material.ctx),
  userTiled(input.prompts.narratedMoveUser, {
    '<PLAYER ACTION>': isOpening(input) ? '' : material.action,
    '<NARRATION>': material.narration,
  }),
);

/** After the narration, follow a move the story made. Auto mode only, and only when nothing moved the player
 *  before the narration. */
const narratedMovePass: TurnPassRecord<string | null> = {
  id: 'narratedMove',
  type: 'narratedMove',
  stage: 'narratedMove',
  fanOut: false,
  companion: true,
  isDue: (input) =>
    input.settings.locationAutoApply &&
    input.settings.locationChangeEnabled &&
    input.destinationCount > 0 &&
    input.prompts.narratedMove !== '' &&
    input.hasCurrentLocation,
  isReady: (material) => !material.moved,
  buildRequest: (input, material) => narratedMoveRequest(input, material, false),
  parseResponse: (raw, material) => matchNarratedMoveResponse(raw, material.destinations, material.here),
};

/** After the narration, ask whether the story moved the player and offer it. Suggest mode only. */
const locationSuggestPass: TurnPassRecord<string | null> = {
  id: 'locationSuggest',
  type: 'narratedMove',
  stage: 'postNarration',
  fanOut: false,
  // A single-location world has nowhere to move, so don't run it even when enabled.
  isDue: (input) =>
    !isOpening(input) &&
    !input.settings.locationAutoApply &&
    input.settings.locationChangeEnabled &&
    input.locationCount > 1 &&
    input.prompts.narratedMove !== '',
  buildRequest: (input, material) => narratedMoveRequest(input, material, quietInBatch(input)),
  parseResponse: (raw, material) => matchNarratedMoveResponse(raw, material.destinations, material.here),
};

/** The tokens each subject's key and quotes add to its line in the schema reply. */
const JSON_REPLY_SLACK = 6;

/** `user` with a reply format appended as its own run. */
const withReplyFormat = (user: TiledRuns, format: string): TiledRuns => ({
  content: user.content + format,
  runs: [...user.runs, { start: user.content.length, end: user.content.length + format.length, contextLabel: 'reply-format' }],
});

/** What `<CHARACTER NAME>` renders in a saved entity location template that still holds it (Q117): the request
 *  covers every subject at once. */
const SAVED_TEMPLATE_CHARACTER_NAME = 'each character listed';

const movesOf = (subject: TurnPassSubject) => subject.moves ?? entityMoveOptions(false);

/** The story minute the subject's request reads. Its time line and wait ends need one. */
const clockOf = (subject: TurnPassSubject): number => {
  if (subject.moveClock === undefined) throw new Error('an entity location request needs the story clock');
  return subject.moveClock;
};

/** Each line a subject is offered, with the move it stands for. */
const subjectCandidates = (subject: TurnPassSubject): [string, EntityMove][] =>
  entityMoveCandidates(movesOf(subject), subject.destinations ?? [], clockOf(subject));

/** Each subject's name in the request, in order. A later namesake is numbered from (2), so each reply maps back. */
export const entityReplyKeys = (subjects: readonly TurnPassSubject[]): string[] => {
  const seen = new Map<string, number>();
  return subjects.map(({ name }) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
};

/** The entity location request's schema: one field per subject, each from that subject's closed list. */
export const entityMovesSchema = (subjects: readonly TurnPassSubject[]): ResponseSchema => {
  const keys = entityReplyKeys(subjects);
  return {
    name: 'entity_moves',
    schema: {
      type: 'object', additionalProperties: false, required: keys,
      properties: Object.fromEntries(subjects.map((subject, i) => [
        keys[i], { type: 'string' as const, enum: subjectCandidates(subject).map(([label]) => label) },
      ])),
    },
  };
};

/** The reply format after the user message: the time, the ask, then each subject's state and closed list. The
 *  parser depends on it, so it sits out of the author's reach. */
const entityMovesFormat = (subjects: readonly TurnPassSubject[], json: boolean): string => {
  const keys = entityReplyKeys(subjects);
  const blocks = subjects.map((subject, i) => {
    const moves = movesOf(subject);
    const list = entityMoveOptionsText(moves, subject.destinations ?? [], clockOf(subject));
    return `## ${keys[i]}\n${entityMoveStateText(keys[i], moves.includes('keepFollowing'))}\nLines for ${keys[i]}:\n${list}`;
  });
  const ask = json
    ? 'Decide for each character alone. Reply for each character with the one line from their own list that fits.'
    : 'Decide for each character alone. Reply with one row per character: the name, a colon, and one line from their own list. Write nothing else.';
  return `\n\n${entityMoveTimeLine(clockOf(subjects[0]))}\n${ask}\n\n${blocks.join('\n\n')}`;
};

/**
 * The turn's one entity location request: the system prompt over `values`, the user message over the action
 * and the narration, then the reply format covering every subject. The schema request carries the text request
 * as its fallback; an endpoint that refused the schema before gets the text request alone.
 */
const entityLocationRequest = (
  input: TurnPlanInput, subjects: readonly TurnPassSubject[], material: TurnMaterial, values: TokenValues, narration: string,
): TurnPassRequest<ChatMessage> => {
  const keys = entityReplyKeys(subjects);
  const system = systemTiled(input.prompts.entityLocation, layerValues(values, { '<CHARACTER NAME>': SAVED_TEMPLATE_CHARACTER_NAME }));
  const user = trimEndTiled(userTiled(
    input.prompts.entityLocationUser,
    {
      '<CHARACTER NAME>': SAVED_TEMPLATE_CHARACTER_NAME,
      '<PLAYER ACTION>': material.action,
      '<NARRATION>': narration,
      // Each subject's state and list ride in the reply format (Q117); a saved template that still holds these
      // chips sends nothing there.
      '<MOVE STATE>': '',
      '<MOVE OPTIONS>': '',
    },
  ));
  const withFormat = (format: string) => withReplyFormat(user, format);
  // One row per subject: its key, a colon, and its longest line.
  const cap = subjects.reduce(
    (sum, subject, i) => sum + estimateTokens(keys[i].length + 2) + locationChangeCap(subjectCandidates(subject).map(([label]) => label)), 0,
  );
  const shared = { type: 'entityLocation' as const, silent: false, quiet: true };
  const textRequest = labeledRequest({ ...shared, maxTokens: cap }, system, withFormat(entityMovesFormat(subjects, false)));
  if (input.settings.entityLocationTextPass) return textRequest;
  const { systemPrompt, messages, maxTokens, anatomy } = textRequest;
  return {
    ...labeledRequest(
      { ...shared, maxTokens: cap + JSON_REPLY_SLACK * subjects.length }, system, withFormat(entityMovesFormat(subjects, true)),
    ),
    responseSchema: entityMovesSchema(subjects),
    textFallback: { systemPrompt, messages, maxTokens, anatomy },
  };
};

/** A schema reply's fields that hold a line, by key. Null when the reply is not a JSON object. */
const jsonReplies = (raw: string): Map<string, string> | null => {
  const parsed = parseJsonReply(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  return new Map(Object.entries(parsed).flatMap(([key, line]): [string, string][] => (typeof line === 'string' ? [[key, line]] : [])));
};

/** A text reply's rows, by the key each starts with. The first row for a key wins; a row naming no key is dropped. */
const textReplies = (raw: string, keys: readonly string[]): Map<string, string> => {
  const said = new Map<string, string>();
  for (const row of raw.split('\n')) {
    const text = row.replace(/\*\*/g, '').replace(/^[\s>*•-]+/, '').trim();
    const colon = text.indexOf(':');
    if (colon < 0) continue;
    const head = text.slice(0, colon).trim().toLowerCase();
    const key = keys.find((k) => k.toLowerCase() === head);
    if (key && !said.has(key)) said.set(key, text.slice(colon + 1).trim());
  }
  return said;
};

/** Each subject's matched move, in subject order, null where the reply has nothing usable for it. A key the
 *  request did not ask about is ignored, and a place a subject was not offered, and so not allowed, matches
 *  nothing. */
export const parseEntityMoves = (raw: string, subjects: readonly TurnPassSubject[]): EntityReply[] => {
  const keys = entityReplyKeys(subjects);
  const said = jsonReplies(raw) ?? textReplies(raw, keys);
  return subjects.flatMap((subject, i) => {
    if (!subject.entity) return [];
    const line = said.get(keys[i]);
    const candidates = subjectCandidates(subject);
    const matched = line === undefined ? null : matchLocationResponse(line, candidates.map(([label]) => label));
    return [{ entity: subject.entity, move: candidates.find(([label]) => label === matched)?.[1] ?? null }];
  });
};

/**
 * One entity location pass: every tracked entity in the scene, asked in one request beside the router that
 * `router` names. `scope` reads the context and the narration its stage sees.
 */
const entityLocationPass = (
  id: 'entityLocationAuto' | 'entityLocationSuggest',
  stage: TurnPassRecord['stage'],
  router: TurnPassRecord<string | null>,
  scope: (material: TurnMaterial) => { values: TokenValues; narration: string },
): TurnPassRecord<EntityReply[]> => {
  const subjects = (material: TurnMaterial): TurnPassSubject[] => material.subjects?.[id] ?? [];
  return {
    id,
    type: 'entityLocation',
    stage,
    fanOut: false,
    companion: true,
    isDue: (input) => router.isDue(input) && input.settings.entityMovement && input.prompts.entityLocation !== '',
    isReady: (material) => subjects(material).length > 0,
    buildRequest: (input, material) => {
      const { values, narration } = scope(material);
      return entityLocationRequest(input, subjects(material), material, values, narration);
    },
    parseResponse: (raw, material) => parseEntityMoves(raw, subjects(material)),
  };
};

/** Before the narration, from the action alone. */
const entityLocationAutoPass = entityLocationPass(
  'entityLocationAuto', 'preNarration', locationAutoPass, (material) => ({ values: material.baseCtx, narration: '' }),
);

/** After the narration, in suggest mode only. */
const entityLocationSuggestPass = entityLocationPass(
  'entityLocationSuggest', 'postNarration', locationSuggestPass, (material) => ({ values: material.ctx, narration: material.narration }),
);

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
      systemTiled(input.prompts.character, layerValues(stageValues(material), { '<CHARACTER NAME>': subject.name })),
      assembledTiled(
        buildCharacterUserMessage({
          character: { name: subject.name, stance: subject.stance, entity: subject.entity },
          stats: subject.stats,
          scene: material.directorScene,
          action: material.effectiveAction,
          diary: subject.diary && strippedEntries(subject.diary, input),
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

/** The told panel actions under the preset's wrapper line (Q19). A blank wrapper sends the lines alone. */
function toldPieces(wrapper: string, told: readonly ToldAction[] | undefined): AnatomyPiece[] {
  if (!told?.length) return [];
  return [
    { text: '\n\n', glue: true },
    ...(wrapper.trim() ? [{ text: wrapper, source: 'action-list' as const }, { text: '\n', glue: true }] : []),
    { text: toldLines(told), contextLabel: 'listed-actions' },
  ];
}

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
      ? material.action === OPENING_STAND_IN
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
            ...toldPieces(input.prompts.actionList, input.toldActions),
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
export const choicesPass: TurnPassRecord<string[]> = {
  id: 'choices',
  type: 'choices',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.choicesEnabled,
  buildRequest: (input, material) => labeledRequest(
    { type: 'choices', maxTokens: TURN_PASS_CAPS.choices, silent: false, quiet: quietInBatch(input) },
    choicesSystemTiled(input.prompts.choices, input.settings.language, layerValues(material.ctx, material.sceneEntityTokens)),
    userTiled(input.prompts.choicesUser, {
      '<PLAYER ACTION>': material.effectiveAction,
      '<NARRATION>': material.narration,
    }),
  ),
  parseResponse: (raw) => parseChoices(raw),
};

/** The stat pass's prompts: the schema request's, and the text pass's where a built-in preset supplies them. */
export interface StatPrompts {
  system: string;
  user: string;
  text: StatText;
}

/** The stat request's item line (Q53): the items whose effects the game applies, so the tracker leaves them out. */
export const statItemEffectsLine = (names: readonly string[]): string =>
  `

The game applies what these items do to stats when they are equipped, used or consumed: ${names.join(', ')}. The readings already hold those changes; record the other changes this turn made.`;

/** A system prompt with the item line after it, when there are items to name. */
const withItemLine = (system: TiledRuns, names: readonly string[] | undefined): TiledRuns => {
  if (!names?.length) return system;
  const line = statItemEffectsLine(names);
  const end = system.content.length;
  return { content: system.content + line, runs: [...system.runs, { start: end, end: end + line.length, contextLabel: 'mode-directive' }] };
};

/** The text pass's prompts. A side with no built-in text wording is sent as written. */
const resolveStatText = ({ system, user, text }: StatPrompts): StatTextPrompts => ({
  system: text.system ?? system,
  user: text.user ?? user,
});

/**
 * The stat request: the schema request over every owner, carrying the player's text pass as its fallback. A
 * snapshot marked for the text pass, or none at all, sends the text pass alone. Nothing is appended for any
 * language: the reply echoes the stats' authored names, which a translation rider would only invite the model
 * to translate.
 */
export function statUpdatesRequest(
  prompts: StatPrompts,
  values: { ctx: TokenValues; action: string; narration: string },
  base: { statCount: number; statRequest?: StatRequestSnapshot; quiet: boolean; itemNames?: readonly string[] },
): TurnPassRequest<ChatMessage> {
  const { statRequest } = base;
  const user = { '<PLAYER ACTION>': values.action, '<NARRATION>': values.narration };
  const shared = { type: 'statUpdates' as const, silent: false, quiet: base.quiet, statRequest };
  const text = resolveStatText(prompts);
  const textStats = statRequest ? textPassTargets(statRequest).length : base.statCount;
  const textRequest = labeledRequest(
    { ...shared, maxTokens: statUpdatesCap(textStats) },
    withItemLine(systemTiled(text.system, layerValues(values.ctx, statRequest?.context)), base.itemNames),
    userTiled(text.user, user),
  );
  if (!statRequest || statRequest.textPass) return textRequest;
  const { systemPrompt, messages, maxTokens, anatomy } = textRequest;
  return {
    ...labeledRequest(
      { ...shared, maxTokens: statSchemaCap(statRequest.targets.length, new Set(statRequest.targets.map((t) => t.ownerKey)).size) },
      withItemLine(systemTiled(prompts.system, layerValues(values.ctx, statRequest.context)), base.itemNames),
      userTiled(prompts.user, user),
    ),
    responseSchema: statRequestSchema(statRequest),
    // With no stat of the player's, the text pass has nothing to ask.
    ...(textStats > 0 && { textFallback: { systemPrompt, messages, maxTokens, anatomy } }),
  };
}

/** Whether a stat request has a stat to ask about on the path it takes. No snapshot sends the text pass. */
export const statRequestReady = (snapshot: StatRequestSnapshot | undefined): boolean =>
  !snapshot || (snapshot.textPass ? textPassTargets(snapshot) : snapshot.targets).length > 0;

/** How the turn moved every present owner's stats. */
export const statUpdatesPass: TurnPassRecord<ReturnType<typeof parseStatUpdates>> = {
  id: 'statUpdates',
  type: 'statUpdates',
  stage: 'postNarration',
  fanOut: false,
  // A world with no live stats would only get hallucinated stat names that match nothing.
  isDue: (input) => input.settings.statUpdatesEnabled && input.settings.statCount > 0,
  // Entities join once the narration names who is present, and the text pass skips them.
  isReady: (material) => statRequestReady(material.statRequest),
  buildRequest: (input, material) => statUpdatesRequest(
    { system: input.prompts.statUpdates, user: input.prompts.statUpdatesUser, text: input.prompts.statText },
    { ctx: material.statCtx ?? material.ctx, action: material.effectiveAction, narration: material.narration },
    {
      statCount: input.settings.statCount, statRequest: material.statRequest, quiet: quietInBatch(input),
      ...(input.settings.inventoryDue && { itemNames: material.statItemNames }),
    },
  ),
  parseResponse: (raw) => parseStatUpdates(raw),
};

/**
 * The Inventory pass's request: the schema request, carrying the text request as its fallback. An endpoint that
 * refused the schema before gets the text request alone. The text reply's format rides after the user message,
 * out of the author's reach, because the parser depends on it.
 */
export function inventoryRequest(
  prompts: { system: string; user: string },
  values: { ctx: TokenValues; action: string; narration: string },
  base: { textPass: boolean; quiet: boolean },
): TurnPassRequest<ChatMessage> {
  const system = systemTiled(prompts.system, values.ctx);
  const user = userTiled(prompts.user, { '<PLAYER ACTION>': values.action, '<NARRATION>': values.narration });
  const withFormat = (format: string) => withReplyFormat(user, format);
  const shared = { type: 'inventory' as const, maxTokens: TURN_PASS_CAPS.inventory, silent: false, quiet: base.quiet };
  const textRequest = labeledRequest(shared, system, withFormat(INVENTORY_TEXT_FORMAT));
  if (base.textPass) return textRequest;
  const { systemPrompt, messages, maxTokens, anatomy } = textRequest;
  return {
    ...labeledRequest(shared, system, withFormat(INVENTORY_JSON_FORMAT)),
    responseSchema: inventoryPassSchema(),
    textFallback: { systemPrompt, messages, maxTokens, anatomy },
  };
}

/** How the story changed who has which item and money (R1, Q23). Due only in a world with items or money that settles (Q37, Q55). */
export const inventoryPass: TurnPassRecord<InventoryPassOp[]> = {
  id: 'inventory',
  type: 'inventory',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.inventoryDue && input.prompts.inventory !== '',
  buildRequest: (input, material) => inventoryRequest(
    { system: input.prompts.inventory, user: input.prompts.inventoryUser },
    { ctx: material.ctx, action: material.effectiveAction, narration: material.narration },
    { textPass: input.settings.inventoryTextPass, quiet: quietInBatch(input) },
  ),
  parseResponse: (raw) => parseInventoryReply(raw),
};

/** The stats the stat pass can't write this turn: what backs a Currency, while the Inventory pass settles money (Q9, Q27). */
export const statPassOmits = (input: TurnPlanInput, currencies: readonly Currency[]): ReadonlySet<string> =>
  (inventoryPass.isDue(input) ? backingStatIds(currencies) : new Set<string>());

/**
 * This turn's memory digest. Due in the batch only; the Background Pass Queue writes any digest a turn
 * leaves behind.
 */
export const summaryPass: TurnPassRecord<string> = {
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

/** How much in-world time this turn consumed, as a reading the turn commit resolves against the clock. */
const timePassedPass: TurnPassRecord<ClockReading | null> = {
  id: 'timePassed',
  type: 'timePassed',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.aiClock,
  // An endpoint that refused the schema before gets the text request alone.
  buildRequest: (input, material) => {
    const system = systemTiled(input.prompts.timePassed, material.ctx);
    const user = userTiled(input.prompts.timePassedUser, {
      '<PLAYER ACTION>': stripOocDirectives(material.effectiveAction),
      '<NARRATION>': material.narration,
    });
    const withFormat = (format: string) => withReplyFormat(user, format);
    const shared = { type: 'timePassed' as const, ...silentOn(material) };
    const textRequest = labeledRequest({ ...shared, maxTokens: TURN_PASS_CAPS.timePassed }, system, withFormat(CLOCK_TEXT_FORMAT));
    if (input.settings.clockTextPass) return textRequest;
    const { systemPrompt, messages, maxTokens, anatomy } = textRequest;
    return {
      ...labeledRequest({ ...shared, maxTokens: TURN_PASS_CAPS.timePassedSchema }, system, withFormat(CLOCK_SCHEMA_FORMAT)),
      responseSchema: clockReadingSchema(),
      textFallback: { systemPrompt, messages, maxTokens, anatomy },
    };
  },
  parseResponse: (raw) => parseClockReply(raw),
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
 * they are only written in that mode; like the digest, they are the queue's job outside the batch.
 */
export const diaryPass: TurnPassRecord<string> = {
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
 * A lasting description for a participant the narration invented. The Background Pass Queue and the player's
 * rewrite build theirs here too; a rewrite adds the subject's later material.
 */
export const discoverEntityPass: TurnPassRecord<string> = {
  id: 'discoverEntity',
  type: 'discoverEntity',
  stage: 'postNarration',
  fanOut: true,
  isDue: (input) => input.settings.describeCharacters && input.settings.concurrentTurnRequests,
  buildRequest: (input, material) => {
    const subject = subjectOf(material);
    return labeledRequest(
      { type: 'discoverEntity', maxTokens: TURN_PASS_CAPS.discoverEntity, ...silentOn(material) },
      systemTiled(input.prompts.discoverEntity, material.ctx),
      discoverUserTiled(
        input.prompts.discoverEntityUser,
        { ...subject, laterMaterial: subject.laterMaterial && strippedEntries(subject.laterMaterial, input) },
        strippedText(material.narration, input),
      ),
    );
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

const milestoneOf = (material: TurnMaterial): { kept: string[]; fresh: string[] } => {
  if (!material.milestone) throw new Error('the milestone selector needs its kept and fresh lists');
  return material.milestone;
};

/**
 * Which older digests stay in long-term memory. The reply format rides after the template, out of the
 * author's reach, because the parser depends on it.
 *
 * A pass record for its request assembly, not for the turn runner: the view runs the selector between
 * turns, so it is absent from {@link TURN_PASSES}.
 */
export const milestoneSelectPass: TurnPassRecord<IncrementalVerdict | null> = {
  id: 'milestoneSelect',
  type: 'milestoneSelect',
  stage: 'postNarration',
  fanOut: false,
  isDue: (input) => input.settings.memoryDigests,
  buildRequest: (input, material) => {
    const { kept, fresh } = milestoneOf(material);
    // An empty kept list leaves blank lines behind; they collapse, as the character note's do.
    const template = trimTiled(tilePieces(collapseBlankLines(promptTemplatePieces(
      input.prompts.milestoneSelectUser,
      milestoneMomentValues(strippedEntries(kept, input), strippedEntries(fresh, input)),
      { source: 'user-template', tokens: { '<REMEMBERED MOMENTS>': 'condensed', '<NEW MOMENTS>': 'condensed' } },
    ))));
    const format = milestoneReplyFormat(kept.length > 0);
    const end = template.content.length;
    return labeledRequest(
      { type: 'milestoneSelect', maxTokens: TURN_PASS_CAPS.milestoneSelect, ...silentOn(material) },
      systemTiled(input.prompts.milestoneSelect, material.baseCtx),
      {
        content: template.content + format,
        runs: [...template.runs, { start: end, end: end + format.length, contextLabel: 'reply-format' }],
      },
    );
  },
  parseResponse: (raw, material) => {
    const { kept, fresh } = milestoneOf(material);
    return parseIncrementalMilestoneReply(raw, kept.length, fresh.length);
  },
};

/**
 * Every pass, in dispatch order: the up-front move, the planning stages, the narration, then the passes
 * that depend on it. The runner keeps this order in both concurrency modes.
 */
export const TURN_PASSES: TurnPassRecord[] = [
  locationAutoPass,
  entityLocationAutoPass,
  thinkingPass,
  directorPass,
  characterPass,
  storyboardPass,
  narrationPass,
  narratedMovePass,
  choicesPass,
  statUpdatesPass,
  inventoryPass,
  locationSuggestPass,
  entityLocationSuggestPass,
  summaryPass,
  timePassedPass,
  openingTimePass,
  diaryPass,
  discoverEntityPass,
];
