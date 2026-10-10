/** The moving pulse. Its keyframes in `index.css` share the name. */
export const LANDING_PULSE_CLASS = 'landing-pulse';
/** The still ring drawn under reduced motion. Its keyframes in `index.css` share the name. */
export const LANDING_RING_CLASS = 'landing-ring';
/** The fixed layer that holds a ring above the page. */
export const LANDING_LAYER_CLASS = 'landing-layer';

// A field, the selected option of a segmented group, a select, or a checkbox.
const CONTROL = 'input, textarea, [role="radio"][data-state="on"], [role="combobox"], [role="checkbox"], [role="switch"], [role="slider"]';
// The fallback for a row of buttons or link buttons; never the label's info button.
const BUTTON = 'button:not(:disabled):not([data-hint-info]), a[href]:not([aria-disabled="true"])';

// The ring starts this far outside its row and the pulse ends at the reach.
const RING_START = 4;
const RING_REACH = 10;

const active = new WeakMap<HTMLElement, { ring: HTMLElement; cancel: () => void }>();
const targets = new WeakMap<Element, HTMLElement>();

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The first match on screen, else the first match. A layout can draw a control twice and hide one per width. */
function shownMatch(row: HTMLElement, selector: string): HTMLElement | null {
  const matches = Array.from(row.querySelectorAll<HTMLElement>(selector));
  return matches.find((match) => match.getClientRects().length > 0) ?? matches[0] ?? null;
}

/**
 * The row's control a landing focuses: its field, select or checkbox, else its first enabled button. A row
 * that is a button is its own control.
 */
export function landingControl(row: HTMLElement): HTMLElement | null {
  if (row.matches('button')) return row;
  return shownMatch(row, CONTROL) ?? shownMatch(row, BUTTON);
}

/** The ring a running landing draws for a row. */
export function landingRing(row: HTMLElement): HTMLElement | null {
  return active.get(row)?.ring ?? null;
}

/** The row a running ring lands on. */
export function landingTarget(ring: Element): HTMLElement | null {
  return targets.get(ring) ?? null;
}

const clipsOn = (value: string) => value !== '' && value !== 'visible';

/** An ancestor that cuts the row's content across, down, or both. */
interface Clipper { element: Element; x: boolean; y: boolean }

/** The row's ancestors that cut its content. Nothing above a fixed ancestor cuts it. */
function clippersOf(row: HTMLElement): Clipper[] {
  const found: Clipper[] = [];
  for (let node: Element | null = row; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (node !== row) {
      const x = clipsOn(style.overflowX);
      const y = clipsOn(style.overflowY);
      if (x || y) found.push({ element: node, x, y });
    }
    if (style.position === 'fixed') break;
  }
  return found;
}

/** The row's top element under `<body>` and the outermost z-index between them, which place the row among the page's layers. */
function stackOf(row: HTMLElement): { root: Element; zIndex: string } {
  let root: Element = row;
  let zIndex = '';
  for (let node: Element | null = row; node && node !== document.body; node = node.parentElement) {
    root = node;
    const style = getComputedStyle(node);
    if (style.position && style.position !== 'static' && style.zIndex && style.zIndex !== 'auto') zIndex = style.zIndex;
  }
  return { root, zIndex };
}

/**
 * Pulses the Landing Pulse ring on a row once and removes it when its animation ends or is canceled. The
 * ring draws in a layer above the row's own layer, so no scroll window cuts it, and follows the row each
 * frame. A row that hides or leaves the page takes its ring with it. A repeat call restarts it. Returns a
 * cancel that removes the ring at once.
 */
export function pulseLanding(row: HTMLElement, options: { reducedMotion?: boolean } = {}): () => void {
  active.get(row)?.cancel();
  if (!row.isConnected) return () => {};
  const name = (options.reducedMotion ?? prefersReducedMotion()) ? LANDING_RING_CLASS : LANDING_PULSE_CLASS;
  const layer = document.createElement('div');
  layer.className = LANDING_LAYER_CLASS;
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('inert', '');
  const ring = document.createElement('div');
  ring.className = name;
  layer.append(ring);

  const rowStyle = getComputedStyle(row);
  for (const property of ['--ring', '--radius']) {
    const value = rowStyle.getPropertyValue(property).trim();
    if (value) ring.style.setProperty(property, value);
  }
  const { root, zIndex } = stackOf(row);
  layer.style.zIndex = zIndex;
  const clippers = clippersOf(row);

  let frame = 0;
  let placed = '';
  const place = () => {
    if (!row.isConnected || row.checkVisibility?.() === false) {
      cancel();
      return;
    }
    const box = row.getBoundingClientRect();
    let left = 0;
    let top = 0;
    let right = window.innerWidth;
    let bottom = window.innerHeight;
    for (const { element, x, y } of clippers) {
      const clip = element.getBoundingClientRect();
      if (x) {
        left = Math.max(left, clip.left - RING_REACH);
        right = Math.min(right, clip.right + RING_REACH);
      }
      if (y) {
        top = Math.max(top, clip.top - RING_REACH);
        bottom = Math.min(bottom, clip.bottom + RING_REACH);
      }
    }
    const next = [left, top, right, bottom, box.left, box.top, box.width, box.height].join();
    if (next !== placed) {
      placed = next;
      Object.assign(layer.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.max(0, right - left)}px`,
        height: `${Math.max(0, bottom - top)}px`,
      });
      Object.assign(ring.style, {
        left: `${box.left - RING_START - left}px`,
        top: `${box.top - RING_START - top}px`,
        width: `${box.width + 2 * RING_START}px`,
        height: `${box.height + 2 * RING_START}px`,
      });
      // The scale per axis takes the ring from its start to its reach for the row's size.
      ring.style.setProperty('--landing-sx', String((box.width + 2 * RING_REACH) / (box.width + 2 * RING_START)));
      ring.style.setProperty('--landing-sy', String((box.height + 2 * RING_REACH) / (box.height + 2 * RING_START)));
    }
    frame = requestAnimationFrame(place);
  };
  const onEnd = (event: AnimationEvent) => {
    if (event.target === ring && event.animationName === name) cancel();
  };
  const cancel = () => {
    if (active.get(row)?.cancel !== cancel) return;
    active.delete(row);
    cancelAnimationFrame(frame);
    layer.remove();
  };

  ring.addEventListener('animationend', onEnd);
  ring.addEventListener('animationcancel', onEnd);
  active.set(row, { ring, cancel });
  targets.set(ring, row);
  root.after(layer);
  place();
  return cancel;
}
