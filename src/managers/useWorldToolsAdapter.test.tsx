import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { benchEditorWorld } from '@/test/worldEditorBench';
import { renderToolsListTab } from '@/test/toolsListBench';
import type { Tool, World } from '@/types';

/** The Tools tab's list: the read view, the draft editor's name rules, and the writes. */

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

const tool = (id: string, name: string): Tool => ({
  id, name, description: `Purpose: ${name}.`, params: [], handler: { kind: 'template', body: 'Yes.' }, emptyResult: '', offeredTo: ['narration'],
});

const WORLD: World = benchEditorWorld({ tools: [tool('t-roll', 'roll_fate'), tool('t-entity', 'get_entity')] } as Partial<World>);

const openTool = (name: string) => {
  fireEvent.click(screen.getByText(name));
};
const nextTask = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0); }));
const nameField = () => screen.getByRole('textbox', { name: 'Name' });

beforeEach(() => localStorage.clear());

describe('the Tools tab list', () => {
  it('shows no warning for a fresh name', () => {
    renderToolsListTab(WORLD, 'advanced');
    openTool('roll_fate');
    expect(screen.queryByText(/^Replaces /)).toBeNull();
  });

  it('refuses a name another Tool in the world uses, and saves a built-in name', () => {
    const { ctx } = renderToolsListTab(WORLD, 'advanced');
    openTool('roll_fate');
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(nameField(), { target: { value: 'GET_ENTITY' } });
    expect(screen.getByText('Another Tool in this world uses this name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Tool' })).toBeDisabled();

    fireEvent.change(nameField(), { target: { value: 'recall' } });
    expect(screen.getByRole('note')).toHaveTextContent('Replaces the built-in recall Tool in this world');
    fireEvent.click(screen.getByRole('button', { name: 'Save Tool' }));
    expect(ctx().worldTools.map((t) => t.name)).toEqual(['recall', 'get_entity']);
  });

  it('undoes a saved edit and a delete, one Step each', async () => {
    const { ctx, history } = renderToolsListTab(WORLD, 'advanced');
    openTool('roll_fate');
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(nameField(), { target: { value: 'roll_dice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Tool' }));
    // Two clicks are two event-loop tasks; writes that share one task fold into one Step.
    await nextTask();
    // The first row's Delete is the edited Tool's.
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(ctx().worldTools.map((t) => t.name)).toEqual(['get_entity']);

    await act(async () => { history().undo(); });
    expect(ctx().worldTools.map((t) => t.name)).toEqual(['roll_dice', 'get_entity']);
    await act(async () => { history().undo(); });
    await waitFor(() => expect(ctx().worldTools.map((t) => t.name)).toEqual(['roll_fate', 'get_entity']));
  });
});
