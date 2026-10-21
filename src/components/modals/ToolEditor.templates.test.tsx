import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool, ToolScriptTiming } from '@/types';
import { sampleToolSnapshot } from '@/lib/tools/sampleToolSnapshot';
import { statCodeNames } from '@/lib/statCodeTestRun';
import { ToolEditor } from './ToolEditor';

const tool = (timing: ToolScriptTiming, code = ''): Tool => ({
  id: 'w-mark', name: 'mark', description: '', emptyResult: '{}', offeredTo: ['narration'],
  params: [{ name: 'who', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'script', code, timing },
});

const names = statCodeNames({
  stats: [], statGroups: [], traits: [], traitGroups: [], entities: [], entityGroups: [],
  placeholders: [], placeholderGroups: [], dictionaries: [],
});

const editor = (draft: Tool, onDraftChange = vi.fn(), home: 'user' | 'world' = 'world') => (
  <ToolEditor
    draft={draft} onDraftChange={onDraftChange} keptHandlers={{}} editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
    home={home} worldCode={home === 'world' ? { names } : undefined}
    editing world={{ snapshot: sampleToolSnapshot, open: false }}
    fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
  />
);

describe('a World Tool’s Templates menu', () => {
  it('lists the templates for the Tool’s timing and follows a timing change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(editor(tool('output')));
    await user.click(screen.getByRole('button', { name: 'Templates' }));
    expect(await screen.findByRole('button', { name: 'Highlight a Name' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll Dice' })).toBeNull();

    rerender(editor(tool('call')));
    expect(await screen.findByRole('button', { name: 'Roll Dice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Highlight a Name' })).toBeNull();
  });

  it('inserts the filled code into the Tool’s script, reading the picked Parameter', async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(editor(tool('output'), onDraftChange));
    await user.click(screen.getByRole('button', { name: 'Templates' }));
    await user.click(await screen.findByRole('button', { name: 'Highlight a Name' }));
    await user.click(screen.getByRole('combobox', { name: 'Name' }));
    await user.click(await screen.findByRole('option', { name: 'who' }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalled());
    const [next] = onDraftChange.mock.lastCall as [Tool];
    expect(next.handler.kind === 'script' && next.handler.code).toContain('String(args["who"] ?? "")');
    expect(next.handler).toMatchObject({ kind: 'script', timing: 'output' });
  });

  it('adds the Parameter a template names to the Tool in the same change as the code', async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    render(editor({ ...tool('call'), params: [] }, onDraftChange));
    await user.click(screen.getByRole('button', { name: 'Templates' }));
    await user.click(await screen.findByRole('button', { name: 'Roll Dice' }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalledTimes(1));
    const [next] = onDraftChange.mock.lastCall as [Tool];
    expect(next.params).toEqual([{ name: 'sides', type: 'number', description: '', required: true, options: [] }]);
    expect(next.handler.kind === 'script' && next.handler.code).toContain('args["sides"]');
  });

  it('replaces a blank Parameter row with the Parameter a template adds', async () => {
    const user = userEvent.setup();
    const onDraftChange = vi.fn();
    const blank = { name: '', type: 'string' as const, description: '', required: true, options: [] };
    render(editor({ ...tool('call'), params: [blank] }, onDraftChange));
    await user.click(screen.getByRole('button', { name: 'Templates' }));
    await user.click(await screen.findByRole('button', { name: 'Roll Dice' }));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));

    await waitFor(() => expect(onDraftChange).toHaveBeenCalled());
    const [next] = onDraftChange.mock.lastCall as [Tool];
    expect(next.params.map((p) => p.name)).toEqual(['sides']);
  });

  it('gives a Settings Tool’s script no Templates button', () => {
    render(editor({ ...tool('call', 'return 1;'), handler: { kind: 'script', code: 'return 1;' } }, vi.fn(), 'user'));
    expect(screen.queryByRole('button', { name: 'Templates' })).toBeNull();
  });
});
