import { describe, it, expect } from 'vitest';
import { applyMarkdownAction } from './markdownToolbar';

// Helper: apply an action and return the value plus the substring the new selection covers.
function run(value: string, start: number, end: number, action: Parameters<typeof applyMarkdownAction>[3]) {
  const out = applyMarkdownAction(value, start, end, action);
  return { value: out.value, selected: out.value.slice(out.selectionStart, out.selectionEnd) };
}

describe('applyMarkdownAction — inline wrap', () => {
  it('wraps a selection in bold and selects the inner text', () => {
    const r = run('a brave hero', 2, 7, 'bold');
    expect(r.value).toBe('a **brave** hero');
    expect(r.selected).toBe('brave');
  });

  it('inserts a placeholder when the selection is empty (italic)', () => {
    const r = run('', 0, 0, 'italic');
    expect(r.value).toBe('*italic text*');
    expect(r.selected).toBe('italic text');
  });

  it('wraps with inline code markers', () => {
    const r = run('run npm test now', 4, 12, 'code');
    expect(r.value).toBe('run `npm test` now');
    expect(r.selected).toBe('npm test');
  });
});

describe('applyMarkdownAction — link', () => {
  it('uses the selection as link text and selects the url', () => {
    const r = run('see docs here', 4, 8, 'link');
    expect(r.value).toBe('see [docs](url) here');
    expect(r.selected).toBe('url');
  });

  it('inserts [text](url) and selects "text" when empty', () => {
    const r = run('', 0, 0, 'link');
    expect(r.value).toBe('[text](url)');
    expect(r.selected).toBe('text');
  });
});

describe('applyMarkdownAction — line prefixes', () => {
  it('prefixes a single line with a heading', () => {
    const r = run('Title', 2, 2, 'h2');
    expect(r.value).toBe('## Title');
    expect(r.selected).toBe('## Title');
  });

  it('prefixes every spanned line for a bullet list', () => {
    const value = 'one\ntwo\nthree';
    const r = run(value, 0, value.length, 'ul');
    expect(r.value).toBe('- one\n- two\n- three');
  });

  it('numbers lines sequentially for an ordered list', () => {
    const value = 'one\ntwo\nthree';
    const r = run(value, 0, value.length, 'ol');
    expect(r.value).toBe('1. one\n2. two\n3. three');
  });

  it('expands a mid-line selection to whole lines before quoting', () => {
    const value = 'first\nsecond';
    // selection starts inside "first" and ends inside "second"
    const r = run(value, 2, 8, 'quote');
    expect(r.value).toBe('> first\n> second');
  });
});
