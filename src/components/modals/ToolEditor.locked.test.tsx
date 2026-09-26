import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool } from '@/types';
import { sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { ToolEditor } from './ToolEditor';

/** A built-in Tool's Handler tab for the handler kinds the catalog doesn't ship yet. */

const tool = (handler: Tool['handler']): Tool => ({
  id: 'get_entity', name: 'get_entity', description: '', params: [], handler, emptyResult: '', offeredTo: ['narration'],
});

const renderHandler = (handler: Tool['handler'], builtIn: boolean, draft = tool(handler)) => render(
  <ToolEditor
    draft={draft} onDraftChange={vi.fn()} editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
    editing builtIn={builtIn} world={{ snapshot: sampleToolSnapshot, open: false }}
    fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
  />,
);

describe('a locked Handler tab', () => {
  it('shows a template read-only', () => {
    renderHandler({ kind: 'template', body: 'Sunny.' }, true);
    expect(screen.getByRole('textbox', { name: 'Template' })).toHaveAttribute('contenteditable', 'false');
  });

  it('shows a script as text, with no editor', () => {
    renderHandler({ kind: 'script', code: 'return 1;' }, true);
    expect(screen.queryByRole('textbox', { name: 'Script' })).toBeNull();
    expect(screen.getByText('return 1;', { exact: false })).toBeInTheDocument();
  });

  it('keeps the script editor for a user Tool', () => {
    renderHandler({ kind: 'script', code: 'return 1;' }, false);
    expect(screen.getByRole('textbox', { name: 'Script' })).toBeInTheDocument();
  });
});

describe('the recall Tool Handler tab', () => {
  const recall = TOOL_CATALOG.find((t) => t.id === 'recall')!;
  const hint = 'Matches words in past turns and diaries, in any case';

  it('reads Memories with its match hint, and no Returns choice', () => {
    renderHandler(recall.handler, true, recall);
    const search = screen.getByRole('combobox', { name: 'Search' });
    expect(search).toHaveTextContent('Memories');
    expect(search).toHaveAccessibleDescription(hint);
    expect(screen.queryByRole('combobox', { name: 'Returns' })).toBeNull();
  });

  it('never offers Memories to a user Tool', async () => {
    const user = userEvent.setup();
    const params: Tool['params'] = [{ name: 'name', type: 'string', description: '', required: true, options: [] }];
    renderHandler({ kind: 'lookup', source: 'entities', param: 'name', returns: 'full' }, false, { ...tool({ kind: 'lookup', source: 'entities', param: 'name', returns: 'full' }), params });
    await user.click(screen.getByRole('combobox', { name: 'Search' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Entities', 'Locations', 'Dictionary Entries']);
  });
});
