// The menu openings that a control asked for, which a text selection never overrides.
const requested = new WeakSet<Event>();

/** Opens the bubble menu around `el`, anchored at its bottom-left corner, as a right-click there would. */
export function openBubbleMenu(el: HTMLElement) {
  const bounds = el.getBoundingClientRect();
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: bounds.left, clientY: bounds.bottom });
  requested.add(event);
  el.dispatchEvent(event);
}

/** Whether `event` came from `openBubbleMenu`, not from the player's own right-click. */
export function isRequestedOpen(event: Event) {
  return requested.has(event);
}
