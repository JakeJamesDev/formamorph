import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import { SettingsProvider } from '@/contexts/SettingsContext';
import EntityStorageService from '@/services/EntityStorageService';
import { SELF_ENTITY } from '@/lib/portableTraits';
import type { LibraryEditorWorld } from '@/managers/LibraryTraitsEditor';
import { encodePlaceholderToken } from '@/lib/placeholders';
import { phValues } from '@/test/placeholderValues';
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

async function openTraits(draft: Entity = wolf, traitWorld?: LibraryEditorWorld) {
  render(<SettingsProvider><EntityEditorModal entityId={null} draft={draft} onClose={vi.fn()} traitWorld={traitWorld} /></SettingsProvider>);
  await userEvent.click(screen.getByRole('tab', { name: 'Traits' }));
}

const searchBox = () => screen.getByPlaceholderText('Search or add new traits');
const openAddMenu = () => userEvent.click(screen.getByRole('button', { name: /^Add to Wolf/ }));
const selectedRow = () => within(document.querySelector('[data-editor-row-selected]') as HTMLElement);
const saveEntity = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^Save$/ }));
  return vi.mocked(EntityStorageService.storeEntity).mock.calls.at(-1)![0].data as Entity;
};

describe('the library entity Traits tab', () => {
  it("shows the entity's own traits and groups, and edits a persona's owned trait with a Stats tab (Q10)", async () => {
    await openTraits();
    expect(screen.getByText('Bond')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Oath'));
    expect(screen.getByText(/Owned by/)).toBeInTheDocument();
    const strip = screen.getByRole('tablist', { name: 'Trait Fields' });
    expect(within(strip).getByRole('tab', { name: 'Stats' })).toBeInTheDocument();
  });

  it('reads an outward requirement by its stored name, red, and offers only requirements inside the entity', async () => {
    await openTraits();
    await userEvent.click(screen.getByText('Oath'));
    await userEvent.click(screen.getByRole('tab', { name: 'Availability' }));
    const chip = screen.getByText('Paladin').closest('[data-unresolved]');
    expect(chip).not.toBeNull();
    // "Playing as" the entity itself points inside it, so it reads resolved.
    expect(screen.getByRole('button', { name: 'playing as Wolf' }).closest('[data-unresolved]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Add Requirement' }));
    expect(screen.getByRole('option', { name: /Tamed/ })).toBeInTheDocument();
    expect(screen.getByText('Any Trait in a Group')).toBeInTheDocument();
    expect(screen.queryByText('Playing As')).not.toBeInTheDocument();
  });

  it('adds a trait to the entity from the + menu and saves it with the entity', async () => {
    await openTraits();
    await openAddMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Add Trait to Wolf' }));
    expect(screen.getAllByText('New Trait').length).toBeGreaterThan(0);
    expect((await saveEntity()).traits!.map((t) => t.name)).toEqual(['Tamed', 'Oath', 'New Trait']);
  });

  it('keeps the list beside the details, with no back row', async () => {
    await openTraits();
    await userEvent.click(screen.getByText('Oath'));
    expect(screen.getByRole('tablist', { name: 'Trait Fields' })).toBeInTheDocument();
    expect(screen.getByText('Bond')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Traits' })).not.toBeInTheDocument();
  });
});

describe("the library entity Traits tab's placeholder palette", () => {
  it("offers the entity's placeholders and inserts one into a trait field", async () => {
    await openTraits({ ...wolf, placeholders: [{ id: 'town', name: 'Town', values: phValues(['Sedge']) }] });
    await userEvent.click(screen.getByText('Tamed'));
    await userEvent.click(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', { name: 'Town' }));
    const tamed = (await saveEntity()).traits?.find((t) => t.id === 't-tamed');
    expect(tamed?.name).toMatch(/\{\{ph:town:/);
  });
});

describe("the library entity Traits tab's toolbar", () => {
  it('replaces the Add buttons with the search box and a + menu that adds to the entity', async () => {
    await openTraits();
    expect(searchBox()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Trait' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Group' })).not.toBeInTheDocument();
    await openAddMenu();
    expect(screen.getByRole('button', { name: 'Add Trait to Wolf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Group to Wolf' })).toBeInTheDocument();
  });

  it("draws the entity's name through its placeholders on the menu rows", async () => {
    const token = encodePlaceholderToken({ id: 'p-kind', mode: 'world', placementId: 'v-kind' });
    await openTraits({
      ...wolf, name: `Wolf of ${token}`, placeholders: [{ id: 'p-kind', name: 'Kind', values: phValues(['Grey']) }],
    });
    await openAddMenu();
    const row = screen.getByRole('button', { name: /^Add Trait to Wolf of/ });
    expect(row.textContent).not.toContain('{{');
    expect(row.textContent).toMatch(/Kind/);
  });

  it('names a new trait from the search text, clears the box, and opens its details', async () => {
    await openTraits();
    await userEvent.type(searchBox(), 'Fangs');
    await openAddMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Add Trait to Wolf' }));
    expect(searchBox()).toHaveValue('');
    expect(screen.getByRole('tablist', { name: 'Trait Fields' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveTextContent('Fangs');
    expect((await saveEntity()).traits!.map((t) => t.name)).toEqual(['Tamed', 'Oath', 'Fangs']);
  });

  it('names a new group from the search text and opens it', async () => {
    await openTraits();
    await userEvent.type(searchBox(), 'Marks');
    await openAddMenu();
    await userEvent.click(screen.getByRole('button', { name: 'Add Group to Wolf' }));
    expect(searchBox()).toHaveValue('');
    expect(screen.getByLabelText('Group Name')).toHaveTextContent('Marks');
    expect((await saveEntity()).traitGroups!.map((g) => g.name)).toEqual(['Bond', 'Marks']);
  });

  it('keeps its own empty hint on an entity with no traits', async () => {
    await openTraits({ id: 'wolf', name: 'Wolf' });
    expect(screen.getByText('No traits yet. Add one to describe this entity to the AI.')).toBeInTheDocument();
  });
});

describe("the library entity Traits tab's search", () => {
  it('lists matching traits flat while a search is typed, and no groups', async () => {
    await openTraits();
    await userEvent.type(searchBox(), 'ta');
    expect(screen.getByText('Tamed')).toBeInTheDocument();
    expect(screen.queryByText('Oath')).not.toBeInTheDocument();
    expect(screen.queryByText('Bond')).not.toBeInTheDocument();
    await userEvent.clear(searchBox());
    await userEvent.type(searchBox(), 'Bond');
    expect(screen.getByText('No traits match “Bond”.')).toBeInTheDocument();
    await userEvent.clear(searchBox());
    expect(screen.getByText('Bond')).toBeInTheDocument();
  });

  it('says when no trait matches', async () => {
    await openTraits();
    await userEvent.type(searchBox(), 'zzz');
    expect(screen.getByText('No traits match “zzz”.')).toBeInTheDocument();
  });

  it("removes and duplicates a match through the entity's own traits", async () => {
    await openTraits();
    await userEvent.type(searchBox(), 'Tamed');
    await userEvent.click(screen.getByText('Tamed'));
    await userEvent.click(selectedRow().getByRole('button', { name: 'Duplicate' }));
    // The copy is selected, so its row and its open details both show the name.
    expect(selectedRow().getByText('Tamed (Copy)')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Tamed'));
    await userEvent.click(selectedRow().getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Tamed')).not.toBeInTheDocument();
    const saved = await saveEntity();
    expect(saved.traits!.map((t) => t.name)).toEqual(['Oath', 'Tamed (Copy)']);
    expect(saved.traits!.find((t) => t.name === 'Tamed (Copy)')!.groupId).toBe('g-bond');
  });
});

describe("the library entity Traits tab's links", () => {
  /** Carried from a world where Class held Paladin (on for this link) and Wizard. */
  const linked: Entity = {
    ...wolf,
    traitLinks: [
      {
        id: 'l-class', originalId: 'w-class', kind: 'group', originalName: 'Class', groupId: null, order: 5,
        overrides: { 'w-paladin': { isDefault: { value: true, blueprint: false } } }, keyNames: { 'w-paladin': 'Paladin' },
      },
      { id: 'l-smite', originalId: 'w-smite', kind: 'trait', originalName: 'Smite', groupId: null, order: 6 },
    ],
  };
  /** A world with its own Class in Blueprints, where Paladin pins Garb and Wizard requires Paladin, and no Smite. */
  const world: LibraryEditorWorld = {
    traits: [
      { id: 'n-paladin', name: 'Paladin', groupId: 'n-class', statChanges: [], placeholderPins: [{ placeholderId: 'p-garb', value: 'plate' }] },
      { id: 'n-wizard', name: 'Wizard', groupId: 'n-class', statChanges: [], requires: [{ kind: 'trait', id: 'n-paladin' }] },
    ],
    traitGroups: [
      { id: 'n-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' },
      { id: 'n-class', name: 'Class', parentId: 'n-blueprints' },
    ],
    entities: [],
    placeholders: [{ id: 'p-garb', name: 'Garb', values: phValues(['plate', 'robes']) }],
  };
  const open = async (traitWorld?: LibraryEditorWorld) => {
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
        overrides: {
          'n-paladin': { isDefault: { value: true, blueprint: false } },
          'n-wizard': { isDefault: { value: true, blueprint: false } },
        },
        keyNames: { 'n-paladin': 'Paladin', 'n-wizard': 'Wizard' },
      },
      linked.traitLinks![1],
    ]);
  });

  it("names a link the world lacks, and removes it there", async () => {
    await open(world);
    await userEvent.click(screen.getByText('Smite'));
    expect(screen.getByText(/This world doesn't have it/)).toBeInTheDocument();
    const [classRemove, smiteRemove] = screen.getAllByRole('button', { name: 'Remove Link' });
    expect(classRemove).toBeInTheDocument();
    await userEvent.click(smiteRemove);
    expect((await saved()).traitLinks!.map((l) => l.id)).toEqual(['l-class']);
  });

  it("reads a linked original's gate on its row inside a world", async () => {
    await open(world);
    await userEvent.click(screen.getByText('Wizard'));
    const row = document.querySelector('[data-editor-row-selected]')!;
    expect(row.querySelector('[tabindex="0"]')?.textContent).toBe('1');
  });

  it("lists a Link's own row in a search, by the name it shows, and never a linked group's inner rows", async () => {
    await open(world);
    await userEvent.type(searchBox(), 'Class');
    expect(screen.getByText('Class')).toBeInTheDocument();
    expect(screen.queryByText('Wizard')).not.toBeInTheDocument();
    await userEvent.clear(searchBox());
    await userEvent.type(searchBox(), 'Wizard');
    expect(screen.getByText('No traits match “Wizard”.')).toBeInTheDocument();
    await userEvent.clear(searchBox());
    // Smite has no original in this world, so its row shows the stored name.
    await userEvent.type(searchBox(), 'Smite');
    await userEvent.click(screen.getByText('Smite'));
    expect(screen.getByText(/This world doesn't have it/)).toBeInTheDocument();
    await userEvent.click(selectedRow().getByRole('button', { name: 'Remove Link' }));
    expect((await saved()).traitLinks!.map((l) => l.id)).toEqual(['l-class']);
  });
});
