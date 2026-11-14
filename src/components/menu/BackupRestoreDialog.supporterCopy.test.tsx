import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BackupRestoreDialog } from './BackupRestoreDialog';

const backup = vi.hoisted(() => ({
  listBackupItems: vi.fn(),
  buildBackup: vi.fn(async () => ({})),
  saveBackup: vi.fn(async () => {}),
}));
vi.mock('@/lib/backup', async (importOriginal) => ({ ...(await importOriginal<object>()), ...backup }));

const REASON = "You can't back up a Supporter world";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('backing up with a Supporter Copy in the library', () => {
  it('lists it disabled with the reason, leaves it unselected, and selects every other world', async () => {
    backup.listBackupItems.mockResolvedValue({
      worlds: [{ id: 'plain', label: 'Plain Fen' }, { id: 'copy', label: 'Supporter Fen', blocked: REASON }],
      saves: [], entities: [], dictionaries: [],
    });
    render(<TooltipProvider><BackupRestoreDialog open start={{ kind: 'backup' }} onOpenChange={() => {}} /></TooltipProvider>);

    const row = (await screen.findByText('Supporter Fen')).closest('label')!;
    expect(row).toHaveAttribute('aria-description', REASON);
    expect(row.querySelector('button')).toBeDisabled();
    expect(screen.getByText('(1/1)')).toBeInTheDocument();

    // Select All and back again never picks the blocked world up.
    const all = screen.getByText('Worlds').closest('label')!.querySelector('button')!;
    fireEvent.click(all);
    fireEvent.click(all);
    fireEvent.click(screen.getByRole('button', { name: 'Save backup' }));
    await waitFor(() => expect(backup.buildBackup).toHaveBeenCalledTimes(1));
    expect([...(backup.buildBackup.mock.calls[0] as unknown as [{ worlds: Set<string> }])[0].worlds]).toEqual(['plain']);
  });
});
