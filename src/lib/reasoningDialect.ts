import type { ReasoningEffortField } from '@/lib/reasoningEffort';

/**
 * Which spelling of the reasoning fields an endpoint takes. Several chat-completions APIs carry the same two
 * ideas — a token budget and an off switch — under different keys, and some reject the spelling the others
 * accept. `unknown` is the default and sends what the app has always sent.
 */
export const REASONING_DIALECTS = [
  'unknown', 'engine', 'openai', 'lmstudio', 'vllm', 'openrouter',
  'anthropic', 'google-2.5', 'google-3', 'moonshot-k3', 'moonshot-k2',
] as const;

export type ReasoningDialect = (typeof REASONING_DIALECTS)[number];

export const isReasoningDialect = (v: unknown): v is ReasoningDialect =>
  REASONING_DIALECTS.includes(v as ReasoningDialect);

/** What Settings calls one wire field, so the AI Context viewer can name it in the player's words. */
type FieldLabel = 'Effort' | 'Budget' | 'Reasoning';

/** One field a dialect writes, named by its path from the body root. */
interface FieldWrite {
  readonly path: readonly string[];
  readonly value: string | number;
  /** The settings word for this field. `Reasoning` is the switch itself. */
  readonly label: FieldLabel;
}

/**
 * How one dialect spells the reasoning fields. The request builder reads nothing else.
 *
 * Off comes in three shapes. A dialect that carries the `none` literal needs no row of its own: the ordinary
 * level write says it, under the same guard as any other literal, so a server nothing has answered for is
 * never sent the field. A dialect whose off signal is its own field names it in `off`, which only a dialect
 * named from the endpoint's identity can do. And a dialect that refuses off sets `offRejected`.
 */
export interface DialectSpelling {
  /** Where the token budget goes. Absent where the dialect takes no budget. */
  readonly budgetPath?: readonly string[];
  /** Fields written beside a budget, such as Anthropic's `thinking.type`. */
  readonly budgetWith?: readonly FieldWrite[];
  /** Where the effort literal goes. Absent where the dialect sends no level. */
  readonly levelPath?: readonly string[];
  /** The token budget this dialect substitutes for each level, where it spells strength as a budget rather
   *  than as a literal. Written to `budgetPath`, and only when no budget of the player's own went there. */
  readonly levelBudgets?: Partial<Record<ReasoningEffortField, number>>;
  /** This dialect's own spelling of "do not reason", which replaces the budget and level writes. Absent
   *  where the `none` literal already says it. */
  readonly off?: readonly FieldWrite[];
  /** Set where the endpoint rejects a budget of zero, so a switched-off prompt sends the switch alone. */
  readonly noBudgetWhenOff?: true;
  /** Set where the endpoint rejects a switched-off request, so `none` sends no reasoning field at all. */
  readonly offRejected?: true;
  /** Set where the budget must sit below the request's output cap. */
  readonly budgetUnderCap?: true;
  /** Set where nothing the endpoint publishes says whether it separates reasoning at all, so both controls
   *  wait for one reply to prove it. Until then the record's budget answer stays unanswered. */
  readonly controlsNeedProof?: true;
}

const EFFORT_PATH = ['reasoning_effort'] as const;
const THINKING_DISABLED: readonly FieldWrite[] = [{ path: ['thinking', 'type'], value: 'disabled', label: 'Reasoning' }];

/**
 * Every dialect's spelling, one row each. Adding an endpoint family is one row here and one request-spec
 * case, never a branch in the builder.
 *
 * Sources, read live on 2026-09-15 and 2026-09-16: vLLM's reasoning-outputs guide (`thinking_token_budget`);
 * OpenRouter's reasoning-tokens guide (`reasoning.effort`, `reasoning.max_tokens`, `effort: none` to
 * disable); Anthropic's OpenAI SDK compatibility page (`thinking.type`, `thinking.budget_tokens`, and
 * `reasoning_effort` listed as ignored); Google's OpenAI compatibility page (`google.thinking_config`, with
 * `thinking_budget` on 2.5 and `thinking_level` on 3.x, and the documented budget per effort); Kimi's chat
 * API reference (k3 takes `reasoning_effort` and always thinks, k2.6 switches with `thinking.type`).
 */
export const DIALECT_SPELLINGS: Record<ReasoningDialect, DialectSpelling> = {
  // What the app sends wherever nothing has named a dialect. This row is the compatibility contract: change
  // it and every endpoint the app has never identified gets a different body.
  unknown: { budgetPath: ['thinking_budget_tokens'], levelPath: EFFORT_PATH },
  // The bundled engine caps by tokens and ignores an effort literal, so it is sent none.
  engine: { budgetPath: ['thinking_budget_tokens'] },
  openai: { levelPath: EFFORT_PATH },
  lmstudio: { budgetPath: ['thinking_budget_tokens'], levelPath: EFFORT_PATH },
  // Both carry `none` themselves, so off rides the ordinary level write. Neither takes a zero budget.
  // A vLLM server separates its reasoning only when its operator started one with a reasoning parser, and no
  // model list says so, so this row shows nothing until a reply proves it.
  vllm: {
    budgetPath: ['thinking_token_budget'], levelPath: EFFORT_PATH, noBudgetWhenOff: true, controlsNeedProof: true,
  },
  openrouter: {
    budgetPath: ['reasoning', 'max_tokens'],
    levelPath: ['reasoning', 'effort'],
    noBudgetWhenOff: true,
  },
  anthropic: {
    budgetPath: ['thinking', 'budget_tokens'],
    budgetWith: [{ path: ['thinking', 'type'], value: 'enabled', label: 'Reasoning' }],
    budgetUnderCap: true,
    off: THINKING_DISABLED,
  },
  // 2.5 spells strength as a budget, so the level maps onto the same field the slider writes. Google rejects
  // an effort literal beside a thinking config, so off is the literal alone. The ladder stops at `high`,
  // which is what Google documents; the record's levels answer keeps a player off the rungs above it.
  'google-2.5': {
    budgetPath: ['google', 'thinking_config', 'thinking_budget'],
    levelBudgets: { minimal: 1024, low: 1024, medium: 8192, high: 24576 },
    off: [{ path: EFFORT_PATH, value: 'none', label: 'Effort' }],
  },
  'google-3': { levelPath: ['google', 'thinking_config', 'thinking_level'], offRejected: true },
  'moonshot-k3': { levelPath: EFFORT_PATH, offRejected: true },
  'moonshot-k2': { off: THINKING_DISABLED },
};

/** Every field shape a dialect writes. One optional per spelling, so the table and the body type move together. */
export interface ReasoningBodyFields {
  thinking_budget_tokens?: number;
  thinking_token_budget?: number;
  reasoning_effort?: ReasoningEffortField;
  reasoning?: { effort?: ReasoningEffortField; max_tokens?: number };
  thinking?: { type?: 'enabled' | 'disabled'; budget_tokens?: number };
  google?: { thinking_config?: { thinking_budget?: number; thinking_level?: string } };
}

/** What one request wants to say about reasoning, before any dialect spells it. */
export interface ReasoningWrite {
  /** The effort literal the record cleared for sending. */
  readonly level: ReasoningEffortField | null;
  /** The token budget, where the target takes one. */
  readonly budget: number | null;
  /** True when the resolved choice is off, reasoning is engaged, and the record has not ruled the model out.
   *  Only then may a dialect spell off in a field of its own. */
  readonly off: boolean;
  /** The request's output cap, for the dialects that keep the budget under it. */
  readonly maxTokens?: number;
}

/** True where the dialect rejects a switched-off request, so the switch is shown checked and locked. */
export function reasoningOffRejected(dialect: ReasoningDialect): boolean {
  return DIALECT_SPELLINGS[dialect].offRejected === true;
}

/**
 * True where the dialect publishes nothing about its own reasoning, so both controls wait until one reply
 * shows a separate reasoning field. The record's budget answer carries that proof.
 */
export function reasoningDialectNeedsProof(dialect: ReasoningDialect): boolean {
  return DIALECT_SPELLINGS[dialect].controlsNeedProof === true;
}

/** True where the dialect names a field for the token budget, so the budget slider is worth showing. */
export function reasoningDialectTakesBudget(dialect: ReasoningDialect): boolean {
  return DIALECT_SPELLINGS[dialect].budgetPath !== undefined;
}

/** True where the dialect carries an effort literal, so the strength dropdown is worth showing. */
export function reasoningDialectTakesLevel(dialect: ReasoningDialect): boolean {
  const spelling = DIALECT_SPELLINGS[dialect];
  return spelling.levelPath !== undefined || spelling.levelBudgets !== undefined;
}

/** Writes one value at its path, building the objects the path passes through. */
function writePath(body: Record<string, unknown>, path: readonly string[], value: string | number): void {
  let node = body;
  for (const key of path.slice(0, -1)) {
    if (!node[key] || typeof node[key] !== 'object') node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[path[path.length - 1]] = value;
}

/** Reads the value at a path, or `undefined` when the body does not carry it. `0` reads as present. */
function readPath(body: unknown, path: readonly string[]): string | number | undefined {
  let node: unknown = body;
  for (const key of path) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return typeof node === 'string' || typeof node === 'number' ? node : undefined;
}

/**
 * The reasoning slice of one request body, in the target dialect's spelling.
 *
 * A dialect that rejects off sends nothing at all for a switched-off prompt, since the only thing it could
 * send is a field the endpoint refuses. A dialect that names its own off field sends that alone: those
 * endpoints reject a budget beside it. Everything else sends the budget and the level its row names, and a
 * row that takes no zero budget drops the budget while off.
 */
export function reasoningDialectBody(dialect: ReasoningDialect, write: ReasoningWrite): ReasoningBodyFields {
  const spelling = DIALECT_SPELLINGS[dialect];
  const body: Record<string, unknown> = {};
  // The generic path writer builds a plain object; the row it followed is what types it.
  const typed = () => body as unknown as ReasoningBodyFields;

  if (write.off) {
    if (spelling.offRejected) return typed();
    if (spelling.off) {
      for (const field of spelling.off) writePath(body, field.path, field.value);
      return typed();
    }
  }

  let budgetWritten = false;
  if (write.budget !== null && spelling.budgetPath && !(write.off && spelling.noBudgetWhenOff)) {
    const cap = spelling.budgetUnderCap && write.maxTokens !== undefined
      ? Math.max(0, Math.min(write.budget, write.maxTokens - 1))
      : write.budget;
    writePath(body, spelling.budgetPath, cap);
    for (const field of spelling.budgetWith ?? []) writePath(body, field.path, field.value);
    budgetWritten = true;
  }

  if (write.level !== null) {
    if (spelling.levelPath) writePath(body, spelling.levelPath, write.level);
    // A dialect that spells strength as a budget has only the one field, so the player's own budget wins it.
    else if (spelling.levelBudgets && spelling.budgetPath && !budgetWritten) {
      const mapped = spelling.levelBudgets[write.level];
      if (mapped !== undefined) writePath(body, spelling.budgetPath, mapped);
    }
  }

  return typed();
}

/** One reasoning field a request carried, as the endpoint received it. */
export interface ReasoningWireField {
  /** What Settings calls it. */
  label: FieldLabel;
  /** What the body calls it, dotted where the dialect nests it. */
  name: string;
  value: string | number;
}

/**
 * The reasoning fields a built body carries, read back through the dialect that wrote them, so the AI
 * Context viewer reports the spelling that went out rather than one the app resolved a second time.
 */
export function reasoningWireFields(dialect: ReasoningDialect, body: ReasoningBodyFields): ReasoningWireField[] {
  const spelling = DIALECT_SPELLINGS[dialect];
  const slots: { label: FieldLabel; path: readonly string[] }[] = [
    ...(spelling.levelPath ? [{ label: 'Effort' as const, path: spelling.levelPath }] : []),
    ...(spelling.budgetPath ? [{ label: 'Budget' as const, path: spelling.budgetPath }] : []),
    ...(spelling.budgetWith ?? []).map((f) => ({ label: f.label, path: f.path })),
    ...(spelling.off ?? []).map((f) => ({ label: f.label, path: f.path })),
  ];
  const fields: ReasoningWireField[] = [];
  const seen = new Set<string>();
  for (const slot of slots) {
    const name = slot.path.join('.');
    if (seen.has(name)) continue;
    const value = readPath(body, slot.path);
    if (value === undefined) continue;
    seen.add(name);
    fields.push({ label: slot.label, name, value });
  }
  return fields;
}
