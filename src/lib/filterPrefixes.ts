import { asStatusFacet, type StatusFacet } from '@/lib/communityStatusFacets';

/** A filter typed into the search box as `author:`/`tag:`/`status:` rather than clicked. */
export type FilterPrefix =
  | { kind: 'author'; value: string }
  | { kind: 'tag'; value: string }
  | { kind: 'status'; value: StatusFacet };

export interface PrefixExtraction {
  /** The prefixes that are finished and should become chips. */
  prefixes: FilterPrefix[];
  /** What remains as plain search text, with the extracted tokens removed. */
  rest: string;
}

/** One whitespace-delimited token of the search box, with quoted runs held together. */
interface Token { text: string; start: number; end: number; terminated: boolean }

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (i >= text.length) break;
    const start = i;
    let quote: string | null = null;
    while (i < text.length) {
      const ch = text[i];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (/\s/.test(ch)) {
        break;
      }
      i += 1;
    }
    // An open quote is a value still being typed — a space inside it does not end the token.
    tokens.push({ text: text.slice(start, i), start, end: i, terminated: quote === null && i < text.length });
  }
  return tokens;
}

function unquote(value: string): string {
  const q = value[0];
  if ((q === '"' || q === "'") && value.length >= 2 && value[value.length - 1] === q) {
    return value.slice(1, -1);
  }
  return value;
}

/** Read a token as a filter prefix, or null when it is ordinary search text. */
function asPrefix(token: string): FilterPrefix | null {
  const match = /^(author|tag|status):(.*)$/i.exec(token);
  if (!match) return null;
  const value = unquote(match[2]).trim();
  if (!value) return null; // `tag:` alone is still being typed
  const kind = match[1].toLowerCase();
  if (kind === 'status') {
    const facet = asStatusFacet(value);
    // An unknown status stays as typed text rather than disappearing into a chip that filters nothing.
    return facet ? { kind: 'status', value: facet } : null;
  }
  return { kind: kind as 'author' | 'tag', value };
}

/**
 * Pull finished `author:`/`tag:`/`status:` tokens out of the search text so the caller can turn them into
 * filter chips.
 *
 * A token only counts once it is finished — followed by a space, or `commitTrailing` set because Enter was
 * pressed. Converting mid-word would eat the value a letter at a time as it is typed.
 */
export function extractFilterPrefixes(text: string, commitTrailing = false): PrefixExtraction {
  const prefixes: FilterPrefix[] = [];
  const cuts: Array<[number, number]> = [];

  for (const token of tokenize(text)) {
    if (!token.terminated && !commitTrailing) continue;
    const prefix = asPrefix(token.text);
    if (!prefix) continue;
    prefixes.push(prefix);
    cuts.push([token.start, token.end]);
  }

  if (!cuts.length) return { prefixes, rest: text };

  let rest = '';
  let cursor = 0;
  for (const [start, end] of cuts) {
    rest += text.slice(cursor, start);
    cursor = end;
  }
  rest += text.slice(cursor);
  // Collapse the gap the removed token left, but keep a trailing space so typing simply continues.
  return { prefixes, rest: rest.replace(/\s+/g, ' ').replace(/^\s+/, '') };
}
