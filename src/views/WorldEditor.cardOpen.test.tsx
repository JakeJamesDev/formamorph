import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, entityFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { CodeCardItem } from '@/lib/codeCards';
import type { CodeCardNavigation } from '@/lib/codeCardNavigation';
import type { World } from '@/types';

/** A code card's Open, from a stat's code box to the item in the World Editor. */

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

// CodeMirror arrives on its own chunk; a plain field stands in for it and hands over the box's navigation.
const navigations = vi.hoisted(() => new Map<string, CodeCardNavigation | undefined>());
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; ariaLabel: string; navigation?: CodeCardNavigation }) => {
    navigations.set(props.ariaLabel, props.navigation);
    return <textarea aria-label={props.ariaLabel} value={props.value} readOnly />;
  },
}));

const values = (texts: string[]) => texts.map((text, index) => ({ id: `v${index}`, text }));
const stat = (id: string, name: string) => ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] });

const WORLD: World = benchEditorWorld({
  stats: [{ ...stat('s1', 'Warmth'), scripts: [{ id: 'after', timing: 'after', code: '' }] }, stat('s2', 'Chill')],
  traits: [{ id: 't1', name: 'Brave', statChanges: [] }],
  placeholders: [{ id: 'p1', name: 'Capital', values: values(['Sedge']) }],
  dictionaries: [{ id: 'b1', name: 'Fen Lore', enabled: true, entries: [] }],
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    {
      id: 'mara', name: 'Mara', playerDescription: 'A ferrier.', aiDescription: 'Runs the ferry.', locations: ['harbor'],
      stats: [stat('m-grit', 'Grit'), stat('m-nerve', 'Nerve')],
      traits: [{ id: 'm-calm', name: 'Calm', statChanges: [], order: 0 }, { id: 'm-wary', name: 'Wary', statChanges: [], order: 1 }],
    },
  ],
} as Partial<World>);

let scrolled: Element[];
const realScroll = Element.prototype.scrollIntoView;
beforeEach(() => {
  localStorage.clear();
  navigations.clear();
  scrolled = [];
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
});
afterEach(() => {
  Element.prototype.scrollIntoView = realScroll;
});

/** Opens Warmth's code and calls the Open its After box was handed. */
function openFromWarmth(item: CodeCardItem) {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Stats/ }));
  fireEvent.click(screen.getByText('Warmth'));
  fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name: 'Scripts' }));
  const open = navigations.get('Code Warmth · After the AI')?.open;
  expect(open, 'the box has an Open').toBeTypeOf('function');
  act(() => open!(item));
}

const selectedRows = () => [...document.querySelectorAll<HTMLElement>('[data-editor-row-selected]')];
const sectionTab = (name: RegExp) => within(screen.getByRole('tablist', { name: 'Editor Sections' })).getByRole('tab', { name });

describe('Open from a code card', () => {
  it.each<[string, CodeCardItem, RegExp, string]>([
    ['a world stat', { kind: 'stat', statId: 's2' }, /Stats/, 'Chill'],
    ['a trait', { kind: 'trait', traitId: 't1' }, /Traits/, 'Brave'],
    ['a placeholder', { kind: 'placeholder', placeholderId: 'p1' }, /Placeholders/, 'Capital'],
    ['an entity', { kind: 'entity', entityId: 'mara' }, /Entities/, 'Mara'],
    ['a dictionary', { kind: 'dictionary', dictionaryId: 'b1' }, /Dictionar/, 'Fen Lore'],
  ])('selects and reveals %s', async (_, item, tab, name) => {
    renderWorldEditorBench(WORLD, 'advanced');
    openFromWarmth(item);

    expect(sectionTab(tab)).toHaveAttribute('aria-selected', 'true');
    const row = selectedRows().find((candidate) => candidate.textContent?.includes(name));
    expect(row, `${name}'s row is selected`).toBeTruthy();
    await waitFor(() => expect(scrolled).toContain(row));
  });

  it.each<[string, CodeCardItem, string, string]>([
    ['stat', { kind: 'stat', statId: 'm-nerve', entityId: 'mara' }, 'Stats', 'Nerve'],
    ['trait', { kind: 'trait', traitId: 'm-wary', entityId: 'mara' }, 'Traits', 'Wary'],
  ])('navigations an entity’s own %s on its tab and reveals the row', async (_, item, tab, name) => {
    renderWorldEditorBench(WORLD, 'advanced');
    openFromWarmth(item);

    expect(sectionTab(/Entities/)).toHaveAttribute('aria-selected', 'true');
    expect(entityFieldsTab(tab)).toHaveAttribute('aria-selected', 'true');
    const entityRow = selectedRows().find((row) => row.textContent?.includes('Mara'));
    const ownRow = selectedRows().find((row) => row.textContent?.includes(name));
    expect(entityRow, 'Mara is selected').toBeTruthy();
    expect(ownRow, `${name} is selected in Mara's tab`).toBeTruthy();
    await waitFor(() => expect(scrolled).toEqual(expect.arrayContaining([entityRow, ownRow])));
  });
});
