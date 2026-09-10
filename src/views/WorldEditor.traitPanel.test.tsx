import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { benchEditorWorld, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { World } from '@/types';

/**
 * What the World Editor's trait panel puts on screen, driven through the real editor.
 *
 * The panel splits its field groups across its own tabs, so a group that loses a field, gains a duplicate,
 * lands out of order, or lands on the wrong tab shows up here as a changed label list. Pins is Advanced only,
 * so Simple mode keeps a strip of two rather than losing it.
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
  stats: [
    { id: 's1', name: 'Warmth', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] },
    { id: 's2', name: 'Damp', type: 'number', description: '', min: 0, max: 10, value: 1, regen: 0, descriptors: [] },
  ],
  placeholders: [{ id: 'p1', name: 'Hair Color', values: [{ id: 'v1', text: 'copper' }] }],
  traitGroups: [{ id: 'g1', name: 'Upbringing', parentId: null }],
  traits: [
    {
      id: 't1', name: 'Sedge-Born', playerDescription: 'Fen-raised.', aiDescription: 'Grew up in the fen.',
      statChanges: [{ statId: 's1', value: 2, type: 'min' }],
      statToggles: [{ statId: 's2', enabled: true }],
      placeholderPins: [{ placeholderId: 'p1', value: 'copper' }],
    },
    // A second trait in a group of its own, so the persistence case crosses a group boundary.
    { id: 't2', name: 'Marsh-Wed', groupId: 'g1', statChanges: [] },
  ],
} as Partial<World>);

// These tabs switch on mouseDown, not click.
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }));

const FIELD_LABELS =
  /^(Name|Player-Facing Description|AI-Facing Description|Stat Changes|Stat Availability|Placeholder Pins)$/;

/** Every field label the panel shows, in document order. The panel's own strip carries a Stats tab and a
 *  Details tab, so the match is taken from the panel body rather than the whole editor. */
const panelLabels = () =>
  screen.getAllByText(FIELD_LABELS)
    .filter((el) => !el.closest('[role="tablist"]'))
    .map((el) => el.textContent);

/** The checkbox captions the panel shows, which are spans rather than labeled fields. */
const panelSwitches = () =>
  screen.getAllByText(/^(Enabled by Default|Player Can Toggle In-Game)$/).map((el) => el.textContent);

/** The trait panel's own strip. The editor's top-level strip carries a Stats tab of its own, so every read
 *  and click here is taken from the named strip rather than by tab name. */
const panelStrip = () => screen.queryByRole('tablist', { name: 'Trait Fields' });

const panelTabNames = () => {
  const strip = panelStrip();
  return strip ? within(strip).getAllByRole('tab').map((el) => el.textContent) : [];
};

const panelTab = (name: string) =>
  within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name });

const openPanelTab = (name: string) => fireEvent.mouseDown(panelTab(name));

const selectTrait = (name: string) => {
  openTab(/Traits/);
  fireEvent.click(screen.getByText(name));
};

beforeEach(() => { localStorage.clear(); });

describe('the World Editor trait panel tabs', () => {
  it('offers three tabs in Advanced mode and opens on Details', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Sedge-Born');
    expect(panelTabNames()).toEqual(['Details', 'Stats', 'Pins']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
  });

  it('puts what the trait is and its own switches on Details, and nothing else', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Sedge-Born');
    expect(panelLabels()).toEqual(['Name', 'Player-Facing Description', 'AI-Facing Description']);
    expect(panelSwitches()).toEqual(['Enabled by Default', 'Player Can Toggle In-Game']);
  });

  it('puts both stat sections whole on Stats, each with its Add button', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Sedge-Born');
    openPanelTab('Stats');
    expect(panelLabels()).toEqual(['Stat Changes', 'Stat Availability']);
    expect(screen.getByRole('button', { name: 'Add Stat Change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Stat Availability' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Stat Changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About Stat Availability' })).toBeInTheDocument();
  });

  it('puts the pin section whole on Pins', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Sedge-Born');
    openPanelTab('Pins');
    expect(panelLabels()).toEqual(['Placeholder Pins']);
    expect(screen.getByRole('button', { name: 'About Placeholder Pins' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Pinned Value' })).toHaveValue('copper');
  });

  it('leaves Simple mode two tabs, with Stat Availability gone from Stats', () => {
    renderWorldEditorBench(WORLD, 'simple');
    selectTrait('Sedge-Born');
    expect(panelTabNames()).toEqual(['Details', 'Stats']);
    openPanelTab('Stats');
    expect(panelLabels()).toEqual(['Stat Changes']);
    expect(screen.getByRole('button', { name: 'Add Stat Change' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Stat Availability' })).toBeNull();
  });

  it('keeps the chosen tab when the author selects another trait, group or not', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Sedge-Born');
    openPanelTab('Stats');
    // Marsh-Wed sits in a group of its own, so this crosses a group boundary as well as a trait.
    fireEvent.click(screen.getByText('Marsh-Wed'));
    expect(panelTab('Stats')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Stat Changes', 'Stat Availability']);
  });

  it('lands on Details when Simple mode takes the Pins tab away, and restores the strip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Sedge-Born');
    openPanelTab('Pins');

    fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
    expect(panelTabNames()).toEqual(['Details', 'Stats']);
    expect(panelTab('Details')).toHaveAttribute('aria-selected', 'true');
    expect(panelLabels()).toEqual(['Name', 'Player-Facing Description', 'AI-Facing Description']);

    // The switch wears the hidden-data marker, whose own label joins its accessible name.
    fireEvent.click(screen.getByRole('radio', { name: /^Advanced/ }));
    expect(panelTabNames()).toEqual(['Details', 'Stats', 'Pins']);
  });

  it('shows a trait group its own panel with no strip', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    selectTrait('Upbringing');
    expect(panelStrip()).toBeNull();
    expect(screen.getByLabelText('Group Name')).toBeInTheDocument();
  });
});
