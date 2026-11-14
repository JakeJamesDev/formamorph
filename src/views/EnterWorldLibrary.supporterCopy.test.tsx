import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { DictionarySelectionItem } from '@/lib/dictionarySelection';
import { OpenWorldIdProvider } from '@/lib/useSupporterCopyBlock';
import type { LibrarySupporterCopyMarker } from '@/types';
import EnterWorldLibrary, { type EntityAddition } from './EnterWorldLibrary';

const marker: LibrarySupporterCopyMarker = { listingId: 'L1', accountId: 'A1', revision: 1, sourceWorldId: 'w-source' };

const entities: EntityAddition[] = [
  { id: 'marked', name: 'Mara Vale', supporterCopy: marker },
  { id: 'plain', name: 'Quiet Cartographer' },
];
const dictionaryItems: DictionarySelectionItem[] = [
  { key: 'library:marked', source: 'library', enabled: false, entryCount: 1, supporterCopy: marker, book: { id: 'marked', name: 'Source Notes', entries: [] } },
  { key: 'library:plain', source: 'library', enabled: false, entryCount: 1, book: { id: 'plain', name: 'Traveler Notes', entries: [] } },
];

afterEach(cleanup);

function open(worldId: string) {
  const onEntityToggle = vi.fn();
  const onDictionaryItemsChange = vi.fn();
  rtlRender(
    <OpenWorldIdProvider value={worldId}>
      <EnterWorldLibrary
        entities={entities}
        selectedEntityIds={new Set()}
        dictionaryItems={dictionaryItems}
        onEntityToggle={onEntityToggle}
        onDictionaryItemsChange={onDictionaryItemsChange}
      />
    </OpenWorldIdProvider>,
    { wrapper: TooltipProvider },
  );
  return { onEntityToggle, onDictionaryItemsChange };
}

describe('Library Additions with Supporter Copy entries', () => {
  it("disables a marked entity and dictionary in another world's start, and leaves the plain ones enabled", async () => {
    const user = userEvent.setup();
    const { onEntityToggle, onDictionaryItemsChange } = open('w-other');

    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Enable Source Notes from Library' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Include Quiet Cartographer' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Enable Traveler Notes from Library' })).toBeEnabled();

    await user.click(screen.getByRole('checkbox', { name: 'Include Mara Vale' }));
    await user.click(screen.getByRole('checkbox', { name: 'Enable Source Notes from Library' }));
    expect(onEntityToggle).not.toHaveBeenCalled();
    expect(onDictionaryItemsChange).not.toHaveBeenCalled();
  });

  it('keeps them enabled in the source world', async () => {
    const user = userEvent.setup();
    const { onEntityToggle } = open('w-source');

    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Enable Source Notes from Library' })).toBeEnabled();
    await user.click(screen.getByRole('checkbox', { name: 'Include Mara Vale' }));
    expect(onEntityToggle).toHaveBeenCalledWith('marked', true);
  });

  it('disables the detail toggle of an inspected marked entity in another world', async () => {
    const user = userEvent.setup();
    open('w-other');

    await user.click(screen.getByRole('button', { name: 'Inspect Mara Vale' }));

    expect(screen.getByRole('checkbox', { name: 'Include Mara Vale in This Game' })).toBeDisabled();
  });
});
