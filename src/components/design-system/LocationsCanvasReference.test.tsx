import { afterEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { canvasHistoryFor } from '@/lib/canvasHistory';
import { LocationsCanvasReference } from './LocationsCanvasReference';

afterEach(() => vi.restoreAllMocks());

it('keeps canvas preferences and history local across fullscreen edits and remounts', async () => {
  const user = userEvent.setup();
  localStorage.setItem('FORMAMORPH_canvasSnap', 'false');
  const savedHistory = canvasHistoryFor('authored-world');
  savedHistory.current = { past: [{ slice: 'locations', before: [], after: [] }], future: [] };
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const show = () => render(<TooltipProvider><LocationsCanvasReference /></TooltipProvider>);
  const first = show();
  await user.click(screen.getByRole('button', { name: 'Edit Full Screen' }));
  expect(await screen.findByRole('toolbar', { name: 'Canvas Tools' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  const snap = screen.getByRole('button', { name: 'Snap To Grid' });
  expect(snap).toHaveAttribute('aria-pressed', 'true');
  await user.click(snap);
  expect(snap).toHaveAttribute('aria-pressed', 'false');
  await user.click(screen.getByRole('button', { name: 'Show Grid' }));
  expect(screen.getByRole('button', { name: 'Show Grid' })).toHaveAttribute('aria-pressed', 'false');
  await user.click(screen.getByRole('button', { name: 'Auto Arrange All' }));
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Undo' }));
  expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Redo' }));
  expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  first.unmount();
  const second = show();
  expect(screen.getByLabelText('Selected Location')).toHaveTextContent('(20, 60)');
  await user.click(screen.getByRole('button', { name: 'Edit Full Screen' }));
  expect(await screen.findByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Snap To Grid' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Show Grid' })).toHaveAttribute('aria-pressed', 'true');
  expect(canvasHistoryFor('authored-world')).toBe(savedHistory);
  expect(savedHistory.current.past).toHaveLength(1);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  second.unmount();
});

it('opens the canvas menu with titled sets, and Escape closes it and hands focus back to the canvas', async () => {
  const user = userEvent.setup();
  const { container } = render(<TooltipProvider><LocationsCanvasReference /></TooltipProvider>);
  const pane = container.querySelector('.react-flow__pane') as HTMLElement;

  fireEvent.contextMenu(pane);
  const menu = await screen.findByRole('menu', { name: 'Canvas Options' });

  // Two titled sets, each exposing its title as the group's own accessible name.
  expect(within(menu).getByRole('group', { name: 'Grid' })).toBeInTheDocument();
  expect(within(menu).getByRole('group', { name: 'Connection Style' })).toBeInTheDocument();

  // Checkbox rows carry their own checked state, defaulted on.
  expect(within(menu).getByRole('menuitemcheckbox', { name: 'Snap To Grid' })).toHaveAttribute('aria-checked', 'true');
  expect(within(menu).getByRole('menuitemcheckbox', { name: 'Show Grid' })).toHaveAttribute('aria-checked', 'true');

  // One radio checked among the three, read by their short presentation labels.
  expect(within(menu).getByRole('menuitemradio', { name: 'Straight' })).toHaveAttribute('aria-checked', 'true');
  expect(within(menu).getByRole('menuitemradio', { name: 'Curved' })).toHaveAttribute('aria-checked', 'false');
  expect(within(menu).getByRole('menuitemradio', { name: 'Elbow' })).toHaveAttribute('aria-checked', 'false');

  // Action rows by name, with no titled group around them.
  expect(within(menu).getByRole('menuitem', { name: 'Undo' })).toBeInTheDocument();
  expect(within(menu).getByRole('menuitem', { name: 'Redo' })).toBeInTheDocument();
  expect(within(menu).getByRole('menuitem', { name: 'Select All Locations' })).toBeInTheDocument();
  expect(within(menu).getByRole('menuitem', { name: 'Auto Arrange All' })).toBeInTheDocument();

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  // The pane takes no focus of its own; the frame around it is what is left holding it.
  expect(document.activeElement).toBe(container.querySelector('[tabindex="-1"]'));
});

it('walks every row with the arrow keys, and the titles are not among the stops', async () => {
  const user = userEvent.setup();
  const { container } = render(<TooltipProvider><LocationsCanvasReference /></TooltipProvider>);
  const pane = container.querySelector('.react-flow__pane') as HTMLElement;

  fireEvent.contextMenu(pane);
  await screen.findByRole('menu', { name: 'Canvas Options' });

  // Undo and Redo are disabled on a fresh canvas and so take no stop of their own — the walk lands on every
  // row that can be picked, in the order the menu draws them, and on nothing else.
  const stops: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    await user.keyboard('{ArrowDown}');
    stops.push(document.activeElement?.textContent ?? '');
  }
  expect(stops).toEqual([
    'Snap To Grid', 'Show Grid', 'Straight', 'Curved', 'Elbow', 'Select All Locations', 'Auto Arrange All',
  ]);
});
