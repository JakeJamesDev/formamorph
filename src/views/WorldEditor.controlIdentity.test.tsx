import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { HISTORY_FIELD_ATTRIBUTE } from '@/lib/historyField';
import { TARGET_ATTRIBUTE } from '@/lib/surface/surfaceTargets';
import type { World } from '@/types';

/** Every non-text control that writes the world carries a field identity, so an undo can pulse it. */

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
  stats: [{
    id: 's-mood', name: 'Mood', type: 'number', description: 'How calm', min: 0, max: 10, value: 4, regen: 0,
    descriptors: [{ id: 'd-low', threshold: 3, description: 'Tense' }, { id: 'd-high', threshold: 10, description: 'Calm' }],
  }],
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true, openings: [{ id: 'o-quay', text: 'Rain on the quay.', kind: 'narration' }] },
    { id: 'docks', name: 'Docks' },
  ],
  connections: [{ id: 'c-walk', a: 'harbor', b: 'docks', aToB: { hint: 'Down the steps' }, bToA: { hint: 'Up the steps' } }],
  entities: [{
    id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'],
    openings: [{ id: 'o-lamp', text: 'Wick trims a lamp.', kind: 'narration' }],
  }],
  traits: [{
    id: 't-calm', name: 'Calm', statChanges: [{ statId: 's-mood', value: 2 }], groupId: null, order: 0,
    placeholderPins: [{ placeholderId: 'weather', value: 'fog' }],
  }],
  placeholders: [{ id: 'weather', name: 'Weather', values: [{ id: 'v-fog', text: 'fog' }, { id: 'v-rain', text: 'rain' }] }],
  dictionaries: [{
    id: 'lore', name: 'Fen Lore', enabled: true,
    entries: [{ id: 'e-reeds', name: 'Reeds', key: ['reeds'], value: 'They whisper.' }],
  }],
} as Partial<World>);

beforeEach(() => {
  localStorage.clear();
  reloadTourProgress();
});

const CONTROLS = '[role="checkbox"], [role="switch"], [role="slider"], [role="combobox"], [role="radio"], input[type="color"], input[type="range"]';
const nameOf = (control: HTMLElement) =>
  `${control.getAttribute('role') ?? control.getAttribute('type')}:${control.getAttribute('aria-label') ?? control.textContent?.slice(0, 40)}`;

/** Controls that steer the editor and write nothing to the world, so an undo has no field to show on them. */
const STEERS: ((control: HTMLElement) => boolean)[] = [
  (control) => control.getAttribute('aria-label') === 'Editor mode',
  (control) => control.getAttribute('aria-label') === 'Connect To',
  // The Locations List and Canvas views.
  (control) => !!control.closest('[aria-label="Locations view"]'),
  // The Overview's custom prompt kinds open a panel.
  (control) => control.closest('[role="radiogroup"]')?.hasAttribute(TARGET_ATTRIBUTE) === true,
  // The placeholder value editor's Chips and Multiline view.
  (control) => !!control.closest('[aria-label="Value editor style"]'),
];

/** Every control each panel tab shows. */
function sweepPanelTabs() {
  const seen = new Map<string, number>();
  const misses = new Set<string>();
  const framed = new Set<string>();
  const collect = () => {
    document.querySelectorAll(`[${HISTORY_FIELD_ATTRIBUTE}]`).forEach((frame) => framed.add(frame.getAttribute(HISTORY_FIELD_ATTRIBUTE)!));
    sweepControls();
  };
  const sweepControls = () => document.querySelectorAll<HTMLElement>(CONTROLS).forEach((control) => {
    const kind = control.getAttribute('role') ?? control.getAttribute('type') ?? 'control';
    seen.set(kind, (seen.get(kind) ?? 0) + 1);
    if (!control.closest(`[${HISTORY_FIELD_ATTRIBUTE}]`) && !STEERS.some((steers) => steers(control))) misses.add(nameOf(control));
  });
  collect();
  const strips = screen.queryAllByRole('tablist').filter((strip) => strip.getAttribute('aria-label') !== 'Editor Sections');
  for (const strip of strips) {
    for (const tab of within(strip).queryAllByRole('tab')) {
      if (!tab.isConnected) continue;
      fireEvent.mouseDown(tab);
      collect();
    }
  }
  return { seen: Object.fromEntries(seen), misses: [...misses], framed };
}

describe('control identity coverage', () => {
  it.each([
    [/Overview/, null],
    [/Stats/, 'Mood'],
    [/Locations/, 'Harbor Steps'],
    [/Entities/, 'Odd Wick'],
    [/Traits/, 'Calm'],
    [/Dictionary/, 'Reeds'],
    [/Dictionary/, 'Fen Lore'],
    [/Placeholders/, 'Weather'],
  ])('%s %s', (tab, record) => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(tab);
    if (record) fireEvent.click(screen.getAllByText(record, { exact: true })[0]);
    const { seen, misses, framed } = sweepPanelTabs();
    expect(Object.keys(seen).length).toBeGreaterThan(0);
    // The sweep reaches the controls that live in shared components, so losing their frame fails it.
    if (record === 'Calm') expect([...framed]).toEqual(expect.arrayContaining(['mode', 'isDefault', 'playerToggle', 'pins/0']));
    if (record === 'Weather') expect([...framed].some((field) => field.startsWith('pins/'))).toBe(true);
    expect(misses).toEqual([]);
  });
});
