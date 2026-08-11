/**
 * JavaScript syntax colouring for stat code, shared by the editor and the read-only previews.
 *
 * The style hands out class names rather than colours, so the palette lives in CSS next to the app's own
 * tokens and both themes come for free. `highlightCode` is the preview half: a string in, coloured spans
 * out, with no editor mounted.
 */

import { HighlightStyle } from '@codemirror/language';
import { javascriptLanguage } from '@codemirror/lang-javascript';
import { highlightTree, tags as t } from '@lezer/highlight';
import { findSlotRanges } from '@/lib/statCodeTemplates';

/** The class a template slot gets in both surfaces. */
export const SLOT_CLASS = 'tok-slot';

/** Deliberately coarse: the point is to tell strings, numbers, keywords and comments apart at a glance,
 *  not to give every node in the grammar its own hue. */
export const codeHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword], class: 'tok-keyword' },
  { tag: [t.string, t.special(t.string), t.regexp], class: 'tok-string' },
  { tag: [t.number, t.bool, t.null], class: 'tok-number' },
  { tag: [t.comment, t.lineComment, t.blockComment], class: 'tok-comment' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tok-function' },
  { tag: [t.propertyName, t.attributeName], class: 'tok-property' },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName)], class: 'tok-definition' },
  { tag: [t.variableName, t.className, t.typeName, t.namespace], class: 'tok-variable' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], class: 'tok-punctuation' },
  { tag: t.invalid, class: 'tok-invalid' },
]);

/** One run of code carrying a single style. `className` is empty for text the grammar had nothing to say
 *  about, which still has to be rendered — the joined tokens are the code, exactly. */
export interface CodeToken {
  text: string;
  className: string;
}

/**
 * Split code into styled runs. Slot syntax, when the surface has slots, wins over whatever the JavaScript
 * grammar made of it — `{{name:number=1}}` is a fill-in point, not an object literal.
 */
export function highlightCode(code: string, options?: { slots?: boolean }): CodeToken[] {
  if (!code) return [];

  // One class per character, then coalesced: slots overlap grammar tokens arbitrarily, and overwriting is
  // simpler to keep correct than trimming ranges around each other.
  const classes = new Array<string>(code.length).fill('');
  highlightTree(javascriptLanguage.parser.parse(code), codeHighlightStyle, (from, to, className) => {
    for (let i = from; i < to; i += 1) classes[i] = className;
  });

  if (options?.slots) {
    for (const { from, to } of findSlotRanges(code)) {
      for (let i = from; i < to; i += 1) classes[i] = SLOT_CLASS;
    }
  }

  const tokens: CodeToken[] = [];
  let start = 0;
  for (let i = 1; i <= code.length; i += 1) {
    if (i === code.length || classes[i] !== classes[start]) {
      tokens.push({ text: code.slice(start, i), className: classes[start] });
      start = i;
    }
  }
  return tokens;
}
