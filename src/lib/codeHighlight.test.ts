import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const JSON_SAMPLE = '{\n  "matches": [\n    { "name": "Molly", "age": 32, "alive": true, "note": null }\n  ]\n}';

describe('highlightCode with JSON', () => {
  it('reproduces the text exactly', () => {
    expect(joined(highlightCode(JSON_SAMPLE, { language: 'json' }))).toBe(JSON_SAMPLE);
  });

  it('tells keys, strings, numbers and literals apart', () => {
    const tokens = highlightCode(JSON_SAMPLE, { language: 'json' });
    expect(classOf(tokens, '"matches"')).toBe('tok-property');
    expect(classOf(tokens, '"Molly"')).toBe('tok-string');
    expect(classOf(tokens, '32')).toBe('tok-number');
    expect(classOf(tokens, 'true')).toBe('tok-number');
    expect(classOf(tokens, 'null')).toBe('tok-number');
  });

  it('reads JSON keys as plain strings under the JavaScript grammar', () => {
    // The language option is what makes a key a key; without it the same text is an object of strings.
    expect(classOf(highlightCode('{ "name": 1 }'), '"name"')).toBe('tok-string');
  });

  it('keeps malformed JSON whole', () => {
    const broken = '{ "name": "Molly", ';
    expect(joined(highlightCode(broken, { language: 'json' }))).toBe(broken);
  });
});

/** Reads the `--code-*` palette for one mode block of `index.css`, and that mode's page background. */
function paletteFor(css: string, selector: ':root' | '.dark') {
  const escaped = selector.replace('.', '\\.');
  const vars = (block: string) => Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)]
      .map(([, name, h, s, l]) => [name, [Number(h), Number(s), Number(l)] as const]),
  );
  // The code palette block is the one declaring `--code-keyword`; the first block per selector holds the
  // default theme's background.
  const blocks = [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'g'))].map((m) => m[1]);
  const code = vars(blocks.find((block) => block.includes('--code-keyword')) ?? '');
  const background = vars(blocks.find((block) => block.includes('--background:')) ?? '').background;
  return { code, background };
}

/** WCAG relative luminance of an HSL triple. */
function luminance([h, s, l]: readonly [number, number, number]): number {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(channel(0)) + 0.7152 * linear(channel(8)) + 0.0722 * linear(channel(4));
}

const contrast = (a: readonly [number, number, number], b: readonly [number, number, number]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe.each([':root', '.dark'] as const)('JSON token colors in %s', (selector) => {
  const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
  const { code, background } = paletteFor(css, selector);
  const classes = [...new Set(highlightCode(JSON_SAMPLE, { language: 'json' }).map((token) => token.className))]
    .filter(Boolean);

  it.each(classes)('%s has a legible color', (className) => {
    const rule = new RegExp(`\\.${className}\\s*\\{[^}]*color:\\s*hsl\\(var\\(--([\\w-]+)\\)\\)`).exec(css);
    expect(rule, `${className} has no color rule`).not.toBeNull();
    const color = code[rule![1]];
    expect(color, `--${rule![1]} is not set in ${selector}`).toBeDefined();
    expect(background).toBeDefined();
    // WCAG AA for body text.
    expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5);
  });
});
