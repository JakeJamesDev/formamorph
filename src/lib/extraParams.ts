/**
 * An endpoint's Extra Parameters: a JSON object the player writes, merged into every request body sent to
 * that endpoint before the app's own fields, so a field the app sets for a call wins and the extras only add
 * what it leaves out (a vendor's own reasoning field, `top_a`, `chat_template_kwargs`, a provider-routing
 * block). The fields that make a request a request, and the ones that shape its reply, stay the app's.
 */

/** What an extra parameter can never set: the request itself and the shape of its reply. */
const PROTECTED = new Set(['model', 'messages', 'stream', 'tools', 'tool_choice', 'response_format', 'n', 'stop']);

/** The object `text` holds, or why it can't be used. Empty text is no parameters. */
export function readExtraParams(text: string | undefined): { params: Record<string, unknown> } | { error: string } {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { params: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { error: `Not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
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
