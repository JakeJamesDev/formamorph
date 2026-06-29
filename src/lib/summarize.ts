// One-shot, non-streaming summarizer for the world editor's "generate AI-Facing Summary" button.
// Mirrors the OpenAI-compatible request shape the game uses, minus the streaming/turn machinery.

export const SUMMARIZE_PROMPT =
  'Summarize the following description in a single concise sentence (under ~20 words). ' +
  'Output only the summary — no preamble, labels, or quotes.';

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

/**
 * Summarize `text` via the configured chat-completions endpoint. Throws on a non-OK response or an
 * empty/unparseable result; the caller surfaces failures (and ignores `AbortError`).
 */
export async function summarizeDescription(
  text: string,
  opts: { endpointUrl: string; apiToken: string; modelName: string; signal?: AbortSignal },
): Promise<string> {
  const res = await fetch(opts.endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.apiToken ? { Authorization: `Bearer ${opts.apiToken}` } : {}),
    },
    body: JSON.stringify({
      model: opts.modelName,
      messages: [
        { role: 'system', content: SUMMARIZE_PROMPT },
        { role: 'user', content: text },
      ],
      max_tokens: 80,
      stream: false,
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as ChatCompletion;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Empty summary response');
  return content.trim();
}
