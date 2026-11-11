import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench, searchWorldField } from '@/test/worldEditorBench';
import type { World } from '@/types';

/** Collapse All on the Entities, Stats, Traits, Placeholders, Dictionary and Scripts tabs, one collapsed set per tab. */

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

// The real editor arrives on its own chunk with CodeMirror; a plain box stands in.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string }) => <textarea aria-label={props.ariaLabel} value={props.value} readOnly />,
}));

const stat = (id: string, name: string, extra: object = {}) =>
  ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], ...extra });

/** Every tab holds one group with one child row, and the child's name is unique to its tab. */
const WORLD: World = benchEditorWorld({
  locations: [
    { id: 'harbor', name: 'Harbor Steps', isStarting: true },
    { id: 'wood', name: 'Wood' },
    { id: 'hollow', name: 'Hollow', parentId: 'wood' },
  ],
  entityGroups: [{ id: 'g-crew', name: 'Crew', parentId: null, order: 1 }],
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: '', aiDescription: '', locations: ['harbor'] },
    { id: 'mira', name: 'Mira', playerDescription: '', aiDescription: '', locations: ['harbor'], groupId: 'g-crew' },
  ],
  statGroups: [{ id: 'g-body', name: 'Body', parentId: null, order: 0 }],
  stats: [stat('grit', 'Grit', { groupId: 'g-body' })],
  traitGroups: [{ id: 'g-kin', name: 'Kin', parentId: null }],
  traits: [{ id: 'stoic', name: 'Stoic', statChanges: [], groupId: 'g-kin' }],
  placeholderGroups: [{ id: 'g-looks', name: 'Looks', parentId: null, order: 0 }],
  placeholders: [{ id: 'hair', name: 'Hairline', groupId: 'g-looks', values: [{ id: 'v1', text: 'braided' }] }],
  dictionaries: [{
    id: 'b1', name: 'Fen Lore', enabled: true,
    entries: [{ id: 'e1', name: 'Lamp Oil', key: ['reed'], value: 'Smells of the marsh.' }],
  }],
  scripts: [{ id: 'weather', name: 'Weather', timing: 'after', code: 'return 1;' }],
} as Partial<World>);

/** The same tabs with no group, so no tab has a parent row. */
const FLAT: World = benchEditorWorld({ locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }] } as Partial<World>);

type TabCase = { tab: RegExp; noun: string; child: string };
const TABS: TabCase[] = [
  { tab: /Entities/, noun: 'entities', child: 'Mira' },
  { tab: /Stats/, noun: 'stats', child: 'Grit' },
  { tab: /Traits/, noun: 'traits', child: 'Stoic' },
  { tab: /Placeholders/, noun: 'placeholders', child: 'Hairline' },
  { tab: /Dictionary/, noun: 'entries', child: 'Lamp Oil' },
  { tab: /Scripts/, noun: 'scripts', child: 'Weather' },
];

const collapseAll = (noun: string) => screen.getByRole('button', { name: `Collapse all ${noun}` });
const expandAll = (noun: string) => screen.getByRole('button', { name: `Expand all ${noun}` });
const anyFace = (noun: string) => screen.getByRole('button', { name: new RegExp(`^(Collapse|Expand) all ${noun}$`) });
/** Whether a tree row shows the text; a panel or a palette can name the same item elsewhere. */
const shown = (text: string) => Array.from(document.querySelectorAll<HTMLElement>('[class*="cursor-pointer"]'))
  .some((row) => row.textContent?.includes(text));

beforeEach(() => { localStorage.clear(); });

describe('Collapse All on the other tree tabs', () => {
  describe.each(TABS)('$noun', ({ tab, noun, child }) => {
    it('hides the child rows, then shows them, with the tab noun in the tooltip', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(tab);
      expect(shown(child)).toBe(true);

      fireEvent.click(collapseAll(noun));
      expect(shown(child)).toBe(false);

      fireEvent.click(expandAll(noun));
      expect(shown(child)).toBe(true);
      expect(collapseAll(noun)).toBeEnabled();
    });

    it('keeps its rows closed across a visit to another tab', () => {
      renderWorldEditorBench(WORLD, 'advanced');
      openEditorTab(tab);
      fireEvent.click(collapseAll(noun));

      openEditorTab(/Overview/);
      openEditorTab(tab);
      expect(shown(child)).toBe(false);
      expect(expandAll(noun)).toBeInTheDocument();
    });

    it('is disabled on a world with no parent rows', () => {
      renderWorldEditorBench(FLAT, 'advanced');
      openEditorTab(tab);
      expect(anyFace(noun)).toBeDisabled();
    });
  });

  it('leaves the Locations tree open when Entities collapses, and the reverse', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(collapseAll('entities'));

    openEditorTab(/Locations/);
    expect(shown('Hollow')).toBe(true);
    fireEvent.click(collapseAll('locations'));
    expect(shown('Hollow')).toBe(false);

    openEditorTab(/Entities/);
    expect(shown('Mira')).toBe(false);
    fireEvent.click(expandAll('entities'));
    expect(shown('Mira')).toBe(true);

    openEditorTab(/Locations/);
    expect(shown('Hollow')).toBe(false);
  });

  it('leaves another tab open when one tab collapses', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Traits/);
    fireEvent.click(collapseAll('traits'));

    openEditorTab(/Stats/);
    expect(shown('Grit')).toBe(true);
    expect(collapseAll('stats')).toBeEnabled();
  });

  it('closes a Dictionary book and its zones, and opens both again', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);
    fireEvent.click(collapseAll('entries'));
    // The book row stays; its entry is gone.
    expect(shown('Fen Lore')).toBe(true);
    expect(shown('Lamp Oil')).toBe(false);

    // Opening the book by hand leaves the zone closed, so the entry stays hidden.
    fireEvent.click(screen.getByRole('button', { name: 'Expand dictionary' }));
    expect(shown('Lamp Oil')).toBe(false);

    fireEvent.click(collapseAll('entries'));
    fireEvent.click(expandAll('entries'));
    expect(shown('Lamp Oil')).toBe(true);
  });

  it('is disabled while a search is typed, and clearing it brings back the closed groups', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Entities/);
    fireEvent.click(collapseAll('entities'));

    fireEvent.change(screen.getByPlaceholderText('Filter Entities'), { target: { value: 'i' } });
    expect(expandAll('entities')).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Filter Entities'), { target: { value: '' } });
    expect(expandAll('entities')).toBeEnabled();
    expect(shown('Mira')).toBe(false);
  });

  it('opens the closed Dictionary book and zone for an entry selected from outside', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Dictionary/);
    fireEvent.click(collapseAll('entries'));
    expect(shown('Lamp Oil')).toBe(false);

    openEditorTab(/Stats/);
    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });
    await waitFor(() => expect(document.activeElement).toBe(searchWorldField()));
    fireEvent.change(searchWorldField(), { target: { value: 'marsh' } });

    await waitFor(() => expect(shown('Lamp Oil')).toBe(true));
  });
});
