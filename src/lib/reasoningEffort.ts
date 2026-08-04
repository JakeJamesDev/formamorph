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

/** Short tab labels; `auto` renders as "Default" (send nothing). */
const REASONING_LABELS: Record<ReasoningEffort, string> = {
  auto: 'Default', none: 'None', minimal: 'Min', low: 'Low', medium: 'Med', high: 'High', xhigh: 'XHigh', max: 'Max',
};

/**
 * The tabs to render for the Native Reasoning control: always "Default" (omit the field) first, then each
 * supported level in canonical order. Pass the endpoint's detected set, or `null`/undefined before detection
 * completes to fall back to the universally-accepted levels.
 */
export function reasoningTabs(
  supported: readonly ReasoningEffortField[] | null | undefined,
): { value: ReasoningEffort; label: string }[] {
  const levels = supported ?? SAFE_REASONING_EFFORTS;
  const ordered = REASONING_CANDIDATES.filter((v) => levels.includes(v));
  return [{ value: 'auto' as ReasoningEffort, label: REASONING_LABELS.auto }, ...ordered.map((v) => ({ value: v, label: REASONING_LABELS[v] }))];
}

/** A prompt's per-prompt reasoning choice: `global` inherits the endpoint-wide level (Settings → Generation →
 *  Native Reasoning); otherwise it's an explicit level. Only narration and choices expose this — see
 *  `REASONING_CONTROL_KINDS`; every other prompt is hardwired to `none` under Native mode. */
export type PromptReasoning = 'global' | ReasoningEffortField;

/** The only prompts with an interactive per-prompt reasoning control (Native mode only). */
export const REASONING_CONTROL_KINDS: readonly AIRequestType[] = ['narration', 'choices'];

/**
 * True when the user has opted into reasoning somewhere: a Thinking mode, a global native effort level, or a
 * per-prompt positive level. When false, callers send no `reasoning_effort` at all and skip the support probe —
 * so a plain endpoint (e.g. LM Studio) isn't hit with reasoning fields it rejects.
 */
export function isReasoningEngaged(
  mode: ThinkingMode,
  globalEffort: ReasoningEffort,
  promptReasoning: Record<string, PromptReasoning>,
): boolean {
  const positive = (v: PromptReasoning) => v !== 'global' && v !== 'none';
  return mode !== 'off' || globalEffort !== 'auto' || Object.values(promptReasoning).some(positive);
}

/** Shipped default per prompt: narration follows the global level, everything else suppresses reasoning. */
export function defaultPromptReasoning(kind: AIRequestType): PromptReasoning {
  return kind === 'narration' ? 'global' : 'none';
}

/** Tabs for a prompt's reasoning control: `Global` first, then the endpoint's supported levels (incl. `none`). */
export function reasoningPromptTabs(
  supported: readonly ReasoningEffortField[] | null | undefined,
): { value: PromptReasoning; label: string }[] {
  const levels = reasoningTabs(supported).slice(1); // drop the "Default" (omit) entry — "Global" replaces it here
  return [{ value: 'global', label: 'Global' }, ...levels.map((l) => ({ value: l.value as PromptReasoning, label: l.label }))];
}

/**
 * Resolves the effective reasoning effort for one request under Native mode: a controlled prompt uses its stored
 * choice (or its shipped default), an uncontrolled prompt is forced to `none`; `global` folds in the endpoint-wide
 * level. The result is fed to `reasoningEffortBody`, which handles guided-mode suppression and the endpoint guard.
 */
export function resolvePromptReasoning(
  kind: AIRequestType,
  prefs: Record<string, PromptReasoning>,
  globalEffort: ReasoningEffort,
): ReasoningEffort {
  const pref = REASONING_CONTROL_KINDS.includes(kind) ? (prefs[kind] ?? defaultPromptReasoning(kind)) : 'none';
  return pref === 'global' ? globalEffort : pref;
}

/** Shipped default reasoning budget (percent of max output) per prompt: narration reasons, others are off (0%). */
export function defaultReasoningBudgetPct(kind: AIRequestType): number {
  return kind === 'narration' ? 40 : 0;
}

/** The effective budget percent for a request: a controlled prompt uses its stored value (or shipped default),
 *  every other prompt is 0 (no reasoning). Clamped to 0–100. */
export function resolveReasoningBudgetPct(kind: AIRequestType, budgets: Partial<Record<AIRequestType, number>>): number {
  const pct = REASONING_CONTROL_KINDS.includes(kind) ? (budgets[kind] ?? defaultReasoningBudgetPct(kind)) : 0;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Builds the `thinking_budget_tokens` slice of a request body — the LOCAL-engine reasoning cap (node-llama-cpp
 * `budgets.thoughtTokens`), sent only when the local engine is active. Guided modes and uncontrolled prompts
 * force 0 (no reasoning — the local engine ignores `reasoning_effort`, so this is how they're suppressed there);
 * a controlled prompt under Native mode sends `round(pct% × maxTokens)`. Always returns the field on the local
 * engine, so `0` cleanly means "off".
 */
export function reasoningBudgetBody(
  mode: ThinkingMode,
  kind: AIRequestType,
  budgets: Partial<Record<AIRequestType, number>>,
  maxTokens: number,
): { thinking_budget_tokens: number } {
  const pct = mode !== 'off' ? 0 : resolveReasoningBudgetPct(kind, budgets);
  return { thinking_budget_tokens: Math.round((pct / 100) * maxTokens) };
}

/**
 * Builds the `reasoning_effort` slice of a request body, spread into the body so an empty result adds no field.
 *
 * The guided modes (`inline`/`precall`/`staged`) drive their own thinking, so they force `none` to suppress a
 * native model's reasoning fighting the guided step. Native mode passes the chosen hint through: `auto` omits
 * the field (send nothing → endpoint default), any level maps to itself.
 *
 * The field is sent ONLY when `supported` is a non-empty list that includes the value — i.e. we've probed the
 * active endpoint and confirmed it accepts that literal. An unknown (`null`/`undefined`, not yet probed) or a
 * conclusively non-reasoning endpoint (`[]`) sends nothing, so a backend that rejects even `none` (e.g. LM Studio
 * on a non-reasoning model) is never hit with the field. A reasoning-capable endpoint gets the hint once its
 * probe caches. A no-op on models without native reasoning.
 */
export function reasoningEffortBody(
  mode: ThinkingMode,
  effort: ReasoningEffort,
  supported?: readonly ReasoningEffortField[] | null,
): { reasoning_effort?: ReasoningEffortField } {
  const value: ReasoningEffortField | null = mode !== 'off' ? 'none' : effort === 'auto' ? null : effort;
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
