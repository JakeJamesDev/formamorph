import type { CSSProperties } from 'react';

/**
 * Chip tinting for the author-side Preview panes: the shared mark styling, a sentinel codec, and the rehype
 * plugin that turns the sentinels back into colored marks after the markdown parse.
 *
 * The plain preview can wrap each resolved value in an element as it renders, because it renders the
 * segments itself. The markdown preview cannot — it hands the renderer one string — so a resolving pane
 * wraps each value in Private Use Area characters that carry the chip's color, and this plugin runs last in
 * the renderer's rehype pipeline, splitting text nodes on those characters and wrapping what lies between
 * them. Nothing goes through raw HTML, and running after the sanitizer leaves its posture untouched.
 *
 * Degradation is per value and silent. A value whose sentinels end up in different parents — a blank line
 * inside it, a closer swallowed by a code span — renders untinted rather than failing the pane, and every
 * sentinel character is removed either way. Panes scrub author text and resolved values before wrapping, so
 * no input can forge or break a pairing.
 *
 * Known limit: a value that starts or ends with underscore emphasis (`_word_`) loses that emphasis, because
 * a sentinel reads to CommonMark as an ordinary character and underscore runs may not open intra-word.
 * Asterisk emphasis is unaffected.
 */

// Private Use Area, so nothing an author can type collides. The color rides in the run as six hex digits,
// each offset into its own PUA block — encoded rather than written as ASCII so no part of a sentinel run
// can be read as markdown.
const TINT_START = '\uE000';
const TINT_END = '\uE001';
const EMPTY_AT = '\uE002';
const HEX_BASE = 0xe010;
const HEX_DIGITS = '0123456789abcdef';
const SENTINEL_RANGE = /[\uE000-\uE01F]/;
const SENTINEL_RANGE_G = /[\uE000-\uE01F]/g;
const COLOR_RE = /^#([0-9a-f]{6})$/i;

/** Alpha applied to a chip color behind resolved text. Low enough to read through, high enough to trace. */
const TINT_ALPHA = '59';

/** The tinted run's classes, shared so both panes highlight identically. */
export const TINT_MARK_CLASS = 'rounded px-0.5';

/** Marks a chip tint apart from an author's own `==highlight==`, which is a `<mark>` too. Both panes set it,
 *  and the edit↔preview scroll sync anchors on it so author highlights stay out of the chip ordering. */
export const TINT_MARK_ATTR = 'data-tint';

/** The empty-value marker's classes. A sliver the width of a caret, so it reads as a trace rather than text. */
export const EMPTY_MARK_CLASS =
  'mx-px inline-block h-[0.85em] w-[0.4em] translate-y-[0.1em] rounded-[2px] border border-muted-foreground/50 bg-muted-foreground/25 align-baseline';

/** Names the marker for assistive tech, which has nothing else to go on — the marker holds no text. */
export const EMPTY_MARK_LABEL = 'Empty Value';

/** Inline style for a tinted run in the plain preview. */
export function tintMarkStyle(color: string | undefined): CSSProperties | undefined {
  return color ? { backgroundColor: `${color}${TINT_ALPHA}`, color: 'inherit' } : undefined;
}

/** Inline style for the empty-value marker in the plain preview. */
export function emptyMarkStyle(color: string | undefined): CSSProperties | undefined {
  return color ? { borderColor: color, backgroundColor: `${color}${TINT_ALPHA}` } : undefined;
}

function encodeColor(color: string): string | null {
  const match = COLOR_RE.exec(color);
  if (!match) return null;
  let out = '';
  for (const digit of match[1].toLowerCase()) out += String.fromCharCode(HEX_BASE + HEX_DIGITS.indexOf(digit));
  return out;
}

function decodeColor(chars: string): string | null {
  if (chars.length !== 6) return null;
  let out = '#';
  for (let i = 0; i < 6; i++) {
    const digit = chars.charCodeAt(i) - HEX_BASE;
    if (digit < 0 || digit > 15) return null;
    out += HEX_DIGITS[digit];
  }
  return out;
}

/** Remove every sentinel character. Panes run this over author text and resolved values before wrapping. */
export function stripTintSentinels(text: string): string {
  return text.replace(SENTINEL_RANGE_G, '');
}

/**
 * Wrap a resolved value so the plugin can tint it. Returns the value untouched when the chip has no color,
 * which leaves it as ordinary prose rather than an invisible highlight.
 */
export function tintValue(value: string, color: string | undefined): string {
  const encoded = color ? encodeColor(color) : null;
  return encoded ? `${TINT_START}${encoded}${value}${TINT_END}` : value;
}

/** The marker a chip leaves when it resolved to nothing, so an empty value is visible instead of silent. */
export function emptyMarker(color: string | undefined): string {
  const encoded = color ? encodeColor(color) : null;
  return encoded ? `${EMPTY_AT}${encoded}` : '';
}

/** The hast subset this walks. Only the fields actually read are declared (see remarkSubSuper). */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

function markNode(color: string, children: HastNode[]): HastNode {
  return {
    type: 'element',
    tagName: 'mark',
    properties: {
      className: TINT_MARK_CLASS.split(' '),
      style: `background-color:${color}${TINT_ALPHA};color:inherit`,
      dataTint: '',
    },
    children,
  };
}

function emptyNode(color: string): HastNode {
  return {
    type: 'element',
    tagName: 'mark',
    properties: {
      className: EMPTY_MARK_CLASS.split(' '),
      style: `border-color:${color};background-color:${color}${TINT_ALPHA}`,
      role: 'img',
      ariaLabel: EMPTY_MARK_LABEL,
      dataTint: '',
    },
    children: [],
  };
}

/** Strip sentinels from a subtree without tinting it — for code, where a mark has no business. */
function scrub(node: HastNode): void {
  if (node.type === 'text' && node.value !== undefined) node.value = stripTintSentinels(node.value);
  for (const child of node.children ?? []) scrub(child);
}

/**
 * Rebuild one parent's children with the sentinel runs turned into marks. An opener with no closer at this
 * level unwinds into plain children, which is what makes a block-spanning value bail per value.
 */
function tintChildren(children: HastNode[]): HastNode[] {
  const root: HastNode[] = [];
  const stack: { color: string; out: HastNode[] }[] = [];
  const target = () => (stack.length ? stack[stack.length - 1].out : root);
  const flush = (text: string) => { if (text) target().push({ type: 'text', value: text }); };

  for (const child of children) {
    if (child.type !== 'text' || child.value === undefined) { target().push(child); continue; }
    const value = child.value;
    let buffer = '';
    let i = 0;
    while (i < value.length) {
      const char = value[i];
      if (!SENTINEL_RANGE.test(char)) { buffer += char; i++; continue; }
      if (char === TINT_START) {
        const color = decodeColor(value.slice(i + 1, i + 7));
        if (color) {
          flush(buffer);
          buffer = '';
          stack.push({ color, out: [] });
          i += 7;
        } else {
          i++; // malformed run: drop the character and read on
        }
        continue;
      }
      if (char === TINT_END) {
        flush(buffer);
        buffer = '';
        const frame = stack.pop();
        if (frame?.out.length) target().push(markNode(frame.color, frame.out));
        i++;
        continue;
      }
      if (char === EMPTY_AT) {
        const color = decodeColor(value.slice(i + 1, i + 7));
        if (color) {
          flush(buffer);
          buffer = '';
          target().push(emptyNode(color));
          i += 7;
        } else {
          i++;
        }
        continue;
      }
      i++; // a stray encoding character on its own
    }
    flush(buffer);
  }

  // Openers still standing have no closer in this parent: give their content back, untinted.
  while (stack.length) {
    const frame = stack.pop();
    if (frame) target().push(...frame.out);
  }
  return root;
}

function transform(node: HastNode): void {
  const children = node.children;
  if (!children?.length) return;
  if (node.tagName === 'code' || node.tagName === 'pre') { scrub(node); return; }
  for (const child of children) transform(child);
  if (children.some((child) => child.type === 'text' && child.value !== undefined && SENTINEL_RANGE.test(child.value))) {
    node.children = tintChildren(children);
  }
}

/** Turns sentinel runs into chip-colored marks. Runs last in the renderer's rehype pipeline, after the
 *  sanitizer, and only on the author-side preview panes. */
export function rehypePreviewTint() {
  return (tree: HastNode) => transform(tree);
}
