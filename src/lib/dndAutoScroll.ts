/** Shared dnd-kit `autoScroll` config for the sortable library grids and editor lists: auto-scroll only a
 *  real inner scroll viewport (the list itself), never the page/window. Reused so the rule can't drift. */
export const CONTAINED_AUTO_SCROLL = {
  canScroll: (el: Element) =>
    el !== document.scrollingElement && el !== document.body && el !== document.documentElement,
};
