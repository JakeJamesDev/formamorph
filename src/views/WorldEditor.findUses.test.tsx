import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { benchEditorWorld, entityFieldsTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { CodeCardNavigation } from '@/lib/codeCardNavigation';
import type { CodeUse } from '@/lib/codeUses';
import type { CodeWorldLookup } from '@/lib/codeWorldLookup';
import type { World } from '@/types';
import { boxScripts } from '@/test/scriptFixtures';

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

interface BoxProps {
  value: string; ariaLabel: string; navigation?: CodeCardNavigation; revealLine?: number; onLineRevealed?: () => void; lookup?: CodeWorldLookup;
}

// CodeMirror arrives on its own chunk; a plain field stands in for it and records what each box was handed.
const boxes = vi.hoisted(() => new Map<string, BoxProps>());
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: BoxProps) => {
    boxes.set(props.ariaLabel, props);
    return <textarea aria-label={props.ariaLabel} value={props.value} readOnly />;
  },
}));

const stat = (id: string, name: string, code = '') => ({ id, name, type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [], scripts: boxScripts({ after: code }) });

// Howl is a Blueprint Mara links; her Link overrides its scripts.
const howl = { ...stat('howl', 'Howl', 'return owner.stats.Howl.value;'), groupId: 'bp' };
const howlLink = {
  id: 'l-howl', originalId: 'howl', kind: 'stat', originalName: 'Howl', groupId: null, order: 2,
  overrides: { howl: { scripts: { value: boxScripts({ after: 'return self.max;' }), blueprint: howl.scripts } } },
};

const WORLD: World = benchEditorWorld({
  // Gale is used by this world script alone.
  scripts: [{ id: 'weather', timing: 'after', code: '// gusts\nstats.Gale.value = 3;' }],
  // Tide is used by this World Tool alone.
  tools: [{
    id: 't-surf', name: 'surf', description: 'Rides the tide.', params: [], emptyResult: '{}', offeredTo: ['narration'],
    handler: { kind: 'script', timing: 'after', code: '// ride\nstats.Tide.value = 2;' },
  }],
  stats: [
    stat('s3', 'Gale'),
    stat('s4', 'Tide'),
    stat('s1', 'Warmth', 'return stats.Chill.value;'),
    { ...stat('s2', 'Chill'), scripts: [...boxScripts({ before: '', after: '' }), { id: 'chill-2', name: 'Second', timing: 'after', code: 'return 2;' }] },
    howl,
  ],
  statGroups: [{ id: 'bp', name: 'Blueprints', parentId: null, system: 'blueprints' }],
  traits: [{ id: 't-bold', name: 'Bold', statChanges: [], scripts: [{ id: 'bold-1', timing: 'after', code: 'stats.Chill.value = 1;' }] }],
  entities: [
    { id: 'resident', name: 'Odd Wick', playerDescription: 'The lamp-keeper.', aiDescription: 'Keeps the lamps.', locations: ['harbor'] },
    {
      id: 'mara', name: 'Mara', playerDescription: 'A ferrier.', aiDescription: 'Runs the ferry.', locations: ['harbor'],
      stats: [stat('m-grit', 'Grit'), stat('m-nerve', 'Nerve', 'self.value = 1;\nreturn stats.Chill.value;')],
      statLinks: [howlLink],
    },
  ],
} as Partial<World>);

const AFTER = 'After the AI';
const BEFORE = 'Before the AI';
/** The open panel's unnamed box of `timing`. Only one panel's boxes are recorded at a time. */
const boxAt = (timing: string) => [...boxes].find(([label]) => label.startsWith('Code ') && label.endsWith(` · ${timing}`))?.[1];

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
  fireEvent.mouseDown(fields().getByRole('tab', { name: 'Scripts' }));
  const goToUse = boxAt(AFTER)?.navigation?.goToUse;
  expect(goToUse, 'the box has Find All Uses').toBeTypeOf('function');
  // So the Scripts tab the row lands on is its own doing.
  fireEvent.mouseDown(fields().getByRole('tab', { name: 'Details' }));
  boxes.clear();
  act(() => goToUse!(use));
}

const sectionTab = (name: RegExp) => within(screen.getByRole('tablist', { name: 'Editor Sections' })).getByRole('tab', { name });
const statFieldsTab = (name: string) => within(screen.getAllByRole('tablist', { name: 'Stat Fields' }).at(-1)!).getByRole('tab', { name });

describe('a Find All Uses row', () => {
  it('opens a world stat’s Code tab and hands its box the line, once', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 's2', timing: 'before', scriptId: 'before', name: 'Chill', line: 3, noOwners: false });

    expect(sectionTab(/Stats/)).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(statFieldsTab('Scripts')).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(boxAt(BEFORE)?.revealLine).toBe(3));
    expect(boxAt(AFTER)?.revealLine, 'the other box keeps its caret').toBeUndefined();

    act(() => boxAt(BEFORE)!.onLineRevealed!());
    await waitFor(() => expect(boxAt(BEFORE)?.revealLine).toBeUndefined());
  });

  it('hands the line to the script the row names, not the first of its timing', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 's2', timing: 'after', scriptId: 'chill-2', name: 'Chill', line: 1, noOwners: false });

    await waitFor(() => expect(boxes.get('Code Second')?.revealLine).toBe(1));
    expect(boxAt(AFTER)?.revealLine, 'the first After script keeps its caret').toBeUndefined();
  });

  it('opens a world trait’s Scripts tab and hands its box the line', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 't-bold', trait: true, timing: 'after', scriptId: 'bold-1', name: 'Bold', line: 1, noOwners: false });

    expect(sectionTab(/Traits/)).toHaveAttribute('aria-selected', 'true');
    const traitTab = () => within(screen.getByRole('tablist', { name: 'Trait Fields' })).getByRole('tab', { name: 'Scripts' });
    await waitFor(() => expect(traitTab()).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(boxes.get('Code Bold · After the AI')?.revealLine).toBe(1));
  });

  it('opens an entity’s own stat on its Stats tab at the box', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: 'mara', rowId: 'm-nerve', timing: 'after', scriptId: 'after', name: 'Nerve', entity: 'Mara', line: 2, noOwners: false });

    expect(sectionTab(/Entities/)).toHaveAttribute('aria-selected', 'true');
    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(statFieldsTab('Scripts')).toHaveAttribute('aria-selected', 'true'));
    await waitFor(() => expect(boxAt(AFTER)?.revealLine).toBe(2));
    expect(boxAt(AFTER)?.value).toBe('self.value = 1;\nreturn stats.Chill.value;');
  });

  it('opens a Blueprint stat’s own box', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 'howl', timing: 'after', scriptId: 'after', name: 'Howl', line: 1, noOwners: false });

    await waitFor(() => expect(boxAt(AFTER)?.revealLine).toBe(1));
    expect(boxAt(AFTER)?.value).toBe('return owner.stats.Howl.value;');
  });

  it('opens a Link’s override box on the Link’s row', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: 'mara', rowId: 'l-howl', timing: 'after', scriptId: 'after', name: 'Howl', entity: 'Mara', line: 1, noOwners: false });

    expect(entityFieldsTab('Stats')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(boxAt(AFTER)?.revealLine).toBe(1));
    expect(boxAt(AFTER)?.value).toBe('return self.max;');
  });

  it('lists a stat a world script alone uses', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Stats/ }));
    fireEvent.click(screen.getByText('Warmth'));
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name: 'Scripts' }));
    expect(boxAt(AFTER)?.lookup?.uses({ kind: 'stat', statId: 's3' })).toEqual([
      { entityId: null, rowId: 'weather', world: true, timing: 'after', scriptId: 'weather', name: 'World', line: 2, noOwners: false },
    ]);
  });

  it('lists a stat a World Tool alone uses, as the Tool’s row', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Stats/ }));
    fireEvent.click(screen.getByText('Warmth'));
    fireEvent.mouseDown(within(screen.getByRole('tablist', { name: 'Stat Fields' })).getByRole('tab', { name: 'Scripts' }));
    expect(boxAt(AFTER)?.lookup?.uses({ kind: 'stat', statId: 's4' })).toEqual([
      { entityId: null, rowId: 't-surf', tool: true, timing: 'after', scriptId: 't-surf', name: 'surf', line: 2, noOwners: false },
    ]);
  });

  it('opens a World Tool on the Tools tab, in its script, and hands the box the line', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 't-surf', tool: true, timing: 'after', scriptId: 't-surf', name: 'surf', line: 2, noOwners: false });

    expect(sectionTab(/^Tools/)).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(boxes.get('Script')?.revealLine).toBe(2));
    expect(boxes.get('Script')?.value).toBe('// ride\nstats.Tide.value = 2;');
    expect(screen.getByText('Edit surf')).toBeInTheDocument();
    act(() => boxes.get('Script')!.onLineRevealed!());
    await waitFor(() => expect(boxes.get('Script')?.revealLine).toBeUndefined());
  });

  it('opens a world script on the Scripts tab and hands its box the line', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    goFromWarmth({ entityId: null, rowId: 'weather', world: true, timing: 'after', scriptId: 'weather', name: 'World', line: 2, noOwners: false });

    expect(sectionTab(/^Scripts/)).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(boxes.get('Code World · After the AI')?.revealLine).toBe(2));
    act(() => boxes.get('Code World · After the AI')!.onLineRevealed!());
    await waitFor(() => expect(boxes.get('Code World · After the AI')?.revealLine).toBeUndefined());
  });
});
