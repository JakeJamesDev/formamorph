import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool } from '@/types';
import { sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { ToolEditor } from './ToolEditor';

const lookup: Tool = {
  id: 'u-find', name: 'find', description: '', emptyResult: '', offeredTo: ['narration'],
  params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
  handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' },
};

describe('the Script reference', () => {
  it('states each global’s access as text, since the list has no badge', async () => {
    const user = userEvent.setup();
    render(
      <ToolEditor
        draft={{ ...lookup, handler: { kind: 'script', code: 'return 1;' } }} onDraftChange={vi.fn()} keptHandlers={{}}
        editTab="handler" onEditTabChange={vi.fn()} userTools={[]}
        editing world={{ snapshot: sampleToolSnapshot, open: false }}
        fullscreen={false} fullscreenButton={null} onCancel={vi.fn()} onSave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'What a Script Can Read' }));
    const list = within(await screen.findByLabelText('What the script can read'));
    const rowOf = (name: string) => list.getByText(name).nextElementSibling?.textContent;
    expect(rowOf('args')).toMatch(/^\{.*\} The arguments the AI sent, checked against the parameters\. Read-only\.$/);
    expect(rowOf('scene')).toMatch(/The current scene\. Read-only\.$/);
    // `console` is no field a write could reach, so it names no access.
    expect(rowOf('console')).toMatch(/Output shows in the browser console\.$/);
    expect(rowOf('console')).not.toMatch(/Read-only|Writable/);
  });
});

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
