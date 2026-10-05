import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { SCROLL_GUARD_TAGS, checkScrollSource } from './scrollGuard';

const NATIVE = `export const A = () => <div className="max-h-40 overflow-y-auto">x</div>;\n`;
const SHARED = `import { ScrollArea } from '@/components/ui/scroll-area';\n` + NATIVE;

describe('checkScrollSource', () => {
  it('flags a native scroller in a file with no ScrollArea and no allow comment', () => {
    expect(checkScrollSource(NATIVE)).toEqual([expect.objectContaining({ line: 1 })]);
  });

  it('passes a file that uses the shared ScrollArea', () => {
    expect(checkScrollSource(SHARED)).toEqual([]);
  });

  it('passes a file with an allow comment that names an exception and a reason', () => {
    const src = NATIVE + `// scroll-guard: allow popover-list: wheel lock inside a dialog\n`;
    expect(checkScrollSource(src)).toEqual([]);
  });

  it.each([
    ['className overflow-auto', `<pre className="overflow-auto" />`],
    ['className overflow-x-auto', `<div className="overflow-x-auto" />`],
    ['className overflow-y-scroll', `<div className="overflow-y-scroll" />`],
    ['variant-prefixed class', `<div className="md:overflow-y-auto" />`],
    ['inline style overflowY', `<div style={{ overflowY: 'auto' }} />`],
    ['inline style overflowX', `<div style={{ overflowX: "scroll" }} />`],
    ['style object overflow', `const s = { overflow: "scroll" };`],
  ])('detects %s', (_name, src) => {
    expect(checkScrollSource(src)).toHaveLength(1);
  });

  it.each([
    ['overflow-hidden', `<div className="overflow-hidden" />`],
    ['overflow-visible', `<div className="overflow-visible" />`],
    ['overflow-wrap utility', `<td className="[overflow-wrap:break-word]" />`],
    ['overflow hidden inline', `<div style={{ overflow: 'hidden' }} />`],
  ])('ignores %s', (_name, src) => {
    expect(checkScrollSource(src)).toEqual([]);
  });

  it('rejects an allow comment with an unknown exception name', () => {
    const src = NATIVE + `// scroll-guard: allow because: it is easier\n`;
    expect(checkScrollSource(src)).toHaveLength(1);
  });

  it('rejects an allow comment with no reason', () => {
    const src = NATIVE + `// scroll-guard: allow horizontal\n`;
    expect(checkScrollSource(src)).toHaveLength(1);
  });

  it('reports the line of each native scroller', () => {
    const src = `const a = 1;\n<div className="overflow-auto" />\n<div className="overflow-y-auto" />\n`;
    expect(checkScrollSource(src).map((v) => v.line)).toEqual([2, 3]);
  });
});

const SRC = resolve(__dirname, '..');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });

describe('native scrollers in the app source', () => {
  it('uses ScrollArea or carries a scroll-guard allow comment in every file', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      checkScrollSource(readFileSync(file, 'utf8')).map(
        (v) => `${relative(SRC, file).replaceAll('\\', '/')}:${v.line} ${v.text}`,
      ),
    );
    expect(offenders, `Use ScrollArea, or add "// scroll-guard: allow <${SCROLL_GUARD_TAGS.join('|')}>: <reason>"`).toEqual([]);
  });
});
