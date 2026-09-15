import type { ReasoningDialect } from '@/lib/reasoningDialect';
import type { ReasoningEffortField } from '@/lib/reasoningEffort';

/**
 * What one row proves about one model. The resolver stamps where the answer came from, so no source
 * vocabulary lives here.
 */
export interface ReasoningIdentityAnswer {
  readonly dialect: ReasoningDialect;
  /** Whether the model reasons. `false` beside an empty `levels` hides every Native Reasoning control. */
  readonly reasons: boolean;
  /** The effort literals the endpoint accepts. An empty list hides the dropdown; `null` leaves it open. */
  readonly levels: readonly ReasoningEffortField[] | null;
  /** Whether the endpoint takes a token budget, which is what shows the slider. */
  readonly budget: boolean;
  /** Whether this model accepts a switched-off request. Omit it to let the dialect's own row decide. */
  readonly offAllowed?: boolean;
}

/** One first-party API, and what its model ids mean. */
export interface ReasoningIdentityRow {
  /** Hostnames this row claims, compared against the endpoint URL's hostname. */
  readonly hosts: readonly string[];
  /** What this host says about one lowercased model id, or `null` where it claims no answer for it. */
  readonly match: (modelId: string) => ReasoningIdentityAnswer | null;
}

/** The record for a model its own vendor gives no thinking parameter at all. */
const NO_THINKING: ReasoningIdentityAnswer = { dialect: 'unknown', reasons: false, levels: [], budget: false };

/**
 * The generation a model id carries, as major times a hundred plus minor, so 4.6 reads 406. `pattern` must
 * capture the major first and the minor second, and every vendor's ids are read on this one scale.
 */
function generation(text: string, pattern: RegExp): number | null {
  const match = pattern.exec(text);
  if (!match) return null;
  return Number(match[1]) * 100 + Number(match[2] ?? 0);
}

/**
 * The generation in a Claude model id, so `claude-sonnet-4-6` reads 406. Both id shapes carry it: the newer
 * `claude-opus-4-5`, name first, and the older `claude-3-5-sonnet-20241022`, digits first. A trailing date is
 * not a minor version, so the minor is at most two digits.
 */
function claudeGeneration(modelId: string): number | null {
  return generation(modelId.slice('claude-'.length), /(?:^|-)(\d+)(?:-(\d{1,2}))?(?=-|$)/);
}

/** The generation in a Gemini model id, so `gemini-2.5-flash` reads 205. */
function geminiGeneration(modelId: string): number | null {
  return generation(modelId, /^gemini-(\d+)(?:\.(\d+))?(?=[-.]|$)/);
}

/** The Claude lines that cannot stop thinking, so a switched-off request is refused rather than honored. */
const ALWAYS_THINKING_LINES: readonly string[] = ['fable', 'mythos'];

/**
 * Anthropic's OpenAI-compatible endpoint, at `https://api.anthropic.com/v1/`. The compatibility page lists
 * `reasoning_effort` as ignored, so neither row offers a strength; thinking is configured by the `thinking`
 * parameter alone.
 *
 * The generation picks the row. Claude 4.7 and later, every 5.x included, reject `thinking.type: enabled`
 * with a 400 and take the adaptive shape instead. Claude 4.6 and earlier have manual budgets and nothing
 * else. Before 3.7 there is no thinking parameter to send, so those models are ruled out rather than shown
 * controls that would fail the turn. An id the pattern does not read is treated as a current model.
 *
 * The Fable and Mythos lines reject `thinking.type: disabled`, which the thinking page states outright, so
 * their switch locks on. Every other model takes the dialect row's own answer, which allows off.
 *
 * Read on 2026-09-15 from Anthropic's OpenAI SDK compatibility page (`reasoning_effort` ignored, `thinking`
 * in the body), its extended-thinking page (the 1,024-token floor, the under-cap rule, and the 400 that
 * `type: enabled` returns on Claude 4.7 and later), and its thinking page (the lines that refuse off).
 */
const ANTHROPIC_ROW: ReasoningIdentityRow = {
  hosts: ['api.anthropic.com'],
  match: (modelId) => {
    if (!modelId.startsWith('claude-')) return null;
    const generation = claudeGeneration(modelId);
    if (generation !== null && generation < 307) return NO_THINKING;
    if (generation !== null && generation <= 406) {
      return { dialect: 'anthropic-budget', reasons: true, levels: [], budget: true };
    }
    // The line is a whole name segment, so a bare `claude-fable` counts and `claude-fabletest` does not.
    const refusesOff = ALWAYS_THINKING_LINES.some(
      (line) => modelId === `claude-${line}` || modelId.startsWith(`claude-${line}-`),
    );
    return {
      dialect: 'anthropic-adaptive', reasons: true, levels: [], budget: false,
      ...(refusesOff ? { offAllowed: false } : {}),
    };
  },
};

/** The levels google-2.5 has a documented budget for, so the record offers no rung it cannot spell. */
const GOOGLE_25_LEVELS: readonly ReasoningEffortField[] = ['minimal', 'low', 'medium', 'high'];

/**
 * The thinking levels every Gemini 3 model accepts. Two of them also take `minimal`, and the OpenAI
 * compatibility page lists it for Gemini 3 Flash, but the per-model table does not give it to the rest. The
 * levels they agree on are offered, since a missing rung costs a player nothing and a rejected one fails the
 * turn.
 */
const GOOGLE_3_LEVELS: readonly ReasoningEffortField[] = ['low', 'medium', 'high'];

/**
 * Google's OpenAI-compatible endpoint, at `https://generativelanguage.googleapis.com/v1beta/openai/`. The
 * generation picks the spelling: 2.x from 2.5 takes a token budget in
 * `google.thinking_config.thinking_budget`, and 3 and later take a level in `thinking_level`. Each is a
 * range, so a later 2.x keeps the budget spelling rather than falling to the newer one. An unread Gemini id
 * is the current generation. Gemini 2.0 and 1.x carry no thinking config, and a model that is not a Gemini
 * one is left to the rest of the chain.
 *
 * Read on 2026-09-15 from Google's OpenAI compatibility and thinking pages.
 */
const GOOGLE_ROW: ReasoningIdentityRow = {
  hosts: ['generativelanguage.googleapis.com'],
  match: (modelId) => {
    if (!modelId.startsWith('gemini-')) return null;
    const generation = geminiGeneration(modelId);
    if (generation === null) return { dialect: 'google-3', reasons: true, levels: GOOGLE_3_LEVELS, budget: false };
    if (generation < 205) return NO_THINKING;
    return generation < 300
      ? { dialect: 'google-2.5', reasons: true, levels: GOOGLE_25_LEVELS, budget: true }
      : { dialect: 'google-3', reasons: true, levels: GOOGLE_3_LEVELS, budget: false };
  },
};

/** Every first-party API whose own address names its reasoning dialect. */
export const REASONING_IDENTITY_ROWS: readonly ReasoningIdentityRow[] = [ANTHROPIC_ROW, GOOGLE_ROW];

/**
 * The answer the endpoint's own identity proves, or `null` where no row claims the host or the model. It
 * reads the URL and the model id and sends no request, so a server that answers 200 to anything is never
 * mistaken for one of these.
 */
export function reasoningIdentityAnswer(
  endpointUrl: string,
  modelId: string,
): ReasoningIdentityAnswer | null {
  let hostname: string;
  try {
    hostname = new URL(endpointUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  const model = modelId.trim().toLowerCase();
  if (!model) return null;
  const row = REASONING_IDENTITY_ROWS.find((r) => r.hosts.includes(hostname));
  return row ? row.match(model) : null;
}
