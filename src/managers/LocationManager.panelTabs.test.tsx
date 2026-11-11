import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import type { World } from '@/types';
import { renderLocationsTab } from '@/test/locationsTabBench';
import { panelWorld } from '@/test/panelBench';

/** What the location panel puts on screen, in its own tabs. */

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
const WORLD: World = panelWorld({
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
  connections: [{ id: 'c1', a: 'veil', b: 'hollow', aToB: {}, bToA: {} }],
  entities: [{ id: 'resident', name: 'Odd Wick', aiDescription: 'Keeps the lamps.', locations: ['veil'] }],
});

/** Every field label the panel shows, in document order. Two of these are also editor tab names, so the
 *  match is taken from the panel body rather than from the whole editor. */
const FIELD_LABELS =
  /^(Name|Player-Facing Description|AI-Facing Description|AI-Facing Summary|Entities|Background Image|Image Tags|Ambient Sound|Placeholder Pins)$/;

const panelLabels = () =>
  screen.queryAllByText(FIELD_LABELS)
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

const selectLocation = (name: string) => {
  fireEvent.click(treeRow(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor location panel tabs', () => {
  it('offers seven tabs in Advanced mode, Openings last, and opens on Details', () => {
    renderLocationsTab(WORLD, 'advanced');
    selectLocation('The Veilwood');
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Connections', 'Items', 'Media', 'Pins', 'Openings']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('offers five tabs in Simple mode', () => {
    renderLocationsTab(WORLD, 'simple');
    selectLocation('The Veilwood');
    expect(panelTabNames()).toEqual(['Details', 'Presence', 'Connections', 'Items', 'Media']);
  });

  it('puts the name, the starting box and the three descriptions on Details, and nothing else', () => {
    renderLocationsTab(WORLD, 'advanced');
    selectLocation('The Veilwood');
    expect(panelLabels()).toEqual([
      'Name', 'Player-Facing Description', 'AI-Facing Description', 'AI-Facing Summary',
    ]);
    expect(screen.getByRole('checkbox', { name: /Starting Location/ })).toBeInTheDocument();
  });

  it('puts the roster on Presence, and the connections on their own tab', () => {
    renderLocationsTab(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Presence');
    expect(panelLabels()).toEqual(['Entities']);
    expect(screen.queryByTestId('connection-row')).not.toBeInTheDocument();
    openPanelTab('Connections');
    expect(panelLabels()).toEqual([]);
    expect(screen.getAllByTestId('connection-row')).toHaveLength(1);
  });

  it('puts the picture, its tags, the Generate button and the sound on Media', () => {
    renderLocationsTab(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Media');
    expect(panelLabels()).toEqual(['Background Image', 'Image Tags', 'Ambient Sound']);
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeInTheDocument();
  });

  it('puts the pin rows and their help control on Pins', () => {
    renderLocationsTab(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Pins');
    expect(panelLabels()).toEqual(['Placeholder Pins']);
    expect(screen.getByRole('button', { name: 'About Placeholder Pins' })).toBeInTheDocument();
  });

  it('drops the Advanced-only fields in Simple mode, keeping Generate with AI', () => {
    renderLocationsTab(WORLD, 'simple');
    selectLocation('The Veilwood');
    expect(panelLabels()).toEqual(['Name', 'Player-Facing Description', 'AI-Facing Description']);
    expect(screen.getByRole('checkbox', { name: /Starting Location/ })).toBeInTheDocument();

    openPanelTab('Media');
    // The picture and its Generate button stay; the tags line and the sound slot are Advanced only.
    expect(panelLabels()).toEqual(['Background Image']);
    expect(screen.getByRole('button', { name: /Generate with AI/ })).toBeInTheDocument();
  });

  it('keeps the chosen tab when the author selects a child location', () => {
    renderLocationsTab(WORLD, 'advanced');
    selectLocation('The Veilwood');
    openPanelTab('Presence');
    fireEvent.click(treeRow('The Hollow'));
    expect(panelTab('Presence')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Entities']);
  });

});
