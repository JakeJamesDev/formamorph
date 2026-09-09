import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's location panel puts on screen, driven through the real editor.
 *
 * The panel groups its fields across its own tabs, so a field that goes missing, gains a duplicate, lands out
 * of order, or lands on the wrong tab shows up here as a changed label list. The tab an author picks belongs
 * to the editor rather than the panel, so the cases that click through the tree prove it survives the
 * per-location remount.
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

/** A parent with every field filled and a child under it, so the persistence case can cross the tree rather
 *  than only step between siblings. The connection gives Presence something authored to draw. */
const WORLD: World = benchEditorWorld({
  locations: [
    {
      id: 'veil', name: 'The Veilwood', isStarting: true,
      playerDescription: 'Moss over standing stones.',
      aiDescription: 'An old wood the fen grew around.',
      aiSummary: 'A drowned wood.',
      imageTags: 'forest, mist',
    },
    { id: 'hollow', name: 'The Hollow', parentId: 'veil', aiDescription: 'A dip below the roots.' },
  ],
  connections: [{ id: 'c1', from: 'veil', to: 'hollow', twoWay: true }],
  entities: [{ id: 'resident', name: 'Odd Wick', aiDescription: 'Keeps the lamps.', locations: ['veil'] }],
});

/** Every field label the panel shows, in document order. Three of these are also editor tab names, so the
 *  match is taken from the panel body rather than from the whole editor. */
const FIELD_LABELS =
  /^(Name|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Entities|Connections|Background Image|Image Tags|Ambient Sound|Placeholder Pins)$/;

const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The location panel's own strip. The editor's top-level one carries a Locations tab, so every read and
 *  click here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Location Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Location Fields' })).getByRole('tab', { name });

// These tabs switch on mouseDown, not click.
const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

/** One row of the tree. A location's name is drawn as meta elsewhere on the page, so the row is picked as
 *  the match sitting inside a clickable list row. */
const treeRow = (name: string) => {
  const row = screen.getAllByText(name)
    .map((el) => el.closest<HTMLElement>('[class*="cursor-pointer"]'))
    .find(Boolean);
  if (!row) throw new Error(`No tree row named ${name}`);
  return row;
};

const openLocations = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /^Locations/ }));

const selectLocation = (name: string) => {
  openLocations();
  fireEvent.click(treeRow(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor location panel tabs', () => {
  it('offers four tabs in Advanced mode and opens on Details', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Media', 'Pins']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('offers three tabs in Simple mode', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectLocation('The Veilwood');
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Media']);
  });

  it('puts the name, the starting box and the three descriptions on Details, and nothing else', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    expect(panelLabels()).toEqual([
      'Name', 'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
    ]);
    expect(screen.getByRole('checkbox', { name: /Starting location/ })).toBeInTheDocument();
  });

  it('puts the roster and the connections on Presence', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Presence');
    expect(panelLabels()).toEqual(['Entities', 'Connections']);
  });

  it('puts the picture, its tags, the Generate button and the sound on Media', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Media');
    expect(panelLabels()).toEqual(['Background Image', 'Image Tags', 'Ambient Sound']);
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeInTheDocument();
  });

  it('puts the pin rows and their help control on Pins', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Pins');
    expect(panelLabels()).toEqual(['Placeholder Pins']);
    expect(screen.getByRole('button', { name: 'About Placeholder Pins' })).toBeInTheDocument();
  });

  it('drops the Advanced-only fields in Simple mode, keeping Generate with AI', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectLocation('The Veilwood');
    expect(panelLabels()).toEqual(['Name', 'Player-Facing Description', 'AI-Facing Description']);
    expect(screen.getByRole('checkbox', { name: /Starting location/ })).toBeInTheDocument();

    openPanelTab('Media');
    // The picture and its Generate button stay; the tags line and the sound slot are Advanced only.
    expect(panelLabels()).toEqual(['Background Image']);
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeInTheDocument();
  });

  it('keeps the chosen tab when the author selects a child location', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Presence');
    fireEvent.click(treeRow('The Hollow'));
    expect(panelTab('Presence')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Entities', 'Connections']);
  });

  it('falls back to Details when Simple mode takes the chosen tab away', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Pins');
    fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Media']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Name', 'Player-Facing Description', 'AI-Facing Description']);
  });

  it('gives the Canvas view the same panel as the tree', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Media');
    fireEvent.click(screen.getByRole('radio', { name: 'Canvas' }));
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Media', 'Pins']);
    expect(panelTab('Media')).toHaveAttribute('aria-selected', 'true');
  });
});
