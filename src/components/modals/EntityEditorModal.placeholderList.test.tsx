import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import EntityStorageService from '@/services/EntityStorageService';
import { phValues } from '@/test/placeholderValues';
import type { Entity, Placeholder } from '@/types';

/** The library entity editor's Placeholders tab on the List Editor: search, a named add, and a copy opened
 *  over the blueprint the card carries. */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), getEntityMetadata: vi.fn().mockResolvedValue([]), storeEntity: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => { throw new Error('no world'); },
  useGameDataOptional: () => null,
  NoWorld: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/game/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ text }: { text: string }) => <div data-testid="md">{text}</div>,
}));
// The field tabs reach into settings and image generation; the tab under test is another one.
vi.mock('@/managers/EntityFields', () => ({ EntityProfileFields: () => null, EntityDescriptionFields: () => null }));

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const eyesBlueprint: Placeholder = { id: 'bp-eyes', name: 'Eyes', values: phValues(['green', 'gray']) };

const maren: Entity = {
  id: 'e1',
  name: 'Maren',
  placeholders: [
    { id: 'town', name: 'Town', values: phValues(['Sedge', 'Marrow']) },
    { id: 'c-eyes', name: 'Eyes', blueprintId: 'bp-eyes', values: [] },
    { id: 'c-lost', name: 'Scar', blueprintId: 'bp-gone', values: [] },
  ],
  blueprints: [eyesBlueprint],
} as unknown as Entity;

async function openPlaceholders(draft: Entity = maren) {
  render(<EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole('tab', { name: 'Placeholders' }));
}

const panes = () => document.querySelector('[data-list-detail]')!.children;
const list = () => within(panes()[0] as HTMLElement);
const detail = () => within(panes()[1] as HTMLElement);
const searchBox = () => screen.getByPlaceholderText('Search or add new placeholders');
const saveEntity = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
  return vi.mocked(EntityStorageService.storeEntity).mock.calls.at(-1)![0].data as Entity;
};

describe('the library entity Placeholders tab', () => {
  it('shows the toolbar, and the list beside the detail', async () => {
    await openPlaceholders();
    expect(list().getByRole('button', { name: 'Add Placeholder' })).toBeInTheDocument();
    expect(list().getByPlaceholderText('Search or add new placeholders')).toBeInTheDocument();
    expect(list().getByText('Town')).toBeInTheDocument();
    expect(detail().getByText('Select a placeholder to edit it, or add one')).toBeInTheDocument();
  });

  it('lists the rows the search matches, and says when none do', async () => {
    await openPlaceholders();
    await userEvent.type(searchBox(), 'tow');
    expect(list().getByText('Town')).toBeInTheDocument();
    expect(list().queryByText('Eyes')).toBeNull();

    await userEvent.clear(searchBox());
    await userEvent.type(searchBox(), 'zzz');
    expect(list().getByText(/No placeholders match/)).toBeInTheDocument();
  });

  it('names a new placeholder from the search text, clears the box, and opens it', async () => {
    await openPlaceholders();
    await userEvent.type(searchBox(), 'Harbor');
    await userEvent.click(screen.getByRole('button', { name: 'Add Placeholder' }));
    expect(searchBox()).toHaveValue('');
    expect(detail().getByDisplayValue('Harbor')).toBeInTheDocument();
    expect((await saveEntity()).placeholders?.map((p) => p.name)).toContain('Harbor');
  });

  it('opens a copy over the carried blueprint, with no Edit Blueprint, and never writes the blueprint', async () => {
    await openPlaceholders();
    await userEvent.click(list().getByText('Eyes'));
    expect(detail().getByText(/Copy of the blueprint/)).toBeInTheDocument();
    expect(detail().getByText('gray')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset to Blueprint/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Edit Blueprint' })).toBeNull();

    // A removed blueprint value is an override on the copy.
    await userEvent.click(detail().getByRole('button', { name: 'Remove value 1' }));
    expect(screen.getByRole('button', { name: /Reset to Blueprint/ })).toBeEnabled();
    const saved = await saveEntity();
    expect(saved.blueprints).toEqual([eyesBlueprint]);
    expect(saved.placeholders?.find((p) => p.id === 'c-eyes')?.valueOverrides).toBeDefined();
  });

  it('opens the copy editor from a search row too', async () => {
    await openPlaceholders();
    await userEvent.type(searchBox(), 'eye');
    await userEvent.click(list().getByText('Eyes'));
    expect(detail().getByText(/Copy of the blueprint/)).toBeInTheDocument();
  });

  it('shows a notice, not a raw edit, for a copy whose blueprint the card lacks', async () => {
    await openPlaceholders();
    await userEvent.click(list().getByText('Scar'));
    expect(detail().getByText(/blueprint isn.t in this card/)).toBeInTheDocument();
    expect(detail().queryByDisplayValue('Scar')).toBeNull();
    expect(screen.queryByRole('button', { name: /Reset to Blueprint/ })).toBeNull();
  });
});

/** The palette header's toggle, which names the section it opens. */
const paletteIn = (pane: ReturnType<typeof within>) => pane.queryByRole('button', { name: /^Placeholders/ });

describe("the library entity editor's placeholder palette", () => {
  it('tops the detail pane on the Placeholders tab, with nothing selected, and never the list', async () => {
    await openPlaceholders();
    expect(paletteIn(detail())).toBeInTheDocument();
    expect(paletteIn(list())).toBeNull();
  });

  it('tops the detail pane on the Traits tab, with nothing selected, and never the list', async () => {
    render(<EntityEditorModal entityId={null} draft={maren} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Traits' }));
    expect(paletteIn(detail())).toBeInTheDocument();
    expect(paletteIn(list())).toBeNull();
  });
});
