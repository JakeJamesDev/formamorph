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

/** Cells of a pipe row after dropping the optional outer pipes. */
function tableCells(line: string): string[] {
  return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
}

/** A delimiter row (complete or still typing): only pipes/dashes/colons/space, with at least one dash. */
function isDelimiterRow(line: string): boolean {
  return /-/.test(line) && /^[\s|:-]*$/.test(line);
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

  // A trailing run of delimiter characters is an in-progress token while streaming — we can't yet
  // tell `*` from `**`/`***` (or a lone backtick from a code span), so hold it back until the next
  // character arrives. Without this the render flickers as a closing delimiter types in.
  const src = text.replace(/[*_~`]+$/, '');
  if (!src) return '';

  const st: ScanState = { fence: null, codeTicks: 0, emphasis: [] };

  for (const line of src.split('\n')) {
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
    return src + (src.endsWith('\n') ? '' : '\n') + st.fence;
  }
  let out: string;
  if (st.codeTicks > 0) {
    out = src + '`'.repeat(st.codeTicks); // inside inline code — leave tables/links literal
  } else {
    out = src;
    if (/\]\([^)\n]*$/.test(out)) out += ')'; // close an in-progress link so the label renders now
  }
  if (st.emphasis.length) {
    // A closing emphasis delimiter can't sit after whitespace (CommonMark flanking), or the whole
    // run renders unstyled for a frame as the reveal crosses a space — a visible flicker. Tuck the
    // synthetic closers tight against the content, keeping the trailing whitespace after them.
    const ws = out.match(/\s+$/)?.[0] ?? '';
    const core = ws ? out.slice(0, out.length - ws.length) : out;
    if (ws && core && !/[*_~`]$/.test(core)) {
      out = core;
      for (let i = st.emphasis.length - 1; i >= 0; i--) out += st.emphasis[i];
      out += ws;
    } else {
      for (let i = st.emphasis.length - 1; i >= 0; i--) out += st.emphasis[i];
    }
  }
  return out;
}

/** While a heading's `#` run is still typing, render the buffer's final level so the heading doesn't
 *  remount as it deepens (`#` → `##` → `###`). Only the frontier (last) line can be mid-typing. */
function upgradeHeadingLevel(visible: string, buffer: string): string {
  const vLines = visible.split('\n');
  const i = vLines.length - 1;
  const vHash = vLines[i].match(/^#{1,6}/);
  if (!vHash) return visible;
  const bLine = buffer.split('\n')[i] ?? '';
  const bHash = bLine.match(/^#{1,6}/);
  if (bHash && bHash[0].length > vHash[0].length && /^#{1,6}\s/.test(bLine)) {
    vLines[i] = bHash[0] + vLines[i].slice(vHash[0].length);
    return vLines.join('\n');
  }
  return visible;
}

/** While a link is typing — label, `]`, or a partial `](url` — render it as a finished link with the
 *  URL pulled from `buffer` (hidden in the href). This spans the whole in-progress region so the
 *  `<a>` never drops out between `]` and the closing `)`. A bare bracket (no link in the buffer) is
 *  left untouched. */
function completeLinkFromBuffer(visible: string, buffer: string): string {
  const open = visible.lastIndexOf('[');
  if (open === -1) return visible;
  const tail = visible.slice(open);
  if (/^\[[^\]\n]*\]\([^)\s]*\)/.test(tail)) return visible; // already a complete link tail
  const bm = buffer.slice(open).match(/^\[[^\]\n]*\]\(([^)\s]*)\)/);
  if (!bm) return visible; // the buffer shows no link here — don't fabricate one
  const label = tail.match(/^\[([^\]\n]*)\]?/)?.[1] ?? '';
  return `${visible.slice(0, open)}[${label}](${bm[1]})`;
}

/** While a block-level marker is still typing, render the buffer's final marker so the block doesn't
 *  remount as it resolves: a `-` settling into a `---` rule (vs. a bullet), an `N` becoming an `N.`
 *  ordered item (vs. a paragraph), a `- [` becoming a `- [x]` task item, or a bare `-` bullet that
 *  would briefly read as a Setext heading underline of the line above. Frontier line only. */
function upgradeBlockMarker(visible: string, buffer: string): string {
  const vLines = visible.split('\n');
  const i = vLines.length - 1;
  const v = vLines[i];
  const b = buffer.split('\n')[i] ?? '';

  // Thematic break: the buffer line is 3+ of the same -/*/_; a partial `-`/`--` reads as a bullet.
  if (/^ {0,3}([-*_])(?: *\1){2,} *$/.test(b)) {
    if (v !== b) {
      vLines[i] = b;
      return vLines.join('\n');
    }
    return visible;
  }
  // Ordered list: the buffer line starts `N. `/`N) `; a bare `N` (no delimiter yet) reads as a paragraph.
  const bo = b.match(/^(\s*)(\d+)([.)] )/);
  if (bo && !/^\s*\d+[.)] /.test(v) && /^\s*\d+[.)]? *$/.test(v)) {
    vLines[i] = bo[1] + (v.match(/\d+/)?.[0] ?? bo[2]) + bo[3];
    return vLines.join('\n');
  }
  // Task list: the buffer line starts `- [x] `/`- [ ] `; while `- [`/`- [ `/`- [x`/`- [x] ` types it
  // reads as a bullet (or a contentless, unchecked-looking checkbox). Snap to the buffer's marker plus
  // its first content char so it's a complete, correctly-checked task item from the first frame.
  const bt = b.match(/^(\s*[-*+] \[[ xX]\] )(\S?)/);
  if (bt && !/^\s*[-*+] \[[ xX]\] \S/.test(v)) {
    vLines[i] = bt[1] + bt[2];
    return vLines.join('\n');
  }
  // Bare bullet: a marker-only line (`-`/`  -`) is a valid Setext underline, so the line above flips
  // to a heading until content types. Reveal the buffer's first content char to keep it a list item.
  if (/^ {0,3}[-*+] *$/.test(v)) {
    const bb = b.match(/^ {0,3}[-*+] +\S/);
    if (bb) {
      vLines[i] = bb[0];
      return vLines.join('\n');
    }
  }
  return visible;
}

/** Keep a streaming pipe-table rendering as a table (not literal-pipe text) the moment the buffer
 *  shows it's a GFM table, by ensuring a column-matching delimiter row is present. Columns and rows
 *  are left to grow/reflow naturally as they type — only the revert-to-plain-text flicker is removed. */
function stabilizeTable(visible: string, buffer: string): string {
  const vLines = visible.split('\n');
  // Find the trailing table block by its last non-empty line, so a just-completed row plus its
  // newline (an empty last line) doesn't hide the block and flip the table back to a raw parse.
  let last = vLines.length - 1;
  while (last >= 0 && vLines[last].trim() === '') last--;
  if (last < 0 || !/^\s*\|/.test(vLines[last])) return visible;
  let start = last;
  for (let i = last; i >= 0; i--) {
    if (/^\s*\|/.test(vLines[i])) start = i;
    else break;
  }

  const headerCols = Math.max(1, tableCells(vLines[start]).length);
  const delimLine = vLines[start + 1];
  // A real delimiter matching the header's columns is already a valid table — let it render and reflow.
  if (delimLine !== undefined && isDelimiterRow(delimLine) && tableCells(delimLine).length === headerCols) {
    return visible;
  }
  // Only synthesize when the buffer confirms this block becomes a table (its second line is a delimiter).
  if (!isDelimiterRow(buffer.split('\n')[start + 1] ?? '')) return visible;
  // Header (and maybe a partial/mismatched delimiter slot) is all that's revealed — give it a delimiter
  // matching the header's current columns so it renders as a table now; it reflows as more cells type.
  const delim = '| ' + Array(headerCols).fill('---').join(' | ') + ' |';
  return [...vLines.slice(0, start + 1), delim].join('\n');
}

/**
 * Render a streaming markdown prefix using the full look-ahead `buffer` (everything received so far,
 * ahead of what's revealed) so multi-token / multi-line constructs render in their final form from
 * the first revealed character — never remounting (flickering) as they resolve. Covers heading level,
 * block markers (thematic break, ordered/task lists), links, and tables; emphasis/code/fences fall
 * through to `autoCloseMarkdown`. Degrades to `autoCloseMarkdown(visible)` when there's no look-ahead.
 */
export function streamingMarkdown(visible: string, buffer: string): string {
  let s = upgradeHeadingLevel(visible, buffer);
  s = upgradeBlockMarker(s, buffer);
  s = completeLinkFromBuffer(s, buffer);
  s = stabilizeTable(s, buffer);
  return autoCloseMarkdown(s);
}
