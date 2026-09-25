import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityOpenings, OpeningsList } from './OpeningsPanel';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { ownerOpeningRows } from '@/lib/openings';
import { placeholderOwners } from '@/lib/placeholderHomes';
import type { Entity } from '@/types';

vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));

/** An entity opening is the entity's own text, so its `{` menu offers Character Name; a world opening has
 *  no entity to name. */

const keeper = { id: 'keeper', name: 'Keeper', openings: [{ id: 'o1', text: '.', kind: 'narration' }] } as Entity;
const lists = { placeholders: [], placeholderGroups: [], dictionaries: [], entities: [keeper] };
const store = { ...placeholderStore([], () => {}), lists, owners: placeholderOwners(lists) };

const mount = (children: ReactNode) => render(
  <PlaceholderStoreProvider value={store}>
    <EditorPreviewRollsProvider>{children}</EditorPreviewRollsProvider>
  </PlaceholderStoreProvider>,
);

/** The `{` menu's rows, typed at the head of the opening. */
async function menu(): Promise<string[]> {
  const user = userEvent.setup();
  await user.click(screen.getByRole('textbox', { name: /Opening 1/ }));
  await user.keyboard('{{');
  await screen.findByTestId('chip-typeahead');
  return screen.getAllByTestId('chip-typeahead-row').map((row) => row.textContent?.trim() ?? '');
}

describe('opening fields', () => {
  it('offer Character Name in an entity’s opening', async () => {
    mount(<EntityOpenings entity={keeper} onChange={() => {}} placeholders={[]} />);
    expect(await menu()).toEqual(['Player Name', 'Character Name']);
  });

  it('leave it out of a world opening', async () => {
    mount(<OpeningsList owner={keeper} rows={ownerOpeningRows(keeper)} onChange={() => {}} placeholders={[]} empty={null} />);
    expect(await menu()).toEqual(['Player Name']);
  });
});
