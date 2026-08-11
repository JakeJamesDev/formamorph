import { describe, it, expect } from 'vitest';
import { highlightCode, type CodeToken } from './codeHighlight';

/** The rendered text has to survive the split, or the preview would show something other than the code. */
const joined = (tokens: CodeToken[]) => tokens.map(token => token.text).join('');
const classOf = (tokens: CodeToken[], text: string) => tokens.find(token => token.text === text)?.className;

describe('highlightCode', () => {
  it('reproduces the code exactly, whatever it splits into', () => {
    const code = 'const a = 1; // note\nreturn "x" + a;';
    expect(joined(highlightCode(code))).toBe(code);
  });

  it('names the token classes a reader scans for', () => {
    const tokens = highlightCode('const total = 42; // sum\nreturn "done";');
    expect(classOf(tokens, 'const')).toBe('tok-keyword');
    expect(classOf(tokens, '42')).toBe('tok-number');
    expect(classOf(tokens, '"done"')).toBe('tok-string');
    expect(classOf(tokens, '// sum')).toBe('tok-comment');
    expect(classOf(tokens, 'total')).toBeTruthy();
  });

  it('leaves whitespace and unclassified text plain rather than dropping it', () => {
    const tokens = highlightCode('  x  ');
    expect(joined(tokens)).toBe('  x  ');
    expect(tokens.some(token => token.className === '')).toBe(true);
  });

  it('parses code that is not valid JavaScript without throwing', () => {
    expect(() => highlightCode('return (((;')).not.toThrow();
    expect(joined(highlightCode('return (((;'))).toBe('return (((;');
  });

  it('marks template slots as one token when asked', () => {
    const tokens = highlightCode('return {{amount:number=1}};', { slots: true });
    expect(joined(tokens)).toBe('return {{amount:number=1}};');
    expect(classOf(tokens, '{{amount:number=1}}')).toBe('tok-slot');
  });

  it('leaves slot syntax to the JavaScript grammar when slots are not in play', () => {
    const tokens = highlightCode('return {{amount:number=1}};');
    expect(tokens.every(token => token.className !== 'tok-slot')).toBe(true);
    expect(joined(tokens)).toBe('return {{amount:number=1}};');
  });

  it('marks every slot in a line, keeping the code between them highlighted', () => {
    const tokens = highlightCode('return {{a:number=1}} + {{b:number=2}};', { slots: true });
    expect(tokens.filter(token => token.className === 'tok-slot')).toHaveLength(2);
    expect(classOf(tokens, 'return')).toBe('tok-keyword');
  });

  it('returns nothing for empty code', () => {
    expect(highlightCode('')).toEqual([]);
  });
});
