import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntityDescriptionFields } from './EntityFields';
import { EditorPreviewRollsProvider } from '@/contexts/EditorPreviewRollsContext';
import { PlaceholderStoreProvider, placeholderStore } from '@/contexts/PlaceholderStoreContext';
import { placeholderOwners } from '@/lib/placeholderHomes';
import type { Entity } from '@/types';

vi.mock('@/components/AiGenerateButton', () => ({ default: () => null }));

const entity = (name: string) => ({ id: 'e1', name, playerDescription: '{{char}} waits.' }) as Entity;

function mount(value: Entity) {
  const lists = { placeholders: [], placeholderGroups: [], dictionaries: [], entities: [value] };
  const store = { ...placeholderStore([], () => {}), lists, owners: placeholderOwners(lists) };
  return render(
    <PlaceholderStoreProvider value={store}>
      <EditorPreviewRollsProvider>
        <EntityDescriptionFields value={value} onChange={() => {}} ownerId={value.id} />
      </EditorPreviewRollsProvider>
    </PlaceholderStoreProvider>,
  );
}

/** The Player-Facing Description's Preview text. */
async function preview(): Promise<string | null> {
  const field = screen.getByText('Player-Facing Description').closest('[data-tour-anchor]') as HTMLElement;
  await userEvent.setup().click(within(field).getByRole('tab', { name: 'Preview' }));
  return within(field).getByTestId('prompt-preview').textContent;
}

describe('an entity description’s Preview', () => {
  it('reads Character Name as the entity’s current name', async () => {
    const { unmount } = mount(entity('YoRHa 2B'));
    expect(await preview()).toBe('YoRHa 2B waits.');
    unmount();
    mount(entity('YoRHa 9S'));
    expect(await preview()).toBe('YoRHa 9S waits.');
  });

  it('reads the label while the entity has no name', async () => {
    mount(entity(''));
    expect(await preview()).toBe('Character Name waits.');
  });
});
