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

describe("the library entity Traits tab's links", () => {
  /** Carried from a world where Class held Paladin (on for this link) and Wizard. */
  const linked: Entity = {
    ...wolf,
    traitLinks: [
      {
        id: 'l-class', originalId: 'w-class', kind: 'group', originalName: 'Class', groupId: null, order: 5,
        defaults: { 'w-paladin': true }, keyNames: { 'w-paladin': 'Paladin' },
      },
      { id: 'l-smite', originalId: 'w-smite', kind: 'trait', originalName: 'Smite', groupId: null, order: 6 },
    ],
  };
  /** A world with its own Class, and no Smite. */
  const world = {
    traits: [
      { id: 'n-paladin', name: 'Paladin', groupId: 'n-class', statChanges: [] },
      { id: 'n-wizard', name: 'Wizard', groupId: 'n-class', statChanges: [] },
    ],
    traitGroups: [{ id: 'n-class', name: 'Class', parentId: null }],
    entities: [],
  };
  const open = async (traitWorld?: typeof world) => {
    render(<SettingsProvider><EntityEditorModal entityId={null} draft={linked} onClose={vi.fn()} traitWorld={traitWorld} /></SettingsProvider>);
    await userEvent.click(screen.getByRole('tab', { name: 'Traits' }));
  };
  const saved = async () => {
    await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
    return vi.mocked(EntityStorageService.storeEntity).mock.calls.at(-1)![0].data as Entity;
  };

  it('reads each link by its stored name, read-only, when opened on its own', async () => {
    await open();
    expect(screen.queryByText('Paladin')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Link' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByText('Class'));
    expect(screen.getByText(/Open this entity from a world to edit the link/)).toBeInTheDocument();
    expect(screen.queryByText('This Link')).not.toBeInTheDocument();
  });

  it("reads a link live inside a world, and stores its This Link edit named from that world", async () => {
    await open(world);
    expect(screen.getByText('Wizard')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Class'));
    expect(screen.getByText('This Link')).toBeInTheDocument();
    const defaults = screen.getByRole('list', { name: 'Enabled by Default' });
    expect(within(defaults).getByRole('checkbox', { name: 'Paladin' })).toBeChecked();
    await userEvent.click(within(defaults).getByRole('checkbox', { name: 'Wizard' }));
    expect((await saved()).traitLinks).toEqual([
      {
        id: 'l-class', originalId: 'n-class', kind: 'group', originalName: 'Class', groupId: null, order: 5,
        defaults: { 'n-paladin': true, 'n-wizard': true }, keyNames: { 'n-paladin': 'Paladin', 'n-wizard': 'Wizard' },
      },
      linked.traitLinks![1],
    ]);
  });

  it("names a link the world lacks, and removes a link it has", async () => {
    await open(world);
    await userEvent.click(screen.getByText('Smite'));
    expect(screen.getByText(/This world doesn't have it/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Link' }));
    expect((await saved()).traitLinks).toEqual([linked.traitLinks![1]]);
  });
});
