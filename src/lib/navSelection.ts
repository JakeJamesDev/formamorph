// Side-navigation states: hover takes the accent fill, the selected row takes the primary fill.
// Each string is a full literal so Tailwind's scan finds every class.

/** An unselected row: muted, with the accent fill on hover. */
export const NAV_IDLE = 'text-muted-foreground hover:bg-accent hover:text-foreground';

/** A row picked by Radix `data-state`. The selected fill wins over hover. */
export const NAV_TAB_STATES = [
  NAV_IDLE,
  'data-[state=active]:bg-primary data-[state=active]:font-medium data-[state=active]:text-primary-foreground',
  'data-[state=active]:hover:bg-primary data-[state=active]:hover:text-primary-foreground',
].join(' ');

/** A row picked by a prop, such as `aria-current`. */
export function navItemStates(selected: boolean): string {
  return selected ? 'bg-primary font-medium text-primary-foreground' : NAV_IDLE;
}
