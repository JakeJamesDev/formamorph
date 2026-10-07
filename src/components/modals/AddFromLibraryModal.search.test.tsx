import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { LibraryItemSummary } from '@/lib/librarySources';
import AddFromLibraryModal from './AddFromLibraryModal';

const items: LibraryItemSummary[] = [
  { id: 'e1', kind: 'entity', name: 'Mara Vale', revision: 'r1', owned: true, authorLine: 'You', sourceLine: 'Created here' },
  { id: 'e2', kind: 'entity', name: 'Quiet Cartographer', revision: 'r1', owned: true, authorLine: 'You', sourceLine: 'Created here' },
];

vi.mock('@/lib/librarySources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/librarySources')>()),
  libraryItems: vi.fn(async () => items),
}));

afterEach(cleanup);

describe('the Add From Library search', () => {
  it('lists every item again when the X clears the search', async () => {
    const user = userEvent.setup();
    render(
      <AddFromLibraryModal
        open
        onOpenChange={() => {}}
        kind="entity"
        title="Add Entities"
        description="Pick entities."
        emptyMessage="Nothing here."
        confirmLabel="Add"
        onConfirm={() => {}}
      />,
    );
    const box = await screen.findByRole('searchbox', { name: 'Search the library' });
    await user.type(box, 'cartographer');
    expect(screen.queryByText('Mara Vale')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear Search' }));

    expect(box).toHaveValue('');
    expect(screen.getByText('Mara Vale')).toBeInTheDocument();
    expect(screen.getByText('Quiet Cartographer')).toBeInTheDocument();
  });
});
