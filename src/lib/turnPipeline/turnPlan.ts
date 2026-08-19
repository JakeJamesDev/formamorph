import type { AIRequestType, ChatMessage, Entity } from '@/types';
import type { ThinkingMode } from '@/contexts/SettingsContext';

/**
 * The Turn Plan: what one turn will ask the model, decided before any request is sent.
 *
 * A turn is a fixed set of **passes** — the narration and everything staged around it. Each pass is a
 * data record (id, due-check, request builder, response parser) rather than a branch of control flow, so
 * "which passes run this turn" is answerable by calling {@link planTurn} and reading the result. A record
 * carries no turn state, so any scheduler can drive the same definitions.
 */

/** Every pass one turn can dispatch. */
export type TurnPassId =
  | 'locationAuto'
  | 'thinking'
  | 'director'
  | 'character'
  | 'storyboard'
  | 'narration'
  | 'choices'
  | 'statUpdates'
  | 'locationSuggest'
  | 'summary'
  | 'timePassed'
  | 'openingTime'
  | 'diary'
  | 'discoverEntity';

/** Where a pass sits relative to the narration. Passes run in stage order, then in plan order. */
export type TurnStage = 'preNarration' | 'planning' | 'narration' | 'postNarration';

/** The concurrency knob: whether the post-narration passes are dispatched together or one at a time. */
export type TurnConcurrency = 'serial' | 'parallel';

/** The settings-derived booleans a turn's shape depends on. */
export interface TurnSettings {
  thinkingMode: ThinkingMode;
  /** The Concurrent Turn Requests setting — becomes {@link TurnPlan.concurrency}. */
  concurrentTurnRequests: boolean;
  choicesEnabled: boolean;
  statUpdatesEnabled: boolean;
  /** Live stats in this world; with none, the stat pass would only invent names that match nothing. */
  statCount: number;
  locationChangeEnabled: boolean;
  locationAutoApply: boolean;
  aiClock: boolean;
  memoryDigests: boolean;
  characterDiaries: boolean;
  /** The Describe New Characters setting, which governs the discovery pass. */
  describeCharacters: boolean;
  /** Narration language or style; anything but English appends a language directive to some prompts. */
  language: string;
}

/** The prompt texts a turn renders — the active preset's, already placeholder-resolved. */
export interface TurnPrompts {
  locationChange: string;
  locationChangeUser: string;
  thinking: string;
  director: string;
  directorUser: string;
  character: string;
  storyboard: string;
  narrationUser: string;
  oocDirective: string;
  /** The cue the opening turn's legacy "START GAME" sentinel resolves to — the world's own when it has one
   *  (see lib/openingCue), the shipped default otherwise. */
  openingCue: string;
  choices: string;
  choicesUser: string;
  statUpdates: string;
  statUpdatesUser: string;
  summary: string;
  summaryUser: string;
  timePassed: string;
  timePassedUser: string;
  openingTime: string;
  openingTimeUser: string;
  diary: string;
  discoverEntity: string;
}

/** Everything the planner decides from. Plain values only — no React, no clock, no globals. */
export interface TurnPlanInput {
  /** The player's action, verbatim. On the opening turn this is the (editable) opening cue. */
  action: string;
  /** False on the opening turn, which is simply any action taken before the game has started. */
  isGameStarted: boolean;
  /** Places navigable from the current location. With none, the router's reply cannot produce a move. */
  destinationCount: number;
  /** Locations in the world; one place means there is nowhere to suggest moving to. */
  locationCount: number;
  hasCurrentLocation: boolean;
  settings: TurnSettings;
  prompts: TurnPrompts;
}

/** One being a fan-out pass is about: a cast member, a diarist, or a newly narrated name. */
export interface TurnPassSubject {
  name: string;
  /** Where the director placed them this turn. */
  stance?: string;
  /** The defined entity this name resolves to; absent for an ad-hoc, planner-invented name. */
  entity?: Entity;
  /** The character's own diary entries, oldest first, as the motivation pass is fed them. */
  diary?: string[];
}

/**
 * What a turn produces as it runs, read by the request builders. Fields are filled in stage order: a
 * post-narration pass sees the narration, a planning pass does not.
 */
export interface TurnMaterial {
  /** The player's action verbatim — what the location router and the narration are fed. */
  action: string;
  /** The action every other consumer sees ("START GAME" on the opening turn). */
  effectiveAction: string;
  turnId: string;
  /** Context values scoped to this turn's location (after any auto-resolved move). */
  ctx: Record<string, string>;
  /** Context values scoped to the location the turn began in — what the digest and diary passes see. */
  baseCtx: Record<string, string>;
  /** Entity chips narrowed to who is actually in the scene, for the choices pass. */
  sceneEntityTokens: Record<string, string>;
  /** Names the location router may answer with. */
  destinations: string[];
  /**
   * The assembled narration system prompt. Built by the caller: the dictionary scan, banded history and
   * notes fallback that produce it are the narration request's own assembly, not a turn decision.
   */
  narrationSystemPrompt: string;
  /** The trimmed history the narration rides on; this turn's user message is appended to it. */
  trimmedHistory: ChatMessage[];
  /** The narration text this turn produced; empty before the narration pass has answered. */
  narration: string;
  /** The last narration the planning stages recap from. */
  lastStory: string;
  /** Digested older turns riding ahead of the precall planner's recap. Empty when banding is off. */
  plannerRecap: string;
  /** The plan the thinking/staged stages produced, injected into the narration. Empty when none ran. */
  turnPlan: string;
  /** The `<ACTIVE CHARACTER GUIDANCE>` value the staged stages render with. */
  activeCharacterGuidance: string;
  /** The director's scene staging, once the director has answered. */
  directorScene: string;
  /** How many beings other than the player the director cast; zero leaves nothing to reconcile. */
  npcCastSize: number;
  /** What each chosen character intends, in cast order — the storyboarder's input. */
  intents: { name: string; text: string }[];
  /** Cast members beyond the active-character cap, named to the storyboarder but not asked. */
  overflow: string[];
  /** Who each fan-out pass runs for. A pass with no entry, or an empty one, sends nothing. */
  subjects?: Partial<Record<TurnPassId, TurnPassSubject[]>>;
  /** The being this request is about, for a fan-out pass. */
  subject?: TurnPassSubject;
}

/** The four values a turn knows before any pass has answered. Everything else is derived mid-run. */
export type TurnMaterialSeed = Pick<TurnMaterial, 'action' | 'effectiveAction' | 'turnId' | 'baseCtx' | 'destinations'>;

/** A turn's starting material: what the caller knows up front, with every derived field at its empty value. */
export function emptyTurnMaterial(seed: TurnMaterialSeed): TurnMaterial {
  return {
    ...seed,
    ctx: {},
    sceneEntityTokens: {},
    narrationSystemPrompt: "",
    trimmedHistory: [],
    narration: "",
    lastStory: "",
    plannerRecap: "",
    turnPlan: "",
    activeCharacterGuidance: "",
    directorScene: "",
    npcCastSize: 0,
    intents: [],
    overflow: [],
  };
}

/** One request, exactly as the request adapter receives it. */
export interface TurnPassRequest {
  type: AIRequestType;
  systemPrompt: string;
  messages: ChatMessage[];
  /** The cap the pass asks for; null means the request type's own default applies downstream. */
  maxTokens: number | null;
  silent: boolean;
  /** The turn a silent request summarizes; absent on foreground passes. */
  attachTurnId?: string;
  /** Suppress this request's own status label, so a batch can show one steady label instead of a race. */
  quiet: boolean;
}

/**
 * One pass as data. `isDue` is the pass's eligibility rule; `buildRequest` and `parseResponse` are its
 * two ends. Fan-out passes ({@link fanOut}) run once per subject, and a due fan-out pass with no
 * subjects sends nothing.
 */
export interface TurnPassRecord<TParsed = unknown> {
  id: TurnPassId;
  type: AIRequestType;
  stage: TurnStage;
  fanOut: boolean;
  isDue(input: TurnPlanInput): boolean;
  /**
   * A second gate, read once the turn is under way: a pass can be due by its settings and still have
   * nothing to ask about. Absent means always ready.
   */
  isReady?(material: TurnMaterial): boolean;
  buildRequest(input: TurnPlanInput, material: TurnMaterial): TurnPassRequest;
  parseResponse(raw: string, material: TurnMaterial): TParsed;
}

/** The plan for one turn: its shape, its concurrency, and the passes it will dispatch in order. */
export interface TurnPlan {
  /** The inputs this plan was made from, so the runner can build each pass's request. */
  input: TurnPlanInput;
  isOpeningTurn: boolean;
  /** The action every consumer but the narration sees. */
  effectiveAction: string;
  concurrency: TurnConcurrency;
  /** True when the narration user message carries the inline `<think>` directive. */
  inlineThinking: boolean;
  /** The due passes, in dispatch order. */
  passes: TurnPassRecord[];
}
