// Scores a selection-fixture trial under the involved-entity rule (involved-rescore-findings.md).
import type { ProbeExchange, ProbeTrialEvidence } from './narration-tool-call-probe';

export interface ScoredTrial {
  arm: string;
  scenario: string;
  seed: number;
  completed: boolean;
  failure?: string;
  /** Involved entities whose full entry a lookup returned. */
  involvedFetched: number;
  involvedTotal: number;
  /** Lookups that matched only entities the action does not involve. */
  unneeded: number;
  /** Lookups that matched nothing. */
  unmatched: number;
  /** Lookups of an entity already fetched in the trial. */
  duplicates: number;
  rounds: number;
  firstRoundReasoning: number;
  laterReasoning: number;
  promptTokens: number[];
  finishReason: string | null;
  /** The paired arm's first response matched this one, ignoring call ids. */
  firstResponseMatchesPair: boolean;
}

export interface ArmSummary {
  trials: number;
  completed: number;
  involvedFetched: number;
  involvedTotal: number;
  unneeded: number;
  unmatched: number;
  duplicates: number;
  firstRoundReasoning: number;
  laterReasoning: number;
  firstResponseMatchesPair: number;
  failures: Record<string, number>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const numberAt = (value: unknown, ...path: string[]): number => {
  let current: unknown = value;
  for (const key of path) current = isRecord(current) ? current[key] : undefined;
  return typeof current === 'number' ? current : 0;
};
const firstChoice = (exchange: ProbeExchange | undefined): Record<string, unknown> | null => {
  const choices = isRecord(exchange?.response) ? exchange.response.choices : undefined;
  return Array.isArray(choices) && isRecord(choices[0]) ? choices[0] : null;
};

export function scoreSelectionTrial(trial: ProbeTrialEvidence, required: readonly string[],
  labels: Pick<ScoredTrial, 'arm' | 'scenario' | 'seed' | 'firstResponseMatchesPair'>): ScoredTrial {
  const fetched = new Set<string>();
  let unneeded = 0;
  let unmatched = 0;
  let duplicates = 0;
  for (const lookup of trial.toolResults) {
    const names = lookup.result.matches.map((entry) => entry.name);
    if (names.length === 0) { unmatched++; continue; }
    if (names.every((name) => fetched.has(name))) { duplicates++; continue; }
    if (!names.some((name) => required.includes(name))) unneeded++;
    for (const name of names) fetched.add(name);
  }
  const reasoning = trial.requests.map((exchange) => numberAt(exchange.response, 'usage', 'completion_tokens_details', 'reasoning_tokens'));
  const finish = firstChoice(trial.requests.at(-1))?.finish_reason;
  return {
    ...labels,
    completed: trial.status === 'succeeded',
    ...(trial.failure ? { failure: trial.failure.kind } : {}),
    involvedFetched: required.filter((name) => fetched.has(name)).length,
    involvedTotal: required.length,
    unneeded, unmatched, duplicates,
    rounds: trial.requests.length,
    firstRoundReasoning: reasoning[0] ?? 0,
    laterReasoning: reasoning.slice(1).reduce((sum, value) => sum + value, 0),
    promptTokens: trial.requests.map((exchange) => numberAt(exchange.response, 'usage', 'prompt_tokens')),
    finishReason: typeof finish === 'string' ? finish : null,
  };
}

/** The first response's message with server-issued call ids removed, for pairing two arms that share round 0. */
export function normalizedFirstResponse(trial: ProbeTrialEvidence): unknown {
  const message = firstChoice(trial.requests[0])?.message;
  if (!isRecord(message)) return null;
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  return { ...message, tool_calls: calls.map((call) => isRecord(call) ? { ...call, id: undefined } : call) };
}

export function summarizeArm(scored: readonly ScoredTrial[]): ArmSummary {
  const summary: ArmSummary = { trials: scored.length, completed: 0, involvedFetched: 0, involvedTotal: 0, unneeded: 0, unmatched: 0,
    duplicates: 0, firstRoundReasoning: 0, laterReasoning: 0, firstResponseMatchesPair: 0, failures: {} };
  for (const item of scored) {
    if (item.completed) summary.completed++;
    summary.involvedFetched += item.involvedFetched;
    summary.involvedTotal += item.involvedTotal;
    summary.unneeded += item.unneeded;
    summary.unmatched += item.unmatched;
    summary.duplicates += item.duplicates;
    summary.firstRoundReasoning += item.firstRoundReasoning;
    summary.laterReasoning += item.laterReasoning;
    if (item.firstResponseMatchesPair) summary.firstResponseMatchesPair++;
    if (item.failure) summary.failures[item.failure] = (summary.failures[item.failure] ?? 0) + 1;
  }
  return summary;
}
