import type { WireMessage } from '@/types';
import { redactUrl } from '@/lib/redactUrl';
import type { AiRequestBody, AiRequestSpec } from './aiRequestSpec';
import { noteImagesDropped } from './localEngineImageDrop';

/** Why a stream failed. `parse` is reported per bad line as a debug event, never thrown — a malformed
 *  frame is skipped so the rest of the stream still arrives. `cut-thought`: the server stopped the reply
 *  on its token limit before any answer or call. */
export type AiStreamErrorKind = 'http' | 'no-body' | 'parse' | 'cut-thought';

/** Structured detail an endpoint returned with an HTTP failure, when it supplied an OpenAI-style error body. */
export interface AiServerError {
  message?: string;
  parameter?: string;
  type?: string;
  code?: string;
}

export class AiStreamError extends Error {
  readonly kind: AiStreamErrorKind;
  readonly status?: number;
  readonly response?: Response;
  readonly serverError?: AiServerError;
  /** The Error Details text: the request, the status, the server's fields and its raw body. */
  readonly details?: string;

  constructor(kind: AiStreamErrorKind, message: string, detail?: {
    status?: number; response?: Response; serverError?: AiServerError; details?: string; cause?: unknown;
  }) {
    super(message, { cause: detail?.cause });
    this.name = 'AiStreamError';
    this.kind = kind;
    this.status = detail?.status;
    this.response = detail?.response;
    this.serverError = detail?.serverError;
    this.details = detail?.details;
  }
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** The structured fields of an OpenAI-compatible error body, or nothing when the body is empty or malformed. */
function parseServerError(raw: string): AiServerError | undefined {
  if (!raw.trim()) return undefined;
  try {
    const payload = recordOf(JSON.parse(raw));
    const error = recordOf(payload?.error) ?? payload;
    if (!error) return undefined;
    const message = typeof error.message === 'string' ? error.message : undefined;
    const parameter = typeof error.param === 'string'
      ? error.param
      : typeof error.parameter === 'string' ? error.parameter : undefined;
    const type = typeof error.type === 'string' ? error.type : undefined;
    const code = typeof error.code === 'string' || typeof error.code === 'number' ? String(error.code) : undefined;
    return message || parameter || type || code ? { message, parameter, type, code } : undefined;
  } catch {
    return undefined;
  }
}

/** The Error Details lines that name the request. */
const requestLines = (spec: AiStreamSpec): string[] =>
  [`Request: POST ${redactUrl(spec.url)}`, spec.body.model ? `Model: ${spec.body.model}` : ''].filter(Boolean);

/** The error for a reply the server stopped on its token limit before any answer or call. */
export function cutThoughtFailure(spec: AiStreamSpec): AiStreamError {
  const limit = spec.body.max_tokens === undefined ? [] : [`max_tokens: ${spec.body.max_tokens}`];
  return new AiStreamError('cut-thought', 'The model reached its token limit before it wrote an answer', {
    details: [...requestLines(spec), ...limit].join('\n'),
  });
}

/** The error for an HTTP failure. The body is read once; its raw text goes into the details beside the parsed fields. */
async function httpFailure(response: Response, spec: AiStreamSpec): Promise<AiStreamError> {
  let raw = '';
  try {
    if (typeof response.text === 'function') raw = await response.text();
  } catch { /* An unreadable body leaves only the status. */ }
  const serverError = parseServerError(raw);
  const lines = [
    ...requestLines(spec),
    `Status: ${[response.status, response.statusText].filter(Boolean).join(' ')}`,
    serverError?.message && `Message: ${serverError.message}`,
    serverError?.parameter && `Param: ${serverError.parameter}`,
    serverError?.type && `Type: ${serverError.type}`,
    serverError?.code && `Code: ${serverError.code}`,
  ].filter(Boolean);
  return new AiStreamError('http', `HTTP ${response.status}`, {
    status: response.status,
    response,
    serverError,
    details: [...lines, '', 'Response:', raw.trim() ? raw : '(empty)'].join('\n'),
  });
}

/** Clock marks for one stream, in the injected clock's units. `firstTokenAt` is the first token of any kind
 *  and `firstContentAt` the first visible one, so their gap is the think time. Null means it never arrived. */
export interface AiStreamTimings {
  startedAt: number;
  firstTokenAt: number | null;
  firstContentAt: number | null;
  endedAt: number;
}

/** One function call the model made, reassembled from its streamed pieces. `arguments` is the raw JSON text. */
export interface AiToolCall {
  id: string;
  name: string;
  arguments: string;
}

/** The field a native reasoning model streams its scratchpad in. A reply echoes it back under the same name. */
export type AiReasoningField = 'reasoning' | 'reasoning_content';

export interface AiStreamResult {
  content: string;
  reasoningText: string;
  /** Which field carried the reasoning; null where none arrived. */
  reasoningField: AiReasoningField | null;
  /** The endpoint's own `finish_reason`, or `aborted` when the caller stopped the turn. */
  finishReason: string | null;
  /** The calls the model made this response, in index order. Empty for a plain reply. */
  toolCalls: AiToolCall[];
  timings: AiStreamTimings;
}

export type AiStreamDebug =
  | { kind: 'request'; url: string; body: AiRequestBody<WireMessage>; startedAt: number }
  /** The endpoint accepted the request and has a body to stream — the first point a consumer can commit
   *  to this turn, since everything before it can still throw. */
  | { kind: 'response'; status: number; openedAt: number }
  | { kind: 'parse'; line: string; error: AiStreamError };

export type AiStreamEvent =
  | { type: 'delta'; delta: string; content: string }
  | { type: 'reasoning'; text: string }
  | { type: 'debug'; debug: AiStreamDebug }
  | { type: 'done'; result: AiStreamResult };

export interface AiStreamOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Live-reasoning cadence; 0 emits every reasoning token. */
  reasoningThrottleMs?: number;
}

/** One streamed piece of a tool call. The first piece names the call; later pieces extend its arguments. */
interface ToolCallPiece {
  /** The call's position in the response. Absent on servers that stream calls one after another. */
  index: number | null;
  id: string;
  name: string;
  arguments: string;
}

/** One decoded stream frame, as much of it as this layer reads. */
interface FrameDelta {
  content: string;
  reasoning: string;
  reasoningField: AiReasoningField | null;
  toolCalls: ToolCallPiece[];
  finishReason: string | null;
}

/** Live-reasoning cadence. Exported because a consumer driving its own reasoning source (an inline
 *  `<think>` body, which rides `content` and so arrives unthrottled) must match this beat. */
export const DEFAULT_REASONING_THROTTLE_MS = 80;

/** The finish reason a caller-stopped turn ends with. Compared against by consumers, so it is a constant
 *  rather than a literal they can mistype. */
export const ABORTED_FINISH_REASON = 'aborted';

/** The finish reason of a reply cut at a cap: the server's own, or the Answer Cap. */
export const LENGTH_FINISH_REASON = 'length';

/** Reads one `data:` line. Returns null for a non-data line, the `[DONE]` sentinel, or a frame with nothing in it. */
function parseFrame(line: string): FrameDelta | null {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6);
  if (data === '[DONE]') return null;
  const parsed = JSON.parse(data);
  const choice = parsed.choices?.[0];
  const delta = recordOf(choice?.delta);
  // A native reasoning model streams its scratchpad in a separate field; some backends name it
  // `reasoning_content`. Inline <think> stays in `content` and is the consumer's to strip.
  const reasoningField: AiReasoningField | null = typeof delta?.reasoning === 'string' && delta.reasoning
    ? 'reasoning'
    : typeof delta?.reasoning_content === 'string' && delta.reasoning_content ? 'reasoning_content' : null;
  const rawCalls = Array.isArray(delta?.tool_calls) ? delta.tool_calls : [];
  return {
    content: typeof delta?.content === 'string' ? delta.content : '',
    reasoning: reasoningField ? String(delta?.[reasoningField]) : '',
    reasoningField,
    toolCalls: rawCalls.flatMap((raw): ToolCallPiece[] => {
      const piece = recordOf(raw);
      if (!piece) return [];
      const fn = recordOf(piece.function);
      return [{
        index: typeof piece.index === 'number' ? piece.index : null,
        id: typeof piece.id === 'string' ? piece.id : '',
        name: typeof fn?.name === 'string' ? fn.name : '',
        arguments: typeof fn?.arguments === 'string' ? fn.arguments : '',
      }];
    }),
    finishReason: choice?.finish_reason ?? null,
  };
}

/** Fold one streamed piece into the calls so far. A piece with an index extends the call at that index; one
 *  without extends the last call unless it names a function, which starts a new call. */
function foldToolCall(calls: AiToolCall[], byIndex: Map<number, AiToolCall>, piece: ToolCallPiece): void {
  const existing = piece.index !== null ? byIndex.get(piece.index) : piece.name ? undefined : calls.at(-1);
  if (existing) {
    if (piece.id) existing.id ||= piece.id;
    if (piece.name) existing.name ||= piece.name;
    existing.arguments += piece.arguments;
    return;
  }
  const call: AiToolCall = { id: piece.id, name: piece.name, arguments: piece.arguments };
  calls.push(call);
  if (piece.index !== null) byIndex.set(piece.index, call);
}

/** Any round's request: the caller's plain messages, or a tool round's follow-up with its wider roles. */
export type AiStreamSpec = AiRequestSpec<WireMessage>;

/**
 * Performs one streaming chat-completions request and yields its typed events.
 *
 * Lines are buffered across reads, so a payload split across network chunks is never parsed half-formed.
 * A malformed line is skipped and surfaced as a `parse` debug event. Aborting ends the stream gracefully:
 * the `done` event still carries everything received before the stop, with `aborted` as the finish reason.
 * HTTP failures and a missing body throw `AiStreamError`.
 */
export async function* streamAiRequest(spec: AiStreamSpec, options: AiStreamOptions = {}): AsyncGenerator<AiStreamEvent, void, void> {
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => performance.now());
  const throttleMs = options.reasoningThrottleMs ?? DEFAULT_REASONING_THROTTLE_MS;
  const { signal } = options;

  const startedAt = now();
  let content = '';
  let reasoningText = '';
  let reasoningField: AiReasoningField | null = null;
  let finishReason: string | null = null;
  const toolCalls: AiToolCall[] = [];
  const callsByIndex = new Map<number, AiToolCall>();
  let firstTokenAt: number | null = null;
  let firstContentAt: number | null = null;
  let lastReasoningTick = -Infinity;

  const result = (): AiStreamResult => ({
    content,
    reasoningText,
    reasoningField,
    finishReason,
    toolCalls,
    timings: { startedAt, firstTokenAt, firstContentAt, endedAt: now() },
  });

  yield { type: 'debug', debug: { kind: 'request', url: spec.url, body: spec.body, startedAt } };

  let response: Response;
  try {
    response = await doFetch(spec.url, {
      method: 'POST',
      headers: spec.headers,
      body: JSON.stringify(spec.body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error as Error).name === 'AbortError') {
      finishReason = ABORTED_FINISH_REASON;
      yield { type: 'done', result: result() };
      return;
    }
    throw error;
  }

  if (!response.ok) throw await httpFailure(response, spec);
  noteImagesDropped(response);
  if (!response.body) throw new AiStreamError('no-body', 'Response has no body to stream');

  yield { type: 'debug', debug: { kind: 'response', status: response.status, openedAt: now() } };

  const reader = response.body.getReader();
  // Unblock a pending read the instant the turn is aborted, so we stop consuming even if the server
  // keeps streaming after we disconnect.
  const cancelOnAbort = () => { reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancelOnAbort, { once: true });

  const decoder = new TextDecoder();
  let buffer = '';
  const pending: AiStreamEvent[] = [];

  const consume = (line: string) => {
    let frame: FrameDelta | null;
    try {
      frame = parseFrame(line);
    } catch (error) {
      pending.push({
        type: 'debug',
        debug: { kind: 'parse', line, error: new AiStreamError('parse', 'Malformed stream frame', { cause: error }) },
      });
      return;
    }
    if (!frame) return;

    if (frame.reasoning) reasoningText += frame.reasoning;
    reasoningField ??= frame.reasoningField;
    if (frame.content) content += frame.content;
    for (const piece of frame.toolCalls) foldToolCall(toolCalls, callsByIndex, piece);
    const tick = now();
    if (firstTokenAt === null && (frame.content || frame.reasoning || frame.toolCalls.length)) firstTokenAt = tick;
    // Visible content, not merely a content frame: models routinely lead with a newline or a space, and
    // treating that as the start would both mis-time the think duration and cut live reasoning off early.
    if (firstContentAt === null && content.trim()) firstContentAt = tick;
    if (frame.finishReason) finishReason = frame.finishReason;

    if (frame.content) pending.push({ type: 'delta', delta: frame.content, content });
    // Live reasoning only matters before the visible output starts, and is throttled so a token-rate
    // scratchpad doesn't drive a re-render per token.
    if (frame.reasoning && firstContentAt === null && tick - lastReasoningTick >= throttleMs) {
      lastReasoningTick = tick;
      pending.push({ type: 'reasoning', text: reasoningText });
    }
  };

  try {
    while (true) {
      if (signal?.aborted) break;
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        // A stop press errors the body under an in-flight read, so the rejection is the abort arriving —
        // not a failure. Anything else is a real transport error and belongs to the caller.
        if (signal?.aborted || (error as Error).name === 'AbortError') break;
        throw error;
      }
      const { done, value } = chunk;
      if (done) break;
      // Dispatch only complete lines; the trailing partial line (and any partial multi-byte char, via
      // `{ stream: true }`) carries into the next read.
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) consume(line);
      while (pending.length) yield pending.shift() as AiStreamEvent;
    }

    if (signal?.aborted) {
      finishReason = ABORTED_FINISH_REASON;
      yield { type: 'done', result: result() };
      return;
    }

    // Flush the decoder and a final line that arrived without a trailing newline.
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer.trim());
    while (pending.length) yield pending.shift() as AiStreamEvent;

    yield { type: 'done', result: result() };
  } finally {
    signal?.removeEventListener('abort', cancelOnAbort);
  }
}
