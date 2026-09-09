import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's entity panel puts on screen, driven through the real editor.
 *
 * The panel splits its field groups across its own tabs, so a group that loses a field, gains a duplicate,
 * lands out of order, or lands on the wrong tab shows up here as a changed label list. The tab an author
 * picks belongs to the editor rather than the panel, so the cases that click through the list prove it
 * survives the per-entity remount.
 */

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

const WORLD: World = benchEditorWorld({
  entities: [
    { id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'] },
    { id: 'e2', name: 'Marsh Tom', aiDescription: 'A ferryman.', locations: ['harbor'] },
  ],
});

const GROUPED_WORLD: World = benchEditorWorld({
  entities: [{ id: 'e1', name: 'Wren', aiDescription: 'A lamp-keeper.', locations: ['harbor'] }],
  entityGroups: [{ id: 'g1', name: 'Fen Folk', parentId: null }],
});

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const FIELD_LABELS =
  /^(Name|Aliases|Type|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Locations|Image|Image Tags|3D Model)$/;

/** Every field label the panel shows, in document order. The editor's own Locations tab shares a label with
 *  the picker, so the match is taken from the panel body rather than the whole editor. */
const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
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
  openTab(/Entities/);
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor entity panel tabs', () => {
  it('offers three tabs in Advanced mode and opens on Profile', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    expect(panelTabNames()).toEqual(['Profile', 'Descriptions', 'Placeholders']);
    expect(panelTab('Profile')).toHaveAttribute('aria-selected', 'true');
  });

  it('offers two tabs in Simple mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectEntity('Wren');
    expect(panelTabNames()).toEqual(['Profile', 'Descriptions']);
  });

  it('puts the identity fields, the picture and its tags on Profile, and no description', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    expect(panelLabels()).toEqual([
      'Image', 'Name', 'Aliases', 'Type', 'Image Tags', 'Locations', '3D Model',
    ]);
  });

  it('puts the three prose fields and nothing else on Descriptions', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Descriptions');
    expect(panelLabels()).toEqual([
      'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
    ]);
  });

  it('puts the scoped placeholder editor on Placeholders', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Placeholders');
    expect(panelLabels()).toEqual([]);
    expect(screen.getByText(/Placeholders of this entity's own/)).toBeInTheDocument();
  });

  it('drops the Advanced-only fields from both tabs in Simple mode, keeping Generate with AI', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectEntity('Wren');
    expect(panelLabels()).toEqual(['Image', 'Name', 'Locations']);
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeInTheDocument();
    openPanelTab('Descriptions');
    expect(panelLabels()).toEqual(['Player-Facing Description', 'AI-Facing Description']);
  });

  it('keeps the chosen tab when the author selects another entity', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Descriptions');
    fireEvent.click(screen.getByText('Marsh Tom'));
    expect(panelTab('Descriptions')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual([
      'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
    ]);
  });

  it('falls back to Profile when Simple mode takes the chosen tab away', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectEntity('Wren');
    openPanelTab('Placeholders');
    fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    expect(panelTabNames()).toEqual(['Profile', 'Descriptions']);
    expect(panelTab('Profile')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Image', 'Name', 'Locations']);
  });

  it('shows the group panel with no tab strip when the author selects a group', () => {
    renderWorldEditorBench(GROUPED_WORLD, 'advanced');
    openTab(/Entities/);
    fireEvent.click(screen.getByText('Fen Folk'));
    expect(screen.getByText('Group Name')).toBeInTheDocument();
    expect(panelTabNames()).toEqual([]);
  });
});
