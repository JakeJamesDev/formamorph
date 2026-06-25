const WORD = /[A-Za-z0-9]/;

interface ScanState {
  fence: string | null; // '```' or '~~~' when inside a fenced code block
  codeTicks: number; // >0 while inside an inline code span (the opening backtick-run length)
  emphasis: string[]; // open inline markers, innermost last (e.g. '*', '**', '_', '~~')
}

/** Index of the first run of exactly `run` backticks in `s`, or -1. */
function findBacktickRun(s: string, run: number): number {
  let i = 0;
  while (i < s.length) {
    if (s[i] === '`') {
      let j = i;
      while (j < s.length && s[j] === '`') j++;
      if (j - i === run) return i;
      i = j;
    } else {
      i++;
    }
  }
  return -1;
}

/** Scan one line, updating inline code / emphasis state. */
function scanInlineLine(line: string, st: ScanState): void {
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];

    if (c === '`') {
      let j = i;
      while (j < n && line[j] === '`') j++;
      const run = j - i;
      if (st.codeTicks === 0) {
        const closeIdx = findBacktickRun(line.slice(j), run);
        if (closeIdx === -1) {
          st.codeTicks = run; // open code span — rest of line is literal code
          return;
        }
        i = j + closeIdx + run; // skip the complete span (its contents are literal)
        continue;
      }
      if (run === st.codeTicks) st.codeTicks = 0; // matching run closes the span
      i = j;
      continue;
    }

    if (st.codeTicks > 0) {
      i++; // inside inline code: everything is literal
      continue;
    }

    if (c === '*' || c === '_' || c === '~') {
      let j = i;
      while (j < n && line[j] === c) j++;
      let run = j - i;
      const before = i > 0 ? line[i - 1] : '';
      const after = j < n ? line[j] : '';

      // A line-leading "* " / "*" is a list bullet, not emphasis.
      if (c === '*' && run === 1 && line.slice(0, i).trim() === '' && (after === ' ' || after === '')) {
        i = j;
        continue;
      }
      // Only '~~' is strikethrough; a lone '~' is literal.
      if (c === '~') {
        if (run < 2) {
          i = j;
          continue;
        }
        run = 2;
      }
      // Intra-word underscore (snake_case) is literal in GFM.
      if (c === '_' && WORD.test(before) && WORD.test(after)) {
        i = j;
        continue;
      }

      const marker = c === '~' ? '~~' : c.repeat(Math.min(run, 3));
      if (st.emphasis[st.emphasis.length - 1] === marker) st.emphasis.pop();
      else st.emphasis.push(marker);
      i = j;
      continue;
    }

    i++;
  }
}

/**
 * Append the minimal closing markers so a partial markdown stream renders as valid GFM. Used during
 * the live typewriter reveal so a half-typed `*italic`, inline `` `code ``, or fenced block shows
 * formatted immediately and self-corrects as the rest streams in.
 *
 * Conservative and heuristic: it handles the common inline constructs (emphasis, strikethrough,
 * inline code) and open fenced code blocks, and leaves links and tables to render natively. A
 * momentarily-wrong close mis-formats a single frame and corrects as more text arrives; the final
 * (complete) text is always the authoritative render.
 */
export function autoCloseMarkdown(text: string): string {
  if (!text) return text;

  const st: ScanState = { fence: null, codeTicks: 0, emphasis: [] };

  for (const line of text.split('\n')) {
    // Fenced code blocks toggle at line level (but not while inside an inline code span).
    if (st.codeTicks === 0) {
      const fm = line.match(/^\s*(```+|~~~+)/);
      if (fm) {
        const marker = fm[1][0] === '`' ? '```' : '~~~';
        if (st.fence === null) {
          st.fence = marker;
          continue;
        }
        if (st.fence === marker) {
          st.fence = null;
          continue;
        }
      }
    }
    if (st.fence !== null) continue; // literal inside a fenced block
    if (st.codeTicks === 0 && line.trim() === '') {
      st.emphasis.length = 0; // a blank line ends the paragraph; emphasis can't cross it
      continue;
    }
    scanInlineLine(line, st);
  }

  if (st.fence !== null) {
    return text + (text.endsWith('\n') ? '' : '\n') + st.fence;
  }
  let out = text;
  if (st.codeTicks > 0) out += '`'.repeat(st.codeTicks);
  for (let i = st.emphasis.length - 1; i >= 0; i--) out += st.emphasis[i];
  return out;
}
