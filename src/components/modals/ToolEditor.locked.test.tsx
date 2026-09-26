import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Tool } from '@/types';
import { sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { ToolEditor } from './ToolEditor';

/** A built-in Tool's Handler tab for the handler kinds the catalog doesn't ship yet. */

const tool = (handler: Tool['handler']): Tool => ({
  id: 'get_entity', name: 'get_entity', description: '', params: [], handler, emptyResult: '', offeredTo: ['narration'],
});

const renderHandler = (handler: Tool['handler'], builtIn: boolean) => render(
  <ToolEditor
    draft={tool(handler)} onDraftChange={vi.fn()} editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
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
