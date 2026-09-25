import type { ThinkingMode, ReasoningEffort } from '@/contexts/SettingsContext';
import type { AIRequestType } from '@/types';
import {
  probeKnownAbsent, recordProbeStatus, completionProbeAnswers, recordCompletionProbe, type CompletionProbeAnswers,
} from '@/lib/probeMemo';
import { observationAnswer, type ReasoningObservation } from '@/lib/reasoningObservation';
import { deriveModelsUrls } from '@/lib/contextLength';
import { loadReasoningCatalog, catalogSaysReasons, type ReasoningCatalogLoader } from '@/lib/reasoningCatalog';
import {
  isReasoningDialect, reasoningDialectNeedsProof, reasoningDialectTakesLevel, reasoningOffRejected,
  type ReasoningDialect,
} from '@/lib/reasoningDialect';
import { reasoningIdentityAnswer } from '@/lib/reasoningIdentity';

/** The `reasoning_effort` values a chat-completions endpoint may accept as a passthrough hint. `auto` is
 *  deliberately absent — it isn't a wire value; the UI's "Default" maps to sending nothing. */
export type ReasoningEffortField = Exclude<ReasoningEffort, 'auto'>;

/** Every effort literal the app knows, in canonical display order (least → most thinking). Different
 *  backends accept different subsets (e.g. cloud takes `minimal`, Ollama takes `max`), so the strengths
 *  actually offered are whichever of these the endpoint advertises — see `resolveReasoningCapability`. */
export const REASONING_CANDIDATES: readonly ReasoningEffortField[] = [
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
];

/** Universal fallback shown before detection runs (or when it can't) — accepted by every backend tested. */
export const SAFE_REASONING_EFFORTS: readonly ReasoningEffortField[] = ['none', 'low', 'medium', 'high'];

/** Which source answered one question in a capability record, so a wrong answer can be traced back. */
export type ReasoningCapabilitySource = 'identity' | 'native' | 'catalog' | 'observed' | 'probe' | 'engine' | 'cache';

const CAPABILITY_SOURCES: readonly ReasoningCapabilitySource[] = [
  'identity', 'native', 'catalog', 'observed', 'probe', 'engine', 'cache',
];

/** The six questions a capability record answers. */
export type ReasoningQuestion = 'reasons' | 'levels' | 'budget' | 'dialect' | 'offAllowed' | 'tools';

const CAPABILITY_QUESTIONS: readonly ReasoningQuestion[] = ['reasons', 'levels', 'budget', 'dialect', 'offAllowed', 'tools'];

/**
 * What the app knows about one endpoint-and-model pair's native reasoning. Every reader asks this record:
 * the request builder and the Native Reasoning controls. A `null` answer means not yet known, which reads
 * as "keep the safe fallback and keep the controls showing".
 */
export interface ReasoningCapability {
  /** Whether the model reasons at all. */
  readonly reasons: boolean | null;
  /** The effort literals the endpoint accepts. An empty list means it accepts none, which rules the model
   *  out unless `reasons` says otherwise: a model that reasons but exposes no strength lists none either. */
  readonly levels: readonly ReasoningEffortField[] | null;
  /** Whether the endpoint takes a reasoning token budget. */
  readonly budget: boolean | null;
  /** Which spelling of the reasoning fields the endpoint takes. `unknown` is the unanswered form. */
  readonly dialect: ReasoningDialect;
  /** Whether this model accepts a switched-off request. `false` locks the switch on. Where no source has
   *  answered, the dialect's own row decides. */
  readonly offAllowed: boolean | null;
  /** Whether the endpoint and model take Tools. Only `true` sends them; see `toolsSupported`. */
  readonly tools: boolean | null;
  /** Where each answer came from. */
  readonly sources: Partial<Record<ReasoningQuestion, ReasoningCapabilitySource>>;
}

/** The record for a target nothing has answered for yet. */
export const UNKNOWN_REASONING_CAPABILITY: ReasoningCapability = {
  reasons: null, levels: null, budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: {},
};

/** True only where a source said the endpoint and model take Tools. Unknown sends none. */
export function toolsSupported(capability: ReasoningCapability | null | undefined): boolean {
  return capability?.tools === true;
}

/** The record for a model one source rules out: it reasons not at all, so it accepts no effort literal. */
export function nonReasoningCapability(source: ReasoningCapabilitySource): ReasoningCapability {
  return {
    reasons: false, levels: [], budget: null, dialect: 'unknown', offAllowed: null, tools: null,
    sources: { reasons: source, levels: source },
  };
}

/** Stamps a source's own dialect onto every record it returns, answered questions and ruled-out ones alike. */
function withDialect(
  record: Omit<ReasoningCapability, 'dialect'>,
  dialect: ReasoningDialect,
  source: ReasoningCapabilitySource,
): ReasoningCapability {
  return { ...record, dialect, sources: { ...record.sources, dialect: source } };
}

/** A record built from an accepted-levels answer. An empty list is conclusive: the endpoint takes no effort
 *  literal at all, so the model does not reason. */
export function reasoningCapabilityFromLevels(
  levels: readonly ReasoningEffortField[],
  source: ReasoningCapabilitySource,
): ReasoningCapability {
  if (levels.length === 0) return nonReasoningCapability(source);
  return {
    reasons: null, levels, budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: { levels: source },
  };
}

/**
 * True when the record rules native reasoning out: the model is known not to reason, or the endpoint accepts
 * no effort literal and nothing has called the model a reasoning one. Both hide the Native Reasoning controls
 * behind the short note. An unknown record is not ruled out, so the controls keep showing until something
 * answers. A source that names the model a reasoner and lists no strength is describing a model that thinks
 * on its own terms, which keeps its switch and its budget slider and loses only the dropdown.
 */
export function reasoningRuledOut(capability: ReasoningCapability | null | undefined): boolean {
  if (capability?.reasons === false) return true;
  return capability?.levels?.length === 0 && capability.reasons !== true;
}

/**
 * True where the target's dialect publishes nothing about its own reasoning and no reply has proved it yet,
 * so every Native Reasoning control would be inert: the record names no budget to send and no literal the
 * wire guard would let through. The budget answer carries the proof, since one reply settles both.
 *
 * This is not the same as ruling the model out. Nothing here says the model does not reason; it says the
 * app cannot yet tell, so it offers no control rather than one that does nothing.
 */
export function reasoningAwaitingProof(capability: ReasoningCapability | null | undefined): boolean {
  return reasoningDialectNeedsProof(capability?.dialect ?? 'unknown') && capability?.budget !== true;
}

/**
 * True where the strength dropdown is worth showing: the dialect carries an effort literal, and no source
 * has said this model exposes no strength to pick. A dialect still awaiting its proof shows no dropdown,
 * because the wire guard would drop every literal the player picked.
 */
export function reasoningLevelControl(capability: ReasoningCapability): boolean {
  if (reasoningAwaitingProof(capability)) return false;
  return reasoningDialectTakesLevel(capability.dialect) && capability.levels?.length !== 0;
}

/**
 * True where the endpoint refuses a switched-off request, so the switch reads checked and locked. The
 * record's own answer wins, since it knows the model; the dialect's row decides for the endpoints whose
 * whole API refuses off.
 */
export function reasoningOffRefused(capability: ReasoningCapability | null | undefined): boolean {
  if (typeof capability?.offAllowed === 'boolean') return !capability.offAllowed;
  return reasoningOffRejected(capability?.dialect ?? 'unknown');
}

/**
 * Reads a stored capability record. A cache entry may also be a bare effort list, which loads as those
 * levels with the other answers unknown, so an update re-detects nothing. A record carrying no dialect loads
 * as `unknown`, the row that spells the plain fields. Anything else is `null`.
 */
export function parseReasoningCapability(raw: unknown): ReasoningCapability | null {
  const isLevel = (v: unknown): v is ReasoningEffortField => REASONING_CANDIDATES.includes(v as ReasoningEffortField);
  if (Array.isArray(raw)) {
    return raw.every(isLevel)
      ? {
          reasons: null, levels: raw as ReasoningEffortField[], budget: null, dialect: 'unknown',
          offAllowed: null, tools: null, sources: { levels: 'cache' },
        }
      : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const { reasons, levels, budget, dialect, offAllowed, tools, sources } = raw as Record<string, unknown>;
  const isTriState = (v: unknown) => v === null || typeof v === 'boolean';
  if (!isTriState(reasons) || !isTriState(budget)) return null;
  if (levels !== null && !(Array.isArray(levels) && levels.every(isLevel))) return null;
  return {
    reasons: reasons as boolean | null,
    levels: levels as ReasoningEffortField[] | null,
    budget: budget as boolean | null,
    dialect: isReasoningDialect(dialect) ? dialect : 'unknown',
    // A record stored before this answer existed carries none, and the dialect's row decides for it.
    offAllowed: typeof offAllowed === 'boolean' ? offAllowed : null,
    tools: typeof tools === 'boolean' ? tools : null,
    sources: parseCapabilitySources(sources),
  };
}

/** Keeps only the question-and-source pairs the record knows, so a stored oddity never types as a source. */
function parseCapabilitySources(raw: unknown): ReasoningCapability['sources'] {
  if (!raw || typeof raw !== 'object') return {};
  const stored = raw as Record<string, unknown>;
  const out: ReasoningCapability['sources'] = {};
  for (const question of CAPABILITY_QUESTIONS) {
    const source = stored[question];
    if (CAPABILITY_SOURCES.includes(source as ReasoningCapabilitySource)) out[question] = source as ReasoningCapabilitySource;
  }
  return out;
}

/** A prompt's resolved reasoning choice: `global` inherits the endpoint-wide level (Settings → Output →
 *  Native Reasoning); otherwise it's an explicit level, `auto` included (Model Default, send no hint). `none`
 *  is the resolved form of a switched-off setting. */
export type PromptReasoning = 'global' | ReasoningEffort;

/** A strength the control can pick while on. `auto` is Model Default: send no hint, the endpoint decides. */
export type ReasoningLevel = 'auto' | Exclude<ReasoningEffortField, 'none'>;
/** A prompt's strength while on: its own level, or `global` to follow the endpoint-wide setting. */
export type PromptReasoningLevel = 'global' | ReasoningLevel;

/** The stored shape of the endpoint-wide Native Reasoning control: an on/off switch plus the strength, which
 *  is kept while off so switching back on restores it. */
export interface ReasoningSetting { enabled: boolean; level: ReasoningLevel }
/** The stored shape of one prompt's Native Reasoning control. Same switch-plus-strength as the global one. */
export interface PromptReasoningSetting { enabled: boolean; level: PromptReasoningLevel }

/** Shipped endpoint-wide setting: on, Model Default. */
export const DEFAULT_REASONING_SETTING: ReasoningSetting = { enabled: true, level: 'auto' };

const REASONING_LEVELS: readonly ReasoningLevel[] = ['auto', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Full-word strength labels for the dropdowns, where a short tab label no longer has to fit. */
const REASONING_LEVEL_LABELS: Record<PromptReasoningLevel, string> = {
  global: 'Global', auto: 'Model Default', minimal: 'Minimal', low: 'Low', medium: 'Medium', high: 'High', xhigh: 'Extra High', max: 'Max',
};

/** The switch-off form of a setting, as the request layer reads it. */
export function resolveReasoningSetting(setting: ReasoningSetting): ReasoningEffort {
  return setting.enabled ? setting.level : 'none';
}

/** A prompt setting's resolved choice: its level while on, `none` while off. */
export function resolvePromptReasoningSetting(setting: PromptReasoningSetting): PromptReasoning {
  return setting.enabled ? setting.level : 'none';
}

/**
 * Reads a stored endpoint-wide setting. Accepts the current object and the earlier plain string (`auto`, `none`,
 * or a level), so a value written before the switch existed still loads: `none` becomes off at Model Default,
 * a level becomes on at that level. Anything else is `null`.
 */
export function parseReasoningSetting(raw: unknown): ReasoningSetting | null {
  if (typeof raw === 'string') {
    if (raw === 'none') return { enabled: false, level: 'auto' };
    return REASONING_LEVELS.includes(raw as ReasoningLevel) ? { enabled: true, level: raw as ReasoningLevel } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const { enabled, level } = raw as { enabled?: unknown; level?: unknown };
  if (typeof enabled !== 'boolean' || !REASONING_LEVELS.includes(level as ReasoningLevel)) return null;
  return { enabled, level: level as ReasoningLevel };
}

/** Reads a stored prompt setting, string or object, on the same terms as `parseReasoningSetting`. A plain
 *  `none` becomes off at Global. */
export function parsePromptReasoningSetting(raw: unknown): PromptReasoningSetting | null {
  const isLevel = (v: unknown): v is PromptReasoningLevel => v === 'global' || REASONING_LEVELS.includes(v as ReasoningLevel);
  if (typeof raw === 'string') {
    if (raw === 'none') return { enabled: false, level: 'global' };
    return isLevel(raw) ? { enabled: true, level: raw } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const { enabled, level } = raw as { enabled?: unknown; level?: unknown };
  if (typeof enabled !== 'boolean' || !isLevel(level)) return null;
  return { enabled, level };
}

/** Prompts whose shipped default is a small amount of native reasoning: the planning passes and the memory
 *  passes weigh several facts at once, so cheap thinking helps them. Parsers and choices ship switched off. */
const LOW_REASONING_KINDS: readonly AIRequestType[] = [
  'thinking', 'director', 'character', 'storyboard', 'summary', 'milestoneSelect', 'diary',
];

/** Shipped setting per prompt: narration on at Global, planning and memory passes on at Low, parsers and
 *  choices off (remembering Global for when they're switched on). */
export function defaultPromptReasoningSetting(kind: AIRequestType): PromptReasoningSetting {
  if (kind === 'narration') return { enabled: true, level: 'global' };
  return LOW_REASONING_KINDS.includes(kind) ? { enabled: true, level: 'low' } : { enabled: false, level: 'global' };
}

/**
 * Dropdown options for the endpoint-wide strength: Model Default first, then each level the record says the
 * endpoint accepts. An unanswered levels question falls back to the universally accepted levels. The current
 * pick stays listed even when the record no longer accepts it, so the dropdown never renders blank; the wire
 * guard still omits a level the endpoint does not take.
 */
export function reasoningLevelOptions(
  capability: ReasoningCapability | null | undefined,
  current?: ReasoningLevel,
): { value: ReasoningLevel; label: string }[] {
  const levels = capability?.levels ?? SAFE_REASONING_EFFORTS;
  const accepted = REASONING_LEVELS.filter((v) => v === 'auto' || v === current || levels.includes(v));
  return accepted.map((v) => ({ value: v, label: REASONING_LEVEL_LABELS[v] }));
}

/** Dropdown options for a prompt's strength: Global first, then the endpoint-wide list, the current pick kept. */
export function promptReasoningLevelOptions(
  capability: ReasoningCapability | null | undefined,
  current?: PromptReasoningLevel,
): { value: PromptReasoningLevel; label: string }[] {
  const level = current === 'global' ? undefined : current;
  return [{ value: 'global', label: REASONING_LEVEL_LABELS.global }, ...reasoningLevelOptions(capability, level)];
}

/**
 * Inline mode's narration call writes its own `<think>` block in the same completion, so native reasoning stays
 * off on that one call regardless of its per-prompt choice. Every other kind and mode follows its own choice.
 */
export function nativeReasoningSuppressed(mode: ThinkingMode, kind: AIRequestType): boolean {
  return mode === 'inline' && kind === 'narration';
}

/** Every request kind: for checks that consider a shipped default, and for validating an imported kind. */
export const ALL_REQUEST_KINDS = [
  'thinking', 'director', 'character', 'storyboard', 'narration', 'choices', 'statUpdates', 'locationChange',
  'summary', 'milestoneSelect', 'diary', 'discoverEntity', 'timePassed', 'openingTime', 'sceneTags',
] as const satisfies readonly AIRequestType[];
// Fails to compile when a kind is added to the union but not to the list above.
type _EveryKindListed = Exclude<AIRequestType, (typeof ALL_REQUEST_KINDS)[number]> extends never ? true : never;
const _everyKindListed: _EveryKindListed = true;
void _everyKindListed;

/**
 * True when the app would let a model reason on some call: a Thinking mode, or any prompt whose effective
 * choice (its stored setting, or its shipped default) is not `none` once the endpoint-wide level is folded in.
 * When false, callers send no reasoning field at all and skip capability resolution. Read from the effective
 * choice, not the stored map, since the shipped tiers switch several prompts on without storing anything.
 */
export function isReasoningEngaged(
  mode: ThinkingMode,
  globalEffort: ReasoningEffort,
  promptReasoning: Record<string, PromptReasoning>,
): boolean {
  return mode !== 'off'
    || ALL_REQUEST_KINDS.some((kind) => resolvePromptReasoning(kind, promptReasoning, globalEffort, mode) !== 'none');
}

/** Shipped resolved choice per prompt — `defaultPromptReasoningSetting` as the request layer reads it. */
export function defaultPromptReasoning(kind: AIRequestType): PromptReasoning {
  return resolvePromptReasoningSetting(defaultPromptReasoningSetting(kind));
}

/**
 * Resolves the effective reasoning effort for one request: the prompt's stored choice (or its shipped default),
 * with `global` folding in the endpoint-wide level. Inline narration resolves to `none` (see
 * `nativeReasoningSuppressed`). The result is fed to `reasoningEffortBody`, which applies the endpoint guard.
 */
export function resolvePromptReasoning(
  kind: AIRequestType,
  prefs: Record<string, PromptReasoning>,
  globalEffort: ReasoningEffort,
  mode: ThinkingMode,
): ReasoningEffort {
  if (nativeReasoningSuppressed(mode, kind)) return 'none';
  const pref = prefs[kind] ?? defaultPromptReasoning(kind);
  return pref === 'global' ? globalEffort : pref;
}

/** The switch-and-strength settings a request reads when the endpoint refuses off. Both are optional: a
 *  caller with nothing stored falls back to the shipped ones. */
export interface KeptReasoningSettings {
  /** Each prompt's own switch and strength, as Settings stores them. */
  readonly prompts?: Record<string, PromptReasoningSetting>;
  /** The endpoint-wide switch and strength, which a prompt set to Global follows. */
  readonly global?: ReasoningSetting;
}

/**
 * The strength a prompt keeps while its switch is off. Both switches are ignored, since this is read only
 * where the endpoint refuses off and both switches therefore render checked and locked.
 */
export function keptReasoningLevel(
  kind: AIRequestType,
  kept: KeptReasoningSettings,
): ReasoningEffort {
  const level = (kept.prompts?.[kind] ?? defaultPromptReasoningSetting(kind)).level;
  return level === 'global' ? (kept.global ?? DEFAULT_REASONING_SETTING).level : level;
}

/**
 * The effort one request carries, with the endpoint's refusal of off folded in. A prompt switched off on an
 * endpoint that refuses off sends the strength it kept instead, since its switch reads as checked and locked
 * and the model reasons whatever the request says. Inline narration still resolves to `none`: that mode
 * suppresses the call's own scratchpad wherever it can, and an endpoint that refuses off simply ignores it.
 */
export function resolveRequestReasoning(
  kind: AIRequestType,
  prefs: Record<string, PromptReasoning>,
  globalEffort: ReasoningEffort,
  mode: ThinkingMode,
  capability: ReasoningCapability | null | undefined,
  kept: KeptReasoningSettings = {},
): ReasoningEffort {
  const choice = resolvePromptReasoning(kind, prefs, globalEffort, mode);
  if (choice !== 'none') return choice;
  if (nativeReasoningSuppressed(mode, kind) || !reasoningOffRefused(capability)) return choice;
  return keptReasoningLevel(kind, kept);
}

/** The budget slider's floor. Off is the prompt's switch, not a 0% position, so the slider never reads as off. */
export const MIN_REASONING_BUDGET_PCT = 5;

/** Shipped reasoning budget (percent of max output) per prompt: narration 40%, everything else 25%. The budget
 *  is a strength, kept while a prompt is switched off; whether it applies at all is the prompt's switch. */
export function defaultReasoningBudgetPct(kind: AIRequestType): number {
  return kind === 'narration' ? 40 : 25;
}

/** The budget percent a prompt would spend while on: the stored value or the shipped default, clamped to the
 *  slider's range. */
export function resolveReasoningBudgetPct(kind: AIRequestType, budgets: Partial<Record<AIRequestType, number>>): number {
  const pct = budgets[kind] ?? defaultReasoningBudgetPct(kind);
  return Math.max(MIN_REASONING_BUDGET_PCT, Math.min(100, pct));
}

/**
 * The reasoning token cap one request carries, before any dialect spells it. `effort` is the prompt's
 * resolved choice from `resolvePromptReasoning`: `none` (switched off, a Global prompt under a switched-off
 * global, or Inline narration) caps at 0, which is how thinking is suppressed on a target that has no effort
 * literal. Anything else caps at `round(pct% × maxTokens)`.
 */
export function reasoningBudgetTokens(
  effort: ReasoningEffort,
  kind: AIRequestType,
  budgets: Partial<Record<AIRequestType, number>>,
  maxTokens: number,
): number {
  const pct = effort === 'none' ? 0 : resolveReasoningBudgetPct(kind, budgets);
  return Math.round((pct / 100) * maxTokens);
}

/**
 * The effort literal one request carries, or `null` where it carries none. `auto` sends nothing, so the
 * endpoint decides; any level maps to itself.
 *
 * A literal is sent ONLY when the record lists it among the levels the endpoint accepts, and never to a model
 * the record says does not reason. An unanswered levels question sends nothing too, so a backend that rejects
 * even `none` (e.g. LM Studio on a non-reasoning model) is never hit with the field before something answers
 * for it.
 */
export function reasoningEffortValue(
  effort: ReasoningEffort,
  capability?: ReasoningCapability | null,
): ReasoningEffortField | null {
  const value: ReasoningEffortField | null = effort === 'auto' ? null : effort;
  if (value === null) return null;
  if (reasoningRuledOut(capability)) return null;
  if (!capability?.levels?.includes(value)) return null;
  return value;
}

/** The endpoint-and-model pair one resolve runs against. */
export interface ReasoningTarget {
  readonly url: string;
  readonly token: string;
  readonly model: string;
}

/** The fetch a resolve uses. Injected so every backend shape is tested without a server. */
export type ResolverFetch = (url: string, init?: RequestInit) => Promise<Response>;

/** What a resolve knows beyond the endpoint itself. */
export interface ReasoningResolveContext {
  /** What this target's most recent reply showed, recorded by the settings context. */
  readonly observation?: ReasoningObservation | null;
  /** Loads the public model catalog. Injected so a test names its own catalog and reaches no network. */
  readonly loadCatalog?: ReasoningCatalogLoader;
  /** The record already cached for this target. A tools answer it holds is not probed again. */
  readonly stored?: ReasoningCapability | null;
  readonly signal?: AbortSignal;
}

/** Asks one advertisement endpoint, returning the record it proves or `null` to try the next source. */
type NativeSource = (
  target: ReasoningTarget,
  doFetch: ResolverFetch,
  signal?: AbortSignal,
) => Promise<ReasoningCapability | null>;

function originOf(endpointUrl: string): string | null {
  try {
    return new URL(endpointUrl).origin;
  } catch {
    return null;
  }
}

function authHeaders(token: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const isEffortField = (v: unknown): v is ReasoningEffortField =>
  REASONING_CANDIDATES.includes(v as ReasoningEffortField);

/** Keeps the first of each literal, so a backend listing one twice still yields a clean level list. */
function dedupeLevels(levels: readonly ReasoningEffortField[]): ReasoningEffortField[] {
  return [...new Set(levels)];
}

/**
 * Reads a mapped-to-nothing list as unanswered rather than as an empty one. An empty list is conclusive —
 * the endpoint accepts no effort literal, so the strength control hides — and a source that has just
 * called the model reasoning must not also say that. The safe fallback stands instead.
 */
function orUnknown(levels: ReasoningEffortField[]): ReasoningEffortField[] | null {
  return levels.length > 0 ? levels : null;
}

/**
 * Fetches one advertisement URL and returns its parsed body, or `null` when that URL does not serve this
 * API. A backend may answer a foreign path with HTTP 200 and an error payload — LM Studio does exactly
 * that on `GET /props` — so the body identifies a source, never the status code. A conclusive absence is
 * remembered for the session, so a foreign endpoint is asked once.
 */
async function readAdvertisement(
  url: string,
  doFetch: ResolverFetch,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  if (probeKnownAbsent(url)) return null;
  try {
    const res = await doFetch(url, { ...init, signal });
    let body: unknown = null;
    try { body = await res.json(); } catch { /* a non-JSON body says nothing */ }
    recordProbeStatus(url, res.status, body);
    if (!res.ok) return null;
    if (!body || typeof body !== 'object' || 'error' in body) return null;
    return body as Record<string, unknown>;
  } catch {
    return null; // network/abort → inconclusive
  }
}

/** LM Studio's reasoning options mapped to our literals. `on` names the switch, not a strength, so it
 *  maps to nothing and an on/off model lists `none` alone. */
const LM_STUDIO_LEVELS: Record<string, ReasoningEffortField> = {
  off: 'none', low: 'low', medium: 'medium', high: 'high',
};

/**
 * LM Studio's native model list (`{origin}/api/v1/models`). Its `capabilities.reasoning` is an object,
 * present only for a reasoning model, whose `allowed_options` also name the strengths the server honors.
 * That same answer settles the budget question: only LM Studio serves this list, and its chat-completions
 * endpoint takes `thinking_budget_tokens` for a reasoning model.
 */
const lmStudioSource: NativeSource = async (target, doFetch, signal) => {
  const origin = originOf(target.url);
  if (!origin) return null;
  const body = await readAdvertisement(`${origin}/api/v1/models`, doFetch, { headers: authHeaders(target.token) }, signal);
  const models = body?.models;
  if (!Array.isArray(models)) return null; // not the LM Studio native shape
  // Match by exact key; if the configured name doesn't map to one (e.g. the literal "default", which makes
  // LM Studio serve whatever's loaded), fall back to the loaded model so capability still resolves.
  const loaded = (m: unknown) => Array.isArray((m as { loaded_instances?: unknown }).loaded_instances)
    && (m as { loaded_instances: unknown[] }).loaded_instances.length > 0;
  const entry = models.find((m) => (m as { key?: unknown }).key === target.model) ?? models.find(loaded);
  if (!entry || typeof entry !== 'object') return null; // model not listed → inconclusive
  const caps = (entry as { capabilities?: unknown }).capabilities;
  const listed = caps && typeof caps === 'object' ? caps as Record<string, unknown> : {};
  const reasoning = listed.reasoning;
  // LM Studio sends Tools to a model not trained for them, which skips or garbles them, so only a yes counts.
  const tools = listed.trained_for_tool_use === true;
  // A model listed without the object does not reason. The budget stays unanswered there: nothing has
  // tested whether the endpoint takes the field for such a model. The dialect is named either way — only
  // LM Studio serves this list, so reaching it identifies the server whatever the model turns out to be.
  if (!reasoning || typeof reasoning !== 'object') {
    const ruledOut = nonReasoningCapability('native');
    return withDialect({ ...ruledOut, tools, sources: { ...ruledOut.sources, tools: 'native' } }, 'lmstudio', 'native');
  }
  const allowed = (reasoning as { allowed_options?: unknown }).allowed_options;
  const levels = Array.isArray(allowed)
    ? orUnknown(dedupeLevels(allowed.map((o) => LM_STUDIO_LEVELS[String(o)]).filter(isEffortField)))
    : null;
  return withDialect({
    reasons: true,
    levels,
    budget: true,
    offAllowed: null,
    tools,
    sources: {
      reasons: 'native', budget: 'native', tools: 'native', ...(levels ? { levels: 'native' as const } : {}),
    },
  }, 'lmstudio', 'native');
};

/**
 * Ollama's show endpoint (`POST {origin}/api/show`). Its `capabilities` array names `thinking` for a model
 * that reasons and `tools` for one that takes Tools. The array is omitted rather than emptied when the
 * server has nothing to say, so a body without it is inconclusive and never a no. Ollama advertises no
 * strengths and no budget.
 */
const ollamaSource: NativeSource = async (target, doFetch, signal) => {
  const origin = originOf(target.url);
  if (!origin) return null;
  const body = await readAdvertisement(`${origin}/api/show`, doFetch, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(target.token) },
    body: JSON.stringify({ model: target.model }),
  }, signal);
  const capabilities = body?.capabilities;
  if (!Array.isArray(capabilities)) return null;
  const tools = capabilities.includes('tools');
  const reasoning: ReasoningCapability = capabilities.includes('thinking')
    ? { ...UNKNOWN_REASONING_CAPABILITY, reasons: true, sources: { reasons: 'native' } }
    : nonReasoningCapability('native');
  return { ...reasoning, tools, sources: { ...reasoning.sources, tools: 'native' } };
};

/**
 * A llama.cpp server's properties endpoint (`GET {origin}/props`). Its `chat_template_caps` report whether
 * the loaded template reads `reasoning_effort` at all, which settles the levels: the safe set when it does,
 * none when it does not, so the strength control appears only where the template honors it. The server
 * exposes no flag for whether the model thinks, so the reasons question stays open either way. Builds
 * before the template capabilities existed omit the flag, and say nothing.
 */
const llamaCppSource: NativeSource = async (target, doFetch, signal) => {
  const origin = originOf(target.url);
  if (!origin) return null;
  const body = await readAdvertisement(`${origin}/props`, doFetch, { headers: authHeaders(target.token) }, signal);
  const caps = body?.chat_template_caps;
  if (!caps || typeof caps !== 'object') return null;
  const honored = (caps as Record<string, unknown>).supports_reasoning_effort;
  if (typeof honored !== 'boolean') return null;
  return {
    reasons: null,
    levels: honored ? [...SAFE_REASONING_EFFORTS] : [],
    budget: null,
    dialect: 'unknown',
    offAllowed: null,
    tools: null,
    sources: { levels: 'native' },
  };
};

/** The parameter names a gateway lists when it takes a reasoning field of some kind. */
const GATEWAY_REASONING_PARAMS: readonly string[] = ['reasoning', 'reasoning_effort', 'include_reasoning'];

/**
 * What one OpenRouter models-list entry says. Only OpenRouter publishes a `reasoning` object, so the object
 * names the dialect by existing, and its own fields answer the strengths, the token budget, and whether the
 * model may be switched off at all.
 *
 * The strengths read as OpenRouter documents them: a list names the literals it accepts, `null` accepts every
 * gateway effort, and an omitted field means the model exposes no strength to pick — an empty list, not an
 * unanswered question, so the dropdown goes rather than the whole control.
 *
 * Only an omitted field says that. A list that arrives with entries and ends up empty leaves the question
 * unanswered instead, which keeps the safe fallback. Both ways of emptying it mean the same thing: the
 * advertisement named strengths, and none of them survived. A mandatory model's list loses `none`, which it
 * rejects, and a list may also name literals this app does not know.
 */
function openRouterCapability(reasoning: Record<string, unknown>): ReasoningCapability {
  const { supported_efforts: efforts, supports_max_tokens: budget, mandatory } = reasoning;
  const named = Array.isArray(efforts) ? efforts : efforts === null ? [...REASONING_CANDIDATES] : [];
  const offAllowed = mandatory !== true;
  const accepted = dedupeLevels(named.filter(isEffortField)).filter((l) => offAllowed || l !== 'none');
  const levels = named.length > 0 ? orUnknown(accepted) : accepted;
  return {
    reasons: true,
    levels,
    budget: budget === true,
    dialect: 'openrouter',
    offAllowed,
    tools: null,
    sources: {
      reasons: 'native', budget: 'native', dialect: 'native', offAllowed: 'native',
      ...(levels ? { levels: 'native' as const } : {}),
    },
  };
}

/**
 * An OpenAI-shaped model list, which several backends serve. An entry may carry a `reasoning` object, which
 * only OpenRouter publishes and only for a reasoning model, so it names that dialect and answers four
 * questions at once. An entry with only a `supported_parameters` list answers the reasons question alone.
 *
 * An entry carrying `max_model_len` is vLLM or Aphrodite, the same key the context-length lookup reads for
 * them. That names the dialect and nothing else: whether the server runs a reasoning parser, and so whether
 * it takes a token budget, is a server-side option no list advertises. The chain carries on to the sources
 * that can answer it. A plain OpenAI list carries none of these and says nothing.
 */
const modelListSource: NativeSource = async (target, doFetch, signal) => {
  const urls = deriveModelsUrls(target.url);
  if (!urls) return null;
  const body = await readAdvertisement(urls.openai, doFetch, { headers: authHeaders(target.token) }, signal);
  const data = body?.data;
  if (!Array.isArray(data)) return null;
  const entry = data.find((m) => (m as { id?: unknown }).id === target.model);
  if (!entry || typeof entry !== 'object') return null; // model not listed → inconclusive

  const reasoning = (entry as { reasoning?: unknown }).reasoning;
  if (reasoning && typeof reasoning === 'object') return openRouterCapability(reasoning as Record<string, unknown>);

  const params = (entry as { supported_parameters?: unknown }).supported_parameters;
  if (Array.isArray(params)) {
    return params.some((p) => GATEWAY_REASONING_PARAMS.includes(String(p)))
      ? { reasons: true, levels: null, budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: { reasons: 'native' } }
      : nonReasoningCapability('native');
  }

  if (typeof (entry as { max_model_len?: unknown }).max_model_len === 'number') {
    return withDialect(UNKNOWN_REASONING_CAPABILITY, 'vllm', 'native');
  }
  return null;
};

/**
 * What the endpoint's own address proves. A first-party API's host names its dialect outright, and its model
 * id names the generation within it, so this source reads the target and sends no request at all. It answers
 * only for the hosts the identity table claims, and leaves every other endpoint to the sources below.
 */
const identitySource: NativeSource = async (target) => {
  const answer = reasoningIdentityAnswer(target.url, target.model);
  if (!answer) return null;
  const from = 'identity' as const;
  return {
    reasons: answer.reasons,
    levels: answer.levels,
    budget: answer.budget,
    dialect: answer.dialect,
    offAllowed: answer.offAllowed ?? null,
    tools: null,
    sources: {
      reasons: from, budget: from, dialect: from,
      ...(answer.levels === null ? {} : { levels: from }),
      ...(answer.offAllowed === undefined ? {} : { offAllowed: from }),
    },
  };
};

/** The advertisement sources, cheapest and most specific first. Each is tried only until one answers. */
const NATIVE_SOURCES: readonly NativeSource[] = [
  identitySource, lmStudioSource, ollamaSource, llamaCppSource, modelListSource,
];

/** Which fields one probe completion carries, and so which questions it asks. */
interface ProbeFields {
  /** The `none` effort literal: a rejection proves the endpoint exposes no reasoning field at all. */
  readonly reasoning: boolean;
  /** One Tool with `tool_choice: "auto"`, the pair play sends, so refusing either reads as no Tools. */
  readonly tools: boolean;
}

/** The Tool a probe carries. It does nothing and takes nothing. */
const PROBE_TOOL = {
  type: 'function',
  function: { name: 'noop', description: 'Does nothing.', parameters: { type: 'object', properties: {} } },
} as const;

/** Sends one probe completion: `true` for a 200, `false` for a 400, `null` for anything that proves nothing. */
async function sendProbe(
  target: ReasoningTarget,
  doFetch: ResolverFetch,
  fields: ProbeFields,
  signal?: AbortSignal,
): Promise<boolean | null> {
  try {
    const res = await doFetch(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(target.token) },
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: 'user', content: '.' }],
        max_tokens: 1,
        stream: false,
        ...(fields.reasoning ? { reasoning_effort: 'none' } : {}),
        ...(fields.tools ? { tools: [PROBE_TOOL], tool_choice: 'auto' } : {}),
      }),
      signal,
    });
    // Drain the tiny body so the connection frees promptly.
    await res.text().catch(() => undefined);
    if (res.status === 200) return true;
    if (res.status === 400) return false;
    return null; // auth/5xx/other → inconclusive
  } catch {
    return null; // network/abort → inconclusive
  }
}

/**
 * Asks the questions no source answered, in as few completions as it can. With both open, one bundled probe
 * asks both: a 200 answers both, and a 400 splits into one probe per field to find the one refused. With
 * one open, that field goes alone. Every conclusive answer is memoized per endpoint and model, so a later
 * resolve this session sends only what it still does not know.
 */
async function probeCompletions(
  target: ReasoningTarget,
  doFetch: ResolverFetch,
  wanted: ProbeFields,
  signal?: AbortSignal,
): Promise<CompletionProbeAnswers> {
  const known = completionProbeAnswers(target.url, target.model);
  const open: ProbeFields = {
    reasoning: wanted.reasoning && known.reasoning === undefined,
    tools: wanted.tools && known.tools === undefined,
  };
  if (open.reasoning && open.tools && !known.bundleRejected) {
    const both = await sendProbe(target, doFetch, open, signal);
    if (both === null) return known; // an inconclusive answer attributes nothing, so it is not split
    recordCompletionProbe(target.url, target.model, both ? { reasoning: true, tools: true } : { bundleRejected: true });
    if (both) return completionProbeAnswers(target.url, target.model);
  }
  for (const field of ['reasoning', 'tools'] as const) {
    if (!open[field]) continue;
    const accepted = await sendProbe(target, doFetch, { reasoning: field === 'reasoning', tools: field === 'tools' }, signal);
    if (accepted !== null) recordCompletionProbe(target.url, target.model, { [field]: accepted });
  }
  return completionProbeAnswers(target.url, target.model);
}

/**
 * The record the probe answers prove, for the wanted questions only, or `null` when they prove nothing.
 * An accepted `none` literal proves only that the field parses, so the reasons question stays open on the
 * safe levels.
 */
function probedCapability(answers: CompletionProbeAnswers, wanted: ProbeFields): ReasoningCapability | null {
  const reasoning = wanted.reasoning ? answers.reasoning : undefined;
  const tools = wanted.tools ? answers.tools : undefined;
  if (reasoning === undefined && tools === undefined) return null;
  const base: ReasoningCapability = reasoning === undefined
    ? UNKNOWN_REASONING_CAPABILITY
    : reasoning
      ? { ...UNKNOWN_REASONING_CAPABILITY, levels: [...SAFE_REASONING_EFFORTS], sources: { levels: 'probe' } }
      : nonReasoningCapability('probe');
  return tools === undefined ? base : { ...base, tools, sources: { ...base.sources, tools: 'probe' } };
}

/**
 * Resolves one endpoint-and-model pair's capability record, then folds in what a reply proved about a
 * dialect that advertises nothing. The proof is applied here rather than inside the chain because the chain
 * has several exits, and a dialect named by one source may be carried out through any of them.
 *
 * Returns `null` when nothing answered conclusively, so a caller keeps its fallback and its cache entry
 * rather than storing a wrong record.
 */
export async function resolveReasoningCapability(
  target: ReasoningTarget,
  doFetch: ResolverFetch = fetch,
  context: ReasoningResolveContext = {},
): Promise<ReasoningCapability | null> {
  const gathered = await gatherReasoningCapability(target, doFetch, context);
  return withProvenSeparation(gathered, context.observation);
}

/**
 * What one reply proves about a dialect nothing advertises for. A vLLM server parts its reasoning out only
 * when its operator started one with a reasoning parser, and no model list says whether they did. A reply
 * carrying a separate reasoning field proves they did, which answers the token budget and licenses the
 * effort literal on that same parsed path; the safe levels are what the literal is then drawn from.
 *
 * A reply whose reasoning sat inline in the prose proves neither. The model thought, and the server handed
 * the thinking back unparsed, which is the case this gate exists to keep controls away from.
 */
function withProvenSeparation(
  record: ReasoningCapability | null,
  observation: ReasoningObservation | null | undefined,
): ReasoningCapability | null {
  if (!record || !reasoningDialectNeedsProof(record.dialect)) return record;
  if (!observation?.sawSeparateReasoning || record.budget !== null) return record;
  return {
    ...record,
    budget: true,
    levels: record.levels ?? [...SAFE_REASONING_EFFORTS],
    sources: {
      ...record.sources,
      budget: 'observed',
      ...(record.levels ? {} : { levels: 'observed' as const }),
    },
  };
}

/**
 * Runs the source chain, then probes for whatever it left open: the reasons question when no source
 * answered it, and the tools question when no source answered that. An advertisement outranks the probe,
 * which only learns whether a field parses.
 */
async function gatherReasoningCapability(
  target: ReasoningTarget,
  doFetch: ResolverFetch,
  context: ReasoningResolveContext,
): Promise<ReasoningCapability | null> {
  if (!originOf(target.url)) return null; // a half-typed endpoint gets no request at all
  const { record, reasonsOpen } = await gatherAdvertised(target, doFetch, context);
  const wanted: ProbeFields = { reasoning: reasonsOpen, tools: record?.tools == null && context.stored?.tools == null };
  if (!wanted.reasoning && !wanted.tools) return record;
  const probed = probedCapability(await probeCompletions(target, doFetch, wanted, context.signal), wanted);
  if (!probed) return record;
  return record ? mergeReasoningCapability(probed, record) : probed;
}

/**
 * The source chain itself. It walks the advertisement sources in order and returns the first that answers
 * the reasons question, so a backend that publishes its own capabilities is never sent a test completion.
 * Next it matches the model id against the public catalog, then reads what the replies already showed.
 * `reasonsOpen` is true only when none of those answered, which is when the reasoning probe fires.
 */
async function gatherAdvertised(
  target: ReasoningTarget,
  doFetch: ResolverFetch,
  context: ReasoningResolveContext,
): Promise<{ record: ReasoningCapability | null; reasonsOpen: boolean }> {
  const { observation, loadCatalog = loadReasoningCatalog, signal } = context;
  let gathered: ReasoningCapability | null = null;
  for (const source of NATIVE_SOURCES) {
    const answer = await source(target, doFetch, signal);
    if (!answer) continue;
    // The earlier source wins: it is the more specific one, so a later source only fills its gaps.
    gathered = gathered ? mergeReasoningCapability(answer, gathered) : answer;
    // Only the reasons question ends the chain. A source that names the strengths but not whether the
    // model thinks (llama.cpp) leaves the question open, so the next source still gets to answer it.
    if (gathered.reasons !== null) return { record: gathered, reasonsOpen: false };
  }
  // A well-known model id, so a catalog-listed model is known to reason before the first turn. The catalog
  // answers the reasons question alone; the levels and budget stay as the advertisements left them. Its
  // silence is never a no: the catalog holds only the ids that reason, so a miss falls through to the
  // sources below. A failed load says nothing and costs the chain nothing.
  if (gathered?.reasons == null && catalogSaysReasons(await loadCatalog(doFetch), target.model)) {
    const listed: ReasoningCapability = {
      reasons: true, levels: null, budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: { reasons: 'catalog' },
    };
    return { record: gathered ? mergeReasoningCapability(listed, gathered) : listed, reasonsOpen: false };
  }
  // What the replies already showed, which costs no request at all. It is asked only once no advertisement
  // named an answer, so a native yes or no is never overridden by what one reply happened to look like.
  const observed = observedCapability(observation);
  if (observed) return { record: gathered ? mergeReasoningCapability(observed, gathered) : observed, reasonsOpen: false };
  return { record: gathered, reasonsOpen: true };
}

/**
 * The record one observation proves, or `null` when it proves nothing. A reply that showed reasoning answers
 * the reasons question alone: seeing a scratchpad says the model thinks, never which strengths the endpoint
 * takes. A reply that came back bare although the call asked for a positive effort rules the model out, and
 * a ruled-out model accepts no effort literal.
 */
function observedCapability(observation: ReasoningObservation | null | undefined): ReasoningCapability | null {
  const answer = observationAnswer(observation);
  if (answer === null) return null;
  if (!answer) return nonReasoningCapability('observed');
  return { reasons: true, levels: null, budget: null, dialect: 'unknown', offAllowed: null, tools: null, sources: { reasons: 'observed' } };
}

/**
 * Whether a stored record still wants resolving: nothing stored at all, an answer only the cache vouches
 * for, or no tools answer. A record written before this session's advertisement sources existed carries
 * `cache` as its source, and whatever levels were stored with it, so it is asked again and a live source
 * replaces them. A record stored before the tools question existed is asked once for that answer.
 */
export function reasoningNeedsResolve(capability: ReasoningCapability | null | undefined): boolean {
  if (!capability || capability.tools === null) return true;
  return Object.values(capability.sources).some((source) => source === 'cache');
}

/**
 * Folds a fresh resolve onto a stored record. Each question takes the fresh answer where the resolve has
 * one and keeps the stored answer otherwise, so a source that just spoke outranks whatever the cache held.
 * That is how a record the cache alone vouches for gives up its levels to a source that just spoke.
 */
export function mergeReasoningCapability(
  stored: ReasoningCapability | null,
  fresh: ReasoningCapability,
): ReasoningCapability {
  if (!stored) return fresh;
  const pick = <K extends 'reasons' | 'levels' | 'budget' | 'offAllowed' | 'tools'>(question: K): ReasoningCapability[K] =>
    (fresh[question] !== null ? fresh[question] : stored[question]);
  return {
    reasons: pick('reasons'),
    levels: pick('levels'),
    budget: pick('budget'),
    offAllowed: pick('offAllowed'),
    tools: pick('tools'),
    // `unknown` is the dialect's unanswered form, so it keeps whatever the stored record named.
    dialect: fresh.dialect !== 'unknown' ? fresh.dialect : stored.dialect,
    sources: { ...stored.sources, ...fresh.sources },
  };
}
