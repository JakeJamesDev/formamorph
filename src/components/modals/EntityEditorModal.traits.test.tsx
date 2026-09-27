import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import EntityStorageService from '@/services/EntityStorageService';
import { SELF_ENTITY } from '@/lib/portableTraits';
import type { Entity } from '@/types';

/** The library entity editor's Traits tab: the World Editor's tree and panel over the entity's own traits. */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), getEntityMetadata: vi.fn().mockResolvedValue([]), storeEntity: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => { throw new Error('no world'); },
  useGameDataOptional: () => null,
  NoWorld: ({ children }: { children: ReactNode }) => children,
}));

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const wolf: Entity = {
  id: 'wolf', name: 'Wolf', persona: true,
  traitGroups: [{ id: 'g-bond', name: 'Bond', parentId: null }],
  traits: [
    { id: 't-tamed', name: 'Tamed', groupId: 'g-bond', statChanges: [] },
    {
      id: 't-oath', name: 'Oath', statChanges: [],
      requires: [{ kind: 'trait', id: 'w-paladin', name: 'Paladin' }, { kind: 'playingAs', id: SELF_ENTITY, name: 'Wolf' }],
    },
  ],
};

async function openTraits() {
  render(<SettingsProvider><EntityEditorModal entityId={null} draft={wolf} onClose={vi.fn()} /></SettingsProvider>);
  await userEvent.click(screen.getByRole('tab', { name: 'Traits' }));
}

describe('the library entity Traits tab', () => {
  it("shows the entity's own traits and groups, and edits an owned trait with no Stats tab", async () => {
    await openTraits();
    expect(screen.getByText('Bond')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Oath'));
    expect(screen.getByText(/Owned by/)).toBeInTheDocument();
    const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
    expect(within(strip).queryByRole('tab', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('reads an outward requirement by its stored name, red, and offers only requirements inside the entity', async () => {
    await openTraits();
    await userEvent.click(screen.getByText('Oath'));
    const chip = screen.getByText('Paladin').closest('[data-unresolved]');
    expect(chip).not.toBeNull();
    // "Playing as" the entity itself points inside it, so it reads resolved.
    expect(screen.getByRole('button', { name: 'playing as Wolf' }).closest('[data-unresolved]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(screen.getByRole('option', { name: /Tamed/ })).toBeInTheDocument();
    expect(screen.getByText('Any Trait in a Group')).toBeInTheDocument();
    expect(screen.queryByText('Playing As')).not.toBeInTheDocument();
  });

  it('adds a trait to the entity and saves it with the entity', async () => {
    await openTraits();
    await userEvent.click(screen.getByRole('button', { name: 'Add Trait' }));
    expect(screen.getAllByText('New Trait').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    const saved = vi.mocked(EntityStorageService.storeEntity).mock.calls.at(-1)![0].data as Entity;
    expect(saved.traits!.map((t) => t.name)).toEqual(['Tamed', 'Oath', 'New Trait']);
  });
});
