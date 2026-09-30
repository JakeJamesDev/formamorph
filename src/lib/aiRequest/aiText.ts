import { stripReasoning } from '@/lib/aiResponse';
import { buildAiRequestSpec, type AiCall, type AiSettingsSnapshot } from './aiRequestSpec';
import { ABORTED_FINISH_REASON, type AiStreamOptions, type AiStreamResult } from './aiStream';
import { streamAiToolLoop } from './toolLoop';

/**
 * One call outside a turn, sent through the request pipeline and answered as plain text. Throws the
 * pipeline's errors, an `AbortError` when stopped, and an error naming the finish reason when the answer is empty.
 */
export async function requestAiText(
  snapshot: AiSettingsSnapshot,
  call: Omit<AiCall, 'tools'>,
  options: Pick<AiStreamOptions, 'signal' | 'fetchImpl'> = {},
): Promise<string> {
  const spec = buildAiRequestSpec(snapshot, call);
  let result: AiStreamResult | undefined;
  for await (const event of streamAiToolLoop(spec, options)) {
    if (event.type === 'done') result = event.result;
  }
  if (options.signal?.aborted || result?.finishReason === ABORTED_FINISH_REASON) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
  const text = stripReasoning(result?.content ?? '').trim();
  if (!text) throw new Error(`The model sent an empty answer (finish reason: ${result?.finishReason ?? 'none'})`);
  return text;
}
