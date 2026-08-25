import { diffWordsWithSpace } from 'diff';

/** One run of the diff: unchanged unless flagged as this world's addition or its removal from the default. */
export type PromptDiffPart = { value: string; added?: boolean; removed?: boolean };

/** Chip tokens as they appear in stored prompt text: `<NARRATION>`, `<TIME|pre=" It is ">`. */
const CHIP_RE = /<[A-Z][^<>]*>/g;

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

/**
 * A world's prompt against the shipped default, word by word. Concatenating everything not `added` gives the
 * default back; everything not `removed` gives the world's text back, which is what lets one flowing document
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

  return diffWordsWithSpace(protectedBase, protectedWorld).map((part) => ({
    value: restore(part.value, chips),
    ...(part.added ? { added: true } : {}),
    ...(part.removed ? { removed: true } : {}),
  }));
}
