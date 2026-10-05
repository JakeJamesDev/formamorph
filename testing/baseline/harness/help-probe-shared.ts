/** What the help probes share: the settings snapshot and the summary math. */
import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { HELP_PICK_SYSTEM_PROMPT } from '@/lib/formaquestion/helpPrompt';
import { pickMessage, type PickQuestion } from '@/lib/formaquestion/helpPicks';
import { UNKNOWN_REASONING_CAPABILITY } from '@/lib/reasoningEffort';

export interface ProbeTarget {
  endpoint: string;
  model: string;
  token: string;
}

/** The app's settings against one endpoint. With `tools`, the endpoint takes function calls, so the help session picks lookup mode. */
export function probeSnapshot(target: ProbeTarget, tools = false): AiSettingsSnapshot {
  return {
    resolveTarget: () => ({
      endpointId: 'probe', url: target.endpoint, apiToken: target.token, model: target.model, maxTokens: undefined, localEngine: false,
      samplerOverrides: defaultEndpointSamplerOverrides(),
      reasoning: tools ? { ...UNKNOWN_REASONING_CAPABILITY, tools: true, sources: { tools: 'probe' } } : UNKNOWN_REASONING_CAPABILITY,
    }),
    thinkingMode: 'off', reasoningEffort: 'auto', reasoningEngaged: false, promptReasoning: {},
    promptReasoningBudget: {}, promptSamplers: {}, promptMaxOutput: {},
    genTemperature: 0.9, genRepetitionPenalty: 1.1, genTopP: 0.95, genTopK: 40, genMinP: 0.05,
    paragraphLimit: 'none', disableThinking: false,
  };
}

/** Tokens in and out, summed over the requests of one question. */
export interface Usage { promptTokens: number; answerTokens: number; requests: number }
export const noUsage = (): Usage => ({ promptTokens: 0, answerTokens: 0, requests: 0 });

export interface Completion {
  choices?: { message?: { content?: string | null; tool_calls?: { id?: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Sends one request body with streaming off and reasoning off, and adds its token counts to `usage`. */
export async function send(url: RequestInfo | URL, init: RequestInit | undefined, usage: Usage): Promise<Completion | Response> {
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
  const response = await fetch(url, { ...init, body: JSON.stringify({ ...body, stream: false, reasoning_effort: 'none' }) });
  if (!response.ok) return response;
  const json = await response.json() as Completion;
  usage.requests++;
  usage.promptTokens += json.usage?.prompt_tokens ?? 0;
  usage.answerTokens += json.usage?.completion_tokens ?? 0;
  return json;
}

/**
 * A fetch for the help session: each request goes out through `send` and comes back as the stream the session
 * reads. `onCompletion` sees each request's body and its completion.
 */
export function sessionFetch(usage: Usage, onCompletion?: (body: { messages: { content: unknown }[] }, completion: Completion) => void): typeof fetch {
  return (async (url: RequestInfo | URL, init?: RequestInit) => {
    const result = await send(url, init, usage);
    if (result instanceof Response) return result;
    onCompletion?.(JSON.parse(String(init?.body)), result);
    const choice = result.choices?.[0];
    const frame = (delta: Record<string, unknown>, finish: string | null = null) =>
      `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finish }] })}\n\n`;
    const frames = [
      ...(choice?.message?.content ? [frame({ content: choice.message.content })] : []),
      ...(choice?.message?.tool_calls ?? []).map((call, at) => frame({ tool_calls: [{ index: at, id: call.id ?? `call-${at}`, type: 'function', function: call.function }] })),
      frame({}, choice?.finish_reason ?? 'stop'),
      'data: [DONE]\n\n',
    ];
    return new Response(frames.join(''), { headers: { 'Content-Type': 'text/event-stream' } });
  }) as typeof fetch;
}

/**
 * A fetch that sends each pick request without the earlier answer, as before ticket 45. It ends the probe when
 * the app's message is not `ask` as `pickMessage` writes it, so the control drops the answer and nothing else.
 * The help session reads a thrown error as a failed pick, so a mismatch exits instead.
 */
export function withoutEarlierAnswer(fetchImpl: typeof fetch, lines: readonly string[], ask: Omit<PickQuestion, 'prompt'>): typeof fetch {
  return ((url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { messages: { role: string; content: unknown }[] };
    // The system prompt can carry a suffix, such as `/no_think`.
    if (!String(body.messages[0]?.content).startsWith(HELP_PICK_SYSTEM_PROMPT)) return fetchImpl(url, init);
    if (body.messages[1]?.content !== pickMessage(lines, ask)) {
      console.error(`pick-old: the pick message of "${ask.question}" is not the one the control rebuilds`);
      process.exit(1);
    }
    body.messages[1] = { ...body.messages[1], content: pickMessage(lines, { ...ask, earlierAnswer: undefined }) };
    return fetchImpl(url, { ...init, body: JSON.stringify(body) });
  }) as typeof fetch;
}

/** `n` of `d` as a right-aligned percent, or a dash for none. */
export const pct = (n: number, d: number) => (d === 0 ? '  –' : `${Math.round((100 * n) / d).toString().padStart(3)}%`);

export const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** The share of the keyed facts the answer names, case-insensitive. */
export const factShare = (facts: string[], answer: string) =>
  facts.length ? facts.filter((fact) => answer.toLowerCase().includes(fact.toLowerCase())).length / facts.length : 0;
