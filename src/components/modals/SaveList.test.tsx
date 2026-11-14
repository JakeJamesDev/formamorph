import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SaveList, type SaveListItem } from './SaveList';

const rows: SaveListItem[] = [
  { id: 'one', name: 'Harbor Arrival', timestamp: Date.UTC(2026, 8, 3, 3, 4), gameTime: 0.3 },
  { id: 'two', name: 'Before the Storm', timestamp: Date.UTC(2026, 8, 6, 20, 42), gameTime: 3.1, isAutosave: true },
];

const renderList = (options: { disabled?: boolean; busy?: boolean; getExportBlock?: (row: SaveListItem) => string | null } = {}) => {
  const callbacks = {
    onPick: vi.fn(),
    onExport: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
  };
  render(
    <TooltipProvider>
      <SaveList rows={rows} {...options} {...callbacks} />
    </TooltipProvider>,
  );
  return callbacks;
};

describe('SaveList', () => {
  it('preserves metadata and sends each row action to its callback', async () => {
    const user = userEvent.setup();
    const callbacks = renderList();

    expect(screen.getByText('Auto')).toBeInTheDocument();
    expect(screen.getByText(/· Game time 3h 6m/)).toBeInTheDocument();
    const grip = screen.getAllByRole('button', { name: 'Drag to reorder' })[0];
    const pick = screen.getByRole('button', { name: 'Load save “Harbor Arrival”' });
    await user.tab();
    expect(grip).toHaveFocus();
    await user.tab();
    expect(pick).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Export save “Harbor Arrival”' }));
    await user.click(screen.getByRole('button', { name: 'Delete save “Harbor Arrival”' }));

    expect(callbacks.onPick).toHaveBeenCalledWith(rows[0]);
    expect(callbacks.onExport).toHaveBeenCalledWith(rows[0]);
    expect(callbacks.onDelete).toHaveBeenCalledWith(rows[0]);
  });

  it('supports keyboard selection and retains disabled and busy behavior', async () => {
    const user = userEvent.setup();
    const callbacks = renderList({ disabled: true, busy: true });
    const pick = screen.getByRole('button', { name: 'Load save “Harbor Arrival”' });

    pick.focus();
    await user.keyboard('{Enter}');
    expect(callbacks.onPick).not.toHaveBeenCalled();
    expect(pick).toHaveAttribute('aria-disabled', 'true');
    expect(pick).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Export save “Harbor Arrival”' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete save “Harbor Arrival”' })).toBeDisabled();
  });
});

describe('a save that may not be exported', () => {
  it('shows Export disabled with the reason, and a click exports nothing', async () => {
    const user = userEvent.setup();
    const reason = "You can't export saves of a Supporter world";
    const callbacks = renderList({ getExportBlock: (row) => (row.id === 'one' ? reason : null) });
    const blocked = screen.getByRole('button', { name: 'Export save “Harbor Arrival”' });

    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect(blocked).toHaveAttribute('aria-description', reason);
    await user.click(blocked);
    expect(callbacks.onExport).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Export save “Before the Storm”' }));
    expect(callbacks.onExport).toHaveBeenCalledWith(rows[1]);
  });
});
