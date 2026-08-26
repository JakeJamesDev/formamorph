import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { tintValue } from '@/lib/previewTint';
import { HIGHLIGHT_COLORS } from '@/lib/markdownToolbar';

// The highlight syntax only proves itself at the far end of the whole pipeline: the remark plugin has to
// match, the marks have to survive the sanitizer, and the classes have to arrive intact for the stylesheet
// to hook. So these render the real component and read the DOM that comes out — never plugin internals.

function marks(markdown: string, tinted = false): HTMLElement[] {
  const { container } = render(<MarkdownRenderer text={markdown} tinted={tinted} />);
  return [...container.querySelectorAll<HTMLElement>('mark')];
}

describe('markdown highlight syntax', () => {
  it('turns ==text== into a mark carrying the default marker classes', () => {
    const [mark, ...rest] = marks('Mind the ==loose plank== there.');
    expect(rest).toHaveLength(0);
    expect(mark.textContent).toBe('loose plank');
    expect([...mark.classList]).toEqual(expect.arrayContaining(['flexible-marker', 'flexible-marker-default']));
  });

  it('gives a color key its own class alongside the shared one', () => {
    const [mark] = marks('=r=Do not touch this==.');
    expect(mark.textContent).toBe('Do not touch this');
    expect([...mark.classList]).toEqual(expect.arrayContaining(['flexible-marker', 'flexible-marker-red']));
    expect(mark.classList).not.toContain('flexible-marker-default');
  });

  it('renders every key the toolbar offers as the class its swatch is drawn with', () => {
    // The toolbar labels each color and paints its swatch with `flexible-marker-<lowercased label>`. That
    // only holds while the plugin's own name for the key agrees, so the two are checked against each other
    // rather than against a second hardcoded list.
    for (const { key, label } of HIGHLIGHT_COLORS) {
      const [mark] = marks(`=${key}=word==`);
      expect([...mark.classList], `key ${key}`).toContain(`flexible-marker-${label.toLowerCase()}`);
    }
  });

  it('still renders a highlight for a key we do not style', () => {
    // A typo'd key must degrade to the themed base rather than dropping the mark or printing the syntax.
    const [mark] = marks('=k=still marked==');
    expect(mark.textContent).toBe('still marked');
    expect([...mark.classList]).toContain('flexible-marker');
  });

  it('carries no inline style, so the sanitizer posture is unchanged', () => {
    const [mark] = marks('==styled by class only==');
    expect(mark.getAttribute('style')).toBeNull();
  });

  it('leaves a lone == expression in prose alone', () => {
    const { container } = render(<MarkdownRenderer text="The check is `a == b` and a==b in prose." />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('needs the content flush against the markers', () => {
    // Documented on the Text Formatting page: padding the content with spaces opts out.
    const { container } = render(<MarkdownRenderer text="== loose plank == stays literal" />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain('== loose plank ==');
  });

  it('reads two adjacent == comparisons as one highlight', () => {
    // The accepted false positive, kept for Obsidian compatibility and warned about in the docs. Pinned so a
    // plugin bump that changes it shows up here rather than in someone's world text.
    const [mark] = marks('a==b and c==d');
    expect(mark.textContent).toBe('b and c');
  });

  it('leaves the syntax literal inside code', () => {
    const { container } = render(<MarkdownRenderer text={'```\n==not a highlight==\n```'} />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toContain('==not a highlight==');
  });

  it('drops an empty marker instead of rendering a hollow mark', () => {
    const { container } = render(<MarkdownRenderer text="Nothing here: ==== and on." />);
    expect(container.querySelectorAll('mark')).toHaveLength(0);
  });

  it('nests inside emphasis, keeping both', () => {
    const { container } = render(<MarkdownRenderer text="*a ==bright== idea*" />);
    const mark = container.querySelector('em mark');
    expect(mark?.textContent).toBe('bright');
  });

  it('renders markdown inside the highlight', () => {
    const { container } = render(<MarkdownRenderer text="==a **bold** claim==" />);
    const mark = container.querySelector('mark');
    // Streamdown renders strong as its own element, so assert the emphasis became markup rather than
    // naming the tag it picked.
    expect(mark?.textContent).toBe('a bold claim');
    expect([...(mark?.children ?? [])].map((c) => c.textContent)).toEqual(['bold']);
  });

  it('renders author highlights in the tinted author preview too', () => {
    // The tinted panes pass their own rehype array, which is exactly where a sanitizer allowance keyed to
    // the default array would silently stop applying.
    const [mark] = marks('Mind the ==loose plank==.', true);
    expect(mark.textContent).toBe('loose plank');
    expect([...mark.classList]).toContain('flexible-marker');
  });

  it('keeps author highlights and chip tints apart in the tinted preview', () => {
    const { container } = render(
      <MarkdownRenderer text={`${tintValue('Mira', '#fde68a')} says ==watch the plank==.`} tinted />,
    );
    const all = [...container.querySelectorAll<HTMLElement>('mark')];
    expect(all.map((m) => m.textContent)).toEqual(['Mira', 'watch the plank']);
    const tint = container.querySelectorAll('mark[data-tint]');
    expect(tint).toHaveLength(1);
    expect(tint[0].textContent).toBe('Mira');
  });
});
