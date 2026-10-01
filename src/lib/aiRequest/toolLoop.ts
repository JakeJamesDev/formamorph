import type { AssistantToolCallMessage, RequestMessage, Tool, ToolCallPart, WireMessage } from '@/types';
import { DEFAULT_TOOL_CALL_LIMIT } from '@/contexts/settingsDefaults';
import type { ToolCallFailure, ToolCallResult } from '@/lib/tools/toolRunner';
import type { OfferedFunction } from '@/lib/tools/toolSchema';
import { answerStart } from '@/lib/aiResponse';
import { CHARS_PER_TOKEN } from '@/lib/memoryUtils';
import { trimToLastSentence } from '@/lib/outputLength';
import type { AiRequestBody, AiRequestSpec } from './aiRequestSpec';
import {
  ABORTED_FINISH_REASON, cutThoughtFailure, LENGTH_FINISH_REASON, streamAiRequest,
  type AiReasoningField, type AiStreamEvent, type AiStreamOptions, type AiStreamResult, type AiStreamSpec, type AiToolCall,
} from './aiStream';

/**
 * The tool loop: one request that offers Tools, run to completion below the Turn Pipeline.
 *
 * A round that offers Tools holds whitespace-only content and streams live from its first visible character,
 * since models write no prose before a call. Ended without calls, the round is the reply. Ended with calls,
 * the content is dropped from the reply (`toolCalls` tells the consumer to clear what it showed), each call runs
 * through the caller's executor, and the next round carries the assistant message (content, calls and the
 * model's own reasoning under the field the server named) plus one `tool` result per call. A limit, a
 * malformed call or an unknown Tool sends one more round without Tools, so the model finishes in prose;
 * that round streams live. Tool rounds are silent requests: they are captured only when asked.
 *
 * Every round runs under the spec's Answer Cap, counted on that round's answer text alone. A round with a
 * cut thought throws, so its reasoning reaches no later round and the request fails like any other.
 */

/** Requests one call of the loop may send, tool rounds and the final round together. */
export const DEFAULT_TOOL_ROUND_CAP = 6;

/** Runs one call of `tool`, a Tool or an app-internal function, with the argument text the model streamed. Stop reaches it through `signal`. */
export type ToolExecutor<TTool extends OfferedFunction = Tool> =
  (tool: TTool, argumentsText: string, signal?: AbortSignal) => Promise<ToolCallResult>;

/** Why a call in a round produced an error result: the runner's own kinds, or a call the loop refused. */
export type AiToolRoundFailure = ToolCallFailure | 'unknown' | 'limit';

/** One call in a tool round, with the text the model read back. Its id is the outgoing one, as the next
 *  round's messages carry it. */
export interface AiToolRoundCall extends AiToolCall {
  result: string;
  failure?: AiToolRoundFailure;
}

/** One tool round, as the silent capture records it. */
export interface AiToolRound {
  /** 1-based position among this request's rounds. */
  index: number;
  /** The messages this round sent. */
  messages: WireMessage[];
  /** What the model wrote this round. It reaches the next round, never the reply. */
  content: string;
  reasoning: string;
  finishReason: string | null;
  calls: AiToolRoundCall[];
}

export type AiToolLoopEvent =
  | AiStreamEvent
  | { type: 'toolRound'; round: AiToolRound }
  /** A round ended with calls, and they are about to run. Any content that round streamed is not the reply. */
  | { type: 'toolCalls'; names: string[] }
  /** The round after the calls sent its first token, even a held one. */
  | { type: 'roundStarted' };

export interface AiToolLoopOptions<TTool extends OfferedFunction = Tool> extends AiStreamOptions {
  /** Runs the offered functions. Without it, the request goes out as the plain stream. */
  execute?: ToolExecutor<TTool>;
  /** Calls one offered function may make per request where it sets no limit of its own. */
  callLimit?: number;
  roundCap?: number;
  /** Show Silent Requests: emit a `toolRound` event per tool round. */
  captureRounds?: boolean;
}

/** Nine alphanumeric characters, which is what the strictest chat template accepts for a call id. */
const outgoingCallId = (n: number): string => n.toString(36).padStart(9, '0');

const errorResult = (error: string): string => JSON.stringify({ error });

/** Every round's reasoning as one text, blank rounds left out. */
const joinReasoning = (parts: readonly string[]): string => parts.filter((p) => p.trim()).join('\n\n');

/** A round the server stopped on its token limit before any answer text or call: its thought never finished. */
function isCutThought(result: AiStreamResult): boolean {
  if (result.finishReason !== LENGTH_FINISH_REASON || result.toolCalls.length > 0) return false;
  const at = answerStart(result.content);
  return at === null || !result.content.slice(at).trim();
}

/**
 * One request under the spec's Answer Cap. Answer text counts from the end of a leading reasoning block;
 * reasoning events and call arguments never count. Past the cap, the request is aborted and no delta runs
 * past the cut. `done` then carries the cut answer with no calls; narration's ends on its last sentence end.
 */
async function* streamCapped(spec: AiStreamSpec, options: AiStreamOptions): AsyncGenerator<AiStreamEvent, void, void> {
  if (spec.answerCap === undefined) {
    yield* streamAiRequest(spec, options);
    return;
  }
  const limit = spec.answerCap * CHARS_PER_TOKEN;
  const callerSignal = options.signal;
  const controller = new AbortController();
  const forwardStop = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', forwardStop, { once: true });
  // The content at the cap, once the answer passes it, and where its answer starts.
  let cut: string | null = null;
  let answerFrom = 0;

  try {
    for await (const event of streamAiRequest(spec, { ...options, signal: controller.signal })) {
      if (event.type === 'delta') {
        if (cut !== null) continue;
        const answerAt = answerStart(event.content);
        if (answerAt === null || event.content.length - answerAt <= limit) { yield event; continue; }
        answerFrom = answerAt;
        cut = event.content.slice(0, answerAt + limit);
        controller.abort();
        const delta = cut.slice(event.content.length - event.delta.length);
        if (delta) yield { type: 'delta', delta, content: cut };
      } else if (event.type === 'done' && cut !== null) {
        // A Stop that lands after the cut keeps what the consumer saw.
        const answer = spec.requestType === 'narration' ? trimToLastSentence(cut.slice(answerFrom)) : cut.slice(answerFrom);
        const result = callerSignal?.aborted
          ? { ...event.result, content: cut, toolCalls: [] }
          : { ...event.result, content: cut.slice(0, answerFrom) + answer, finishReason: LENGTH_FINISH_REASON, toolCalls: [] };
        yield { type: 'done', result };
      } else {
        yield event;
      }
    }
  } finally {
    callerSignal?.removeEventListener('abort', forwardStop);
  }
}

/**
 * Stream one request through the tool loop. Yields the stream's own events for the reply, `reasoning`
 * events carrying every round's thinking so far, and a `toolRound` per tool round when capturing. Without
 * Tools on the wire, this is the plain stream under the Answer Cap.
 */
export async function* streamAiToolLoop<TTool extends OfferedFunction = Tool>(
  spec: AiRequestSpec<RequestMessage, TTool>,
  options: AiToolLoopOptions<TTool>,
): AsyncGenerator<AiToolLoopEvent, void, void> {
  const tools = spec.tools;
  const { signal, execute } = options;
  if (!tools?.length || !spec.body.tools || !execute) {
    for await (const event of streamCapped(spec, options)) {
      if (event.type === 'done' && isCutThought(event.result)) throw cutThoughtFailure(spec);
      yield event;
    }
    return;
  }

  const callLimit = options.callLimit ?? DEFAULT_TOOL_CALL_LIMIT;
  const roundCap = options.roundCap ?? DEFAULT_TOOL_ROUND_CAP;
  const messages: WireMessage[] = [...spec.body.messages];
  // The body without Tools, for the finish-in-prose round.
  const { tools: _tools, tool_choice: _choice, ...plainBody } = spec.body;
  const callsMade = new Map<string, number>();
  const reasoningByRound: string[] = [];
  let reasoningField: AiReasoningField | null = null;
  let startedAt: number | null = null;
  let firstTokenAt: number | null = null;
  let issuedIds = 0;
  // Cleared by a limit, a malformed call or an unknown Tool: the next round then finishes in prose.
  let offerTools = true;
  // Set once a round's calls are answered, until the next round's first token.
  let answeredCalls = false;

  const finalResult = (round: AiStreamResult, content: string, finishReason: string | null): AiStreamResult => ({
    content,
    reasoningText: joinReasoning([...reasoningByRound, round.reasoningText]),
    reasoningField: round.reasoningField ?? reasoningField,
    finishReason,
    toolCalls: [],
    timings: {
      startedAt: startedAt ?? round.timings.startedAt,
      firstTokenAt: firstTokenAt ?? round.timings.firstTokenAt,
      firstContentAt: round.timings.firstContentAt,
      endedAt: round.timings.endedAt,
    },
  });

  /** One call: the Tool it names, its limit, then the executor. Every outcome is text the model can read. */
  const runCall = async (call: ToolCallPart): Promise<{ text: string; failure?: AiToolRoundFailure }> => {
    const tool = tools.find((t) => t.name === call.function.name);
    if (!tool) {
      const known = tools.map((t) => t.name).join(', ');
      return { text: errorResult(`Unknown Tool ${JSON.stringify(call.function.name)}. Tools: ${known}.`), failure: 'unknown' };
    }
    const limit = tool.callLimit ?? callLimit;
    const made = callsMade.get(tool.id) ?? 0;
    if (made >= limit) {
      const calls = limit === 1 ? '1 call' : `${limit} calls`;
      return { text: errorResult(`${tool.name} has reached its limit of ${calls} for this request.`), failure: 'limit' };
    }
    callsMade.set(tool.id, made + 1);
    try {
      return await execute(tool, call.function.arguments, signal);
    } catch (error) {
      return { text: errorResult(`The Tool failed: ${(error as Error).message}`), failure: 'handler' };
    }
  };

  for (let index = 1; ; index++) {
    const offering = offerTools && index < roundCap;
    const body: AiRequestBody<WireMessage> = offering ? { ...spec.body, messages: [...messages] } : { ...plainBody, messages: [...messages] };
    const roundSpec: AiStreamSpec = { ...spec, body };
    // Whitespace-only deltas of a Tools-offered round, until its first visible character.
    const held: AiStreamEvent[] = [];
    let live = !offering;
    let result: AiStreamResult | undefined;

    for await (const event of streamCapped(roundSpec, options)) {
      if (event.type === 'done') { result = event.result; break; }
      if (answeredCalls && (event.type === 'delta' || event.type === 'reasoning')) {
        answeredCalls = false;
        yield { type: 'roundStarted' };
      }
      if (event.type === 'delta') {
        if (!live && !event.content.trim()) { held.push(event); continue; }
        live = true;
        yield* held.splice(0);
        yield event;
      } else if (event.type === 'reasoning') {
        yield { type: 'reasoning', text: joinReasoning([...reasoningByRound, event.text]) };
      } else if (event.debug.kind !== 'response' || index === 1) {
        // One response debug for the loop: a consumer commits to the turn on it, and does so once.
        yield event;
      }
    }
    // The stream ends with `done` or throws; nothing else leaves the loop above.
    if (!result) return;
    startedAt ??= result.timings.startedAt;
    firstTokenAt ??= result.timings.firstTokenAt;
    reasoningField ??= result.reasoningField;

    if (result.finishReason === ABORTED_FINISH_REASON) {
      yield { type: 'done', result: finalResult(result, live ? result.content : '', ABORTED_FINISH_REASON) };
      return;
    }
    if (isCutThought(result)) throw cutThoughtFailure(roundSpec);
    if (!offering || result.toolCalls.length === 0) {
      for (const event of held) yield event;
      yield { type: 'done', result: finalResult(result, result.content, result.finishReason) };
      return;
    }

    const calls: ToolCallPart[] = result.toolCalls.map((call) => ({
      id: outgoingCallId(++issuedIds),
      type: 'function',
      function: { name: call.name, arguments: call.arguments },
    }));
    const assistant: AssistantToolCallMessage = {
      role: 'assistant',
      content: result.content || null,
      tool_calls: calls,
      ...(result.reasoningField && result.reasoningText ? { [result.reasoningField]: result.reasoningText } : {}),
    };
    messages.push(assistant);
    yield { type: 'toolCalls', names: calls.map((call) => call.function.name) };

    const roundCalls: AiToolRoundCall[] = [];
    for (const call of calls) {
      const outcome = await runCall(call);
      if (signal?.aborted) {
        yield { type: 'done', result: finalResult(result, '', ABORTED_FINISH_REASON) };
        return;
      }
      if (outcome.failure === 'unknown' || outcome.failure === 'limit' || outcome.failure === 'arguments') offerTools = false;
      messages.push({ role: 'tool', tool_call_id: call.id, content: outcome.text });
      roundCalls.push({
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments,
        result: outcome.text,
        ...(outcome.failure ? { failure: outcome.failure } : {}),
      });
    }
    if (options.captureRounds) {
      yield {
        type: 'toolRound',
        round: {
          index,
          messages: body.messages,
          content: result.content,
          reasoning: result.reasoningText,
          finishReason: result.finishReason,
          calls: roundCalls,
        },
      };
    }
    reasoningByRound.push(result.reasoningText);
    answeredCalls = true;
  }
}
