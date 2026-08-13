import type { AiRequestBody, AiRequestSpec } from './aiRequestSpec';

/** Why a stream failed. `parse` is reported per bad line as a debug event, never thrown — a malformed
 *  frame is skipped so the rest of the stream still arrives. */
export type AiStreamErrorKind = 'http' | 'no-body' | 'parse';

export class AiStreamError extends Error {
  readonly kind: AiStreamErrorKind;
  readonly status?: number;
  readonly response?: Response;

  constructor(kind: AiStreamErrorKind, message: string, detail?: { status?: number; response?: Response; cause?: unknown }) {
    super(message, { cause: detail?.cause });
    this.name = 'AiStreamError';
    this.kind = kind;
    this.status = detail?.status;
    this.response = detail?.response;
  }
}

/** Clock marks for one stream, in the injected clock's units. `firstTokenAt` is the first token of any kind
 *  and `firstContentAt` the first visible one, so their gap is the think time. Null means it never arrived. */
export interface AiStreamTimings {
  startedAt: number;
  firstTokenAt: number | null;
  firstContentAt: number | null;
  endedAt: number;
}

export interface AiStreamResult {
  content: string;
  reasoningText: string;
  /** The endpoint's own `finish_reason`, or `aborted` when the caller stopped the turn. */
  finishReason: string | null;
  timings: AiStreamTimings;
}

export type AiStreamDebug =
  | { kind: 'request'; url: string; body: AiRequestBody; startedAt: number }
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

/** One decoded stream frame, as much of it as this layer reads. */
interface FrameDelta {
  content: string;
  reasoning: string;
  finishReason: string | null;
}

/** Live-reasoning cadence. Exported because a consumer driving its own reasoning source (an inline
 *  `<think>` body, which rides `content` and so arrives unthrottled) must match this beat. */
export const DEFAULT_REASONING_THROTTLE_MS = 80;

/** The finish reason a caller-stopped turn ends with. Compared against by consumers, so it is a constant
 *  rather than a literal they can mistype. */
export const ABORTED_FINISH_REASON = 'aborted';

/** Reads one `data:` line. Returns null for a non-data line, the `[DONE]` sentinel, or a frame with nothing in it. */
function parseFrame(line: string): FrameDelta | null {
  if (!line.startsWith('data: ')) return null;
  const data = line.slice(6);
  if (data === '[DONE]') return null;
  const parsed = JSON.parse(data);
  const choice = parsed.choices?.[0];
  return {
    content: choice?.delta?.content || '',
    // A native reasoning model streams its scratchpad in a separate field; some backends name it
    // `reasoning_content`. Inline <think> stays in `content` and is the consumer's to strip.
    reasoning: choice?.delta?.reasoning ?? choice?.delta?.reasoning_content ?? '',
    finishReason: choice?.finish_reason ?? null,
  };
}

/**
 * Performs one streaming chat-completions request and yields its typed events.
 *
 * Lines are buffered across reads, so a payload split across network chunks is never parsed half-formed.
 * A malformed line is skipped and surfaced as a `parse` debug event. Aborting ends the stream gracefully:
 * the `done` event still carries everything received before the stop, with `aborted` as the finish reason.
 * HTTP failures and a missing body throw `AiStreamError`.
 */
export async function* streamAiRequest(spec: AiRequestSpec, options: AiStreamOptions = {}): AsyncGenerator<AiStreamEvent, void, void> {
  const doFetch = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => performance.now());
  const throttleMs = options.reasoningThrottleMs ?? DEFAULT_REASONING_THROTTLE_MS;
  const { signal } = options;

  const startedAt = now();
  let content = '';
  let reasoningText = '';
  let finishReason: string | null = null;
  let firstTokenAt: number | null = null;
  let firstContentAt: number | null = null;
  let lastReasoningTick = -Infinity;

  const result = (): AiStreamResult => ({
    content,
    reasoningText,
    finishReason,
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

  if (!response.ok) throw new AiStreamError('http', `HTTP ${response.status}`, { status: response.status, response });
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
    if (frame.content) content += frame.content;
    const tick = now();
    if (firstTokenAt === null && (frame.content || frame.reasoning)) firstTokenAt = tick;
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
