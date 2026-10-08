import { expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HistoryControlsReference } from './HistoryControlsReference';

const renderReference = () => render(
  <TooltipProvider>
    <HistoryControlsReference />
  </TooltipProvider>,
);

const desktop = () => screen.getByRole('region', { name: 'Desktop sample' });
const mobile = () => screen.getByRole('region', { name: 'Mobile sample' });
const open = (sample: HTMLElement) => fireEvent.click(within(sample).getByRole('button', { name: 'History' }));
const list = (sample: HTMLElement) => within(sample).getByRole('dialog', { name: 'History' });
const labels = (sample: HTMLElement) => within(list(sample)).getAllByRole('button').map((b) => b.textContent);

it('lists World opened, the Steps, the Saved marker after its Step, and dims the Steps past the cursor', () => {
  renderReference();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Sample' }));
  // Undo twice: the cursor leaves two Steps dimmed.
  fireEvent.click(within(desktop()).getByRole('button', { name: 'Undo' }));
  fireEvent.click(within(desktop()).getByRole('button', { name: 'Undo' }));
  open(desktop());

  const rows = within(list(desktop()));
  expect(labels(desktop())).toHaveLength(8);
  expect(labels(desktop())[0]).toBe('World opened');
  expect(rows.getByRole('button', { name: /^Edit World: Thumbnail/ })).toHaveAttribute('aria-current', 'step');
  expect(rows.getByRole('button', { name: /^Remove Trait Brave/ })).toHaveAttribute('data-undone', 'true');
  expect(rows.getByRole('button', { name: /^Edit Entity Mara/ })).toHaveAttribute('data-undone', 'true');
  expect(rows.getByRole('button', { name: /^Add Location Docks/ })).not.toHaveAttribute('data-undone');

  // The marker sits right after the Step it was placed at.
  const savedStep = rows.getByRole('button', { name: /^Edit World: Thumbnail/ }).parentElement!;
  expect(within(savedStep).getByText('Saved')).toBeInTheDocument();
  expect(rows.getAllByText('Saved')).toHaveLength(1);
});

it('names each row by its full label, and an undone row as undone', () => {
  renderReference();
  fireEvent.click(screen.getByRole('button', { name: 'Reset Sample' }));
  open(desktop());
  // The current row also shows a Now marker, which the name leaves out.
  expect(within(list(desktop())).getByRole('button', { name: 'Edit Entity Mara: Image Tags' })).toHaveTextContent('Now');
  fireEvent.click(within(desktop()).getByRole('button', { name: 'Undo' }));

  const rows = within(list(desktop()));
  expect(rows.getByRole('button', { name: 'Edit Stat Hunger: Description' })).toBeInTheDocument();
  expect(rows.getByRole('button', { name: 'Edit Entity Mara: Image Tags (undone)' })).toBeInTheDocument();
  expect(rows.getByRole('button', { name: 'Edit Locations' })).toBeInTheDocument();
});

it('puts the Saved marker under World opened when the save matches the head', () => {
  renderReference();
  fireEvent.click(within(desktop()).getByRole('button', { name: 'History' }));
  fireEvent.click(within(list(desktop())).getByRole('button', { name: 'World opened' }));
  fireEvent.click(screen.getByRole('button', { name: 'Mark Saved' }));

  const head = within(list(desktop())).getByRole('button', { name: 'World opened' });
  expect(head.nextElementSibling).toHaveTextContent('Saved');
  expect(head).toHaveAttribute('aria-current', 'step');
});

it('moves to a clicked row, back to the head and forward to a dimmed row', () => {
  renderReference();
  open(desktop());
  const rows = () => within(list(desktop()));

  fireEvent.click(rows().getByRole('button', { name: /^Add Location Docks/ }));
  expect(rows().getByRole('button', { name: /^Add Location Docks/ })).toHaveAttribute('aria-current', 'step');
  expect(rows().getByRole('button', { name: /^Edit World: Thumbnail/ })).toHaveAttribute('data-undone', 'true');

  fireEvent.click(rows().getByRole('button', { name: 'World opened' }));
  expect(rows().getByRole('button', { name: 'World opened' })).toHaveAttribute('aria-current', 'step');
  expect(within(desktop()).getByRole('button', { name: 'Undo' })).toBeDisabled();

  fireEvent.click(rows().getByRole('button', { name: /^Edit World: Thumbnail/ }));
  expect(within(desktop()).getByRole('button', { name: 'Redo' })).toBeEnabled();
  expect(rows().getByRole('button', { name: /^Edit World: Thumbnail/ })).toHaveAttribute('aria-current', 'step');
});

it('drops the undone Steps and their marker when a new Step is added', () => {
  renderReference();
  fireEvent.click(within(desktop()).getByRole('button', { name: 'Undo' }));
  fireEvent.click(within(desktop()).getByRole('button', { name: 'Undo' }));
  fireEvent.click(within(desktop()).getByRole('button', { name: 'Undo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Sample Step' }));
  open(desktop());

  expect(within(list(desktop())).queryByText('Saved')).not.toBeInTheDocument();
  expect(labels(desktop())).toHaveLength(6);
  expect(within(desktop()).getByRole('button', { name: 'Redo' })).toBeDisabled();
});

it('keeps Undo and Redo in the mobile popover head and the pill on desktop', () => {
  renderReference();
  expect(within(desktop()).getByRole('group', { name: 'History' })).toBeInTheDocument();
  expect(within(mobile()).queryByRole('group', { name: 'History' })).not.toBeInTheDocument();
  expect(within(mobile()).queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();

  open(mobile());
  act(() => { fireEvent.click(within(list(mobile())).getByRole('button', { name: 'Undo' })); });
  expect(within(list(mobile())).getByRole('button', { name: 'Redo' })).toBeEnabled();
  // Both layouts read one history, so the desktop pill follows.
  expect(within(desktop()).getByRole('button', { name: 'Redo' })).toBeEnabled();
});
