import { diffLines, diffWordsWithSpace, type Change } from 'diff';
import { PLACEHOLDER_TOKEN_SOURCE } from './placeholders';

/**
 * One run of the diff: unchanged unless flagged as this world's addition or its removal from the default.
 * Inside a reworded line, `changed` marks the words that differ from the other side; the rest of the line
 * is shown on both sides so each reads whole.
 */
export type PromptDiffPart = { value: string; added?: boolean; removed?: boolean; changed?: boolean };

/** Chip tokens as they appear in stored prompt text: `<NARRATION>`, `<TIME|pre=" It is ">`, `{{ph:…}}`. */
const CHIP_RE = new RegExp(`<[A-Z][^<>]*>|${PLACEHOLDER_TOKEN_SOURCE}`, 'g');

/** The private-use area the chip sentinels are drawn from. */
const PUA_RE = /[\uE000-\uF8FF]/g;
const PUA_FIRST = 0xe000;
const PUA_LAST = 0xf8ff;

/**
 * The private-use codepoints the prompts themselves contain, which no sentinel may reuse: a stray one would
 * otherwise be restored as somebody's chip. Over six thousand are free for the handful of chips a prompt has.
 */
function taken(text: string): Set<number> {
  return new Set((text.match(PUA_RE) ?? []).map((char) => char.codePointAt(0)!));
}

/**
 * Chips swapped for one codepoint each, so the word diff can never split one mid-token. `sentinels` is shared
 * across both sides: identical chip text has to reach the same codepoint or matching lines diff as changed.
 */
function protect(text: string, sentinels: Map<string, string>, free: number[]): string {
  return text.replace(CHIP_RE, (chip) => {
    const seen = sentinels.get(chip);
    if (seen !== undefined) return seen;
    // Out of free codepoints only past ~6400 distinct chips: leave the chip as text rather than collide.
    const next = free.pop();
    if (next === undefined) return chip;
    const sentinel = String.fromCodePoint(next);
    sentinels.set(chip, sentinel);
    return sentinel;
  });
}

function restore(text: string, chips: Map<string, string>): string {
  if (!chips.size) return text;
  return text.replace(PUA_RE, (char) => chips.get(char) ?? char);
}

/** Below this share of text kept in common runs, a changed line pair reads as a rewrite, not a rewording. */
const REWORDING_MIN_SHARED = 0.3;

/** Small words any two sentences share, which say nothing about whether a passage was kept. */
const FILLER = /^\s*(a|an|and|as|at|be|by|for|in|is|it|of|on|or|that|the|this|to|with)\s*$/i;

/** A run both sides keep that counts toward a rewording: any text but bare space, punctuation or a filler word. */
const keeps = (value: string) => /[\p{L}\p{N}]/u.test(value) && !FILLER.test(value);

/**
 * The word diff with a lone filler word that sits between two changes counted as changed on both sides:
 * it matched by chance, and left kept it splits one rewritten phrase into fragments on each side.
 */
function unpinFillers(words: Change[]): Change[] {
  const changed = (word: Change | undefined) => !!word && (word.added || word.removed);
  return words.flatMap((word, i) => (!changed(word) && FILLER.test(word.value) && changed(words[i - 1]) && changed(words[i + 1])
    ? [{ ...word, removed: true, added: false }, { ...word, added: true, removed: false }]
    : [word]));
}

/**
 * One side of a reworded hunk: the whole old (or new) text, with the words that differ from the other side
 * marked `changed`. Bare space or punctuation kept between two changes is marked with them, so one change
 * reads as one mark, and neighbours with the same marking are joined.
 */
function hunkSide(words: Change[], side: 'added' | 'removed'): PromptDiffPart[] {
  const other = side === 'added' ? 'removed' : 'added';
  const runs = words.filter((word) => !word[other]);
  const parts: PromptDiffPart[] = runs.map((word, i) => {
    const between = i > 0 && i < runs.length - 1 && runs[i - 1][side] && runs[i + 1][side];
    const changed = word[side] || (between && /^[\s\p{P}]*$/u.test(word.value));
    return { value: word.value, [side]: true, ...(changed ? { changed: true } : {}) };
  });
  return parts.reduce<PromptDiffPart[]>((out, part) => {
    const last = out[out.length - 1];
    if (last && !!last.changed === !!part.changed) out[out.length - 1] = { ...last, value: last.value + part.value };
    else out.push(part);
    return out;
  }, []);
}

/**
 * One changed hunk: the old lines, then the new lines under them, so a new line never starts at the end of
 * the one it replaced. When the new lines reword the old ones, the words that differ are marked `changed`
 * on both sides; an unrelated rewrite is marked as whole lines, since a word diff across it matches only
 * small shared words ("the", "and") and would mark fragments.
 */
function diffHunk(removed: string, added: string): PromptDiffPart[] {
  const words = unpinFillers(diffWordsWithSpace(removed, added));
  const shared = words.filter((part) => !part.added && !part.removed && keeps(part.value))
    .reduce((n, part) => n + part.value.trim().length, 0);
  const longer = Math.max(removed.trim().length, added.trim().length);
  if (longer > 0 && shared / longer >= REWORDING_MIN_SHARED) return [...hunkSide(words, 'removed'), ...hunkSide(words, 'added')];
  return [{ value: removed, removed: true }, { value: added, added: true }];
}

/**
 * Take back the newline `diffByLines` appended to each side. The last unchanged part ends in that newline
 * only for a side with nothing after it; a side that continues past it needs its break, so the break moves
 * to the front of that side's tail, and the tail's own last part gives up the appended one instead.
 */
function dropAppendedNewline(parts: PromptDiffPart[]): PromptDiffPart[] {
  const out = [...parts];
  let u = out.length - 1;
  while (u >= 0 && (out[u].added || out[u].removed)) u--;
  const trimEnd = (i: number) => { out[i] = { ...out[i], value: out[i].value.replace(/\n$/, '') }; };
  if (u === out.length - 1) { trimEnd(u); return out; }
  if (u >= 0) trimEnd(u);
  for (const side of ['added', 'removed'] as const) {
    const tail = out.map((part, i) => ({ part, i })).filter(({ part, i }) => i > u && part[side]);
    if (!tail.length) continue;
    if (u >= 0) out[tail[0].i] = { ...out[tail[0].i], value: `\n${out[tail[0].i].value}` };
    trimEnd(tail[tail.length - 1].i);
  }
  return out;
}

/**
 * Line diff first, refined to words only inside a changed hunk. Both sides get a closing newline so the
 * last line matches whether or not text follows it, and lose it again afterward.
 */
function diffByLines(base: string, world: string): PromptDiffPart[] {
  const lines = diffLines(`${base}\n`, `${world}\n`);
  const out: PromptDiffPart[] = [];
  for (let i = 0; i < lines.length; i++) {
    const part = lines[i];
    const next = lines[i + 1];
    if (part.removed && next?.added) {
      out.push(...diffHunk(part.value, next.value));
      i++;
    } else {
      out.push({ value: part.value, ...(part.added ? { added: true } : {}), ...(part.removed ? { removed: true } : {}) });
    }
  }
  return dropAppendedNewline(out).filter((part) => part.value !== '');
}

/**
 * A world's prompt against a baseline prompt: changed lines as the old lines over the new ones, with the words
 * that differ marked inside a reworded line. Concatenating everything not `added` gives the default back; everything not `removed` gives the world's text back, which is what lets one flowing document
 * show both. Hyphenated words split at the hyphen — jsdiff's word boundary, accepted as-is.
 */
export function promptWordDiff(base: string, world: string): PromptDiffPart[] {
  const used = taken(base + world);
  // Popped from the end, so the codepoints handed out stay in ascending order.
  const free: number[] = [];
  for (let cp = PUA_LAST; cp >= PUA_FIRST; cp--) if (!used.has(cp)) free.push(cp);

  const sentinels = new Map<string, string>();
  const protectedBase = protect(base, sentinels, free);
  const protectedWorld = protect(world, sentinels, free);
  const chips = new Map([...sentinels].map(([chip, sentinel]) => [sentinel, chip]));

  return diffByLines(protectedBase, protectedWorld).map((part) => ({
    value: restore(part.value, chips),
    ...(part.added ? { added: true } : {}),
    ...(part.removed ? { removed: true } : {}),
    ...(part.changed ? { changed: true } : {}),
  }));
}
