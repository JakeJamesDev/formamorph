import type { ThinkingMode, ReasoningEffort } from '@/contexts/SettingsContext';
import type { AIRequestType } from '@/types';
import { probeKnownAbsent, recordProbeStatus } from '@/lib/probeMemo';

/** The `reasoning_effort` values a chat-completions endpoint may accept as a passthrough hint. `auto` is
 *  deliberately absent — it isn't a wire value; the UI's "Default" maps to sending nothing. */
export type ReasoningEffortField = Exclude<ReasoningEffort, 'auto'>;

/** Every effort literal the app knows to probe for, in canonical display order (least → most thinking).
 *  Different backends accept different subsets (e.g. cloud takes `minimal`, Ollama takes `max`), so the
 *  actual tabs shown are whichever of these the active endpoint returns 200 for — see `detectSupportedReasoningEfforts`. */
export const REASONING_CANDIDATES: readonly ReasoningEffortField[] = [
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
];

/** Universal fallback shown before detection runs (or when it can't) — accepted by every backend tested. */
export const SAFE_REASONING_EFFORTS: readonly ReasoningEffortField[] = ['none', 'low', 'medium', 'high'];

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

/** Dropdown options for the endpoint-wide strength: Model Default first, then each level the endpoint accepts.
 *  Unknown support (`null`/undefined) falls back to the universally accepted levels. */
export function reasoningLevelOptions(
  supported: readonly ReasoningEffortField[] | null | undefined,
): { value: ReasoningLevel; label: string }[] {
  const levels = supported ?? SAFE_REASONING_EFFORTS;
  const accepted = REASONING_LEVELS.filter((v) => v === 'auto' || levels.includes(v));
  return accepted.map((v) => ({ value: v, label: REASONING_LEVEL_LABELS[v] }));
}

/** Dropdown options for a prompt's strength: Global first, then the endpoint-wide list. */
export function promptReasoningLevelOptions(
  supported: readonly ReasoningEffortField[] | null | undefined,
): { value: PromptReasoningLevel; label: string }[] {
  return [{ value: 'global', label: REASONING_LEVEL_LABELS.global }, ...reasoningLevelOptions(supported)];
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
 * The field is sent ONLY when `supported` is a non-empty list that includes the value — i.e. we've probed the
 * active endpoint and confirmed it accepts that literal. An unknown (`null`/`undefined`, not yet probed) or a
 * conclusively non-reasoning endpoint (`[]`) sends nothing, so a backend that rejects even `none` (e.g. LM Studio
 * on a non-reasoning model) is never hit with the field. A reasoning-capable endpoint gets the hint once its
 * probe caches. A no-op on models without native reasoning.
 */
export function reasoningEffortBody(
  effort: ReasoningEffort,
  supported?: readonly ReasoningEffortField[] | null,
): { reasoning_effort?: ReasoningEffortField } {
  const value: ReasoningEffortField | null = effort === 'auto' ? null : effort;
  if (value === null) return {};
  if (!supported || !supported.includes(value)) return {};
  return { reasoning_effort: value };
}

/**
 * Best-effort check of whether the active model natively reasons, via LM Studio's native REST API
 * (`{origin}/api/v1/models` → `models[].capabilities.reasoning`, an object present only for reasoning
 * models). LM Studio silently ignores an unsupported `reasoning_effort` (HTTP 200 + a server-side warning),
 * so the effort probe can't tell — this can. Returns `false` when the model is listed without a reasoning
 * capability, `true` when it has one, and `null` when the check doesn't apply (not LM Studio, model absent
 * from the list, or the endpoint is unreachable) so callers keep probing / fall back.
 */
export async function detectReasoningCapability(
  endpointUrl: string,
  token: string,
  model: string,
  signal?: AbortSignal,
): Promise<boolean | null> {
  let origin: string;
  try {
    origin = new URL(endpointUrl).origin;
  } catch {
    return null;
  }
  // Skipped once this session has seen the native list 404 (probeMemo) — not LM Studio, and that won't
  // change without an endpoint change.
  const nativeUrl = `${origin}/api/v1/models`;
  if (probeKnownAbsent(nativeUrl)) return null;
  try {
    const res = await fetch(nativeUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    });
    recordProbeStatus(nativeUrl, res.status);
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const models = (json as { models?: unknown }).models;
    if (!Array.isArray(models)) return null; // not the LM Studio native shape
    // Match by exact key; if the configured name doesn't map to one (e.g. the literal "default", which makes
    // LM Studio serve whatever's loaded), fall back to the single loaded model so capability still resolves.
    const loaded = (m: unknown) => Array.isArray((m as { loaded_instances?: unknown }).loaded_instances) && (m as { loaded_instances: unknown[] }).loaded_instances.length > 0;
    const entry = models.find((m) => (m as { key?: unknown }).key === model) ?? models.find(loaded);
    if (!entry || typeof entry !== 'object') return null; // model not listed → inconclusive
    const caps = (entry as { capabilities?: unknown }).capabilities;
    const reasoning = caps && typeof caps === 'object' ? (caps as Record<string, unknown>).reasoning : undefined;
    return !!reasoning;
  } catch {
    return null; // network/abort → inconclusive
  }
}

/**
 * Probes an endpoint for which `reasoning_effort` literals it accepts by sending a minimal request per
 * candidate and keeping the ones that return HTTP 200 (400 = rejected). Returns the accepted list, `[]` when
 * the endpoint rejects even `none` (a conclusively non-reasoning model), or `null` if the probe is inconclusive
 * (network/auth/5xx on any candidate) so callers keep their fallback rather than narrowing to a wrong set.
 *
 * First consults `detectReasoningCapability` (LM Studio's native model list): a positively non-reasoning model
 * returns `[]` immediately, without sending any `reasoning_effort` probe — LM Studio would otherwise 200-and-warn
 * on every one. Otherwise `none` is probed first and short-circuits: if the backend rejects it, the model exposes
 * no reasoning fields, so we return `[]` without sending the other six candidates.
 */
export async function detectSupportedReasoningEfforts(
  url: string,
  token: string,
  model: string,
  signal?: AbortSignal,
): Promise<ReasoningEffortField[] | null> {
  const probe = async (value: ReasoningEffortField): Promise<boolean | null> => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: '.' }],
          max_tokens: 1,
          stream: false,
          reasoning_effort: value,
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
  };

  const capability = await detectReasoningCapability(url, token, model, signal);
  if (capability === false) return []; // backend advertises this model as non-reasoning

  const noneAccepted = await probe('none');
  if (noneAccepted === null) return null; // inconclusive → keep fallback
  if (noneAccepted === false) return []; // rejects `none` → non-reasoning; skip the rest

  const rest = REASONING_CANDIDATES.filter((v) => v !== 'none');
  const results = await Promise.all(rest.map(probe));
  if (results.some((r) => r === null)) return null; // couldn't cleanly classify → keep fallback
  return ['none', ...rest.filter((_, i) => results[i])];
}
