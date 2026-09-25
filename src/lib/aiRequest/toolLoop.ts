import type { AssistantToolCallMessage, Tool, ToolCallPart, WireMessage } from '@/types';
import { DEFAULT_TOOL_CALL_LIMIT } from '@/contexts/settingsDefaults';
import type { ToolCallFailure, ToolCallResult } from '@/lib/tools/toolRunner';
import type { AiRequestBody, AiRequestSpec } from './aiRequestSpec';
import {
  ABORTED_FINISH_REASON, streamAiRequest,
  type AiReasoningField, type AiStreamEvent, type AiStreamOptions, type AiStreamResult, type AiStreamSpec, type AiToolCall,
} from './aiStream';

/**
 * The tool loop: one request that offers Tools, run to completion below the Turn Pipeline.
 *
 * A round that offers Tools holds its content until it ends. Ended without calls, the held deltas flush in
 * order and the round is the reply. Ended with calls, the content is dropped from the reply, each call runs
 * through the caller's executor, and the next round carries the assistant message (content, calls and the
 * model's own reasoning under the field the server named) plus one `tool` result per call. A limit, a
 * malformed call or an unknown Tool sends one more round without Tools, so the model finishes in prose;
 * that round streams live. Tool rounds are silent requests: they are captured only when asked.
 */

/** Requests one call of the loop may send, tool rounds and the final round together. */
export const DEFAULT_TOOL_ROUND_CAP = 6;

/** Runs one call of `tool` with the argument text the model streamed. Stop reaches it through `signal`. */
export type ToolExecutor = (tool: Tool, argumentsText: string, signal?: AbortSignal) => Promise<ToolCallResult>;

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
  /** A round ended with calls, and they are about to run. */
  | { type: 'toolCalls'; names: string[] }
  /** The round after the calls sent its first token, held or not. */
  | { type: 'roundStarted' };

export interface AiToolLoopOptions extends AiStreamOptions {
  execute: ToolExecutor;
  /** Calls one Tool may make per request where the Tool sets no limit of its own. */
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

/**
 * Stream one request through the tool loop. Yields the stream's own events for the reply, `reasoning`
 * events carrying every round's thinking so far, and a `toolRound` per tool round when capturing. Without
 * Tools on the wire, this is the plain stream.
 */
export async function* streamAiToolLoop(
  spec: AiRequestSpec,
  options: AiToolLoopOptions,
): AsyncGenerator<AiToolLoopEvent, void, void> {
  const tools = spec.tools;
  if (!tools?.length || !spec.body.tools) {
    yield* streamAiRequest(spec, options);
    return;
  }

  const { signal, execute } = options;
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
    const held: AiStreamEvent[] = [];
    let result: AiStreamResult | undefined;

    for await (const event of streamAiRequest(roundSpec, options)) {
      if (event.type === 'done') { result = event.result; break; }
      if (answeredCalls && (event.type === 'delta' || event.type === 'reasoning')) {
        answeredCalls = false;
        yield { type: 'roundStarted' };
      }
      if (event.type === 'delta') {
        if (offering) held.push(event);
        else yield event;
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
      yield { type: 'done', result: finalResult(result, offering ? '' : result.content, ABORTED_FINISH_REASON) };
      return;
    }
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
