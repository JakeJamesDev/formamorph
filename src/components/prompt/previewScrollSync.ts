import { TINT_MARK_ATTR } from '@/lib/previewTint';

/**
 * Scroll sync between two panes showing one document at different heights.
 *
 * A whole-document fraction maps poorly (a chip is one short token; its expanded value can be many lines),
 * so the position is recorded as a spot *between two shared anchors* — elements both panes render in the
 * same order — and reproduced in the other pane. Non-uniform expansion above or below the reading spot no
 * longer skews the result.
 *
 * Which elements those are is the caller's: the prompt field pairs Lexical chips against the expanded chip
 * marks ({@link PROMPT_ANCHORS}); the Request Anatomy pairs each run's own wrapper, which both its views
 * draw one of.
 */

/** A captured scroll position: interpolated between shared anchors `seg`..`seg+1`, or a whole-document
 *  fraction when the pane has no anchors to align on. */
export type ScrollAnchor = { seg: number; t: number } | { frac: number };

/**
 * The prompt field's two pane selectors. Preview selects the chip-tinted marks by their brand rather than
 * every `<mark>`: an author's own `==highlight==` renders as one too, and each of those would insert an
 * anchor Edit has no counterpart for, sliding every later pairing out by one.
 */
export const PROMPT_ANCHORS = {
  edit: '[data-lexical-decorator]',
  preview: `mark[${TINT_MARK_ATTR}]`,
} as const;

/** The elements a pane aligns on, in document order. */
export function anchorElements(el: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>(selector));
}

/** Anchor element tops (px from content top), bracketed by the content's own top (0) and bottom
 *  (scrollHeight) — giving `anchors + 1` gaps to interpolate within. */
function anchorPositions(el: HTMLElement, selector: string): number[] {
  const contentTop = el.getBoundingClientRect().top - el.scrollTop;
  const tops = anchorElements(el, selector).map((a) => a.getBoundingClientRect().top - contentTop);
  return [0, ...tops, el.scrollHeight];
}

/**
 * The anchor for one position in the pane's content, measured in px from the content's top. Scrolling
 * passes the viewport centre; the caret passes its own offset, which is what makes the preview follow the
 * line being written rather than the middle of the view.
 */
export function anchorAt(el: HTMLElement, selector: string, offset: number): ScrollAnchor {
  const pos = anchorPositions(el, selector);
  if (pos.length <= 2) return { frac: offset / el.scrollHeight }; // no anchors → whole-document fraction
  let seg = 0;
  while (seg < pos.length - 2 && offset >= pos[seg + 1]) seg++;
  return { seg, t: (offset - pos[seg]) / (pos[seg + 1] - pos[seg] || 1) };
}

export function captureAnchor(el: HTMLElement | null, selector: string): ScrollAnchor | null {
  if (!el || el.scrollHeight <= el.clientHeight) return null;
  return anchorAt(el, selector, el.scrollTop + el.clientHeight / 2);
}

/** The top of one node's box, measuring a text node through a range since only elements have rects. */
function nodeTop(node: Node): number | null {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const r = (node as Element).getBoundingClientRect();
    return r.height ? r.top : null;
  }
  const r = document.createRange();
  r.selectNodeContents(node);
  const box = r.getBoundingClientRect();
  return box.height ? box.top : null;
}

/** Viewport y of the caret, or null when nothing measurable can be found. */
function caretTop(range: Range): number | null {
  // A collapsed range inside text has zero width but a real line height — that is the good case.
  const rect = range.getBoundingClientRect();
  if (rect.height) return rect.top;

  // Beside a chip there is no text box to measure: the chip is a Lexical decorator (an element), so a
  // caret placed against it collapses to an empty rect. Measure the node the caret sits against instead —
  // without this the caret reads as position zero and the preview jumps to the top instead of following.
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType === Node.ELEMENT_NODE) {
    const kids = (startContainer as Element).childNodes;
    for (const neighbor of [kids[startOffset], kids[startOffset - 1]]) {
      const top = neighbor ? nodeTop(neighbor) : null;
      if (top !== null) return top;
    }
  }

  // Last resort: the element the caret is in. Coarse, but never wrong by more than its own height.
  const host = startContainer.nodeType === Node.ELEMENT_NODE
    ? (startContainer as Element)
    : startContainer.parentElement;
  return host ? nodeTop(host) : null;
}

export function caretOffset(el: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const top = caretTop(range);
  if (top === null) return null;
  return top - (el.getBoundingClientRect().top - el.scrollTop);
}

export function applyAnchor(el: HTMLElement | null, selector: string, anchor: ScrollAnchor): void {
  if (!el) return;
  let center: number;
  if ('frac' in anchor) center = anchor.frac * el.scrollHeight;
  else {
    const pos = anchorPositions(el, selector);
    const seg = Math.min(anchor.seg, pos.length - 2); // guard against a differing anchor count
    center = pos[seg] + anchor.t * (pos[seg + 1] - pos[seg]);
  }
  el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, center - el.clientHeight / 2));
}
