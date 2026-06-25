import { describe, it, expect } from 'vitest';
import { autoCloseMarkdown } from './autoCloseMarkdown';

describe('autoCloseMarkdown', () => {
  it('leaves complete / plain text unchanged', () => {
    expect(autoCloseMarkdown('')).toBe('');
    expect(autoCloseMarkdown('Just some prose.')).toBe('Just some prose.');
    expect(autoCloseMarkdown('He said **hello** and left.')).toBe('He said **hello** and left.');
  });

  it('closes an open bold/italic run', () => {
    expect(autoCloseMarkdown('He said **hel')).toBe('He said **hel**');
    expect(autoCloseMarkdown('an *ital')).toBe('an *ital*');
    expect(autoCloseMarkdown('***both')).toBe('***both***');
  });

  it('closes nested emphasis innermost-first', () => {
    expect(autoCloseMarkdown('a *b _c')).toBe('a *b _c_*');
  });

  it('closes an open inline code span', () => {
    expect(autoCloseMarkdown('run `npm i')).toBe('run `npm i`');
  });

  it('treats markers inside inline code as literal', () => {
    expect(autoCloseMarkdown('`a*b')).toBe('`a*b`');
    expect(autoCloseMarkdown('use `arr[*]` now')).toBe('use `arr[*]` now');
  });

  it('closes an open fenced code block', () => {
    expect(autoCloseMarkdown('```js\nconst x = 1')).toBe('```js\nconst x = 1\n```');
    expect(autoCloseMarkdown('```\ncode\n```\ndone')).toBe('```\ncode\n```\ndone');
  });

  it('does not treat list bullets as emphasis', () => {
    expect(autoCloseMarkdown('* item one\n* item')).toBe('* item one\n* item');
    expect(autoCloseMarkdown('- a\n- b')).toBe('- a\n- b');
  });

  it('does not treat intra-word underscores as emphasis', () => {
    expect(autoCloseMarkdown('the snake_case name')).toBe('the snake_case name');
    expect(autoCloseMarkdown('_emphasized')).toBe('_emphasized_');
  });

  it('handles strikethrough but ignores a lone tilde', () => {
    expect(autoCloseMarkdown('~~struck')).toBe('~~struck~~');
    expect(autoCloseMarkdown('about ~5 apples')).toBe('about ~5 apples');
  });

  it('resets emphasis across a blank line (paragraph break)', () => {
    expect(autoCloseMarkdown('*loose\n\nnext')).toBe('*loose\n\nnext');
  });

  it('leaves an incomplete table to render natively', () => {
    const t = 'Loot:\n\n| Item | Qty |\n| ---- | --- |\n| Sword';
    expect(autoCloseMarkdown(t)).toBe(t);
  });
});
