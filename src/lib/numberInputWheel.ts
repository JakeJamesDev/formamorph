/**
 * Wheel stepping for `<input type="number">`.
 *
 * Chrome steps a focused number input on wheel, but only while the surrounding scroll container still has
 * room to move in that direction — so at the top of a list the value could only count down, and at the
 * bottom only up. This takes the gesture over: it cancels the browser's handling and applies the step
 * itself, so both directions work at any scroll position. It has to be a native non-passive listener,
 * because React registers `wheel` as passive at the root, where `preventDefault` is a no-op.
 */

/** Decimal places in a step, so `0.1` increments don't accumulate float drift. */
function precisionOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

/**
 * The value one wheel tick away, clamped to the field's own min/max. Wheel up (negative `deltaY`)
 * increases, matching the browser's stepping and the spinner arrows.
 */
export function steppedValue(input: HTMLInputElement, deltaY: number): number {
  const step = Number(input.step) || 1;
  const current = Number(input.value) || 0;
  const next = current + (deltaY < 0 ? step : -step);

  const min = input.min === '' ? -Infinity : Number(input.min);
  const max = input.max === '' ? Infinity : Number(input.max);
  const clamped = Math.min(max, Math.max(min, next));

  return Number(clamped.toFixed(precisionOf(step)));
}

/**
 * Write a value the way a keystroke would. React installs its own `value` setter to track changes, so
 * assigning through the prototype's setter leaves that tracker stale — which is what makes the `input`
 * event register as a real change and reach the field's `onChange`.
 */
export function setValueLikeUser(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Attach wheel stepping to a number input. Returns the cleanup. */
export function attachNumberWheelStep(input: HTMLInputElement): () => void {
  const onWheel = (event: WheelEvent) => {
    // Only a focused field steps — otherwise scrolling past one would edit it.
    if (input.ownerDocument.activeElement !== input) return;
    if (input.disabled || input.readOnly || event.deltaY === 0) return;
    event.preventDefault();
    setValueLikeUser(input, String(steppedValue(input, event.deltaY)));
  };
  input.addEventListener('wheel', onWheel, { passive: false });
  return () => input.removeEventListener('wheel', onWheel);
}
