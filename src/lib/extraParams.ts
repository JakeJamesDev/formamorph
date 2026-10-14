/**
 * An endpoint's Extra Parameters: a JSON object the player writes, merged into every request body sent to
 * that endpoint, after everything the app sets, so it wins (a vendor's own reasoning field, `top_a`,
 * `chat_template_kwargs`, a provider-routing block). The fields that make a request a request stay the app's.
 */

/** What an extra parameter can never replace: the request itself. */
const PROTECTED = new Set(['model', 'messages', 'stream']);

/** The object `text` holds, or why it can't be used. Empty text is no parameters. */
export function readExtraParams(text: string | undefined): { params: Record<string, unknown> } | { error: string } {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { params: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { error: `Not valid JSON: ${(error as Error).message}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'Write one JSON object, like {"top_a": 0.1}.' };
  const blocked = Object.keys(parsed).filter((key) => PROTECTED.has(key));
  if (blocked.length) return { error: `These are set by the app and can't be replaced: ${blocked.join(', ')}.` };
  return { params: parsed as Record<string, unknown> };
}

/** The parameters to merge, or none when the text can't be used (the editor says why). */
export function extraParamsOf(text: string | undefined): Record<string, unknown> {
  const read = readExtraParams(text);
  return 'params' in read ? read.params : {};
}
