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

/** An entity opening is the entity's own text, so its `{` menu offers Character Name; a world opening has
 *  no entity to name. */
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

describe('an entity opening’s Preview', () => {
  const greeting = { ...keeper, openings: [{ id: 'o1', text: '{{char}} nods to {{user}}.', kind: 'narration' }] } as Entity;

  it('reads Character Name as the entity’s name and Player Name as its label', async () => {
    mount(<EntityOpenings entity={greeting} onChange={() => {}} placeholders={[]} />);
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Preview' }));
    expect(screen.getByTestId('prompt-preview').textContent).toBe('Keeper nods to Player Name.');
  });
});
