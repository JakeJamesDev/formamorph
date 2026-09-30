// One-shot summarizer for the world editor's "generate AI-Facing Summary" button.

import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { requestAiText } from '@/lib/aiRequest/aiText';

export const SUMMARIZE_PROMPT =
  'Summarize the following description in a single concise sentence (under ~20 words). ' +
  'Output only the summary — no preamble, labels, or quotes.';

/**
 * Summarize `text` through the request pipeline. Throws on a failed or empty result; the caller surfaces
 * failures (and ignores `AbortError`).
 */
export async function summarizeDescription(
  text: string,
  opts: { snapshot: AiSettingsSnapshot; signal?: AbortSignal },
): Promise<string> {
  return requestAiText(opts.snapshot, {
    systemPrompt: SUMMARIZE_PROMPT,
    messages: [{ role: 'user', content: text }],
    requestType: 'descriptionSummary',
    maxTokensOverride: 80,
  }, { signal: opts.signal });
}
