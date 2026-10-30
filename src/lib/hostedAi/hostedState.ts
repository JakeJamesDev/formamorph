import { isReasoningDialect } from '@/lib/reasoningDialect';
import {
  REASONING_CANDIDATES, UNKNOWN_REASONING_CAPABILITY,
  type ReasoningCapability, type ReasoningEffortField,
} from '@/lib/reasoningEffort';

/** The states the hosted-state route itself reports. */
const SERVER_STATES = ['age-gate', 'locked', 'paused', 'exhausted', 'warned', 'ready'] as const;
type ServerState = (typeof SERVER_STATES)[number];

/** The served model's capability record, as the admin entered it. */
export interface HostedCapabilities {
  tools?: boolean;
  /** The reasoning dialect id, or null for a model that does not reason. */
  reasoning?: string | null;
  budget?: boolean;
  efforts?: string[];
}

/** The account's hosted state, as the hosted-state route answers it. */
export interface HostedState {
  tier: string | null;
  state: ServerState;
  window: number | null;
  maxTokens: number | null;
  tokenMargin: number | null;
  model: { id: string; capabilities: HostedCapabilities } | null;
  percentUsed: number | null;
  turnsLeft: number | null;
  resetAt: string | null;
  acknowledged: number[];
}

/** What the proxy reports after a call settles. */
export interface HostedUsage {
  percentUsed: number;
  turnsLeft: number | null;
  resetAt: string;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
export const recordOf = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;

/** Reads the route's `data`; null when it is not a hosted state. */
export function parseHostedState(raw: unknown): HostedState | null {
  const data = recordOf(raw);
  const state = data?.state;
  if (!data || !SERVER_STATES.includes(state as ServerState)) return null;
  const model = recordOf(data.model);
  const id = str(model?.id);
  return {
    tier: str(data.tier),
    state: state as ServerState,
    window: num(data.window),
    maxTokens: num(data.maxTokens),
    tokenMargin: num(data.tokenMargin),
    model: model && id ? { id, capabilities: (recordOf(model.capabilities) ?? {}) as HostedCapabilities } : null,
    percentUsed: num(data.percentUsed),
    turnsLeft: num(data.turnsLeft),
    resetAt: str(data.resetAt),
    acknowledged: Array.isArray(data.acknowledged) ? data.acknowledged.filter((n): n is number => typeof n === 'number') : [],
  };
}

/** Reads one `event: usage` payload; null when it is not one. */
export function parseHostedUsage(raw: unknown): HostedUsage | null {
  const data = recordOf(raw);
  const percentUsed = num(data?.percentUsed);
  const resetAt = str(data?.resetAt);
  if (percentUsed === null || resetAt === null) return null;
  return { percentUsed, turnsLeft: num(data?.turnsLeft), resetAt };
}

/** The prompt budget: the window less the server's estimate margin, or null with no window. */
export function hostedPromptWindow(state: HostedState | null): number | null {
  if (state?.window == null) return null;
  return Math.max(0, state.window - (state.tokenMargin ?? 0));
}

/** The served model's capability record, in the request layer's terms. A field the admin left out stays unknown. */
export function hostedReasoningCapability(capabilities: HostedCapabilities | undefined): ReasoningCapability {
  if (!capabilities) return UNKNOWN_REASONING_CAPABILITY;
  const { tools, reasoning, budget, efforts } = capabilities;
  const dialect = isReasoningDialect(reasoning) ? reasoning : 'unknown';
  // An explicit null says the model does not reason; an absent or unknown dialect says nothing.
  const reasons = reasoning === null ? false : dialect !== 'unknown' ? true : null;
  const levels = reasons === false
    ? []
    : Array.isArray(efforts)
      ? efforts.filter((e): e is ReasoningEffortField => REASONING_CANDIDATES.includes(e as ReasoningEffortField))
      : null;
  const known = <T,>(value: T | null) => value !== null && value !== undefined;
  const toolsAnswer = typeof tools === 'boolean' ? tools : null;
  const budgetAnswer = typeof budget === 'boolean' ? budget : null;
  return {
    ...UNKNOWN_REASONING_CAPABILITY,
    reasons,
    levels,
    budget: budgetAnswer,
    dialect,
    tools: toolsAnswer,
    sources: {
      ...(known(reasons) && { reasons: 'native' as const }),
      ...(known(levels) && { levels: 'native' as const }),
      ...(known(budgetAnswer) && { budget: 'native' as const }),
      ...(dialect !== 'unknown' && { dialect: 'native' as const }),
      ...(known(toolsAnswer) && { tools: 'native' as const }),
    },
  };
}
