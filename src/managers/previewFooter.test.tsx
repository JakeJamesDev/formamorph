import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { openTraitFieldsTab, panelWorld, renderPanelBench, withEditorProviders } from '@/test/panelBench';
import { renderStatsTab } from '@/test/statsTabBench';
import { renderTraitsTab } from '@/test/traitsTabBench';
import type { LibraryEditorWorld } from '@/lib/libraryGateInput';
import type { Entity, Stat, World } from '@/types';
import LibraryStatsEditor from './LibraryStatsEditor';
import LibraryTraitsEditor from './LibraryTraitsEditor';

/** The Preview in the detail's footer row, through each host of the stat and trait editors. */

vi.mock('../services/WorldStorageService', () => ({
  default: {
    initialize: vi.fn(),
    getWorldMetadata: vi.fn().mockResolvedValue([]),
    storeWorld: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/jsonFileWorkerUtils', () => ({
  serializeJsonBlob: vi.fn(), parseJsonText: vi.fn(), terminateWorker: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  ToastContainer: () => null,
}));

const stat = (id: string, name: string, extra: Partial<Stat> = {}): Stat => ({
  id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra,
});

const WORLD: World = panelWorld({
  stats: [stat('s-warmth', 'Warmth'), stat('bp-trust', 'Trust', { groupId: 'bp' })],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' }],
  traitGroups: [{ id: 'g-blueprints', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  traits: [
    { id: 't-oath', name: 'Hollow Oath', statChanges: [], order: 0 },
    { id: 't-tamer', name: 'Beast Tamer', statChanges: [], groupId: 'g-blueprints', order: 1 },
  ],
  entities: [{
    id: 'rook', name: 'Rook', playerDescription: 'A ranger.', aiDescription: 'A ranger.', locations: ['harbor'],
    traitLinks: [{ id: 'l-tamer', originalId: 't-tamer', kind: 'trait', originalName: 'Beast Tamer', groupId: null, order: 0 }],
    statLinks: [{ id: 'l-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null }],
  }],
} as Partial<World>);

const LIBRARY_WORLD: LibraryEditorWorld = {
  traits: WORLD.traits, traitGroups: WORLD.traitGroups ?? [], entities: WORLD.entities, placeholders: [],
  stats: WORLD.stats, statGroups: WORLD.statGroups,
};

// A partial Entity, cast: the panel reads only these fields.
const libraryEntity: Entity = {
  id: 'lib', name: 'Wick', playerDescription: '', aiDescription: '', locations: [],
  traits: [{ id: 'lt', name: 'Lamplit', statChanges: [] }],
  stats: [stat('ls', 'Oil')],
  statLinks: [{ id: 'l-lib-trust', originalId: 'bp-trust', kind: 'stat', originalName: 'Trust', groupId: null }],
} as unknown as Entity;

/** A library entity's editor, standalone or opened inside the world, whose Blueprints its links read. */
const LibraryHost = ({ kind, world = false }: { kind: 'stats' | 'traits'; world?: boolean }) => {
  const [entity, setEntity] = useState<Entity | null>(libraryEntity);
  if (!entity) return null;
  return kind === 'stats'
    ? <LibraryStatsEditor entity={entity} setEntity={setEntity} placeholders={[]} world={world ? LIBRARY_WORLD : null} />
    : <LibraryTraitsEditor entity={entity} setEntity={setEntity} placeholders={[]} onOpenEntity={() => {}} />;
};

beforeEach(() => { localStorage.clear(); });

const footerRow = () => document.querySelector('[data-detail-footer]') as HTMLElement;
const buttonsIn = (el: Element) => within(el as HTMLElement).queryAllByRole('button').map((b) => b.textContent?.trim());
/** The footer row's buttons on its left and on its right. */
const footerSides = () => {
  const [lead, actions] = Array.from(footerRow().children);
  return { left: buttonsIn(lead), right: buttonsIn(actions) };
};
const openStatFieldsTab = (name: string) => fireEvent.mouseDown(
  within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name }),
);
const openTab = (name: string) => openTraitFieldsTab(name);
const shownTabPanel = () => screen.getByRole('tabpanel');

const searchFor = (placeholder: string, term: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: term } });
/** Opens a row: a tree row by its label, a search row by its Select button. */
const select = (label: string) => fireEvent.click(screen.getByText(label));
const selectFound = (label: string) => fireEvent.click(screen.getByRole('button', { name: `Select ${label}` }));

describe('the Preview on a plain world trait', () => {
  it('sits alone in the footer row while the Appearance tab is open, and never in the tab', () => {
    renderTraitsTab(WORLD, 'advanced');
    select('Hollow Oath');
    openTab('Appearance');

    expect(footerSides()).toEqual({ left: ['Preview'], right: [] });
    expect(within(shownTabPanel()).queryByRole('button', { name: 'Preview' })).toBeNull();
  });

  it('leaves the footer row empty on another tab', () => {
    renderTraitsTab(WORLD, 'advanced');
    select('Hollow Oath');
    openTab('Appearance');
    openTab('Details');

    expect(footerSides()).toEqual({ left: [], right: [] });
  });
});

describe('the Preview on a plain world stat', () => {
  it('sits alone in the footer row while the Appearance tab is open, and leaves on another tab', () => {
    renderStatsTab(WORLD, 'advanced');
    select('Warmth');
    expect(footerSides()).toEqual({ left: [], right: [] });

    openStatFieldsTab('Appearance');
    expect(footerSides()).toEqual({ left: ['Preview'], right: [] });
    expect(within(shownTabPanel()).queryByRole('button', { name: 'Preview' })).toBeNull();

    openStatFieldsTab('Details');
    expect(footerSides()).toEqual({ left: [], right: [] });
  });
});

describe('the Preview beside the row actions', () => {
  it('sits left of Link To… on a Blueprint stat in Advanced', () => {
    renderStatsTab(WORLD, 'advanced');
    searchFor('Filter Stats', 'Trust');
    selectFound('Trust');
    openStatFieldsTab('Appearance');

    expect(footerSides()).toEqual({ left: ['Preview'], right: ['Link To…'] });
  });

  it("sits left of Reset to Blueprint on an entity's stat link row", () => {
    renderPanelBench(WORLD, 'advanced', withEditorProviders(<LibraryHost kind="stats" world />));
    select('Trust');
    openStatFieldsTab('Appearance');

    expect(footerSides()).toEqual({ left: ['Preview'], right: ['Reset to Blueprint'] });
  });

  it('sits left of Edit Blueprint and Reset to Blueprint on a world stat link row', () => {
    renderStatsTab(WORLD, 'advanced');
    // The Blueprint's row comes first; the link's row sits under Rook.
    fireEvent.click(screen.getAllByText('Trust').at(-1)!);
    expect(screen.getByText(/Linked from/)).toBeInTheDocument();
    openStatFieldsTab('Appearance');

    expect(footerSides()).toEqual({ left: ['Preview'], right: ['Edit Blueprint', 'Reset to Blueprint'] });
  });

  it("opens the Blueprint from a stat link row's Edit Blueprint", () => {
    renderStatsTab(WORLD, 'advanced');
    fireEvent.click(screen.getAllByText('Trust').at(-1)!);
    fireEvent.click(within(footerRow()).getByRole('button', { name: 'Edit Blueprint' }));

    expect(screen.queryByText(/Linked from/)).toBeNull();
    expect(footerSides().right).toEqual(['Link To…']);
  });

  it("opens the Blueprint group from a stat group link's Edit Blueprint", () => {
    const grouped = panelWorld({
      stats: [stat('bp-mood', 'Mood', { groupId: 'bp-social' })],
      statGroups: [
        { id: 'bp', name: 'Blueprints', parentId: null, order: 1, system: 'blueprints' },
        { id: 'bp-social', name: 'Social', parentId: 'bp', order: 0 },
      ],
      entities: [{
        id: 'rook', name: 'Rook', playerDescription: '', aiDescription: '', locations: ['harbor'],
        statLinks: [{ id: 'l-social', originalId: 'bp-social', kind: 'group', originalName: 'Social', groupId: null }],
      }],
    } as Partial<World>);
    renderStatsTab(grouped, 'advanced');
    fireEvent.click(screen.getAllByText('Social').at(-1)!);
    expect(footerSides().right).toEqual(['Edit Blueprint', 'Reset to Blueprint']);
    fireEvent.click(within(footerRow()).getByRole('button', { name: 'Edit Blueprint' }));

    expect(footerSides().right).toEqual(['Link To…']);
  });

  it('leaves a trait link row, which is read-only, Edit Blueprint and Reset to Blueprint, and no Link To…', () => {
    renderTraitsTab(WORLD, 'advanced');
    searchFor('Filter Traits', 'Tamer');
    selectFound('Rook › Beast Tamer');
    openTab('Appearance');

    expect(footerSides()).toEqual({ left: [], right: ['Edit Blueprint', 'Reset to Blueprint'] });
  });

  it('keeps Link To… on a Blueprint trait in Advanced', () => {
    renderTraitsTab(WORLD, 'advanced');
    searchFor('Filter Traits', 'Tamer');
    selectFound('Beast Tamer');
    openTab('Appearance');

    expect(footerSides()).toEqual({ left: ['Preview'], right: ['Link To…'] });
  });
});

describe('the Preview in the library editors', () => {
  it("shows in a library trait's footer row", () => {
    renderPanelBench(WORLD, 'advanced', withEditorProviders(<LibraryHost kind="traits" />));
    select('Lamplit');
    openTab('Appearance');

    expect(footerSides().left).toEqual(['Preview']);
  });

  it("shows in a library stat's footer row", () => {
    renderPanelBench(WORLD, 'advanced', withEditorProviders(<LibraryHost kind="stats" />));
    select('Oil');
    openStatFieldsTab('Appearance');

    expect(footerSides().left).toEqual(['Preview']);
  });
});
