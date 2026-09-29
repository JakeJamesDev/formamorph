import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool } from '@/types';
import { sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { ToolEditor } from './ToolEditor';

const lookup: Tool = {
  id: 'u-find', name: 'find', description: '', emptyResult: '', offeredTo: ['narration'],
  params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' },
};

describe('the Handler tab', () => {
  it('never offers Memories to a user Tool', async () => {
    const user = userEvent.setup();
    render(
      <ToolEditor
        draft={lookup} onDraftChange={vi.fn()} keptHandlers={{}} editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
        editing world={{ snapshot: sampleToolSnapshot, open: false }}
        fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: 'Search' }));
    expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['Entities', 'Locations', 'Dictionary Entries']);
  });
});
