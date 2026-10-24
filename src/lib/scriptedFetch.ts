import type { RevealArrivalEvent } from './revealTestScripts';

/** One SSE frame of an OpenAI-style chat-completions stream. */
const frame = (delta: object, finishReason: string | null = null) =>
  `data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\n`;

/**
 * A `fetch` that answers every call with `text` streamed as chat-completion deltas at `schedule`'s
 * wall-clock times, so a request runs the real stream path without a server. Aborting the request's signal
 * stops the stream with an `AbortError`, as a real fetch does.
 */
export function scriptedFetch(text: string, schedule: RevealArrivalEvent[]): typeof fetch {
  return async (_input, init) => {
    const signal = init?.signal ?? undefined;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const startedAt = performance.now();
        let sent = 0;
        let i = 0;
        const onAbort = () => {
          if (timer !== null) clearTimeout(timer);
          controller.error(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        const step = () => {
          timer = null;
          while (i < schedule.length && performance.now() - startedAt >= schedule[i].atMs) {
            const chars = schedule[i++].chars;
            if (chars > sent) controller.enqueue(encoder.encode(frame({ content: text.slice(sent, chars) })));
            sent = Math.max(sent, chars);
          }
          if (i < schedule.length) {
            timer = setTimeout(step, Math.max(0, schedule[i].atMs - (performance.now() - startedAt)));
            return;
          }
          if (sent < text.length) controller.enqueue(encoder.encode(frame({ content: text.slice(sent) })));
          controller.enqueue(encoder.encode(`${frame({}, 'stop')}data: [DONE]\n\n`));
          signal?.removeEventListener('abort', onAbort);
          controller.close();
        };
        step();
      },
      cancel() {
        if (timer !== null) clearTimeout(timer);
      },
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
}
