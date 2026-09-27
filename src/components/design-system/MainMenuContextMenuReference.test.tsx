import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MainMenuContextMenuReference } from './MainMenuContextMenuReference';

const renderReference = () => render(
  <TooltipProvider>
    <MainMenuContextMenuReference />
  </TooltipProvider>,
);

const getSample = () => screen.getByRole('button', { name: /sample entity/i });
const openSampleMenu = () => fireEvent.contextMenu(getSample());

afterEach(() => {
  window.location.hash = '';
  fireEvent(window, new Event('hashchange'));
});

describe('main menu context menu reference', () => {
  it('targets both group dialogs through the live dev route', async () => {
    const user = userEvent.setup();
    renderReference();
    window.location.hash = '#dev?modal=designSystem&tab=context-menu&subtab=picker';
    fireEvent(window, new Event('hashchange'));
    expect(screen.getByRole('textbox', { name: 'Find a Group' })).toHaveFocus();
    window.location.hash = '#dev?modal=designSystem&tab=context-menu&subtab=create';
    fireEvent(window, new Event('hashchange'));
    expect(screen.getByRole('textbox', { name: 'Group Name' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Add To Group…' })).toHaveFocus();
  });
  it('changes the sample tile size through the production menu', async () => {
    const user = userEvent.setup();
    renderReference();

    openSampleMenu();
    expect(screen.getByRole('menuitemradio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('menuitemradio', { name: 'Large' }));

    expect(screen.getByText('The tile size is large.')).toBeInTheDocument();
  });

  it('shows a local outcome when the sample moves to a group', async () => {
    const user = userEvent.setup();
    renderReference();

    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Archive of Very Long Expeditions and Unfinished Maps' }));

    expect(screen.getByText('The sample group is Archive of Very Long Expeditions and Unfinished Maps.')).toBeInTheDocument();
  });

  it('creates a local group through the production action', async () => {
    const user = userEvent.setup();
    renderReference();

    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Create New Group…' }));
    await user.type(screen.getByRole('textbox', { name: 'Group Name' }), 'New Group');
    await user.click(screen.getByRole('button', { name: 'Create Group' }));

    expect(screen.getByText('The sample group is New Group.')).toBeInTheDocument();
  });

  it('preserves deletion confirmation and cancellation for the local sample', async () => {
    const user = userEvent.setup();
    renderReference();

    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirmation = screen.getByRole('alertdialog', { name: 'Delete Character' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirmation).not.toBeInTheDocument();
    expect(getSample()).toBeInTheDocument();

    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.queryByRole('button', { name: /sample entity/i })).not.toBeInTheDocument();
    expect(screen.getByText('The local sample is deleted.')).toBeInTheDocument();
  });

  it('ends the menu with the item actions, Delete last, each with an icon', () => {
    renderReference();
    openSampleMenu();

    const menu = screen.getByRole('menu');
    const lastSeparator = within(menu).getAllByRole('separator').at(-1)!;
    const last = within(menu).getAllByRole('menuitem')
      .filter((row) => lastSeparator.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(last.map((row) => row.textContent?.trim())).toEqual(['Check for Updates', 'Set as Default Persona', 'Delete']);
    // The icon is decorative, so no accessible name carries it.
    for (const row of last) expect(row.querySelector('svg')).not.toBeNull();
  });

  it('shows a local outcome for each item action', async () => {
    const user = userEvent.setup();
    renderReference();
    expect(screen.getByText('Check for Updates has not run.')).toBeInTheDocument();
    expect(screen.getByText('The sample is not the default persona.')).toBeInTheDocument();

    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Check for Updates' }));
    expect(screen.getByText('Check for Updates ran on the local sample.')).toBeInTheDocument();

    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Set as Default Persona' }));
    expect(screen.getByText('The sample is the default persona.')).toBeInTheDocument();

    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Clear Default Persona' }));
    expect(screen.getByText('The sample is not the default persona.')).toBeInTheDocument();
  });

  it('restores the local sample after deletion', async () => {
    const user = userEvent.setup();
    renderReference();
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    // jsdom keeps the closed dialog's body pointer lock, which a browser clears.
    fireEvent.click(screen.getByRole('button', { name: 'Restore Sample' }));

    expect(getSample()).toBeInTheDocument();
    expect(screen.getByText('The local sample is available.')).toBeInTheDocument();
  });

  it('opens, navigates, activates, and restores focus from the keyboard', async () => {
    const user = userEvent.setup();
    renderReference();
    const sample = getSample();
    sample.focus();

    await user.keyboard('{Shift>}{F10}{/Shift}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByText('The tile size is large.')).toBeInTheDocument();

    await user.keyboard('{Shift>}{F10}{/Shift}');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(sample).toHaveFocus();
  });

  it('removes the local sample from its selected group', async () => {
    const user = userEvent.setup();
    renderReference();
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Favorites' }));
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Remove From Group' }));

    expect(screen.getByText('The sample is not in a group.')).toBeInTheDocument();
  });

  it('does not persist demonstration actions', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderReference();
    openSampleMenu();
    await user.click(screen.getByRole('menuitemradio', { name: 'Small' }));
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Favorites' }));
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Create New Group…' }));
    await user.type(screen.getByRole('textbox', { name: 'Group Name' }), 'Local Creation');
    await user.click(screen.getByRole('button', { name: 'Create Group' }));
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Remove From Group' }));
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Check for Updates' }));
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Set as Default Persona' }));
    openSampleMenu();
    await user.click(screen.getByRole('menuitem', { name: 'Clear Default Persona' }));

    expect(setItem).not.toHaveBeenCalled();
  });
});
