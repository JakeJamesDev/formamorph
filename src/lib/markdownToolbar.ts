// Pure (DOM-free) text transforms behind the World Description markdown toolbar. Each action takes the
// current value + selection and returns the new value plus the selection range to restore.

export type MarkdownAction =
  | 'bold' | 'italic' | 'code' | 'link' // inline wrap
  | 'h1' | 'h2' | 'ul' | 'ol' | 'quote'; // line prefix

export interface SelectionEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Markers and empty-selection placeholder for the inline-wrap actions. */
const WRAP: Record<'bold' | 'italic' | 'code', { marker: string; placeholder: string }> = {
  bold: { marker: '**', placeholder: 'bold text' },
  italic: { marker: '*', placeholder: 'italic text' },
  code: { marker: '`', placeholder: 'code' },
};

/** Line-level prefixes; `ol` is handled specially (sequential numbering). */
const LINE_PREFIX: Record<'h1' | 'h2' | 'ul' | 'quote', string> = {
  h1: '# ',
  h2: '## ',
  ul: '- ',
  quote: '> ',
};

/** Wrap the selection (or a placeholder when empty) with `marker`, selecting the inner text. */
function wrap(
  value: string, selStart: number, selEnd: number, marker: string, placeholder: string,
): SelectionEdit {
  const selected = value.slice(selStart, selEnd) || placeholder;
  const inserted = `${marker}${selected}${marker}`;
  const innerStart = selStart + marker.length;
  return {
    value: value.slice(0, selStart) + inserted + value.slice(selEnd),
    selectionStart: innerStart,
    selectionEnd: innerStart + selected.length,
  };
}

/** Insert a `[text](url)` link, selecting the url (or the placeholder text when nothing is selected). */
function link(value: string, selStart: number, selEnd: number): SelectionEdit {
  const selected = value.slice(selStart, selEnd);
  if (selected) {
    const inserted = `[${selected}](url)`;
    const urlStart = selStart + selected.length + 3; // after `[selected](`
    return {
      value: value.slice(0, selStart) + inserted + value.slice(selEnd),
      selectionStart: urlStart,
      selectionEnd: urlStart + 3, // "url"
    };
  }
  const inserted = '[text](url)';
  return {
    value: value.slice(0, selStart) + inserted + value.slice(selEnd),
    selectionStart: selStart + 1,
    selectionEnd: selStart + 5, // "text"
  };
}

/**
 * Prefix every line spanned by the selection. The selection is first expanded to whole lines; the
 * returned selection covers the prefixed block. `ol` numbers lines sequentially.
 */
function prefixLines(
  value: string, selStart: number, selEnd: number, action: 'h1' | 'h2' | 'ul' | 'ol' | 'quote',
): SelectionEdit {
  const blockStart = value.lastIndexOf('\n', selStart - 1) + 1;
  const lineEnd = value.indexOf('\n', selEnd);
  const blockEnd = lineEnd === -1 ? value.length : lineEnd;

  const block = value.slice(blockStart, blockEnd);
  const prefixed = block
    .split('\n')
    .map((line, i) => `${action === 'ol' ? `${i + 1}. ` : LINE_PREFIX[action]}${line}`)
    .join('\n');

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
  switch (action) {
    case 'bold':
    case 'italic':
    case 'code': {
      const { marker, placeholder } = WRAP[action];
      return wrap(value, selStart, selEnd, marker, placeholder);
    }
    case 'link':
      return link(value, selStart, selEnd);
    case 'h1':
    case 'h2':
    case 'ul':
    case 'ol':
    case 'quote':
      return prefixLines(value, selStart, selEnd, action);
  }
}
