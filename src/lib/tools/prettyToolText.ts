/** A Tool's text as a reader sees it: JSON indented, anything else as the AI receives it. */
export function prettyToolText(text: string): { code: string; json: boolean } {
  try {
    return { code: JSON.stringify(JSON.parse(text), null, 2), json: true };
  } catch {
    return { code: text, json: false };
  }
}
