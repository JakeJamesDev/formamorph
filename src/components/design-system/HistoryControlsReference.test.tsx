import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const MARA_LABEL = 'Edit Entity Mara Featherstonehaugh of the Lantern Docks';
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
  expect(within(list(desktop())).getByRole('button', { name: `${MARA_LABEL}: Player Description` })).toHaveTextContent('Now');
  fireEvent.click(within(desktop()).getByRole('button', { name: 'Undo' }));

  const rows = within(list(desktop()));
  expect(rows.getByRole('button', { name: 'Edit Stat Hunger: Description' })).toBeInTheDocument();
  const undone = rows.getByRole('button', { name: `${MARA_LABEL}: Player Description (undone)` });
  expect(within(undone).getByText('(undone)')).toBeInTheDocument();
  expect(rows.getByRole('button', { name: 'Edit Locations' })).toBeInTheDocument();
});

it('shows a long name and its field as their own parts', () => {
  renderReference();
  open(desktop());
  const row = within(within(list(desktop())).getByRole('button', { name: `${MARA_LABEL}: Player Description` }));
  expect(row.getByText('Mara Featherstonehaugh of the Lantern Docks')).toBeInTheDocument();
  expect(row.getByText('Player Description')).toBeInTheDocument();
  expect(row.getByText('Edit')).toBeInTheDocument();
  expect(row.getByText('Entity')).toBeInTheDocument();
});

/** Counts each word of a row's visible text, the sr-only and Now markers left out. */
const wordCounts = (row: HTMLElement) => {
  const counts: Record<string, number> = {};
  for (const word of (row.textContent ?? '').replace(/\(undone\)|Now$/g, '').split(/\s+/).filter(Boolean)) {
    counts[word] = (counts[word] ?? 0) + 1;
  }
  return counts;
};

it('shows a nameless row with its verb, type and field once each', () => {
  renderReference();
  open(desktop());
  const rows = within(list(desktop()));
  expect(wordCounts(rows.getByRole('button', { name: 'Edit Locations' }))).toEqual({ Edit: 1, Locations: 1 });
  const world = rows.getByRole('button', { name: /^Edit World: Thumbnail/ });
  expect(wordCounts(world)).toEqual({ Edit: 1, World: 1, Thumbnail: 1 });
});

it('shows a labeled batch as its label', () => {
  renderReference();
  fireEvent.click(screen.getByRole('button', { name: 'Add Sample Step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Sample Step' }));
  open(desktop());
  expect(wordCounts(within(list(desktop())).getByRole('button', { name: 'Import Lorebook' }))).toEqual({ Import: 1, Lorebook: 1 });
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

describe('the row tip', () => {
  const MARA_NAME = 'Mara Featherstonehaugh of the Lantern Docks';
  // jsdom has no layout: any box whose text holds the long name reads as wider than it is.
  const stubCutOff = (text: string) => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.textContent?.includes(text) ? 400 : 0;
    });
  };
  afterEach(() => { vi.restoreAllMocks(); });

  const maraRow = () => within(list(desktop())).getByRole('button', { name: `${MARA_LABEL}: Player Description` });
  /** The open tip's popup, found by the name it spells out in full. */
  const tip = async () => (await screen.findByText(MARA_NAME, { selector: '[data-step-tip] *' })).closest('[data-step-tip]') as HTMLElement;

  it('opens on hover of a cut-off row with the whole name, the field, the verb and the type', async () => {
    stubCutOff(MARA_NAME);
    renderReference();
    open(desktop());
    await userEvent.hover(maraRow());

    const popup = within(await tip());
    expect(popup.getByText('Player Description')).toBeInTheDocument();
    expect(popup.getByText('Edit')).toBeInTheDocument();
    expect(popup.getByText('Entity')).toBeInTheDocument();
  });

  it('opens on keyboard focus of a cut-off row', async () => {
    stubCutOff(MARA_NAME);
    renderReference();
    open(desktop());
    // Tab in from the row above, so focus arrives the way a keyboard user's does.
    within(list(desktop())).getByRole('button', { name: /^Remove Trait Brave/ }).focus();
    await userEvent.tab();
    expect(maraRow()).toHaveFocus();

    expect(await tip()).toBeVisible();
  });

  it('adds nothing to the row for assistive technology', async () => {
    stubCutOff(MARA_NAME);
    renderReference();
    open(desktop());
    await userEvent.hover(maraRow());
    await tip();

    expect(maraRow()).toHaveAccessibleDescription('');
  });

  it('opens none on a row that shows in full, on hover or on focus', async () => {
    stubCutOff(MARA_NAME);
    renderReference();
    open(desktop());
    const rows = within(list(desktop()));
    await userEvent.hover(rows.getByRole('button', { name: 'Edit Stat Hunger: Description' }));
    // Past the provider's open delay.
    await act(() => new Promise((done) => { setTimeout(done, 600); }));
    expect(document.querySelector('[data-step-tip]')).toBeNull();

    rows.getByRole('button', { name: 'Edit Locations' }).focus();
    await userEvent.tab();
    expect(rows.getByRole('button', { name: /^Edit World: Thumbnail/ })).toHaveFocus();
    await act(() => new Promise((done) => { setTimeout(done, 600); }));
    expect(document.querySelector('[data-step-tip]')).toBeNull();
  });

  it('closes when the pointer moves on from a cut-off row to a row that fits', async () => {
    stubCutOff(MARA_NAME);
    renderReference();
    open(desktop());
    await userEvent.hover(maraRow());
    await tip();

    await userEvent.hover(within(list(desktop())).getByRole('button', { name: /^Remove Trait Brave/ }));
    await waitFor(() => { expect(document.querySelector('[data-step-tip]')).toBeNull(); });
  });

  it('closes when focus moves on from a cut-off row to a row that fits', async () => {
    stubCutOff(MARA_NAME);
    renderReference();
    open(desktop());
    within(list(desktop())).getByRole('button', { name: /^Remove Trait Brave/ }).focus();
    await userEvent.tab();
    await tip();

    await userEvent.tab({ shift: true });
    expect(within(list(desktop())).getByRole('button', { name: /^Remove Trait Brave/ })).toHaveFocus();
    await waitFor(() => { expect(document.querySelector('[data-step-tip]')).toBeNull(); });
  });

  it('leaves Undo and Redo on the shared tip with the flat text', async () => {
    renderReference();
    await userEvent.hover(within(desktop()).getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Undo (Ctrl+Z)', { selector: 'div' })).toBeInTheDocument();
    expect(document.querySelector('[data-step-tip]')).toBeNull();
  });
});
