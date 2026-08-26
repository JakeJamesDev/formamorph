// Pure (DOM-free) text transforms behind the World Description markdown toolbar. Each action takes the
// current value + selection and returns the new value plus the selection range to restore.
//
// Every action toggles: applying one that is already in effect removes it. Headings and lists share a
// slot (applying one replaces the other), while quote nests around them independently.

export type WrapAction = 'bold' | 'italic' | 'strike' | 'code' | 'sub' | 'sup';
export type PrefixAction = 'h1' | 'h2' | 'h3' | 'h4' | 'ul' | 'ol' | 'task' | 'quote';

/** The color keys `=r=text==` takes, letters matching the color initials the stylesheet paints. */
export const HIGHLIGHT_COLORS = [
  { key: 'r', label: 'Red' },
  { key: 'o', label: 'Orange' },
  { key: 'y', label: 'Yellow' },
  { key: 'g', label: 'Green' },
  { key: 'c', label: 'Cyan' },
  { key: 'b', label: 'Blue' },
  { key: 'p', label: 'Purple' },
  { key: 'q', label: 'Pink' },
  { key: 'x', label: 'Gray' },
] as const;

export type HighlightColorKey = (typeof HIGHLIGHT_COLORS)[number]['key'];
/** `highlight` is the keyless base, which takes the theme's own color. */
export type HighlightAction = 'highlight' | `highlight:${HighlightColorKey}`;

export type MarkdownAction =
  | WrapAction
  | PrefixAction
  | HighlightAction
  | 'link' | 'image' // inserts taking a url
  | 'codeblock' | 'rule' | 'table'; // block inserts

export interface SelectionEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Markers and empty-selection placeholder for the inline-wrap actions. */
const WRAP: Record<WrapAction, { marker: string; placeholder: string }> = {
  bold: { marker: '**', placeholder: 'bold text' },
  italic: { marker: '*', placeholder: 'italic text' },
  strike: { marker: '~~', placeholder: 'struck text' },
  code: { marker: '`', placeholder: 'code' },
  // Pandoc-style sub/sup, per remarkSubSuper. Their content may not contain whitespace.
  sub: { marker: '~', placeholder: 'sub' },
  sup: { marker: '^', placeholder: 'sup' },
};

/** Line-level prefixes; `ol` is handled specially (sequential numbering). */
const LINE_PREFIX: Record<Exclude<PrefixAction, 'ol'>, string> = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  h4: '#### ',
  ul: '- ',
  task: '- [ ] ',
  quote: '> ',
};

/**
 * True when `marker` sits immediately outside the selection. A single-character marker also matches the
 * inner half of its doubled form (`*` inside `**bold**`, `~` inside `~~struck~~`), so a repeat of the
 * marker just beyond disqualifies it.
 */
function isWrapped(value: string, selStart: number, selEnd: number, marker: string): boolean {
  const before = value.slice(selStart - marker.length, selStart);
  const after = value.slice(selEnd, selEnd + marker.length);
  if (before !== marker || after !== marker) return false;
  if (marker.length > 1) return true;
  return value[selStart - 2] !== marker && value[selEnd + 1] !== marker;
}

/** Wrap the selection (or a placeholder when empty) with `marker`, selecting the inner text. Removes the
 *  markers instead when the selection already carries them, inside or out. */
function wrap(
  value: string, selStart: number, selEnd: number, marker: string, placeholder: string,
): SelectionEdit {
  // Selection sits inside the markers ("**|brave|**") — drop them and keep the text selected.
  if (isWrapped(value, selStart, selEnd, marker)) {
    const inner = value.slice(selStart, selEnd);
    const start = selStart - marker.length;
    return {
      value: value.slice(0, start) + inner + value.slice(selEnd + marker.length),
      selectionStart: start,
      selectionEnd: start + inner.length,
    };
  }
  // Selection covers the markers ("|**brave**|") — same removal, measured from the other side.
  const covered = value.slice(selStart, selEnd);
  if (
    covered.length > marker.length * 2 &&
    covered.startsWith(marker) && covered.endsWith(marker) &&
    isWrapped(value, selStart + marker.length, selEnd - marker.length, marker)
  ) {
    const inner = covered.slice(marker.length, -marker.length);
    return {
      value: value.slice(0, selStart) + inner + value.slice(selEnd),
      selectionStart: selStart,
      selectionEnd: selStart + inner.length,
    };
  }

  const selected = covered || placeholder;
  const inserted = `${marker}${selected}${marker}`;
  const innerStart = selStart + marker.length;
  return {
    value: value.slice(0, selStart) + inserted + value.slice(selEnd),
    selectionStart: innerStart,
    selectionEnd: innerStart + selected.length,
  };
}

const HIGHLIGHT_PLACEHOLDER = 'highlighted text';
const HIGHLIGHT_CLOSE = '==';
/** An opening marker sitting immediately before a position, capturing the color key it carries. */
const HIGHLIGHT_OPEN_BEFORE = /=([a-z]?)=$/;
/** A whole highlight, markers included, as a covering selection sees it. */
const HIGHLIGHT_COVERED = /^=([a-z]?)=([\s\S]+)==$/;

export function isHighlightAction(action: MarkdownAction): action is HighlightAction {
  return action === 'highlight' || action.startsWith('highlight:');
}

/** The color key an action carries; empty for the themed base. */
function highlightKey(action: HighlightAction): string {
  return action === 'highlight' ? '' : action.slice('highlight:'.length);
}

/** The highlight the selection sits exactly inside, or null. Both markers must be there: a bare `==` in
 *  front of the selection is ordinary prose unless something closes it right after. */
function highlightAround(value: string, selStart: number, selEnd: number): { key: string; start: number } | null {
  if (value.slice(selEnd, selEnd + HIGHLIGHT_CLOSE.length) !== HIGHLIGHT_CLOSE) return null;
  const match = HIGHLIGHT_OPEN_BEFORE.exec(value.slice(0, selStart));
  return match ? { key: match[1], start: selStart - match[0].length } : null;
}

/**
 * Wrap the selection in a highlight, or retarget the one it already carries: the same color again removes
 * the markers, a different one swaps the opener so the run recolors in place. Nesting instead would give
 * `=b==r=text====`, which reads as a highlight of the literal text `=r=text`.
 *
 * The markers are asymmetric — `=r=` opens and a plain `==` closes — so this can't go through `wrap`.
 */
function highlight(value: string, selStart: number, selEnd: number, key: string): SelectionEdit {
  const open = `=${key}=`;

  // Selection sits inside the markers ("=r=|brave|==").
  const inside = highlightAround(value, selStart, selEnd);
  if (inside) {
    const inner = value.slice(selStart, selEnd);
    const rest = value.slice(selEnd + HIGHLIGHT_CLOSE.length);
    const body = inside.key === key ? inner : `${open}${inner}${HIGHLIGHT_CLOSE}`;
    const innerStart = inside.start + (inside.key === key ? 0 : open.length);
    return {
      value: value.slice(0, inside.start) + body + rest,
      selectionStart: innerStart,
      selectionEnd: innerStart + inner.length,
    };
  }

  // Selection covers the markers ("|=r=brave==|").
  const covered = HIGHLIGHT_COVERED.exec(value.slice(selStart, selEnd));
  if (covered) {
    const inner = covered[2];
    const body = covered[1] === key ? inner : `${open}${inner}${HIGHLIGHT_CLOSE}`;
    const innerStart = selStart + (covered[1] === key ? 0 : open.length);
    return {
      value: value.slice(0, selStart) + body + value.slice(selEnd),
      selectionStart: innerStart,
      selectionEnd: innerStart + inner.length,
    };
  }

  const selected = value.slice(selStart, selEnd) || HIGHLIGHT_PLACEHOLDER;
  const innerStart = selStart + open.length;
  return {
    value: value.slice(0, selStart) + open + selected + HIGHLIGHT_CLOSE + value.slice(selEnd),
    selectionStart: innerStart,
    selectionEnd: innerStart + selected.length,
  };
}

/**
 * Insert a `[text](url)` link — or `![alt](url)` for an image — selecting the url, or the placeholder
 * text when nothing was selected and the author still has to say what the link reads as.
 */
function link(value: string, selStart: number, selEnd: number, image: boolean): SelectionEdit {
  const lead = image ? '![' : '[';
  const selected = value.slice(selStart, selEnd);
  if (selected) {
    const inserted = `${lead}${selected}](url)`;
    const urlStart = selStart + lead.length + selected.length + 2; // after `](`
    return {
      value: value.slice(0, selStart) + inserted + value.slice(selEnd),
      selectionStart: urlStart,
      selectionEnd: urlStart + 3, // "url"
    };
  }
  const label = image ? 'alt' : 'text';
  const inserted = `${lead}${label}](url)`;
  const labelStart = selStart + lead.length;
  return {
    value: value.slice(0, selStart) + inserted + value.slice(selEnd),
    selectionStart: labelStart,
    selectionEnd: labelStart + label.length,
  };
}

const TABLE_SKELETON = '| Column | Column |\n| --- | --- |\n| Cell | Cell |';

/**
 * Insert a block that stands on its own line — a fenced code block around the selection, a rule, or a
 * table skeleton. Blank lines are added only where the surrounding text does not already supply them.
 */
function insertBlock(
  value: string, selStart: number, selEnd: number, action: 'codeblock' | 'rule' | 'table',
): SelectionEdit {
  const selected = value.slice(selStart, selEnd);
  const body = action === 'codeblock'
    ? `\`\`\`\n${selected || 'code'}\n\`\`\``
    : action === 'rule' ? '---' : TABLE_SKELETON;

  const before = value.slice(0, selStart).endsWith('\n') || selStart === 0 ? '' : '\n';
  const after = value.slice(selEnd).startsWith('\n') || selEnd === value.length ? '' : '\n';
  const inserted = before + body + after;
  return {
    value: value.slice(0, selStart) + inserted + value.slice(selEnd),
    selectionStart: selStart + before.length,
    selectionEnd: selStart + before.length + body.length,
  };
}

// Heading and list markers occupy one slot per line, so applying one clears whatever was there.
const BLOCK_MARKER = /^(?:#{1,6} |[-*] (?:\[[ xX]\] )?|\d+\. )/;
// Quote nests outside that slot: `> - item` is a bulleted line inside a quote, and stripping the `> `
// to bullet it would silently pull the line out of the quote.
const QUOTE_MARKER = /^(?:> )+/;

const TASK_MARKER = /^[-*] \[[ xX]\] /;

/** True when `line` (already stripped of its quote marker) carries this action's own marker. */
function hasMarker(line: string, action: Exclude<PrefixAction, 'quote'>): boolean {
  if (action === 'ol') return /^\d+\. /.test(line);
  if (action === 'task') return TASK_MARKER.test(line);
  // A checked or unchecked box is a task line, not a plain bullet, so `ul` converts rather than clears it.
  if (action === 'ul') return line.startsWith('- ') && !TASK_MARKER.test(line);
  return line.startsWith(LINE_PREFIX[action]);
}

/**
 * Prefix every line spanned by the selection. The selection is first expanded to whole lines; the
 * returned selection covers the prefixed block. `ol` numbers lines sequentially.
 *
 * Toggles: when every spanned line already carries this marker the marker is removed instead, and a
 * heading/list marker belonging to a different action is replaced rather than stacked.
 */
function prefixLines(
  value: string, selStart: number, selEnd: number, action: PrefixAction,
): SelectionEdit {
  const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const lineEnd = value.indexOf('\n', selEnd);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;

  const lines = value.slice(blockStart, blockEnd).split('\n');
  // Hold each line's quote marker aside so the block ops below only ever see the line's own content.
  const quotes = lines.map((line) => QUOTE_MARKER.exec(line)?.[0] ?? '');
  const bodies = lines.map((line, i) => line.slice(quotes[i].length));

  let out: string[];
  if (action === 'quote') {
    const allQuoted = quotes.every((q) => q !== '');
    out = lines.map((line) => (allQuoted ? line.slice(2) : `> ${line}`));
  } else {
    const on = bodies.every((body) => hasMarker(body, action));
    const stripped = bodies.map((body) => body.replace(BLOCK_MARKER, ''));
    out = stripped.map((body, i) => (
      quotes[i] + (on ? body : `${action === 'ol' ? `${i + 1}. ` : LINE_PREFIX[action]}${body}`)
    ));
  }
  const prefixed = out.join('\n');

  return {
    value: value.slice(0, blockStart) + prefixed + value.slice(blockEnd),
    selectionStart: blockStart,
    selectionEnd: blockStart + prefixed.length,
  };
}

/** Apply a toolbar action to `value`, returning the new value and the selection to restore. */
export function applyMarkdownAction(
  value: string, selStart: number, selEnd: number, action: MarkdownAction,
): SelectionEdit {
  if (isHighlightAction(action)) return highlight(value, selStart, selEnd, highlightKey(action));
  switch (action) {
    case 'bold':
    case 'italic':
    case 'strike':
    case 'code':
    case 'sub':
    case 'sup': {
      const { marker, placeholder } = WRAP[action];
      return wrap(value, selStart, selEnd, marker, placeholder);
    }
    case 'link':
    case 'image':
      return link(value, selStart, selEnd, action === 'image');
    case 'codeblock':
    case 'rule':
    case 'table':
      return insertBlock(value, selStart, selEnd, action);
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'ul':
    case 'ol':
    case 'task':
    case 'quote':
      return prefixLines(value, selStart, selEnd, action);
  }
}
