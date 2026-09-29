import { useState, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityEditorModal from './EntityEditorModal';
import EntityManager from '@/managers/EntityManager';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { EditorModeContext } from '@/lib/editorMode';
import { entityTabForField, type EntityPanelTab } from '@/views/entityPanelTabs';
import type { Entity } from '@/types';

/**
 * The library entity editor and the World Editor's entity panel share one tab organization. The library's
 * Entity tab holds the panel's tabs as sub-tabs, with Traits and Placeholders on the top strip, and each field
 * sits in the same tab in both.
 */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), getEntityMetadata: vi.fn().mockResolvedValue([]), storeEntity: vi.fn() },
}));

const entity = { id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.' } as unknown as Entity;

const world = {
  entities: [entity],
  locations: [],
  stats: [],
  traits: [],
  placeholders: [],
  placeholderOwners: new Map(),
  placementLetters: new Map(),
  updateEntity: vi.fn(),
};
vi.mock('@/contexts/GameDataContext', () => ({
  useGameData: () => world,
  useGameDataOptional: () => world,
  NoWorld: ({ children }: { children: ReactNode }) => children,
}));

// jsdom has no matchMedia; SettingsProvider reads it on mount for the theme.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const FIELD_LABELS =
  /^(Name|Aliases|Pronouns|Persona|Type|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Locations|Image|Image Tags|3D Model)$/;

/** The searchable fields' keys, as the find bar reports them. */
const FIELD_KEYS: Record<string, string> = {
  Name: 'name',
  Aliases: 'aliases[0]',
  Pronouns: 'pronouns',
  Type: 'type',
  'Image Tags': 'imageTags',
  'Player-Facing Description': 'playerDescription',
  'AI-Facing Description': 'aiDescription',
  'AI-Facing Summary': 'aiSummary',
};

const WorldPanel = () => {
  const [tab, setTab] = useState<EntityPanelTab>('profile');
  return <EntityManager entity={entity} tab={tab} onTabChange={setTab} traitId={null} onTraitIdChange={() => {}} placeholderId={null} onPlaceholderIdChange={() => {}} onOpenWorldPlaceholder={() => {}} />;
};

const ownText = (el: Element) =>
  [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();

const namesOf = (tabs: HTMLElement[]) => tabs.map((t) => t.getAttribute('aria-label') ?? t.textContent?.trim());
/** The entity field strip, which both editors label the same. */
const fieldStrip = () => screen.getByRole('tablist', { name: 'Entity Fields' });
const fieldTabNames = () => namesOf(within(fieldStrip()).getAllByRole('tab'));
/** The library modal's own strip: every tab outside the field strip. */
const topTabNames = () => namesOf(screen.getAllByRole('tab').filter((t) => !fieldStrip().contains(t)));
/** The panel a tab controls. The library nests the field panels in its Entity panel, so a bare query is ambiguous. */
const panelOf = (name: string) => document.getElementById(screen.getByRole('tab', { name }).getAttribute('aria-controls') ?? '')!;

const renderLibrary = (ui = <EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} />) =>
  render(<SettingsProvider>{ui}</SettingsProvider>);

/** Each field tab's name, then the field labels it shows, for whichever editor is on screen. */
async function fieldsByTab(skip: string[] = []) {
  const out: Record<string, string[]> = {};
  for (const name of fieldTabNames()) {
    if (!name || skip.includes(name)) continue;
    await userEvent.click(screen.getByRole('tab', { name }));
    const panel = panelOf(name);
    // A checkbox row carries its hint inline, so a label reads by its own text, as the matcher does.
    out[name] = within(panel).queryAllByText(FIELD_LABELS).map(ownText);
  }
  return out;
}

describe('the two entity editors', () => {
  it('show the same field tabs, with Traits and Placeholders on the library top strip', () => {
    renderLibrary();
    const libraryTop = topTabNames();
    const librarySub = fieldTabNames();
    cleanup();
    render(<SettingsProvider><WorldPanel /></SettingsProvider>);
    const worldTabs = fieldTabNames();

    expect(libraryTop).toEqual(['Entity', 'Traits', 'Placeholders']);
    expect(librarySub).toEqual(['Profile', 'Descriptions', 'Openings']);
    expect(worldTabs).toEqual(['Profile', 'Descriptions', 'Traits', 'Placeholders', 'Openings']);
  });

  it('drop Traits, Openings and Placeholders in the World Editor in Simple mode, and keep them in the always-Advanced library', () => {
    const simple = (ui: React.ReactNode) => (
      <SettingsProvider>
        <EditorModeContext.Provider value={{ mode: 'simple', advanced: false, setMode: vi.fn() }}>{ui}</EditorModeContext.Provider>
      </SettingsProvider>
    );
    render(simple(<WorldPanel />));
    expect(fieldTabNames()).toEqual(['Profile', 'Descriptions']);
    cleanup();
    render(simple(<EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} />));
    expect(topTabNames()).toEqual(['Entity', 'Traits', 'Placeholders']);
    expect(fieldTabNames()).toEqual(['Profile', 'Descriptions', 'Openings']);
  });

  it('show Pronouns in both modes and Persona only in Advanced, with the always-Advanced library showing both', () => {
    const simple = (ui: React.ReactNode) => (
      <SettingsProvider>
        <EditorModeContext.Provider value={{ mode: 'simple', advanced: false, setMode: vi.fn() }}>{ui}</EditorModeContext.Provider>
      </SettingsProvider>
    );
    render(simple(<WorldPanel />));
    expect(screen.getByLabelText('Pronouns')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Persona' })).toBeNull();
    cleanup();
    render(simple(<EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} />));
    expect(screen.getByLabelText('Pronouns')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Persona' })).toBeInTheDocument();
  });

  it('write the Persona role and pronouns to the entity in the World Editor', async () => {
    world.updateEntity.mockClear();
    render(<SettingsProvider><WorldPanel /></SettingsProvider>);
    await userEvent.click(screen.getByRole('radio', { name: 'Persona-Only' }));
    expect(world.updateEntity.mock.calls.at(-1)?.[0]).toMatchObject({ id: 'e1', persona: true, personaOnly: true });
    await userEvent.type(screen.getByLabelText('Pronouns'), 'x');
    expect(world.updateEntity.mock.calls.at(-1)?.[0]).toMatchObject({ id: 'e1', pronouns: 'x' });
  });

  it('open the library editor on Entity and Profile', () => {
    renderLibrary();
    expect(screen.getByRole('tab', { name: 'Entity' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
  });

  it('put each field in the same tab, with Locations only in the World Editor', async () => {
    renderLibrary();
    const library = await fieldsByTab(['Openings']);
    cleanup();
    render(<SettingsProvider><WorldPanel /></SettingsProvider>);
    // Traits holds a list of the entity's own traits, not fields.
    const worldFields = await fieldsByTab(['Traits', 'Openings', 'Placeholders']);

    expect(library).toEqual({
      Profile: ['Image', 'Name', 'Aliases', 'Pronouns', 'Persona', 'Type', 'Image Tags', '3D Model'],
      Descriptions: ['Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary'],
    });
    expect({ ...worldFields, Profile: worldFields.Profile.filter((l) => l !== 'Locations') }).toEqual(library);

    // The find bar's field-to-tab map agrees with where each searchable field renders.
    for (const [tabName, labels] of Object.entries(library)) {
      for (const label of labels) {
        const key = FIELD_KEYS[label];
        if (key) expect([label, entityTabForField(key)]).toEqual([label, tabName.toLowerCase()]);
      }
    }
  });

  it('show Tags beside every library sub-tab', async () => {
    renderLibrary();
    for (const name of ['Profile', 'Descriptions', 'Openings']) {
      await userEvent.click(screen.getByRole('tab', { name }));
      expect([name, screen.getAllByText('Tags', { exact: true })]).toEqual([name, [expect.anything()]]);
      // Beside the field panel, not inside it.
      expect(within(panelOf(name)).queryByText('Tags', { exact: true })).toBeNull();
    }
  });

  it('show Tags at the top of Profile only on a narrow screen', async () => {
    const wide = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...wide(query), matches: true })) as typeof window.matchMedia;
    try {
      renderLibrary();
      expect(within(panelOf('Profile')).getByText('Tags', { exact: true })).toBeInTheDocument();
      for (const name of ['Descriptions', 'Openings']) {
        await userEvent.click(screen.getByRole('tab', { name }));
        expect([name, screen.queryByText('Tags', { exact: true })]).toEqual([name, null]);
      }
    } finally {
      window.matchMedia = wide;
    }
  });

  it('open the tab and sub-tab that hold a focused field', async () => {
    const { rerender } = renderLibrary();
    await userEvent.click(screen.getByRole('tab', { name: 'Placeholders' }));
    rerender(
      <SettingsProvider>
        <EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} focusField={{ fieldKey: 'aiSummary', itemId: 'e1' }} />
      </SettingsProvider>,
    );
    expect(screen.getByRole('tab', { name: 'Entity' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Descriptions' })).toHaveAttribute('aria-selected', 'true');
    expect(within(panelOf('Descriptions')).getByText('AI-Facing Summary')).toBeInTheDocument();
  });

  it('show the same opening rows on the Openings tab, and write a new row to the entity', async () => {
    const withOpenings = {
      ...entity,
      openings: [{ id: 'o1', text: 'Wren trims the lamp.', kind: 'narration' }],
      openingWeights: { o1: 2 },
    } as unknown as Entity;
    const rowsOn = async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Openings' }));
      const panel = panelOf('Openings');
      return within(panel).getAllByTestId('opening-row').map((row) => [
        within(row).getByLabelText('Draw weight for Opening 1').getAttribute('value'),
        within(row).getByLabelText('Chance for Opening 1').textContent,
      ]);
    };

    renderLibrary(<EntityEditorModal entityId={null} draft={withOpenings} onClose={vi.fn()} />);
    const library = await rowsOn();
    cleanup();
    world.updateEntity.mockClear();
    const Panel = () => {
      const [tab, setTab] = useState<EntityPanelTab>('profile');
      return <EntityManager entity={withOpenings} tab={tab} onTabChange={setTab} traitId={null} onTraitIdChange={() => {}} placeholderId={null} onPlaceholderIdChange={() => {}} onOpenWorldPlaceholder={() => {}} />;
    };
    render(<SettingsProvider><Panel /></SettingsProvider>);
    expect(await rowsOn()).toEqual(library);
    expect(library).toEqual([['2', '100%']]);

    await userEvent.click(screen.getByRole('button', { name: 'Add Opening' }));
    const written = world.updateEntity.mock.calls.at(-1)?.[0] as Entity;
    expect(written.id).toBe('e1');
    expect(written.openings).toHaveLength(2);
    expect(written.openingWeights).toEqual({ o1: 2 });
  });
});

describe('the Others | Self switch on the Openings tab', () => {
  const rows = [
    { id: 'o1', text: 'Wren trims the lamp.', kind: 'narration' },
    { id: 'o2', text: 'You wake as Wren.', kind: 'action', self: true },
  ];
  const withRows = (marks: Partial<Entity>) => ({ ...entity, ...marks, openings: rows, openingWeights: { o1: 2 } } as unknown as Entity);
  const switchFor = (n: number) => within(panelOf('Openings')).queryByRole('radiogroup', { name: `Drawn For, Opening ${n}` });
  const cardCount = () => within(panelOf('Openings')).getAllByTestId('opening-row').length;
  const openTab = () => userEvent.click(screen.getByRole('tab', { name: 'Openings' }));
  const WorldPanelFor = ({ of }: { of: Entity }) => {
    const [tab, setTab] = useState<EntityPanelTab>('profile');
    return <EntityManager entity={of} tab={tab} onTabChange={setTab} traitId={null} onTraitIdChange={() => {}} placeholderId={null} onPlaceholderIdChange={() => {}} onOpenWorldPlaceholder={() => {}} />;
  };

  it('shows on a library entity with the Persona mark, with its Self row', async () => {
    renderLibrary(<EntityEditorModal entityId={null} draft={withRows({ persona: true })} onClose={vi.fn()} />);
    await openTab();
    expect(within(switchFor(1)!).getByRole('radio', { name: 'Others' })).toBeChecked();
    expect(within(switchFor(2)!).getByRole('radio', { name: 'Self' })).toBeChecked();
  });

  it('hides, with the Self row, on a library entity without the Persona mark', async () => {
    renderLibrary(<EntityEditorModal entityId={null} draft={withRows({})} onClose={vi.fn()} />);
    await openTab();
    expect(switchFor(1)).toBeNull();
    expect(cardCount()).toBe(1);
  });

  it('flips a library persona’s row to Self, keeping its text, kind and weight', async () => {
    renderLibrary(<EntityEditorModal entityId={null} draft={withRows({ persona: true })} onClose={vi.fn()} />);
    await openTab();
    await userEvent.click(within(switchFor(1)!).getByRole('radio', { name: 'Self' }));
    const panel = panelOf('Openings');
    expect(within(switchFor(1)!).getByRole('radio', { name: 'Self' })).toBeChecked();
    expect(within(within(panel).getByRole('radiogroup', { name: 'Opens As, Opening 1' })).getByRole('radio', { name: 'Narration' })).toBeChecked();
    expect(within(panel).getByLabelText('Draw weight for Opening 1')).toHaveValue(2);
    expect(within(panel).getByText('Wren trims the lamp.')).toBeInTheDocument();
    expect(cardCount()).toBe(2);
  });

  it('hides on a library copy of a Custom Persona entity, which no player can pick', async () => {
    renderLibrary(<EntityEditorModal entityId={null} draft={withRows({ customPersona: true })} onClose={vi.fn()} />);
    await openTab();
    expect(switchFor(1)).toBeNull();
    expect(cardCount()).toBe(1);
  });

  it('shows on the world’s Custom Persona entity and writes a flip to it', async () => {
    world.updateEntity.mockClear();
    render(<SettingsProvider><WorldPanelFor of={withRows({ customPersona: true })} /></SettingsProvider>);
    await openTab();
    expect(within(switchFor(2)!).getByRole('radio', { name: 'Self' })).toBeChecked();

    await userEvent.click(within(switchFor(2)!).getByRole('radio', { name: 'Others' }));
    const written = world.updateEntity.mock.calls.at(-1)?.[0] as Entity;
    expect(written.openings).toEqual([rows[0], { id: 'o2', text: 'You wake as Wren.', kind: 'action' }]);
    expect(written.openingWeights).toEqual({ o1: 2 });
  });

  it('hides on a world entity with neither mark', async () => {
    render(<SettingsProvider><WorldPanelFor of={withRows({})} /></SettingsProvider>);
    await openTab();
    expect(switchFor(1)).toBeNull();
    expect(cardCount()).toBe(1);
  });
});

describe('the library Openings tab toolbar', () => {
  const twoOpenings = {
    ...entity,
    openings: [
      { id: 'o1', text: 'Wren trims the lamp.', kind: 'narration' },
      { id: 'o2', text: 'A gull steals your bread.', kind: 'action' },
    ],
  } as unknown as Entity;
  const cards = () => within(panelOf('Openings')).queryAllByTestId('opening-row')
    .map((row) => within(row).getAllByText(/^Opening \d+$/)[0].textContent);
  const box = () => within(panelOf('Openings')).getByPlaceholderText('Search openings');

  it('filters the cards by text and shows a no-match line', async () => {
    renderLibrary(<EntityEditorModal entityId={null} draft={twoOpenings} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Openings' }));

    await userEvent.type(box(), 'gull');
    expect(cards()).toEqual(['Opening 2']);

    await userEvent.clear(box());
    await userEvent.type(box(), 'lantern');
    expect(cards()).toEqual([]);
    expect(within(panelOf('Openings')).getByText('No openings match “lantern”.')).toBeInTheDocument();
  });

  it('adds a card with the + and clears the box', async () => {
    renderLibrary(<EntityEditorModal entityId={null} draft={twoOpenings} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Openings' }));

    await userEvent.type(box(), 'gull');
    await userEvent.click(within(panelOf('Openings')).getByRole('button', { name: 'Add Opening' }));
    expect(box()).toHaveValue('');
    expect(cards()).toEqual(['Opening 1', 'Opening 2', 'Opening 3']);
  });
});
