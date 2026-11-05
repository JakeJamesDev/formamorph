import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { benchEditorWorld, openEditorTab, renderWorldEditorBench } from '@/test/worldEditorBench';
import type { Tool, World } from '@/types';

/** The World Editor's Tools tab: where the editor shows it. The list and its writes are in useWorldToolsAdapter.test.tsx. */

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
  openEditorTab(/Tools/);
  fireEvent.click(screen.getByText(name));
};
const nameField = () => screen.getByRole('textbox', { name: 'Name' });
const editorTabs = () => within(screen.getByRole('tablist', { name: 'Editor Sections' }));

beforeEach(() => localStorage.clear());

describe('the Tools tab', () => {
  it('shows in the Advanced editor, under Logic, and not in Simple', () => {
    const { unmount } = renderWorldEditorBench(WORLD, 'simple');
    expect(editorTabs().queryByRole('tab', { name: /Tools/ })).toBeNull();
    unmount();
    renderWorldEditorBench(WORLD, 'advanced');
    expect(editorTabs().getByRole('tab', { name: /Tools/ })).toBeInTheDocument();
  });

  it('warns that a Tool named like a built-in Tool replaces it in this world', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openTool('get_entity');
    expect(screen.getByRole('note')).toHaveTextContent('Replaces the built-in get_entity Tool in this world');
  });

  it('lists the world’s Tools in run order', () => {
    renderWorldEditorBench(WORLD, 'advanced');
    openEditorTab(/Tools/);
      const names = screen.getAllByText(/^(roll_fate|get_entity)$/).map((el) => el.textContent);
    expect(names).toEqual(['roll_fate', 'get_entity']);
    // Each row drags by its grip.
    expect(document.querySelectorAll('[aria-roledescription="sortable"]')).toHaveLength(2);
  });

  it('leaves the world unchanged until Save Tool, and Cancel drops the draft', () => {
    const { ctx } = renderWorldEditorBench(WORLD, 'advanced');
    openTool('roll_fate');
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    fireEvent.change(nameField(), { target: { value: 'roll_dice' } });
    expect(ctx().worldTools[0].name).toBe('roll_fate');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(ctx().worldTools[0].name).toBe('roll_fate');
    expect(screen.getByRole('heading', { level: 3, name: 'roll_fate' })).toBeInTheDocument();
  });
});
