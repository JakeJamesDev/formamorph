import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { reloadTourProgress } from '@/lib/authoringTour/progress';
import { HISTORY_FIELD_ATTRIBUTE } from '@/lib/historyField';
import type { World } from '@/types';

/** Every text field that writes the world carries a field identity, so an undo can pulse it. */

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
  traits: [{ id: 't-calm', name: 'Calm', statChanges: [{ statId: 's-mood', value: 2 }], groupId: null, order: 0 }],
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

/** The world text fields on screen: plain inputs and textareas that write the world, and chip fields. */
const worldFields = () => Array.from(document.querySelectorAll<HTMLElement>(
  'input[data-world-field], textarea[data-world-field], [data-lexical-editor="true"]',
));
const nameOf = (field: HTMLElement) =>
  field.getAttribute('aria-label') ?? field.getAttribute('placeholder') ?? field.outerHTML.slice(0, 80);

/** Every world field each panel tab shows, and the ones with no frame. */
function sweepPanelTabs() {
  const seen = new Set<HTMLElement>();
  const misses = new Set<string>();
  const collect = () => worldFields().forEach((field) => {
    seen.add(field);
    if (!field.closest(`[${HISTORY_FIELD_ATTRIBUTE}]`)) misses.add(nameOf(field));
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
  // The Overview's custom prompts open from a radio group, not a strip.
  const prompts = screen.queryByRole('radio', { name: 'Openings' })?.closest<HTMLElement>('[role="radiogroup"]');
  for (const kind of prompts ? within(prompts).getAllByRole('radio') : []) {
    fireEvent.click(kind);
    collect();
  }
  return { seen: seen.size, misses: [...misses] };
}

describe('field identity coverage', () => {
  it.each([
    [/Overview/, null],
    [/Stats/, 'Mood'],
    [/Locations/, 'Harbor Steps'],
    [/Entities/, 'Odd Wick'],
    [/Traits/, 'Calm'],
    [/Dictionary/, 'Reeds'],
    [/Dictionary/, 'Fen Lore'],
    [/Placeholders/, 'Weather'],
  ])('%s %s: every world text field carries an identity', (tab, record) => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(tab);
    if (record) fireEvent.click(screen.getAllByText(record, { exact: true })[0]);
    const { seen, misses } = sweepPanelTabs();
    expect(misses).toEqual([]);
    // A list with no record open shows no world field, so a sweep that reached no panel finds none.
    expect(seen).toBeGreaterThan(0);
  });
});
