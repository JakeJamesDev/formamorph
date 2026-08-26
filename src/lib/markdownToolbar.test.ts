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

describe('applyMarkdownAction — inline toggle off', () => {
  it('removes the markers when the selection sits inside them', () => {
    const r = run('a **brave** hero', 4, 9, 'bold');
    expect(r.value).toBe('a brave hero');
    expect(r.selected).toBe('brave');
  });

  it('removes the markers when the selection covers them', () => {
    const r = run('a **brave** hero', 2, 11, 'bold');
    expect(r.value).toBe('a brave hero');
    expect(r.selected).toBe('brave');
  });

  it('does not treat the inner half of a bold pair as italic', () => {
    const r = run('a **brave** hero', 4, 9, 'italic');
    expect(r.value).toBe('a ***brave*** hero');
  });

  it('toggles inline code off', () => {
    const r = run('run `npm test` now', 5, 13, 'code');
    expect(r.value).toBe('run npm test now');
  });
});

describe('applyMarkdownAction — added inline actions', () => {
  it('wraps and unwraps strikethrough', () => {
    const on = run('a bad idea', 2, 5, 'strike');
    expect(on.value).toBe('a ~~bad~~ idea');
    expect(run(on.value, 4, 7, 'strike').value).toBe('a bad idea');
  });

  it('does not treat the inner half of a strikethrough pair as subscript', () => {
    const r = run('a ~~bad~~ idea', 4, 7, 'sub');
    expect(r.value).toBe('a ~~~bad~~~ idea');
  });

  it('wraps subscript and superscript with the Pandoc delimiters', () => {
    expect(run('H2O', 1, 2, 'sub').value).toBe('H~2~O');
    expect(run('x2', 1, 2, 'sup').value).toBe('x^2^');
  });

  it('wraps and unwraps a highlight', () => {
    const on = run('mind the loose plank', 9, 20, 'highlight');
    expect(on.value).toBe('mind the ==loose plank==');
    expect(on.selected).toBe('loose plank');
    expect(run(on.value, 11, 22, 'highlight').value).toBe('mind the loose plank');
  });

  it('inserts a highlight placeholder when nothing is selected', () => {
    const r = run('', 0, 0, 'highlight');
    expect(r.value).toBe('==highlighted text==');
    expect(r.selected).toBe('highlighted text');
  });
});

// The colored highlights are the one asymmetric markup the toolbar writes — `=r=` opens, a plain `==`
// closes — so they get their own path rather than the symmetric wrap bold and italic share.
describe('applyMarkdownAction — highlight colors', () => {
  it('opens with the color key and closes plain', () => {
    const r = run('mind the loose plank', 9, 20, 'highlight:r');
    expect(r.value).toBe('mind the =r=loose plank==');
    expect(r.selected).toBe('loose plank');
  });

  it('inserts a colored placeholder when nothing is selected', () => {
    const r = run('', 0, 0, 'highlight:g');
    expect(r.value).toBe('=g=highlighted text==');
    expect(r.selected).toBe('highlighted text');
  });

  it('removes a color when its own key is pressed again', () => {
    const r = run('mind the =r=loose plank==', 12, 23, 'highlight:r');
    expect(r.value).toBe('mind the loose plank');
    expect(r.selected).toBe('loose plank');
  });

  it('recolors in place rather than nesting when a different key is pressed', () => {
    // Pressing blue on red text must swap the opener. Nesting would produce `=b==r=text====`, which reads
    // as a highlight of the literal text "=r=text".
    const r = run('mind the =r=loose plank==', 12, 23, 'highlight:b');
    expect(r.value).toBe('mind the =b=loose plank==');
    expect(r.selected).toBe('loose plank');
  });

  it('takes a colored run down to the themed base', () => {
    const r = run('mind the =r=loose plank==', 12, 23, 'highlight');
    expect(r.value).toBe('mind the ==loose plank==');
  });

  it('colors a run that was highlighted plain', () => {
    const r = run('mind the ==loose plank==', 11, 22, 'highlight:y');
    expect(r.value).toBe('mind the =y=loose plank==');
  });

  it('works from a selection that covers the markers', () => {
    expect(run('mind the =r=loose plank==', 9, 25, 'highlight:r').value).toBe('mind the loose plank');
    expect(run('mind the =r=loose plank==', 9, 25, 'highlight:b').value).toBe('mind the =b=loose plank==');
    expect(run('mind the ==loose plank==', 9, 24, 'highlight').value).toBe('mind the loose plank');
  });

  it('leaves the selection on the text after a recolor from a covering selection', () => {
    const r = run('mind the =r=loose plank==', 9, 25, 'highlight:b');
    expect(r.selected).toBe('loose plank');
  });

  it('does not read an ordinary equals run as a highlight to retarget', () => {
    // `a==b` is not a highlight, so pressing red must wrap the selection rather than treat the `==` in
    // front of it as an opener and swallow it.
    const r = run('a==b', 3, 4, 'highlight:r');
    expect(r.value).toBe('a===r=b==');
  });
});

describe('applyMarkdownAction — inserts', () => {
  it('inserts an image with the alt text selected', () => {
    const r = run('', 0, 0, 'image');
    expect(r.value).toBe('![alt](url)');
    expect(r.selected).toBe('alt');
  });

  it('uses the selection as alt text and selects the url', () => {
    const r = run('a crest here', 2, 7, 'image');
    expect(r.value).toBe('a ![crest](url) here');
    expect(r.selected).toBe('url');
  });

  it('fences the selection as a code block on its own lines', () => {
    const r = run('run this', 4, 8, 'codeblock');
    expect(r.value).toBe('run \n```\nthis\n```');
  });

  it('inserts a rule without doubling existing blank lines', () => {
    const r = run('a\n', 2, 2, 'rule');
    expect(r.value).toBe('a\n---');
  });

  it('inserts a table skeleton', () => {
    const r = run('', 0, 0, 'table');
    expect(r.value).toBe('| Column | Column |\n| --- | --- |\n| Cell | Cell |');
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

describe('applyMarkdownAction — line prefix toggle and replace', () => {
  it('removes the heading when it is already applied', () => {
    const r = run('## Title', 4, 4, 'h2');
    expect(r.value).toBe('Title');
  });

  it('replaces a heading of another level rather than stacking', () => {
    const r = run('## Title', 4, 4, 'h1');
    expect(r.value).toBe('# Title');
  });

  it('replaces a bullet list with a numbered one', () => {
    const value = '- one\n- two';
    const r = run(value, 0, value.length, 'ol');
    expect(r.value).toBe('1. one\n2. two');
  });

  it('removes the bullets when every line already has one', () => {
    const value = '- one\n- two';
    const r = run(value, 0, value.length, 'ul');
    expect(r.value).toBe('one\ntwo');
  });

  it('bullets the remaining lines when only some already have one', () => {
    const value = '- one\ntwo';
    const r = run(value, 0, value.length, 'ul');
    expect(r.value).toBe('- one\n- two');
  });

  it('unquotes a quoted block', () => {
    const value = '> first\n> second';
    const r = run(value, 0, value.length, 'quote');
    expect(r.value).toBe('first\nsecond');
  });

  it('converts a bullet to a task and back', () => {
    const task = run('- one', 3, 3, 'task');
    expect(task.value).toBe('- [ ] one');
    expect(run(task.value, 7, 7, 'ul').value).toBe('- one');
  });

  it('clears a task line when task is applied again, keeping a checked box', () => {
    expect(run('- [x] done', 7, 7, 'task').value).toBe('done');
  });

  it('applies deeper heading levels', () => {
    expect(run('Title', 0, 0, 'h4').value).toBe('#### Title');
    expect(run('#### Title', 6, 6, 'h3').value).toBe('### Title');
  });

  it('bullets inside a quote without unquoting the line', () => {
    const r = run('> a note', 4, 4, 'ul');
    expect(r.value).toBe('> - a note');
  });
});
