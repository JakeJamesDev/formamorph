import { describe, expect, it } from 'vitest';
import { bundledDocsIndex } from '@/lib/docs/bundledDocsIndex';
import { createDocsIndex, SECTION_CHAR_LIMIT } from '@/lib/docs/docsIndex';
import { HELP_PICK_LIMIT, pickList, pickMessage, readPicks } from './helpPicks';

describe('readPicks', () => {
  const lines = ['Library › How to Make a Group', 'Library › Groups', 'Settings › Output', 'World Editor: Traits › Groups', 'Memory › The Memory Tab', 'Memory › Kept vs Sent', 'Tools › Try It'];

  it('reads the copied lines of the reply as list positions, in the order of the reply', () => {
    expect(readPicks('Settings › Output\nLibrary › How to Make a Group', lines)).toEqual([2, 0]);
  });

  it('reads a line through a list marker, another case and other punctuation', () => {
    expect(readPicks('1. library > how to make a group\n- **Memory › The Memory Tab**', lines)).toEqual([0, 4]);
  });

  it('reads a line with no page when one section alone has that heading', () => {
    expect(readPicks('Kept vs Sent', lines)).toEqual([5]);
  });

  it('drops a heading that two pages have, a line the list does not hold, and a repeat', () => {
    expect(readPicks('Groups\nLibrary › Tiles\nSettings › Output\nSettings › Output', lines)).toEqual([2]);
  });

  it('tells two lines with the same words apart when the reply copies one exactly', () => {
    const twins = ['World Editor › Stats', 'World Editor: Stats'];
    expect(readPicks('World Editor: Stats', twins)).toEqual([1]);
    expect(readPicks('2. **World Editor: Stats**\n- World Editor › Stats', twins)).toEqual([1, 0]);
    // A loose copy reads as the first of the two.
    expect(readPicks('world editor stats', twins)).toEqual([0]);
  });

  it('keeps the pick limit at most', () => {
    expect(lines.length).toBeGreaterThan(HELP_PICK_LIMIT);
    expect(readPicks(lines.join('\n'), lines)).toEqual([0, 1, 2, 3, 4]);
  });

  it('reads no pick from a reply that copies no line', () => {
    expect(readPicks('None of the sections answer it.', lines)).toEqual([]);
  });
});

describe('pickList', () => {
  const long = Array.from({ length: 40 }, (_, n) => `Paragraph ${n} of the long section. `.repeat(8)).join('\n\n');
  const index = createDocsIndex({
    pages: {
      Library: '# 📚 Library\n\nYour tiles.\n\n## How to Make a Group\n\n1. Select **New Group**.\n\n### Group Colors\n\nPick a color.\n',
      Saves: `# Saves\n\n## 💾 The Long One\n\n${long}\n`,
      Changelog: '# Changelog\n\n## 3.1.0\n\n### Added\n\n- A thing.\n',
    },
    sidebar: '- [Library](Library)\n- [Saves](Saves)\n',
  });

  it('lists each whole guide section once, as its page and headings with no emoji, and leaves the changelog out', () => {
    expect(long.length).toBeGreaterThan(SECTION_CHAR_LIMIT);
    expect(pickList(index).lines).toEqual(['Library', 'Library › How to Make a Group', 'Saves', 'Saves › The Long One']);
  });

  it('gives a split section every part, in order', () => {
    const { lines, sections } = pickList(index);
    const parts = sections[lines.indexOf('Saves › The Long One')].map((section) => section.id);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts).toEqual(index.get(['Saves#-the-long-one']).map((section) => section.id));
  });

  it('gives the bundled guide lines that each name one section, so an exact copy of any line reads as its own section', () => {
    const { lines, sections } = pickList(bundledDocsIndex());
    expect(lines.length).toBeGreaterThan(100);
    expect(sections.every((parts) => parts.length > 0)).toBe(true);
    expect(new Set(lines).size).toBe(lines.length);
    lines.forEach((line, at) => expect(readPicks(line, lines)).toEqual([at]));
  });
});

describe('pickMessage', () => {
  it('holds the list, then the question, with nothing else for a first question from no screen', () => {
    expect(pickMessage(['A › One', 'B › Two'], { question: 'How do I add one?' })).toBe([
      '<sections>\nA › One\nB › Two\n</sections>',
      'Question: How do I add one?',
      'Reply with the lines of the sections that answer the question, the best one first.',
    ].join('\n\n'));
  });

  it('names the open screen and the earlier question when it has them', () => {
    const message = pickMessage(['A › One'], { question: 'and then?', earlier: 'How do I add one?', where: 'World Editor, Traits tab' });
    expect(message).toContain('\n\nThe player asks from this screen: World Editor, Traits tab.\n\nThe player\'s earlier question: How do I add one?\n\nQuestion: and then?\n\n');
  });

  it('holds the earlier answer after the earlier question', () => {
    const message = pickMessage(['A › One'], { question: 'can I undo it?', earlier: 'How do I add one?', earlierAnswer: '1. Select **Add**.\n2. Name it.' });
    expect(message).toContain('\n\nThe player\'s earlier question: How do I add one?\n\nThe earlier answer:\n1. Select **Add**.\n2. Name it.\n\nQuestion: can I undo it?\n\n');
  });
});
