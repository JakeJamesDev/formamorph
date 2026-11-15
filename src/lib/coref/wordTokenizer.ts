/**
 * English word tokenization that reproduces spaCy's `en_core_web_sm` tokenizer, the word split the coref
 * models were trained on. It replays spaCy's own affix patterns and special cases from
 * `spacyEnTokenizer.json` (written by `scripts/coref/dump_spacy_tokenizer.py`) with the same algorithm as
 * spaCy's `Tokenizer`: whitespace split, prefix/suffix peeling, infix splits, then the special-case matcher.
 */
import rulesJson from './spacyEnTokenizer.json';

/** One word token. `start`/`end` index the tokenized text (UTF-16 code units, end exclusive). Runs of
 *  whitespace beyond a single space are tokens of their own, as in spaCy. */
export interface WordToken {
  text: string;
  start: number;
  end: number;
}

interface SpacyRules {
  prefix: string;
  suffix: string;
  infix: string;
  urlMatch: string;
  rules: Record<string, string[]>;
  matcher: Record<string, string[]>;
}

// Escapes JS keeps as they are under the `u` flag; any other escaped character is a literal.
const JS_ESCAPES = new Set([...'dDsSbBfnrtv0cxpPk', ...'^$\\.*+?()[]{}|/']);

/** A Python `re` pattern rewritten for a JS `u`-flag RegExp: `\U` code points, Unicode `\w` and `\d`, and
 *  Python's identity escapes. Exported for its test. */
export function pythonPattern(source: string): string {
  const src = source.replace(/^\(\?u\)/, '');
  let out = '';
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      const next = src[i + 1];
      i++;
      if (next === 'U') {
        out += `\\u{${src.slice(i + 1, i + 9).replace(/^0+(?=.)/, '')}}`;
        i += 8;
      } else if (next === 'u') {
        out += `\\u${src.slice(i + 1, i + 5)}`;
        i += 4;
      } else if (next === 'w') {
        out += inClass ? '\\p{L}\\p{N}_' : '[\\p{L}\\p{N}_]';
      } else if (next === 'W' && !inClass) {
        out += '[^\\p{L}\\p{N}_]';
      } else if (next === 'd') {
        out += '\\p{Nd}';
      } else if (next === 'D') {
        out += '\\P{Nd}';
      } else if (next === '-' && inClass) {
        out += '\\-';
      } else if (JS_ESCAPES.has(next)) {
        out += `\\${next}`;
      } else {
        out += next;
      }
      continue;
    }
    if (ch === '[' && !inClass) inClass = true;
    else if (ch === ']' && inClass) inClass = false;
    out += ch;
  }
  return out;
}

const rules = rulesJson as SpacyRules;
const PREFIX_RE = new RegExp(pythonPattern(rules.prefix), 'u');
const SUFFIX_RE = new RegExp(pythonPattern(rules.suffix), 'u');
const INFIX_RE = new RegExp(pythonPattern(rules.infix), 'gu');
const URL_RE = new RegExp(pythonPattern(rules.urlMatch), 'u');
const SPECIALS = new Map(Object.entries(rules.rules));
const MATCHER = Object.entries(rules.matcher);

// Python str.isspace(), which differs from JS whitespace at 0x1c-0x1f, 0x85 and 0xfeff.
const PY_SPACES = new Set([9, 10, 11, 12, 13, 0x1c, 0x1d, 0x1e, 0x1f, 0x20, 0x85, 0xa0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a,
  0x2028, 0x2029, 0x202f, 0x205f, 0x3000]);
const isSpace = (ch: string) => PY_SPACES.has(ch.charCodeAt(0));

const prefixLength = (s: string) => PREFIX_RE.exec(s)?.[0].length ?? 0;

function suffixLength(s: string): number {
  const m = SUFFIX_RE.exec(s);
  return m ? m[0].length : 0;
}

// spaCy's _split_affixes then _attach_tokens on one whitespace-free chunk.
function tokenizeChunk(chunk: string): string[] {
  const prefixes: string[] = [];
  const suffixes: string[] = [];
  let s = chunk;
  let lastSize = -1;
  while (s && s.length !== lastSize) {
    if (SPECIALS.has(s)) break;
    lastSize = s.length;
    const pre = prefixLength(s);
    let prefix = '';
    let minusPre = '';
    if (pre) {
      prefix = s.slice(0, pre);
      minusPre = s.slice(pre);
      if (minusPre && SPECIALS.has(minusPre)) {
        s = minusPre;
        prefixes.push(prefix);
        break;
      }
    }
    const suf = suffixLength(s.slice(pre));
    let suffix = '';
    let minusSuf = '';
    if (suf) {
      suffix = s.slice(s.length - suf);
      minusSuf = s.slice(0, s.length - suf);
      if (minusSuf && SPECIALS.has(minusSuf)) {
        s = minusSuf;
        suffixes.push(suffix);
        break;
      }
    }
    if (pre && suf && pre + suf <= s.length) {
      s = s.slice(pre, s.length - suf);
      prefixes.push(prefix);
      suffixes.push(suffix);
    } else if (pre) {
      s = minusPre;
      prefixes.push(prefix);
    } else if (suf) {
      s = minusSuf;
      suffixes.push(suffix);
    }
  }
  const out = [...prefixes];
  if (s) {
    const special = SPECIALS.get(s);
    if (special) out.push(...special);
    else if (URL_RE.test(s)) out.push(s);
    else out.push(...splitInfixes(s));
  }
  return out.concat(suffixes.reverse());
}

function splitInfixes(s: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of s.matchAll(INFIX_RE)) {
    const infixStart = m.index;
    const infixEnd = infixStart + m[0].length;
    if (infixStart === 0) continue;
    if (infixStart !== start) out.push(s.slice(start, infixStart));
    if (infixStart !== infixEnd) out.push(m[0]);
    start = infixEnd;
  }
  if (start < s.length) out.push(s.slice(start));
  return out;
}

// Lay token strings back onto the text from `from`, skipping the single spaces between them.
function place(text: string, pieces: string[], from: number, into: WordToken[]): number {
  let at = from;
  for (const piece of pieces) {
    while (text.startsWith(piece, at) === false && text[at] === ' ') at++;
    into.push({ text: piece, start: at, end: at + piece.length });
    at += piece.length;
  }
  return at;
}

// spaCy's _apply_special_cases: special cases that span several affix tokens replace them.
function applySpecialCases(text: string, tokens: WordToken[]): WordToken[] {
  const matches: { start: number; end: number }[] = [];
  for (const [, pattern] of MATCHER) {
    const n = pattern.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      let ok = true;
      for (let j = 0; j < n && ok; j++) ok = tokens[i + j].text === pattern[j];
      if (ok) matches.push({ start: i, end: i + n });
    }
  }
  if (!matches.length) return tokens;
  // spaCy's len_start_cmp: longest first, then the earliest start.
  matches.sort((a, b) => (a.end - a.start) - (b.end - b.start) || b.start - a.start);
  const seen = new Set<number>();
  const kept: { start: number; end: number }[] = [];
  for (let k = matches.length - 1; k >= 0; k--) {
    const m = matches[k];
    if (!seen.has(m.start) && !seen.has(m.end - 1)) kept.push(m);
    for (let i = m.start; i < m.end; i++) seen.add(i);
  }
  kept.sort((a, b) => a.start - b.start);
  const byStart = new Map(kept.map((m) => [m.start, m]));
  const out: WordToken[] = [];
  for (let i = 0; i < tokens.length;) {
    const m = byStart.get(i);
    const rule = m && SPECIALS.get(text.slice(tokens[m.start].start, tokens[m.end - 1].end));
    if (!m || !rule) {
      out.push(tokens[i]);
      i++;
      continue;
    }
    place(text, rule, tokens[m.start].start, out);
    i = m.end;
  }
  return out;
}

/** The spaCy `en_core_web_sm` word tokens of `text`. */
export function wordTokenize(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  if (!text) return tokens;
  let start = 0;
  let inWs = isSpace(text[0]);
  const flush = (end: number) => {
    const span = text.slice(start, end);
    place(text, SPECIALS.get(span) ?? tokenizeChunk(span), start, tokens);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isSpace(ch) !== inWs) {
      if (start < i) flush(i);
      start = ch === ' ' ? i + 1 : i;
      inWs = !inWs;
    }
  }
  if (start < text.length) flush(text.length);
  return applySpecialCases(text, tokens);
}
