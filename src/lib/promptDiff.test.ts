import { describe, it, expect } from 'vitest';
import { promptWordDiff } from './promptDiff';

/** The visible text of the parts on one side of the diff, as the reader would see it. */
const sideText = (parts: ReturnType<typeof promptWordDiff>, side: 'base' | 'world') =>
  parts.filter((p) => (side === 'base' ? !p.added : !p.removed)).map((p) => p.value).join('');

const added = (parts: ReturnType<typeof promptWordDiff>) =>
  parts.filter((p) => p.added).map((p) => p.value);
const removed = (parts: ReturnType<typeof promptWordDiff>) =>
  parts.filter((p) => p.removed).map((p) => p.value);
/** One side of the changed lines as the reader sees it: the old lines, or the new ones under them. */
const lines = (parts: ReturnType<typeof promptWordDiff>, side: 'added' | 'removed') =>
  parts.filter((p) => p[side]).map((p) => p.value).join('');
/** The words marked as differing inside a changed line, on one side. */
const changedWords = (parts: ReturnType<typeof promptWordDiff>, side: 'added' | 'removed') =>
  parts.filter((p) => p[side] && p.changed).map((p) => p.value);

describe('promptWordDiff: both sides survive the round trip', () => {
  it('reports identical text as one unchanged part', () => {
    const parts = promptWordDiff('Write the scene.', 'Write the scene.');
    expect(parts).toEqual([{ value: 'Write the scene.' }]);
  });

  it('reassembles the base from everything not added, and the world from everything not removed', () => {
    const base = 'Be concise and vivid.\nGive at least 3 options.';
    const world = 'Be expansive and unhurried.\nGive at least 4 options, one per line.';
    const parts = promptWordDiff(base, world);
    expect(sideText(parts, 'base')).toBe(base);
    expect(sideText(parts, 'world')).toBe(world);
  });

  it.each([
    ['text added after the last line', 'Keep it short.\nEnd here.', 'Keep it short.\nEnd here.\nAdd a mindstate.'],
    ['text removed after the last line', 'Keep it short.\nEnd here.\nAdd a mindstate.', 'Keep it short.\nEnd here.'],
    ['the last line rewritten', 'Keep it short.\nEnd here.', 'Keep it short.\nSomething else entirely now.'],
    ['everything rewritten', 'Alpha beta.', 'Gamma delta epsilon.'],
    ['a trailing newline on one side only', 'Keep it short.\n', 'Keep it short.'],
  ])('reassembles both sides exactly with %s', (_name, base, world) => {
    const parts = promptWordDiff(base, world);
    expect(sideText(parts, 'base')).toBe(base);
    expect(sideText(parts, 'world')).toBe(world);
  });

  it('shows an unrelated rewrite as whole lines, with no words marked inside them', () => {
    const base = 'Output the story prose - the events themselves, and nothing after the scene ends.';
    const world = 'First output a mindstate for each character in the scene, in brackets.';
    const parts = promptWordDiff(`Intro.\n${base}\nOutro.`, `Intro.\n${world}\nOutro.`);
    expect(lines(parts, 'removed')).toBe(`${base}\n`);
    expect(lines(parts, 'added')).toBe(`${world}\n`);
    expect(changedWords(parts, 'removed')).toEqual([]);
    expect(changedWords(parts, 'added')).toEqual([]);
  });

  it('starts the new line under the old one, not at its end', () => {
    const parts = promptWordDiff('Keep it short.\nSay less.\nEnd here.', 'Keep it short.\nSay a little less.\nEnd here.');
    const firstAdded = parts.findIndex((p) => p.added);
    expect(parts[firstAdded - 1].removed).toBe(true);
    expect(parts[firstAdded - 1].value.endsWith('\n')).toBe(true);
  });

  it('marks an insertion on the new line only, and shows the old line whole', () => {
    const parts = promptWordDiff('one two', 'one blue two');
    expect(lines(parts, 'removed')).toBe('one two');
    expect(changedWords(parts, 'removed')).toEqual([]);
    expect(changedWords(parts, 'added').join('').trim()).toBe('blue');
  });

  it('marks a deletion on the old line only, and shows the new line whole', () => {
    const parts = promptWordDiff('one blue two', 'one two');
    expect(lines(parts, 'added')).toBe('one two');
    expect(changedWords(parts, 'added')).toEqual([]);
    expect(changedWords(parts, 'removed').join('').trim()).toBe('blue');
  });

  it('marks only the differing words inside a reworded line, old line over new', () => {
    const parts = promptWordDiff('vivid second person prose', 'grim second person prose');
    expect(parts).toEqual([
      { value: 'vivid', removed: true, changed: true },
      { value: ' second person prose', removed: true },
      { value: 'grim', added: true, changed: true },
      { value: ' second person prose', added: true },
    ]);
  });

  it('marks a lone filler word between two changes with them, rather than splitting the change around it', () => {
    const base = "- Bracketed text is the author directing the scene, not something the character says: keep the prose free of it.";
    const world = "- Bracketed text is author direction: keep the prose free of it (the mindstate block before the prose is the one exception).";
    const parts = promptWordDiff(base, world);
    for (const side of ['added', 'removed'] as const) {
      const sideParts = parts.filter((p) => p[side]);
      sideParts.forEach((p, i) => {
        const between = i > 0 && i < sideParts.length - 1 && sideParts[i - 1].changed && sideParts[i + 1].changed;
        if (between && !p.changed) expect(p.value.trim()).not.toMatch(/^(the|a|an|and|to|of|is)$/i);
      });
    }
  });

  it('keeps blank lines, so a dropped section reads as the paragraph it was', () => {
    const base = 'A\n\n## Lore\ntext\n\n## World\nB';
    const world = 'A\n\n## World\nB';
    const parts = promptWordDiff(base, world);
    expect(sideText(parts, 'base')).toBe(base);
    expect(sideText(parts, 'world')).toBe(world);
    expect(removed(parts).join('')).toContain('Lore');
  });
});

describe('promptWordDiff: chips stay atomic', () => {
  it('swaps a re-argued chip whole rather than highlighting the argument inside it', () => {
    // Unprotected, the word diff shares the `<DICTIONARY|` head and the `>` tail and highlights only
    // `before`/`after`, cutting the chip into three pieces the reader has to reassemble.
    const parts = promptWordDiff('Lore:\n<DICTIONARY|before>\nEnd', 'Lore:\n<DICTIONARY|after>\nEnd');
    expect(lines(parts, 'removed').trim()).toBe('<DICTIONARY|before>');
    expect(lines(parts, 'added').trim()).toBe('<DICTIONARY|after>');
    expect(parts.every((p) => !p.value.includes('<DICTIONARY') || /<DICTIONARY\|(before|after)>/.test(p.value))).toBe(true);
  });

  it('leaves an untouched chip whole and unmarked on both lines when its neighbors change', () => {
    const parts = promptWordDiff(
      'Be concise. <LENGTH GUIDANCE> Then stop.',
      'Be unhurried. <LENGTH GUIDANCE> Then stop.',
    );
    const chipParts = parts.filter((p) => p.value.includes('<LENGTH GUIDANCE>'));
    expect(chipParts).toHaveLength(2);
    expect(chipParts.every((p) => !p.changed)).toBe(true);
  });

  it('numbers chips from one shared store, so dropping an earlier chip does not misname a later one', () => {
    // Per-side stores would give the surviving chip index 0 on the world side and index 1 on the base
    // side — the same sentinel as the dropped chip, so it renders as the wrong chip and diffs as changed.
    const base = '<WORLD OVERVIEW>\nthe scene so far\n<NARRATION>';
    const world = 'the scene so far\n<NARRATION>';
    const parts = promptWordDiff(base, world);
    expect(sideText(parts, 'base')).toBe(base);
    expect(sideText(parts, 'world')).toBe(world);
    expect(removed(parts).join('')).toContain('<WORLD OVERVIEW>');
    expect(added(parts)).toEqual([]);
  });

  it('treats two identical prompts as wholly unchanged, chips and all', () => {
    const text = '## Background Lore\n<DICTIONARY|before>\n\n## Game World\n<WORLD OVERVIEW>';
    expect(promptWordDiff(text, text)).toEqual([{ value: text }]);
  });

  it('reports a dropped chip whole, with its argument intact', () => {
    const parts = promptWordDiff('Lore:\n<DICTIONARY|before>\nEnd', 'Lore:\nEnd');
    expect(removed(parts).join('')).toContain('<DICTIONARY|before>');
    expect(sideText(parts, 'world')).toBe('Lore:\nEnd');
  });

  it('reports an added chip whole', () => {
    const parts = promptWordDiff('Scene:\nEnd', 'Scene:\n<TIME|pre=" It is ">\nEnd');
    expect(added(parts).join('')).toContain('<TIME|pre=" It is ">');
  });

  it('distinguishes two different chips rather than collapsing them onto one sentinel', () => {
    const parts = promptWordDiff('<NARRATION>', '<PLAYER ACTION>');
    expect(removed(parts).join('')).toBe('<NARRATION>');
    expect(added(parts).join('')).toBe('<PLAYER ACTION>');
  });

  it('swaps a placeholder chip whole when only its mode changes', () => {
    // Unprotected, the word diff splits the token at its colons and highlights only `world`/`unique`.
    const id = '6f1c2a90-4b1e-4c55-9d2e-0a7b3c4d5e6f';
    const before = `{{ph:${id}:world:a1b2}}`;
    const after = `{{ph:${id}:unique:a1b2}}`;
    const parts = promptWordDiff(`Wear ${before} today.`, `Wear ${after} today.`);
    expect(changedWords(parts, 'removed')).toEqual([before]);
    expect(changedWords(parts, 'added')).toEqual([after]);
  });

  it('leaves lowercase angle text alone — only chips are protected', () => {
    const parts = promptWordDiff('use <name> here', 'use <name> now');
    expect(sideText(parts, 'base')).toBe('use <name> here');
    expect(sideText(parts, 'world')).toBe('use <name> now');
  });

  it('passes private-use codepoints in the prompt through untouched', () => {
    // The sentinels live in the private-use area; a stray one in the text must not be eaten or remapped.
    const base = `a \u{E000} <NARRATION> b`;
    const parts = promptWordDiff(base, base);
    expect(parts).toEqual([{ value: base }]);
  });

  it('still restores chips when the prompt occupies the top of the private-use block', () => {
    // Handing out the next codepoint above the highest one in use would land outside the block, leaving
    // the sentinel unrestorable and the chip rendered as a stray glyph.
    const base = `\u{F8FF} lore:\n<DICTIONARY|before>\nEnd`;
    const world = `\u{F8FF} lore:\nEnd`;
    const parts = promptWordDiff(base, world);
    expect(sideText(parts, 'base')).toBe(base);
    expect(sideText(parts, 'world')).toBe(world);
    expect(removed(parts).join('')).toContain('<DICTIONARY|before>');
  });
});
