import { screen, waitFor } from '@testing-library/react';

const RAILS = { left: 'Story', right: 'Status' } as const;

/**
 * Waits out the game sides' collapse and dock motion: each side shows its rail exactly when its edge strip
 * offers to dock it. A view with no strips (Hide UI, mobile) is settled already.
 */
export const settleSides = () => waitFor(() => {
  const strips = screen.queryAllByRole('button', { name: /^(Collapse|Dock) Panel$/ });
  if (strips.length !== 2) return;
  (['left', 'right'] as const).forEach((side, i) => {
    const collapsed = strips[i].getAttribute('aria-label') === 'Dock Panel' || strips[i].textContent === 'Dock Panel';
    const railShown = screen.queryByRole('navigation', { name: RAILS[side] }) !== null;
    if (collapsed !== railShown) throw new Error(`the ${side} side is still moving`);
  });
});
