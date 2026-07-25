import { describe, it, expect } from 'vitest';
import { remarkSubSuper } from './remarkSubSuper';

/** The plugin receives an mdast tree; build the shapes it actually sees rather than a parser's output. */
interface Node { type: string; value?: string; children?: Node[]; data?: { hName?: string } }
const para = (...children: Node[]): Node => ({ type: 'root', children: [{ type: 'paragraph', children }] });
const text = (value: string): Node => ({ type: 'text', value });

/** Run the plugin and hand back the paragraph's children. */
function run(tree: Node): Node[] {
  remarkSubSuper()(tree);
  return tree.children![0].children!;
}

describe('remarkSubSuper', () => {
  it('converts ~x~ to a sub element', () => {
    const out = run(para(text('H~2~O')));
    expect(out).toEqual([
      { type: 'text', value: 'H' },
      { type: 'subscript', data: { hName: 'sub' }, children: [{ type: 'text', value: '2' }] },
      { type: 'text', value: 'O' },
    ]);
  });

  it('converts ^x^ to a sup element', () => {
    const out = run(para(text('x^2^')));
    expect(out[1]).toEqual({ type: 'superscript', data: { hName: 'sup' }, children: [{ type: 'text', value: '2' }] });
  });

  it('converts several occurrences in one run of text', () => {
    const out = run(para(text('a^1^ b~2~')));
    expect(out.filter((n) => n.type === 'superscript')).toHaveLength(1);
    expect(out.filter((n) => n.type === 'subscript')).toHaveLength(1);
  });

  it('nests the two forms', () => {
    const [node] = run(para(text('~a^b^~')));
    expect(node.type).toBe('subscript');
    expect(node.children![1]).toMatchObject({ type: 'superscript', children: [{ type: 'text', value: 'b' }] });
  });

  // The whitespace rule is what stops a lone tilde in prose from pairing with a later one and swallowing
  // the text between them — the failure mode that makes a naive implementation unusable for narration.
  it('leaves delimiters that would span whitespace alone', () => {
    const out = run(para(text('about ~5 minutes and ~10 more')));
    expect(out).toEqual([{ type: 'text', value: 'about ~5 minutes and ~10 more' }]);
  });

  it('leaves an unpaired delimiter alone', () => {
    const out = run(para(text('50~60 degrees')));
    expect(out).toEqual([{ type: 'text', value: '50~60 degrees' }]);
  });

  it('leaves text with no delimiters untouched', () => {
    const out = run(para(text('plain narration text')));
    expect(out).toEqual([{ type: 'text', value: 'plain narration text' }]);
  });

  // Code spans and raw HTML parse to their own node types; the walk must not rewrite their values, which is
  // what keeps `<sub>` and backticked text working as-is.
  it('does not touch non-text nodes', () => {
    const tree = para(
      { type: 'inlineCode', value: 'H~2~O' },
      { type: 'html', value: '<sub>2</sub>' },
    );
    const out = run(tree);
    expect(out).toEqual([
      { type: 'inlineCode', value: 'H~2~O' },
      { type: 'html', value: '<sub>2</sub>' },
    ]);
  });

  it('descends into nested children', () => {
    const tree: Node = { type: 'root', children: [
      { type: 'blockquote', children: [{ type: 'paragraph', children: [text('x^2^')] }] },
    ] };
    remarkSubSuper()(tree);
    const inner = tree.children![0].children![0].children!;
    expect(inner[1]).toMatchObject({ type: 'superscript' });
  });

  // The matcher is a module-level /g regex, so a stale `lastIndex` would make every other call skip matches.
  it('gives the same result when run repeatedly', () => {
    const first = run(para(text('H~2~O')));
    const second = run(para(text('H~2~O')));
    expect(second).toEqual(first);
    expect(second).toHaveLength(3);
  });
});
