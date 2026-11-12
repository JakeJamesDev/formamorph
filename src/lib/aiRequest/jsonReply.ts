/** A schema reply's JSON value, with any code fence around it removed. Undefined when it is not JSON. */
export function parseJsonReply(text: string): unknown {
  try {
    return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) as unknown;
  } catch {
    return undefined;
  }
}
