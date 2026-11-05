import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import type { World } from '@/types';
import { renderEntitiesTab } from '@/test/entitiesTabBench';
import { asMobile, panelWorld, panelTabLayout } from '@/test/panelBench';

/** What the entity panel puts on screen, in its own tabs. The tab an author picks belongs to the host rather than the panel, so the cases that click through the list prove it survives the per-entity remount. */

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

const WORLD: World = panelWorld({
  entities: [
    { id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'] },
    { id: 'e2', name: 'Marsh Tom', aiDescription: 'A ferryman.', locations: ['harbor'] },
  ],
});

const GROUPED_WORLD: World = panelWorld({
  entities: [{ id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'] }],
  entityGroups: [{ id: 'g1', name: 'Fen Folk', parentId: null }],
});

const FIELD_LABELS =
  /^(Name|Aliases|Type|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Locations|Image|Image Tags|3D Model)$/;

/** Every field label the panel shows, in document order. The editor's own Locations tab shares a label with
 *  the picker, so the match is taken from the panel body rather than the whole editor. */
const panelLabels = () =>
  screen.queryAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The entity panel's own strip. The editor's top-level one carries a Placeholders tab of its own, so every
 *  read and click here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Entity Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Entity Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectEntity = (name: string) => {
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor entity panel tabs', () => {
  it('offers seven tabs in Advanced mode and opens on Profile', () => {
    renderEntitiesTab(WORLD, 'advanced');
    selectEntity('Wren');
    expect(panelTabNames()).toEqual(['Profile', 'Descriptions', 'Items', 'Traits', 'Stats', 'Placeholders', 'Openings']);
    expect(panelTab('Profile')).toHaveAttribute('aria-selected', 'true');
  });

  it('offers three tabs in Simple mode', () => {
    renderEntitiesTab(WORLD, 'simple');
    selectEntity('Wren');
    expect(panelTabNames()).toEqual(['Profile', 'Descriptions', 'Items']);
  });

  it('puts the identity fields, the picture and its tags on Profile, and no description', () => {
    renderEntitiesTab(WORLD, 'advanced');
    selectEntity('Wren');
    expect(panelLabels()).toEqual([
      'Image', 'Name', 'Aliases', 'Type', 'Image Tags', 'Locations', '3D Model',
    ]);
  });

  it('puts the three prose fields and nothing else on Descriptions', () => {
    renderEntitiesTab(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Descriptions');
    expect(panelLabels()).toEqual([
      'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
    ]);
  });

  it('puts the scoped placeholder editor on Placeholders', () => {
    renderEntitiesTab(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Placeholders');
    expect(panelLabels()).toEqual([]);
    expect(screen.getByText(/These placeholders belong to this entity/)).toBeInTheDocument();
  });

  it('drops the Advanced-only fields from both tabs in Simple mode, keeping Generate with AI', () => {
    renderEntitiesTab(WORLD, 'simple');
    selectEntity('Wren');
    expect(panelLabels()).toEqual(['Image', 'Name', 'Locations']);
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeInTheDocument();
    openPanelTab('Descriptions');
    expect(panelLabels()).toEqual(['Player-Facing Description', 'AI-Facing Description']);
  });

  it('keeps the chosen tab when the author selects another entity', () => {
    renderEntitiesTab(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Descriptions');
    fireEvent.click(screen.getByText('Marsh Tom'));
    expect(panelTab('Descriptions')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual([
      'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
    ]);
  });

  it('shows the group panel with no tab strip when the author selects a group', () => {
    renderEntitiesTab(GROUPED_WORLD, 'advanced');
    fireEvent.click(screen.getByText('Fen Folk'));
    expect(screen.getByText('Group Name')).toBeInTheDocument();
    expect(panelTabNames()).toEqual([]);
  });
});

const layout = () => panelTabLayout('Entity Fields');
const FIXED_SCROLL = { strip: 'fixed', body: 'scroll' };
const FIXED_FILL = { strip: 'fixed', body: 'fill' };

describe('the World Editor entity panel height', () => {
  it.each([
    ['desktop', () => () => {}],
    ['mobile', asMobile],
  ])('keeps the strip fixed, fills the pane for Traits and Placeholders, and scrolls the other tabs on %s', (_, setUp) => {
    const undo = setUp();
    try {
      renderEntitiesTab(WORLD, 'advanced');
      selectEntity('Wren');
      expect(layout()).toEqual(FIXED_SCROLL);
      openPanelTab('Traits');
      expect(layout()).toEqual(FIXED_FILL);
      openPanelTab('Placeholders');
      expect(layout()).toEqual(FIXED_FILL);
      for (const tab of ['Descriptions', 'Openings', 'Profile']) {
        openPanelTab(tab);
        expect(layout()).toEqual(FIXED_SCROLL);
      }
    } finally {
      undo();
    }
  });
});
