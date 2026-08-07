// Rank tag suggestions for autocomplete: prefix matches first, then substring matches, each keeping the
// input (popularity) order of `options`. Shared by the Image-Tags textarea and the world-tag chip field.

/** `query` must be pre-lowercased. Returns up to `limit` matches, prefix hits before substring hits. */
export function rankTagSuggestions(options: string[], query: string, limit: number): string[] {
  const starts: string[] = [];
  const contains: string[] = [];
  for (const o of options) {
    const lo = o.toLowerCase();
    if (lo.startsWith(query)) starts.push(o);
    else if (lo.includes(query)) contains.push(o);
    if (starts.length >= limit) break; // enough prefix hits; the rest can't outrank them
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * The comma-separated tag the caret sits in. `start`/`end` bound the whole tag (last comma/newline before,
 * spaces skipped → next comma/newline) so a selection replaces all of it; `token` is only the part left of
 * the caret, which is what we match on — so `red r|ibbon` still suggests from `red r`, matching what the
 * author sees while typing.
 */
export function activeTagToken(value: string, caret: number): { start: number; end: number; token: string } {
  const before = value.slice(0, caret);
  const boundary = Math.max(before.lastIndexOf(','), before.lastIndexOf('\n'));
  let start = boundary + 1;
  while (start < caret && value[start] === ' ') start++;
  const rel = value.slice(caret).search(/[,\n]/);
  const end = rel === -1 ? value.length : caret + rel;
  return { start, end, token: value.slice(start, caret) };
}

/**
 * Replace the tag the caret sits in with `tag`, reporting where the caret should land. A trailing `", "` is
 * appended only when the replaced tag was the last one, so picking a suggestion mid-list keeps the separator
 * that is already there.
 */
export function replaceActiveTag(value: string, caret: number, tag: string): { value: string; caret: number } {
  const { start, end } = activeTagToken(value, caret);
  const insert = end >= value.length ? `${tag}, ` : tag;
  return { value: value.slice(0, start) + insert + value.slice(end), caret: start + insert.length };
}
