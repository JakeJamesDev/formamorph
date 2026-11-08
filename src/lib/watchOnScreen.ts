/**
 * Track whether any of `el` shows on screen, clipping by scrolled or overflow-hidden ancestors included.
 * A render loop reads `visible` each frame to skip drawing while its canvas is out of sight.
 */
export function watchOnScreen(el: Element): { readonly visible: boolean; stop: () => void } {
  const state = { visible: true, stop: () => {} };
  if (typeof IntersectionObserver === 'undefined') return state;
  const observer = new IntersectionObserver((entries) => {
    const last = entries[entries.length - 1];
    if (last) state.visible = last.isIntersecting;
  });
  observer.observe(el);
  state.stop = () => observer.disconnect();
  return state;
}
