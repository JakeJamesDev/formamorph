import { describe, it, expect } from 'vitest';
import { promptWordDiff } from './promptDiff';

/** The visible text of the parts on one side of the diff, as the reader would see it. */
const sideText = (parts: ReturnType<typeof promptWordDiff>, side: 'base' | 'world') =>
  parts.filter((p) => (side === 'base' ? !p.added : !p.removed)).map((p) => p.value).join('');

const added = (parts: ReturnType<typeof promptWordDiff>) =>
  parts.filter((p) => p.added).map((p) => p.value);
const removed = (parts: ReturnType<typeof promptWordDiff>) =>
  parts.filter((p) => p.removed).map((p) => p.value);

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

  it('marks an insertion added and nothing removed', () => {
    const parts = promptWordDiff('one two', 'one blue two');
    expect(removed(parts)).toEqual([]);
    expect(added(parts).join('')).toContain('blue');
  });

  it('marks a deletion removed and nothing added', () => {
    const parts = promptWordDiff('one blue two', 'one two');
    expect(added(parts)).toEqual([]);
    expect(removed(parts).join('')).toContain('blue');
  });

  it('diffs at word level, leaving the rest of the line unchanged', () => {
    const parts = promptWordDiff('vivid second person prose', 'grim second person prose');
    expect(removed(parts)).toEqual(['vivid']);
    expect(added(parts)).toEqual(['grim']);
    // The shared tail stays one unchanged run rather than being re-emitted word by word.
    expect(parts.filter((p) => !p.added && !p.removed).map((p) => p.value)).toEqual([' second person prose']);
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
    expect(removed(parts).join('')).toBe('<DICTIONARY|before>');
    expect(added(parts).join('')).toBe('<DICTIONARY|after>');
  });

  it('leaves an untouched chip whole and unchanged when its neighbors change', () => {
    const parts = promptWordDiff(
      'Be concise. <LENGTH GUIDANCE> Then stop.',
      'Be unhurried. <LENGTH GUIDANCE> Then stop.',
    );
    const chipPart = parts.find((p) => p.value.includes('<LENGTH GUIDANCE>'));
    expect(chipPart).toBeDefined();
    expect(chipPart!.added).toBeUndefined();
    expect(chipPart!.removed).toBeUndefined();
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
