/**
 * Reveal a search hit: scroll it into view and mark it, without taking focus.
 *
 * The editor's fields are rendered by a dozen managers with no shared handle on the DOM, so the hit is
 * located by its text rather than by a wired-up ref: the first control under `root` whose content holds
 * the matched string wins, skipping anything inside a `data-editor-find-skip` subtree (the find bar and
 * the list's own filter box). A miss costs only the marker — the tab switch and item selection have
 * already put the author in front of the right panel.
 *
 * Focus stays in the find bar throughout, so typing a query and stepping through hits never redirects
 * keystrokes into the world. That rules out a selection as the marker, since a browser paints one only
 * in the focused control; instead a prose field highlights the matched run through the Highlight API and
 * every field gets a ring, so the hit is visible either way.
 *
 * The lookup retries a few times because selecting an item remounts its manager, so the field usually
 * does not exist yet when the navigation happens. Retries are timer-driven rather than frame-driven:
 * `requestAnimationFrame` stops firing in a tab that isn't compositing, which would strand the reveal.
 */

const RING_CLASS = 'editor-find-target';

/** How a chip announces which token it stands for, so a jump can find it without a wired-up ref. */
export const CHIP_TOKEN_ATTR = 'data-chip-token';
const HIGHLIGHT_NAME = 'editor-find-match';
const MIRROR_CLASS = 'editor-find-mirror';

/** Styles that decide where each glyph lands, copied so the mirror's text sits exactly over the real text. */
const MIRRORED_STYLES = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant', 'fontSizeAdjust',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textIndent', 'textTransform', 'textAlign', 'direction',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'boxSizing', 'tabSize',
] as const;

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

const isTextControl = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

/** The text a control currently shows — a chip renders as its placeholder name, not its token. */
const contentOf = (el: Field): string => (isTextControl(el) ? el.value : el.textContent ?? '');

let marked: Element | null = null;

/**
 * The mirror: a copy of a form control's text laid over it with the matched run marked.
 *
 * A browser paints a selection only in the focused control and `::highlight()` cannot reach inside an
 * `<input>`, so the only way to show *where* in a plain field the hit is — without stealing focus — is to
 * draw it. The mirror copies the styles that position glyphs, renders the same string with the match
 * wrapped, and hides everything but that mark.
 */
let mirror: { el: HTMLElement; host: HTMLElement; hadPosition: string; sync: () => void; detach: () => void } | null = null;

function clearMirror() {
  if (!mirror) return;
  mirror.detach();
  mirror.el.remove();
  mirror.host.style.position = mirror.hadPosition;
  mirror = null;
}

/**
 * Lay a mirror over `field` with `[at, at + length)` marked.
 *
 * It lives in the field's own wrapper, which is made a containing block for the purpose, so the editor's
 * panels carry it as they scroll and resize without anything having to keep the two in step. Anchoring to
 * whatever `offsetParent` happens to be is not enough: that ancestor is often outside the scrolling
 * viewport, and an absolute child resolves against its containing block rather than its DOM parent, so the
 * mirror would sit still while the field scrolled away from it.
 *
 * The field scrolling its *own* text is the one case position cannot answer, so that one is listened for.
 *
 * Returns the mark, so the caller can bring it into view inside the field.
 */
function drawMirror(field: HTMLInputElement | HTMLTextAreaElement, at: number, length: number): HTMLElement | null {
  const host = field.parentElement;
  if (!host) return null;
  const hadPosition = host.style.position;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const el = document.createElement('div');
  el.className = MIRROR_CLASS;
  el.setAttribute('aria-hidden', 'true');
  const from = getComputedStyle(field);
  for (const key of MIRRORED_STYLES) el.style[key] = from[key];
  el.style.top = '0px';
  el.style.left = '0px';
  el.style.width = `${field.offsetWidth}px`;
  el.style.height = `${field.offsetHeight}px`;
  const multiline = field instanceof HTMLTextAreaElement;
  el.style.whiteSpace = multiline ? 'pre-wrap' : 'pre';
  el.style.overflowWrap = multiline ? 'break-word' : 'normal';

  const text = field.value;
  const mark = document.createElement('mark');
  mark.textContent = text.slice(at, at + length);
  el.append(text.slice(0, at), mark, text.slice(at + length));
  host.append(el);
  // Placed by measuring from a zero origin rather than by trusting `offsetTop`, so a padded or bordered
  // wrapper needs no special case.
  const target = field.getBoundingClientRect();
  const origin = el.getBoundingClientRect();
  el.style.top = `${target.top - origin.top}px`;
  el.style.left = `${target.left - origin.left}px`;
  // A field scrolled off its own start would otherwise paint the mark where the text no longer is. Kept in
  // step rather than copied once: the field's text moves under the mirror whenever it scrolls its own
  // content — when the author drags through a long value, and while this reveal animates one into view.
  const sync = () => {
    el.scrollTop = field.scrollTop;
    el.scrollLeft = field.scrollLeft;
  };
  sync();
  field.addEventListener('scroll', sync);
  mirror = { el, host, hadPosition, sync, detach: () => field.removeEventListener('scroll', sync) };
  return mark;
}

/** Registry access, absent on browsers without the Highlight API. */
const highlights = (): HighlightRegistry | null =>
  typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null;

function clearMarker() {
  marked?.classList.remove(RING_CLASS);
  marked = null;
  highlights()?.delete(HIGHLIGHT_NAME);
  clearMirror();
}

/**
 * The field holding this hit.
 *
 * Identity comes from the field's whole value, not from the matched word: several fields on one panel
 * routinely contain the same word, and matching on the word alone marks whichever renders first. An exact
 * value match also makes the stored offset usable as-is. A field showing chips renders their names rather
 * than their tokens and so can never match exactly; those fall back to the matched word.
 */
function locate(root: HTMLElement, hit: MatchLocation): { field: Field; at: number; score: number } | null {
  const wanted = loose(hit.value);
  // Which occurrence within its own field this hit is, so the marker lands on the right one of several.
  const nth = countBefore(hit.value, hit.matchText, hit.start);
  let best: { field: Field; at: number; score: number } | null = null;
  // Chips are values too — a placeholder's values and a dictionary entry's keywords are edited as chips
  // rather than as a text box, and so hold text no form control ever will.
  for (const field of root.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"], [data-chip]')) {
    if (field.closest('[data-editor-find-skip]')) continue;
    if (field instanceof HTMLInputElement && field.type !== 'text' && field.type !== 'search') continue;
    const content = contentOf(field);
    if (!content.includes(hit.matchText)) continue;
    const shown = loose(content);
    // Ranked, because text alone is regularly ambiguous. Being the right *kind* of control counts most: a
    // chip-list entry so often repeats its item's name word for word that the name field would otherwise
    // win every time. Then the caption, which is the only thing separating two prose fields holding the
    // same text. Then exact text over a shared opening — a prose field can only ever share an opening,
    // rendering markdown and chips rather than the source it stores.
    const captioned = field.closest('[data-find-field]')?.getAttribute('data-find-field');
    const score =
      (field.hasAttribute('data-chip') === !!hit.inChipList ? KIND_MATCH : 0)
      + (captioned && hit.fieldLabel && captioned.startsWith(hit.fieldLabel) ? CAPTION_MATCH : 0)
      + (shown === wanted ? EXACT_TEXT : commonPrefix(shown, wanted));
    if (best && score <= best.score) continue;
    const at = nthIndexOf(content, hit.matchText, nth);
    best = { field, at: at >= 0 ? at : content.indexOf(hit.matchText), score };
  }
  return best;
}

/** A prose field renders block by block, so its text loses the newlines the stored value keeps. */
const loose = (text: string) => text.replace(/\s+/g, ' ').trim();

function commonPrefix(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i += 1;
  return i;
}

function countBefore(haystack: string, needle: string, before: number): number {
  let n = 0;
  for (let at = haystack.indexOf(needle); at >= 0 && at < before; at = haystack.indexOf(needle, at + 1)) n += 1;
  return n;
}

function nthIndexOf(haystack: string, needle: string, nth: number): number {
  let at = haystack.indexOf(needle);
  for (let seen = 0; at >= 0 && seen < nth; seen += 1) at = haystack.indexOf(needle, at + 1);
  return at;
}

/** Where a hit sits: the field's stored value, the matched run, its offset into that value, and the
 *  field's caption — which is the only thing telling two fields with identical text apart. */
export interface MatchLocation {
  value: string;
  matchText: string;
  start: number;
  fieldLabel?: string;
  /** True when the hit belongs to one entry of a chip list rather than to a text box. */
  inChipList?: boolean;
}

/** A Range over `[at, at + length)` of a prose field, walking its text nodes to the offset. */
function rangeAt(field: HTMLElement, at: number, length: number): Range | null {
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let seen = 0;
  let started = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const size = node.textContent?.length ?? 0;
    if (!started && seen + size > at) {
      range.setStart(node, at - seen);
      started = true;
    }
    if (started && seen + size >= at + length) {
      range.setEnd(node, at + length - seen);
      return range;
    }
    seen += size;
  }
  return null;
}

// Ranked scoring bands, each far enough above the next that a lower one can only ever break a tie.
// `commonPrefix` is bounded by the field's own length, so it stays under the smallest band.
const KIND_MATCH = 1e12;
const CAPTION_MATCH = 1e9;
const EXACT_TEXT = 1e6;

/** Retry budget: the first hit after opening a tab waits on that panel's first mount, the slowest case. */
const RETRY_LIMIT = 30;
const RETRY_MS = 40;

/** Mark the field under `root` holding `hit` and bring it on screen. */
export function revealEditorMatch(root: HTMLElement | null, hit: MatchLocation, attempt = 0): void {
  if (!root || !hit.matchText) return;
  const found = locate(root, hit);
  const retry = () => setTimeout(() => revealEditorMatch(root, hit, attempt + 1), RETRY_MS);
  if (!found) {
    if (attempt < RETRY_LIMIT) retry();
    else clearMarker();
    return;
  }
  // A candidate sharing nothing with the target is some other field that happens to use the same word —
  // keep waiting for the real one to mount, and settle for it only once the budget is spent.
  if (found.score === 0 && attempt < RETRY_LIMIT) {
    retry();
    return;
  }
  const { field, at } = found;
  clearMarker();
  field.classList.add(RING_CLASS);
  marked = field;
  if (isTextControl(field)) {
    // Invisible while the field is unfocused, but it puts the caret on the hit the moment it is clicked.
    field.setSelectionRange(at, at + hit.matchText.length);
    const mark = drawMirror(field, at, hit.matchText.length);
    if (mark) scrollWithinField(field, mark);
    revealRect(field, (mark ?? field).getBoundingClientRect());
    return;
  }
  const registry = highlights();
  const range = rangeAt(field, at, hit.matchText.length);
  if (!range) {
    revealRect(field, field.getBoundingClientRect());
    return;
  }
  if (registry) registry.set(HIGHLIGHT_NAME, new Highlight(range));
  revealRect(field, range.getBoundingClientRect());
}

/** Instant only where motion is unwelcome — the scroll is how the author follows where they were taken. */
const scrollBehavior = (): ScrollBehavior =>
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** The nearest ancestor that actually scrolls `el` — the panel the field sits in, in practice. */
function scrollerFor(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/**
 * Put a form control's own text at the hit.
 *
 * A control scrolls its content rather than growing, and it holds no focus here, so nothing moves it on its
 * own — the mirror's mark is the only handle on where the hit sits in that content. Instant, because the
 * rect measured straight after has to be where the mark has already landed.
 */
function scrollWithinField(field: HTMLInputElement | HTMLTextAreaElement, mark: HTMLElement): void {
  if (field.scrollHeight > field.clientHeight) {
    field.scrollTop = Math.max(0, mark.offsetTop - (field.clientHeight - mark.offsetHeight) / 2);
  }
  if (field.scrollWidth > field.clientWidth) {
    field.scrollLeft = Math.max(0, mark.offsetLeft - (field.clientWidth - mark.offsetWidth) / 2);
  }
  // Straight away, rather than waiting on the field's scroll event: that is dispatched with the next frame,
  // and the rect measured on the very next line has to be where the mark has already landed.
  mirror?.sync();
}

/**
 * Bring `rect` — where the hit actually is — to the middle of the panel.
 *
 * Not `field.scrollIntoView`: a prose field grows to fit its text rather than scrolling it, so a long one
 * is taller than the panel, and centering *it* puts its midpoint on screen and the hit anywhere but. The
 * author saw a ringed field scrolled to the wrong part of itself. Centering the hit's own rect is the
 * thing that was meant all along; with no scrolling ancestor there is nothing to move and the field's own
 * position has to do.
 */
function revealRect(field: Field, rect: DOMRect): void {
  const scroller = scrollerFor(field);
  if (!scroller) {
    field.scrollIntoView({ block: 'center', behavior: scrollBehavior() });
    return;
  }
  const box = scroller.getBoundingClientRect();
  const delta = (rect.top - box.top) - (scroller.clientHeight - rect.height) / 2;
  if (Math.abs(delta) > 1) scroller.scrollBy({ top: delta, behavior: scrollBehavior() });
}

/** Drop the marker — the find bar closing, or a search that no longer matches anything. */
export function clearEditorMatch(): void {
  clearMarker();
}

/** How long a revealed chip wears its ring. Long enough to find by eye, short enough that it is gone
 *  before the next edit — nothing here clears it on interaction. */
const CHIP_RING_MS = 1600;

/**
 * Reveal one chip in a prompt editor: scroll it into view and ring it, without taking focus.
 *
 * The chip is found by its own affix-free token rather than by a ref, since the editor rebuilds its
 * decorators on every remount and a jump lands before that first render. Same retry budget as the find
 * bar's field lookup, and for the same reason: opening a prompt mounts its editor a few frames later.
 *
 * Searched from the document rather than from a panel, because full screen re-parents the whole Prompts
 * panel into an overlay — a root captured before the jump no longer contains the editor. Being inside a
 * Lexical editor is what makes it the right chip: the anatomy draws chips of its own, outside one.
 */
export function revealEditorChip(token: string, attempt = 0): void {
  if (!token) return;
  const chip = document.querySelector<HTMLElement>(
    `[data-lexical-editor] [${CHIP_TOKEN_ATTR}="${CSS.escape(token)}"]`,
  );
  if (!chip) {
    if (attempt < RETRY_LIMIT) setTimeout(() => revealEditorChip(token, attempt + 1), RETRY_MS);
    return;
  }
  chip.classList.add(RING_CLASS);
  setTimeout(() => chip.classList.remove(RING_CLASS), CHIP_RING_MS);
  revealRect(chip, chip.getBoundingClientRect());
}

/**
 * Bring the selected tree row on screen.
 *
 * Selecting an item from the find bar sets the id the tree reads, but nothing scrolls the list to it, so a
 * hit far down a long tree left the list sitting wherever it was — the detail pane moved and the list did
 * not. Retried on the same budget as the field lookup, since the row appears with the tree's next render.
 */
export function revealSelectedRow(root: HTMLElement | null, attempt = 0): void {
  const row = root?.querySelector<HTMLElement>('[data-editor-row-selected]');
  if (!row) {
    if (root && attempt < RETRY_LIMIT) setTimeout(() => revealSelectedRow(root, attempt + 1), RETRY_MS);
    return;
  }
  row.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
}
