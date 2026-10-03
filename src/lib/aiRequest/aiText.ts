import { stripReasoning } from '@/lib/aiResponse';
import { buildAiRequestSpec, type AiCall, type AiRequestSpec, type AiSettingsSnapshot } from './aiRequestSpec';
import { ABORTED_FINISH_REASON, type AiStreamOptions, type AiStreamResult } from './aiStream';
import { streamAiToolLoop } from './toolLoop';

export interface AiTextOptions extends Pick<AiStreamOptions, 'signal' | 'fetchImpl'> {
  /** Gets the request as sent and what came back, once the stream ends or fails, for an AI Context viewer. */
  observe?: (spec: AiRequestSpec, result: AiStreamResult | undefined) => void;
}

/**
 * One call outside a turn, sent through the request pipeline and answered as plain text. Throws the
 * pipeline's errors, an `AbortError` when stopped, and an error naming the finish reason when the answer is empty.
 */
export async function requestAiText(
  snapshot: AiSettingsSnapshot,
  call: Omit<AiCall, 'tools'>,
  { observe, ...options }: AiTextOptions = {},
): Promise<string> {
  const spec = buildAiRequestSpec(snapshot, call);
  let result: AiStreamResult | undefined;
  try {
    for await (const event of streamAiToolLoop(spec, options)) {
      if (event.type === 'done') result = event.result;
    }
  } finally {
    observe?.(spec, result);
  }
  if (options.signal?.aborted || result?.finishReason === ABORTED_FINISH_REASON) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  const text = stripReasoning(result?.content ?? '').trim();
  if (!text) throw new Error(`The model sent an empty answer (finish reason: ${result?.finishReason ?? 'none'})`);
  return text;
}
