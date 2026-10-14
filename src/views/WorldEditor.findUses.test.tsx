import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, entityFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { CodeCardNavigation } from '@/lib/codeCardNavigation';
import type { CodeUse } from '@/lib/codeUses';
import type { World } from '@/types';

/** A Find All Uses row, from a stat's code box to another box at the line. */

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

interface BoxProps { value: string; ariaLabel: string; navigation?: CodeCardNavigation; revealLine?: number; onLineRevealed?: () => void }

// CodeMirror arrives on its own chunk; a plain field stands in for it and records what each box was handed.
const boxes = vi.hoisted(() => new Map<string, BoxProps>());
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: BoxProps) => {
    boxes.set(props.ariaLabel, props);
    return <textarea aria-label={props.ariaLabel} value={props.value} readOnly />;
  },
}));

const stat = (id: string, name: string, code = '') => ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], code });

// Howl is a Blueprint Mara links; her Link overrides its After box.
const howl = { ...stat('howl', 'Howl', 'return owner.stats.Howl.value;'), groupId: 'bp' };
const howlLink = {
  id: 'l-howl', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null, order: 2,
  overrides: { howl: { code: { value: 'return self.max;', blueprint: howl.code } } },
};

const WORLD: World = benchEditorWorld({
  stats: [stat('s1', 'Warmth', 'return stats.Chill.value;'), stat('s2', 'Chill'), howl],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    {
      id: 'mara', name: 'Mara', playerDescription: 'A ferrier.', aiDescription: 'Runs the ferry.', locations: ['harbor'],
      stats: [stat('m-grit', 'Grit'), stat('m-nerve', 'Nerve', 'self.value = 1;\nreturn stats.Chill.value;')],
      statLinks: [howlLink],
    },
  ],
} as Partial<World>);

const AFTER = 'Stat Code After the AI';
const BEFORE = 'Stat Code Before the AI';

const realScroll = Element.prototype.scrollIntoView;
beforeEach(() => {
  localStorage.clear();
  boxes.clear();
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  Element.prototype.scrollIntoView = realScroll;
});

/** Takes Find All Uses from Warmth's After box, returns Warmth to Details, then follows `use`. */
function goFromWarmth(use: CodeUse) {
  fireEvent.mouseDown(screen.getByRole('tab', { name: /Stats/ }));
  fireEvent.click(screen.getByText('Warmth'));
  const fields = () => within(screen.getByRole('tablist', { name: 'Stat Fields' }));
  fireEvent.mouseDown(fields().getByRole('tab', { name: 'Code' }));
  const goToUse = boxes.get(AFTER)?.navigation?.goToUse;
  expect(goToUse, 'the box has Find All Uses').toBeTypeOf('function');
  // So the Code tab the row lands on is its own doing.
  fireEvent.mouseDown(fields().getByRole('tab', { name: 'Details' }));
  boxes.clear();
  act(() => goToUse!(use));
}

const sectionTab = (name: RegExp) => within(screen.getByRole('tablist', { name: 'Editor Sections' })).getByRole('tab', { name });
const statFieldsTab = (name: string) => within(screen.getAllByRole('tablist', { name: 'Stat Fields' }).at(-1)!).getByRole('tab', { name });

describe('a Find All Uses row', () => {
  it('opens a world stat’s Code tab and hands its box the line, once', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 's2', timing: 'before', stat: 'Chill', line: 3, noOwners: false });

    expect(sectionTab(/Stats/)).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(statFieldsTab('Code')).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(boxes.get(BEFORE)?.revealLine).toBe(3));
    expect(boxes.get(AFTER)?.revealLine, 'the other box keeps its caret').toBeUndefined();

    act(() => boxes.get(BEFORE)!.onLineRevealed!());
    await waitFor(() => expect(boxes.get(BEFORE)?.revealLine).toBeUndefined());
  });

  it('opens an entity’s own stat on its Stats tab at the box', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: 'mara', rowId: 'm-nerve', timing: 'after', stat: 'Nerve', entity: 'Mara', line: 2, noOwners: false });

    expect(sectionTab(/Entities/)).toHaveAttribute('aria-selected', 'true');
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(statFieldsTab('Code')).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(boxes.get(AFTER)?.revealLine).toBe(2));
    expect(boxes.get(AFTER)?.value).toBe('self.value = 1;\nreturn stats.Chill.value;');
  });

  it('opens a Blueprint stat’s own box', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 'howl', timing: 'after', stat: 'Howl', line: 1, noOwners: false });

    await waitFor(() => expect(boxes.get(AFTER)?.revealLine).toBe(1));
    expect(boxes.get(AFTER)?.value).toBe('return owner.stats.Howl.value;');
  });

  it('opens a Link’s override box on the Link’s row', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: 'mara', rowId: 'l-howl', timing: 'after', stat: 'Howl', entity: 'Mara', line: 1, noOwners: false });

    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(boxes.get(AFTER)?.revealLine).toBe(1));
    expect(boxes.get(AFTER)?.value).toBe('return self.max;');
  });
});
