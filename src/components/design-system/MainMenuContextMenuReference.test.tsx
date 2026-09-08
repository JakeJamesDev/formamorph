import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MainMenuContextMenuReference } from './MainMenuContextMenuReference';

const renderReference = () => render(
  <TooltipProvider>
    <MainMenuContextMenuReference />
  </TooltipProvider>,
);

describe('main menu context menu reference', () => {
  it('changes the sample tile size through the production menu', async () => {
    const user = userEvent.setup();
    renderReference();

    fireEvent.contextMenu(screen.getByRole('button', { name: /sample world/i }));
    expect(screen.getByRole('menuitemradio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('menuitemradio', { name: 'Large' }));

    expect(screen.getByText('The tile size is large.')).toBeInTheDocument();
  });

  it('shows a local outcome when the sample moves to a group', async () => {
    const user = userEvent.setup();
    renderReference();

    fireEvent.contextMenu(screen.getByRole('button', { name: /sample world/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Archive of Very Long Expeditions and Unfinished Maps' }));

    expect(screen.getByText('The sample group is Archive of Very Long Expeditions and Unfinished Maps.')).toBeInTheDocument();
  });

  it('creates a local group through the production action', async () => {
    const user = userEvent.setup();
    renderReference();

    fireEvent.contextMenu(screen.getByRole('button', { name: /sample world/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Create New Group' }));

    expect(screen.getByText('The sample group is New Group.')).toBeInTheDocument();
  });

  it('preserves deletion confirmation and cancellation for the local sample', async () => {
    const user = userEvent.setup();
    renderReference();
    const sample = () => screen.getByRole('button', { name: /sample world/i });

    fireEvent.contextMenu(sample());
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const confirmation = screen.getByRole('alertdialog', { name: 'Delete World' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirmation).not.toBeInTheDocument();
    expect(sample()).toBeInTheDocument();

    fireEvent.contextMenu(sample());
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(screen.queryByRole('button', { name: /sample world/i })).not.toBeInTheDocument();
    expect(screen.getByText('The local sample is deleted.')).toBeInTheDocument();
  });

  it('opens, navigates, activates, and restores focus from the keyboard', async () => {
    const user = userEvent.setup();
    renderReference();
    const sample = screen.getByRole('button', { name: /sample world/i });
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
    const sample = screen.getByRole('button', { name: /sample world/i });

    fireEvent.contextMenu(sample);
    await user.click(screen.getByRole('menuitem', { name: 'Favorites' }));
    fireEvent.contextMenu(sample);
    await user.click(screen.getByRole('menuitem', { name: 'Remove From Group' }));

    expect(screen.getByText('The sample is not in a group.')).toBeInTheDocument();
  });

  it('does not persist demonstration actions', async () => {
    const user = userEvent.setup();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderReference();
    const sample = screen.getByRole('button', { name: /sample world/i });

    fireEvent.contextMenu(sample);
    await user.click(screen.getByRole('menuitemradio', { name: 'Small' }));
    fireEvent.contextMenu(sample);
    await user.click(screen.getByRole('menuitem', { name: 'Favorites' }));
    fireEvent.contextMenu(sample);
    await user.click(screen.getByRole('menuitem', { name: 'Create New Group' }));

    expect(setItem).not.toHaveBeenCalled();
  });
});
