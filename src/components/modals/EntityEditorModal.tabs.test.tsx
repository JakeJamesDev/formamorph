import { useState } from 'react';
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
 * The library entity editor and the World Editor's entity panel share one tab organization. Apart from the
 * library's Overview, both show the same tabs, and each field sits in the same tab in both.
 */

vi.mock('@/services/EntityStorageService', () => ({
  default: { getEntityData: vi.fn(), storeEntity: vi.fn() },
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
  return <EntityManager entity={entity} tab={tab} onTabChange={setTab} />;
};

const ownText = (el: Element) =>
  [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join('').trim();

const tabNames = () => screen.getAllByRole('tab').map((t) => t.textContent?.trim());

/** Each tab's name, then the field labels it shows, for whichever editor is on screen. */
async function fieldsByTab(skip: string[] = []) {
  const out: Record<string, string[]> = {};
  for (const name of tabNames()) {
    if (!name || skip.includes(name)) continue;
    await userEvent.click(screen.getByRole('tab', { name }));
    const panel = screen.getByRole('tabpanel');
    // A checkbox row carries its hint inline, so a label reads by its own text, as the matcher does.
    out[name] = within(panel).queryAllByText(FIELD_LABELS).map(ownText);
  }
  return out;
}

describe('the two entity editors', () => {
  it('show the same tabs apart from Overview, with Overview first in the library', () => {
    render(<SettingsProvider><EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} /></SettingsProvider>);
    const library = tabNames();
    cleanup();
    render(<SettingsProvider><WorldPanel /></SettingsProvider>);
    const worldTabs = tabNames();

    expect(library).toEqual(['Overview', 'Profile', 'Descriptions', 'Openings', 'Placeholders']);
    expect(worldTabs).toEqual(library.slice(1));
  });

  it('drop Openings and Placeholders in the World Editor in Simple mode, and keep them in the always-Advanced library', () => {
    const simple = (ui: React.ReactNode) => (
      <SettingsProvider>
        <EditorModeContext.Provider value={{ mode: 'simple', advanced: false, setMode: vi.fn() }}>{ui}</EditorModeContext.Provider>
      </SettingsProvider>
    );
    render(simple(<WorldPanel />));
    expect(tabNames()).toEqual(['Profile', 'Descriptions']);
    cleanup();
    render(simple(<EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} />));
    expect(tabNames()).toEqual(['Overview', 'Profile', 'Descriptions', 'Openings', 'Placeholders']);
  });

  it('show Pronouns in both modes and Persona only in Advanced, with the always-Advanced library showing both', () => {
    const simple = (ui: React.ReactNode) => (
      <SettingsProvider>
        <EditorModeContext.Provider value={{ mode: 'simple', advanced: false, setMode: vi.fn() }}>{ui}</EditorModeContext.Provider>
      </SettingsProvider>
    );
    render(simple(<WorldPanel />));
    expect(screen.getByLabelText('Pronouns')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^Persona/ })).toBeNull();
    cleanup();
    render(simple(<EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} />));
    expect(screen.getByLabelText('Pronouns')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Persona/ })).toBeInTheDocument();
  });

  it('write the Persona mark and pronouns to the entity in the World Editor', async () => {
    world.updateEntity.mockClear();
    render(<SettingsProvider><WorldPanel /></SettingsProvider>);
    await userEvent.click(screen.getByRole('checkbox', { name: /^Persona/ }));
    expect(world.updateEntity.mock.calls.at(-1)?.[0]).toMatchObject({ id: 'e1', persona: true });
    await userEvent.type(screen.getByLabelText('Pronouns'), 'x');
    expect(world.updateEntity.mock.calls.at(-1)?.[0]).toMatchObject({ id: 'e1', pronouns: 'x' });
  });

  it('open the library editor on Profile, not Overview', () => {
    render(<SettingsProvider><EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} /></SettingsProvider>);
    expect(screen.getByRole('tab', { name: 'Profile' })).toHaveAttribute('aria-selected', 'true');
  });

  it('put each field in the same tab, with Locations only in the World Editor', async () => {
    render(<SettingsProvider><EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} /></SettingsProvider>);
    const library = await fieldsByTab(['Overview', 'Openings', 'Placeholders']);
    cleanup();
    render(<SettingsProvider><WorldPanel /></SettingsProvider>);
    const worldFields = await fieldsByTab(['Openings', 'Placeholders']);

    expect(library).toEqual({
      Profile: ['Image', 'Name', 'Aliases', 'Pronouns', 'Type', 'Persona', 'Image Tags', '3D Model'],
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

  it('keep Overview to publish information', async () => {
    render(<SettingsProvider><EntityEditorModal entityId={null} draft={entity} onClose={vi.fn()} /></SettingsProvider>);
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(within(screen.getByRole('tabpanel')).queryAllByText(FIELD_LABELS)).toEqual([]);
  });

  it('show the same opening rows on the Openings tab, and write a new row to the entity', async () => {
    const withOpenings = {
      ...entity,
      openings: [{ id: 'o1', text: 'Wren trims the lamp.', kind: 'narration' }],
      openingWeights: { o1: 2 },
    } as unknown as Entity;
    const rowsOn = async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Openings' }));
      const panel = screen.getByRole('tabpanel');
      return within(panel).getAllByTestId('opening-row').map((row) => [
        within(row).getByLabelText('Draw weight for Opening 1').getAttribute('value'),
        within(row).getByLabelText('Chance for Opening 1').textContent,
      ]);
    };

    render(<SettingsProvider><EntityEditorModal entityId={null} draft={withOpenings} onClose={vi.fn()} /></SettingsProvider>);
    const library = await rowsOn();
    cleanup();
    world.updateEntity.mockClear();
    const Panel = () => {
      const [tab, setTab] = useState<EntityPanelTab>('profile');
      return <EntityManager entity={withOpenings} tab={tab} onTabChange={setTab} />;
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
