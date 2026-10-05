/** The moving pulse. Its keyframes in `index.css` share the name. */
export const LANDING_PULSE_CLASS = 'landing-pulse';
/** The still ring drawn under reduced motion. Its keyframes in `index.css` share the name. */
export const LANDING_RING_CLASS = 'landing-ring';

// A field, the selected option of a segmented group, a select, or a checkbox; never the label's info button.
const CONTROL = 'input, textarea, [role="radio"][data-state="on"], [role="combobox"], [role="checkbox"], [role="switch"], [role="slider"]';

const active = new WeakMap<HTMLElement, () => void>();

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The row's control a landing focuses. A control that draws a select and a segmented group hides one per
 * width, so the one on screen wins. A row that is a button is its own control.
 */
export function landingControl(row: HTMLElement): HTMLElement | null {
  if (row.matches('button')) return row;
  const controls = Array.from(row.querySelectorAll<HTMLElement>(CONTROL));
  return controls.find((control) => control.getClientRects().length > 0) ?? controls[0] ?? null;
}

/**
 * Pulses the Landing Pulse ring on a row once and takes the class off when its animation ends or is
 * canceled. A repeat call restarts it. Returns a cancel that takes the class off at once.
 */
export function pulseLanding(row: HTMLElement, options: { reducedMotion?: boolean } = {}): () => void {
  active.get(row)?.();
  const name = (options.reducedMotion ?? prefersReducedMotion()) ? LANDING_RING_CLASS : LANDING_PULSE_CLASS;
  const onEnd = (event: AnimationEvent) => {
    if (event.target === row && event.animationName === name) cancel();
  };
  const cancel = () => {
    if (active.get(row) !== cancel) return;
    active.delete(row);
    row.removeEventListener('animationend', onEnd);
    row.removeEventListener('animationcancel', onEnd);
    row.classList.remove(name);
    row.style.removeProperty('--landing-sx');
    row.style.removeProperty('--landing-sy');
  };
  // The ring starts 4px outside the row and ends 10px out; the scale per axis gets it there from the row's size.
  const { width, height } = row.getBoundingClientRect();
  if (width > 0 && height > 0) {
    row.style.setProperty('--landing-sx', String((width + 20) / (width + 8)));
    row.style.setProperty('--landing-sy', String((height + 20) / (height + 8)));
  }
  // The earlier pulse's cancel took its class off; a reflow before the add restarts the animation.
  void row.offsetWidth;
  row.classList.add(name);
  row.addEventListener('animationend', onEnd);
  row.addEventListener('animationcancel', onEnd);
  active.set(row, cancel);
  return cancel;
}
