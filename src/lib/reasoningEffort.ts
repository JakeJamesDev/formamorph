import type { ThinkingMode, ReasoningEffort } from '@/contexts/SettingsContext';
import type { AIRequestType } from '@/types';
import { probeKnownAbsent, recordProbeStatus } from '@/lib/probeMemo';
import { deriveModelsUrls } from '@/lib/contextLength';

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
export type ReasoningCapabilitySource = 'native' | 'probe' | 'engine' | 'cache';

const CAPABILITY_SOURCES: readonly ReasoningCapabilitySource[] = ['native', 'probe', 'engine', 'cache'];

/** The three questions a capability record answers. */
export type ReasoningQuestion = 'reasons' | 'levels' | 'budget';

const CAPABILITY_QUESTIONS: readonly ReasoningQuestion[] = ['reasons', 'levels', 'budget'];

/**
 * What the app knows about one endpoint-and-model pair's native reasoning. Every reader asks this record:
 * the request builder and the Native Reasoning controls. A `null` answer means not yet known, which reads
 * as "keep the safe fallback and keep the controls showing".
 */
export interface ReasoningCapability {
  /** Whether the model reasons at all. */
  readonly reasons: boolean | null;
  /** The effort literals the endpoint accepts. An empty list means it accepts none. */
  readonly levels: readonly ReasoningEffortField[] | null;
  /** Whether the endpoint takes a reasoning token budget. */
  readonly budget: boolean | null;
  /** Where each answer came from. */
  readonly sources: Partial<Record<ReasoningQuestion, ReasoningCapabilitySource>>;
}

/** The record for a target nothing has answered for yet. */
export const UNKNOWN_REASONING_CAPABILITY: ReasoningCapability = {
  reasons: null, levels: null, budget: null, sources: {},
};

/** The record for a model one source rules out: it reasons not at all, so it accepts no effort literal. */
export function nonReasoningCapability(source: ReasoningCapabilitySource): ReasoningCapability {
  return { reasons: false, levels: [], budget: null, sources: { reasons: source, levels: source } };
}

/** A record built from an accepted-levels answer. An empty list is conclusive: the endpoint takes no effort
 *  literal at all, so the model does not reason. */
export function reasoningCapabilityFromLevels(
  levels: readonly ReasoningEffortField[],
  source: ReasoningCapabilitySource,
): ReasoningCapability {
  if (levels.length === 0) return nonReasoningCapability(source);
  return { reasons: null, levels, budget: null, sources: { levels: source } };
}

/**
 * True when the record rules native reasoning out: the model is known not to reason, or the endpoint accepts
 * no effort literal at all. Both hide the Native Reasoning controls behind the short note. An unknown record
 * is not ruled out, so the controls keep showing until something answers.
 */
export function reasoningRuledOut(capability: ReasoningCapability | null | undefined): boolean {
  return capability?.reasons === false || capability?.levels?.length === 0;
}

/**
 * Reads a stored capability record. A cache entry may also be a bare effort list, which loads as those
 * levels with the other two answers unknown, so an update re-detects nothing. Anything else is `null`.
 */
export function parseReasoningCapability(raw: unknown): ReasoningCapability | null {
  const isLevel = (v: unknown): v is ReasoningEffortField => REASONING_CANDIDATES.includes(v as ReasoningEffortField);
  if (Array.isArray(raw)) {
    return raw.every(isLevel)
      ? { reasons: null, levels: raw as ReasoningEffortField[], budget: null, sources: { levels: 'cache' } }
      : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const { reasons, levels, budget, sources } = raw as Record<string, unknown>;
  const isTriState = (v: unknown) => v === null || typeof v === 'boolean';
  if (!isTriState(reasons) || !isTriState(budget)) return null;
  if (levels !== null && !(Array.isArray(levels) && levels.every(isLevel))) return null;
  return {
    reasons: reasons as boolean | null,
    levels: levels as ReasoningEffortField[] | null,
    budget: budget as boolean | null,
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
  'thinking', 'director', 'character', 'storyboard', 'summary', 'diary',
];

/** Shipped setting per prompt: narration on at Global, planning and memory passes on at Low, parsers and
 *  choices off (remembering Global for when they're switched on). */
export function defaultPromptReasoningSetting(kind: AIRequestType): PromptReasoningSetting {
  if (kind === 'narration') return { enabled: true, level: 'global' };
  return LOW_REASONING_KINDS.includes(kind) ? { enabled: true, level: 'low' } : { enabled: false, level: 'global' };
}

/** Dropdown options for the endpoint-wide strength: Model Default first, then each level the record says the
 *  endpoint accepts. An unanswered levels question falls back to the universally accepted levels. */
export function reasoningLevelOptions(
  capability: ReasoningCapability | null | undefined,
): { value: ReasoningLevel; label: string }[] {
  const levels = capability?.levels ?? SAFE_REASONING_EFFORTS;
  const accepted = REASONING_LEVELS.filter((v) => v === 'auto' || levels.includes(v));
  return accepted.map((v) => ({ value: v, label: REASONING_LEVEL_LABELS[v] }));
}

/** Dropdown options for a prompt's strength: Global first, then the endpoint-wide list. */
export function promptReasoningLevelOptions(
  capability: ReasoningCapability | null | undefined,
): { value: PromptReasoningLevel; label: string }[] {
  return [{ value: 'global', label: REASONING_LEVEL_LABELS.global }, ...reasoningLevelOptions(capability)];
}

/**
 * Inline mode's narration call writes its own `<think>` block in the same completion, so native reasoning stays
 * off on that one call regardless of its per-prompt choice. Every other kind and mode follows its own choice.
 */
export function nativeReasoningSuppressed(mode: ThinkingMode, kind: AIRequestType): boolean {
  return mode === 'inline' && kind === 'narration';
}

/**
 * True when reasoning is engaged somewhere: a Thinking mode, a global native effort level, or a per-prompt
 * positive level (the shipped defaults include several). When false, callers send no `reasoning_effort` at all
 * and skip the support probe.
 */
export function isReasoningEngaged(
  mode: ThinkingMode,
  globalEffort: ReasoningEffort,
  promptReasoning: Record<string, PromptReasoning>,
): boolean {
  const positive = (v: PromptReasoning) => v !== 'global' && v !== 'none';
  return mode !== 'off' || globalEffort !== 'auto' || Object.values(promptReasoning).some(positive);
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
 * Builds the `thinking_budget_tokens` slice of a request body — the LOCAL-engine reasoning cap (node-llama-cpp
 * `budgets.thoughtTokens`), sent only when the local engine is active. `effort` is the prompt's resolved choice
 * from `resolvePromptReasoning`: `none` (switched off, a Global prompt under a switched-off global, or Inline
 * narration) sends 0, since the local engine ignores `reasoning_effort` and this is how it's suppressed there.
 * Anything else sends `round(pct% × maxTokens)`. Always returns the field, so `0` cleanly means "off".
 */
export function reasoningBudgetBody(
  effort: ReasoningEffort,
  kind: AIRequestType,
  budgets: Partial<Record<AIRequestType, number>>,
  maxTokens: number,
): { thinking_budget_tokens: number } {
  const pct = effort === 'none' ? 0 : resolveReasoningBudgetPct(kind, budgets);
  return { thinking_budget_tokens: Math.round((pct / 100) * maxTokens) };
}

/**
 * Builds the `reasoning_effort` slice of a request body, spread into the body so an empty result adds no field.
 * `auto` omits the field (send nothing → endpoint default); any level maps to itself.
 *
 * The field is sent ONLY when the record lists that literal among the levels the endpoint accepts, and never
 * to a model the record says does not reason. An unanswered levels question sends nothing too, so a backend
 * that rejects even `none` (e.g. LM Studio on a non-reasoning model) is never hit with the field before
 * something answers for it.
 */
export function reasoningEffortBody(
  effort: ReasoningEffort,
  capability?: ReasoningCapability | null,
): { reasoning_effort?: ReasoningEffortField } {
  const value: ReasoningEffortField | null = effort === 'auto' ? null : effort;
  if (value === null) return {};
  if (reasoningRuledOut(capability)) return {};
  if (!capability?.levels?.includes(value)) return {};
  return { reasoning_effort: value };
}

/** The endpoint-and-model pair one resolve runs against. */
export interface ReasoningTarget {
  readonly url: string;
  readonly token: string;
  readonly model: string;
}

/** The fetch a resolve uses. Injected so every backend shape is tested without a server. */
export type ResolverFetch = (url: string, init?: RequestInit) => Promise<Response>;

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
  const reasoning = caps && typeof caps === 'object' ? (caps as Record<string, unknown>).reasoning : undefined;
  // A model listed without the object does not reason. The budget stays unanswered there: nothing has
  // tested whether the endpoint takes the field for such a model.
  if (!reasoning || typeof reasoning !== 'object') return nonReasoningCapability('native');
  const allowed = (reasoning as { allowed_options?: unknown }).allowed_options;
  const levels = Array.isArray(allowed)
    ? orUnknown(dedupeLevels(allowed.map((o) => LM_STUDIO_LEVELS[String(o)]).filter(isEffortField)))
    : null;
  return {
    reasons: true,
    levels,
    budget: true,
    sources: { reasons: 'native', budget: 'native', ...(levels ? { levels: 'native' as const } : {}) },
  };
};

/**
 * Ollama's show endpoint (`POST {origin}/api/show`). Its `capabilities` array names `thinking` for a model
 * that reasons. The array is omitted rather than emptied when the server has nothing to say, so a body
 * without it is inconclusive and never a no. Ollama advertises no strengths and no budget.
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
  if (!capabilities.includes('thinking')) return nonReasoningCapability('native');
  return { reasons: true, levels: null, budget: null, sources: { reasons: 'native' } };
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
    sources: { levels: 'native' },
  };
};

/** The parameter names a gateway lists when it takes a reasoning field of some kind. */
const GATEWAY_REASONING_PARAMS: readonly string[] = ['reasoning', 'reasoning_effort', 'include_reasoning'];

/**
 * A gateway's OpenAI-shaped model list. An entry may carry a `reasoning` object, which is present only for
 * a reasoning model and whose `supported_efforts` name the strengths the gateway accepts; a `mandatory`
 * model rejects `none`, so that literal is dropped and switching off omits the field instead. An entry with
 * only a `supported_parameters` list answers the reasons question alone. A plain OpenAI list carries
 * neither and says nothing.
 */
const gatewaySource: NativeSource = async (target, doFetch, signal) => {
  const urls = deriveModelsUrls(target.url);
  if (!urls) return null;
  const body = await readAdvertisement(urls.openai, doFetch, { headers: authHeaders(target.token) }, signal);
  const data = body?.data;
  if (!Array.isArray(data)) return null;
  const entry = data.find((m) => (m as { id?: unknown }).id === target.model);
  if (!entry || typeof entry !== 'object') return null; // model not listed → inconclusive

  const reasoning = (entry as { reasoning?: unknown }).reasoning;
  if (reasoning && typeof reasoning === 'object') {
    const { supported_efforts: efforts, mandatory } = reasoning as Record<string, unknown>;
    let levels = Array.isArray(efforts) ? dedupeLevels(efforts.filter(isEffortField)) : null;
    if (levels && mandatory === true) levels = levels.filter((l) => l !== 'none');
    levels = levels && orUnknown(levels);
    return {
      reasons: true,
      levels,
      budget: null,
      sources: { reasons: 'native', ...(levels ? { levels: 'native' as const } : {}) },
    };
  }

  const params = (entry as { supported_parameters?: unknown }).supported_parameters;
  if (!Array.isArray(params)) return null;
  return params.some((p) => GATEWAY_REASONING_PARAMS.includes(String(p)))
    ? { reasons: true, levels: null, budget: null, sources: { reasons: 'native' } }
    : nonReasoningCapability('native');
};

/** The advertisement sources, cheapest and most specific first. Each is tried only until one answers. */
const NATIVE_SOURCES: readonly NativeSource[] = [lmStudioSource, ollamaSource, llamaCppSource, gatewaySource];

/**
 * The one completion a resolve may send, and only when nothing advertised. It asks for the `none` literal:
 * a rejection proves the endpoint exposes no reasoning field at all, so the model does not reason.
 * Acceptance proves only that the field parses, so the reasons question stays open on the safe levels.
 */
async function probeNoneLiteral(
  target: ReasoningTarget,
  doFetch: ResolverFetch,
  signal?: AbortSignal,
): Promise<ReasoningCapability | null> {
  try {
    const res = await doFetch(target.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(target.token) },
      body: JSON.stringify({
        model: target.model,
        messages: [{ role: 'user', content: '.' }],
        max_tokens: 1,
        stream: false,
        reasoning_effort: 'none',
      }),
      signal,
    });
    // Drain the tiny body so the connection frees promptly.
    await res.text().catch(() => undefined);
    if (res.status === 400) return nonReasoningCapability('probe');
    if (res.status === 200) {
      return { reasons: null, levels: [...SAFE_REASONING_EFFORTS], budget: null, sources: { levels: 'probe' } };
    }
    return null; // auth/5xx/other → inconclusive
  } catch {
    return null; // network/abort → inconclusive
  }
}

/**
 * Resolves one endpoint-and-model pair's capability record. It walks the advertisement sources in order and
 * returns the first that answers, so a backend that publishes its own capabilities is never sent a test
 * completion. Only when none of them answers does it send the single probe.
 *
 * Returns `null` when nothing answered conclusively, so a caller keeps its fallback and its cache entry
 * rather than storing a wrong record.
 */
export async function resolveReasoningCapability(
  target: ReasoningTarget,
  doFetch: ResolverFetch = fetch,
  signal?: AbortSignal,
): Promise<ReasoningCapability | null> {
  if (!originOf(target.url)) return null; // a half-typed endpoint gets no request at all
  let gathered: ReasoningCapability | null = null;
  for (const source of NATIVE_SOURCES) {
    const answer = await source(target, doFetch, signal);
    if (!answer) continue;
    // The earlier source wins: it is the more specific one, so a later source only fills its gaps.
    gathered = gathered ? mergeReasoningCapability(answer, gathered) : answer;
    // Only the reasons question ends the chain. A source that names the strengths but not whether the
    // model thinks (llama.cpp) leaves the question open, so the next source still gets to answer it.
    if (gathered.reasons !== null) return gathered;
  }
  const probed = await probeNoneLiteral(target, doFetch, signal);
  if (!probed) return gathered;
  // An advertisement outranks the probe, which only learns whether the field parses.
  return gathered ? mergeReasoningCapability(probed, gathered) : probed;
}

/**
 * Whether a stored record still wants resolving: nothing stored at all, or an answer only the cache
 * vouches for. A record written before this session's advertisement sources existed carries `cache` as its
 * source, and whatever levels were stored with it, so it is asked again and a live source replaces them.
 */
export function reasoningNeedsResolve(capability: ReasoningCapability | null | undefined): boolean {
  if (!capability) return true;
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
  const pick = <K extends 'reasons' | 'levels' | 'budget'>(question: K): ReasoningCapability[K] =>
    (fresh[question] !== null ? fresh[question] : stored[question]);
  return {
    reasons: pick('reasons'),
    levels: pick('levels'),
    budget: pick('budget'),
    sources: { ...stored.sources, ...fresh.sources },
  };
}
