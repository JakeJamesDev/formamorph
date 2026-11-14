import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { LibraryItemSummary } from '@/lib/librarySources';
import { OpenWorldIdProvider } from '@/lib/useSupporterCopyBlock';
import AddFromLibraryModal from './AddFromLibraryModal';

const marked: LibraryItemSummary = {
  id: 'e1', kind: 'entity', name: 'Mara Vale', revision: 'r1', owned: true, authorLine: 'You', sourceLine: 'Your library',
  supporterCopy: { listingId: 'L1', accountId: 'A1', revision: 1, sourceWorldId: 'w-source' },
};
const plain: LibraryItemSummary = {
  id: 'e2', kind: 'entity', name: 'Quiet Cartographer', revision: 'r1', owned: true, authorLine: 'You', sourceLine: 'Your library',
};

vi.mock('@/lib/librarySources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/librarySources')>()),
  libraryItems: vi.fn(async () => [marked, plain]),
  libraryItemData: vi.fn(async (_kind: string, id: string) => ({ id, name: id })),
}));

afterEach(cleanup);

function open(worldId: string | undefined, onConfirm = vi.fn()) {
  rtlRender(
    <OpenWorldIdProvider value={worldId}>
      <AddFromLibraryModal
        open onOpenChange={() => {}} kind="entity" title="Add Entities" description="Pick entities."
        emptyMessage="Nothing here." confirmLabel="Add" onConfirm={onConfirm}
      />
    </OpenWorldIdProvider>,
    { wrapper: TooltipProvider },
  );
  return onConfirm;
}

/** The rows list in library order: the marked entry first, the plain one second. */
const checkbox = async (name: string) => (await screen.findAllByRole('checkbox'))[name === 'Mara Vale' ? 0 : 1];

describe('Add From Library with a Supporter Copy entry', () => {
  it("disables the entry in another world's picker and adds nothing from it", async () => {
    const user = userEvent.setup();
    const onConfirm = open('w-other');

    expect(await checkbox('Mara Vale')).toBeDisabled();
    await user.click(await screen.findByText('Mara Vale'));
    await user.click(await screen.findByText('Quiet Cartographer'));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    const picks = onConfirm.mock.calls[0][0] as { source: { id: string } }[];
    expect(picks.map((pick) => pick.source.id)).toEqual(['e2']);
  });

  it('keeps the entry enabled in its source world', async () => {
    const user = userEvent.setup();
    const onConfirm = open('w-source');

    expect(await checkbox('Mara Vale')).toBeEnabled();
    await user.click(await screen.findByText('Mara Vale'));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect((onConfirm.mock.calls[0][0] as { source: { id: string } }[]).map((pick) => pick.source.id)).toEqual(['e1']);
  });

  it('keeps an unmarked entry enabled in any world', async () => {
    open('w-other');

    expect(await checkbox('Quiet Cartographer')).toBeEnabled();
  });
});
