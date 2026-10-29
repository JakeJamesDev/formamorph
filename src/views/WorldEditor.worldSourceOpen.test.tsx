import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, entityFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import type { WorldSource } from '@/lib/formaquestion/helpWorldSource';
import type { World } from '@/types';

/** A Formaquestion world source opens its item in the World Editor. */

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

const stat = (id: string, name: string) => ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] });

const WORLD: World = benchEditorWorld({
  stats: [stat('s1', 'Warmth')],
  traits: [{ id: 't1', name: 'Brave', statChanges: [] }],
  dictionaries: [{ id: 'b1', name: 'Fen Lore', enabled: true, entries: [{ id: 'e1', name: 'Ashen Pact', key: ['pact'], value: 'An oath.' }] }],
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    { id: 'mara', name: 'Mara', playerDescription: 'A ferrier.', aiDescription: 'Runs the ferry.', locations: ['harbor'], stats: [stat('m-grit', 'Grit')] },
  ],
} as Partial<World>);

const source = (worldKind: WorldSource['worldKind'], id: string, name: string): WorldSource => ({ kind: 'world', worldKind, id, name });
const selectedRows = () => [...document.querySelectorAll<HTMLElement>('[data-editor-row-selected]')];
const sectionTab = (name: RegExp) => within(screen.getByRole('tablist', { name: 'Editor Sections' })).getByRole('tab', { name });

let scrolled: Element[];
const realScroll = Element.prototype.scrollIntoView;
beforeEach(() => {
  localStorage.clear();
  scrolled = [];
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this); };
});
afterEach(() => {
  Element.prototype.scrollIntoView = realScroll;
});

describe('a world source opened from Formaquestion', () => {
  it('registers the editor lean with an opener and the live world', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    const open = helpWorld.get();
    expect(open?.lean).toBe('editor');
    expect(open?.open).toBeTypeOf('function');
    expect(open?.world?.().entities.map((entity) => entity.name)).toEqual(['Odd Wick', 'Mara']);
  });

  it.each<[string, WorldSource, RegExp, string]>([
    ['a stat', source('stat', 's1', 'Warmth'), /Stats/, 'Warmth'],
    ['a trait', source('trait', 't1', 'Brave'), /Traits/, 'Brave'],
    ['an entity', source('entity', 'mara', 'Mara'), /Entities/, 'Mara'],
    ['a dictionary entry', source('dictionary', 'e1', 'Ashen Pact'), /Dictionar/, 'Ashen Pact'],
  ])('selects and reveals %s', async (_, item, tab, name) => {
    renderWorldEditorBench(WORLD, 'advanced');
    act(() => helpWorld.get()!.open!(item));
    expect(sectionTab(tab)).toHaveAttribute('aria-selected', 'true');
    const row = selectedRows().find((candidate) => candidate.textContent?.includes(name));
    expect(row, `${name}'s row is selected`).toBeTruthy();
    await waitFor(() => expect(scrolled).toContain(row));
  });

  it('opens a world prompt on the overview', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    act(() => helpWorld.get()!.open!(source('stat', 's1', 'Warmth')));
    act(() => helpWorld.get()!.open!(source('prompt', 'systemPrompt', 'AI-Facing Description')));
    expect(sectionTab(/Overview/)).toHaveAttribute('aria-selected', 'true');
  });

  it('opens an entity’s own stat on the entity', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    act(() => helpWorld.get()!.open!(source('stat', 'm-grit', 'Grit')));
    expect(sectionTab(/Entities/)).toHaveAttribute('aria-selected', 'true');
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
    expect(selectedRows().some((row) => row.textContent?.includes('Grit'))).toBe(true);
  });
});
