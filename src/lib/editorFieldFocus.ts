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
const HIGHLIGHT_NAME = 'editor-find-match';

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

const isTextControl = (el: Element): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

/** The text a control currently shows — a chip renders as its placeholder name, not its token. */
const contentOf = (el: Field): string => (isTextControl(el) ? el.value : el.textContent ?? '');

let marked: Element | null = null;

/** Registry access, absent on browsers without the Highlight API. */
const highlights = (): HighlightRegistry | null =>
  typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null;

function clearMarker() {
  marked?.classList.remove(RING_CLASS);
  marked = null;
  highlights()?.delete(HIGHLIGHT_NAME);
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
  for (const field of root.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]')) {
    if (field.closest('[data-editor-find-skip]')) continue;
    if (field instanceof HTMLInputElement && field.type !== 'text' && field.type !== 'search') continue;
    const content = contentOf(field);
    if (!content.includes(hit.matchText)) continue;
    const shown = loose(content);
    // Exact beats near, near beats merely containing the word. A prose field can only ever be near: it
    // renders markdown and chips rather than the source, so its text runs a little short of the stored value.
    const score = shown === wanted ? Number.MAX_SAFE_INTEGER : commonPrefix(shown, wanted);
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

/** Where a hit sits: the field's stored value, the matched run, and its offset into that value. */
export interface MatchLocation {
  value: string;
  matchText: string;
  start: number;
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

/** Retry budget: a switch between tabs remounts a whole panel, which can take a good many ticks. */
const RETRY_LIMIT = 12;
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
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  field.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  field.classList.add(RING_CLASS);
  marked = field;
  if (isTextControl(field)) {
    // Invisible while the field is unfocused, but it puts the caret on the hit the moment it is clicked.
    field.setSelectionRange(at, at + hit.matchText.length);
    return;
  }
  const registry = highlights();
  const range = rangeAt(field, at, hit.matchText.length);
  if (registry && range) registry.set(HIGHLIGHT_NAME, new Highlight(range));
}

/** Drop the marker — the find bar closing, or a search that no longer matches anything. */
export function clearEditorMatch(): void {
  clearMarker();
}
