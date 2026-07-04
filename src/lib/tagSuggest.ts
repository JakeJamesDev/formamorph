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
