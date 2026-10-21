import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { CodeSurface } from '@/lib/codeSurface';
import type { VariableNode } from '@/lib/statCodeVariableTree';
import type { Tool, ToolScriptHandler, World } from '@/types';

/** A Script World Tool in the editor: Try It runs it on the open world without applying a write, and its code box
 *  reads the script surface with `args`. */

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
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() },
  ToastContainer: () => null,
}));

interface BoxProps {
  value: string; ariaLabel: string; surface: CodeSurface; statNames?: readonly string[]; variables?: () => readonly VariableNode[];
}

// CodeMirror arrives on its own chunk; a plain field stands in for it and records what the box was handed.
const boxes = vi.hoisted(() => new Map<string, BoxProps>());
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: BoxProps) => {
    boxes.set(props.ariaLabel, props);
    return <textarea aria-label={props.ariaLabel} value={props.value} readOnly />;
  },
}));

const tool = (id: string, name: string, handler: Partial<ToolScriptHandler>, params: Tool['params'] = []): Tool => ({
  id, name, description: `Purpose: ${name}.`, params, emptyResult: '{}', offeredTo: ['narration'],
  handler: { kind: 'script', code: '', ...handler },
});
const place: Tool['params'] = [{ name: 'place', type: 'string', description: 'Where to go.', required: true, options: [] }];

const travel = tool('t-travel', 'travel', {
  timing: 'after', reply: 'Off you go.', code: 'location.move(args.place);\nclock.advance(30);\nstats.Luck.value = 9;',
}, place);
const roll = tool('t-roll', 'roll_luck', { code: 'return "Luck is " + stats.Luck.value;' });
const tell = tool('t-tell', 'tell_tale', { timing: 'after', code: 'entities.Stranger.diary("Hello.");' });
const filter = tool('t-filter', 'shout', { timing: 'output', code: 'narration.sentence = narration.sentence.toUpperCase();' });

const WORLD: World = benchEditorWorld({
  stats: [{ id: 'luck', name: 'Luck', type: 'number', description: '', min: 0, max: 10, value: 4, regen: 0, descriptors: [] }],
  locations: [{ id: 'harbor', name: 'Harbor Steps', isStarting: true }, { id: 'gate', name: 'North Gate' }],
  tools: [travel, roll, tell, filter],
} as Partial<World>);

const openTool = (name: string) => {
  openEditorTab(/Tools/);
  fireEvent.click(screen.getByText(name));
};
const run = () => fireEvent.click(screen.getByRole('button', { name: 'Run' }));
const result = () => screen.findByTestId('try-it-result');

beforeEach(() => {
  localStorage.clear();
  boxes.clear();
});

describe('Try It on a Script World Tool', () => {
  it('shows an After the AI Tool’s Reply and each staged write, and leaves the world unchanged', async () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTool('travel');
    const before = { stats: structuredClone(ctx().stats), tools: structuredClone(ctx().worldTools), where: ctx().locations };
    fireEvent.change(screen.getByRole('textbox', { name: 'place' }), { target: { value: 'North Gate' } });
    run();

    const shown = await result();
    expect(shown).toHaveTextContent('Off you go.');
    expect(shown).toHaveTextContent('stats.Luck.value = 9');
    expect(shown).toHaveTextContent('location.move: North Gate');
    expect(shown).toHaveTextContent('clock.advance: 30 minutes');
    expect(ctx().stats).toEqual(before.stats);
    expect(ctx().worldTools).toEqual(before.tools);
    expect(ctx().locations).toEqual(before.where);
  });

  it('shows an On Call Tool’s value as the reply, read from the open world', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('roll_luck');
    run();
    expect(await result()).toHaveTextContent('Luck is 4');
  });

  it('tells the AI’s error when a required argument is missing, and lists no write', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('travel');
    run();
    const shown = await result();
    expect(shown).toHaveTextContent('The AI reads this error');
    expect(shown).toHaveTextContent(/place/);
    expect(shown).not.toHaveTextContent('location.move');
  });

  it('warns on a diary target the authored world lacks, and does not fail the run', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('tell_tale');
    run();
    const shown = await result();
    expect(shown).toHaveTextContent('Done.');
    expect(shown).toHaveTextContent('Diary target “Stranger” may be discovered in play.');
    expect(shown).not.toHaveTextContent('The AI reads this error');
  });

  it('rewrites a sample sentence for a During AI Output Tool', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('shout');
    fireEvent.change(screen.getByRole('textbox', { name: 'Sample Sentence' }), { target: { value: 'The gate creaks.' } });
    run();
    expect(await result()).toHaveTextContent('THE GATE CREAKS.');
  });

  it('asks for no sample sentence on the other timings', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('travel');
    expect(screen.queryByRole('textbox', { name: 'Sample Sentence' })).toBeNull();
  });
});

describe('a Script World Tool’s code box', () => {
  it('reads the script surface with args typed from the parameters, and lists the world’s stats', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('travel');
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Handler' }));

    await waitFor(() => expect(boxes.get('Script')).toBeDefined());
    const box = boxes.get('Script')!;
    const globals = box.surface.globals.map((entry) => entry.name);
    expect(globals).toEqual(expect.arrayContaining(['args', 'location', 'clock', 'discover', 'memories', 'entities', 'stats']));
    expect(box.surface.members.get('args')?.map((entry) => entry.name)).toEqual(['place']);
    expect(box.statNames).toEqual(['Luck']);
  });

  // The box lists these before the stat tree, which has Stats, Clock, Location, Discover, Memory and Diary.
  it('hands the Variable menu the Tool’s arguments, beside a surface whose tree has the write surface', async () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('travel');
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Handler' }));

    await waitFor(() => expect(boxes.get('Script')).toBeDefined());
    const box = boxes.get('Script')!;
    expect(box.surface.statMaps).toBe(true);
    expect(box.variables!().map((node) => ('label' in node ? node.label : ''))).toEqual(['Arguments']);
  });
});
