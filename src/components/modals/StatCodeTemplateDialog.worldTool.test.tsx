import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stat, ToolParam, ToolScriptTiming } from '@/types';
import type { CodeTemplate } from '@/lib/statCodeTemplates';
import { StatCodeTemplateDialog, type StatTemplateRepository } from './StatCodeTemplateDialog';

// A textarea over the same value is enough to type a slot into; the preview is the form under test.
vi.mock('@/components/prompt/CodeArea', () => ({
  CodeArea: (props: { value: string; onChange: (next: string) => void; ariaLabel: string; preview?: React.ReactNode }) => (
    <>
      <textarea aria-label={props.ariaLabel} value={props.value} onChange={(event) => props.onChange(event.target.value)} />
      {props.preview}
    </>
  ),
}));

const stats = [{ id: 's1', name: 'Warmth', type: 'number', value: 7, min: 0, max: 10 }] as unknown as Stat[];
const param = (name: string, type: ToolParam['type'] = 'number'): ToolParam => ({ name, type, description: '', required: true, options: [] });

/** A library held in memory, with the dialog's real pack parsing in front of it. */
const memoryRepository = (library: CodeTemplate[] = []): StatTemplateRepository & { library: CodeTemplate[] } => ({
  library,
  list: async () => [...library],
  save: async (template) => {
    const saved = { ...template, id: template.id || `saved-${library.length}` };
    library.push(saved);
    return saved;
  },
  remove: async (id) => { library.splice(library.findIndex((t) => t.id === id), 1); },
  import: async (templates) => { library.push(...templates); return templates.length; },
});

const openTool = (timing: ToolScriptTiming, params: readonly ToolParam[], extra: { onInsert?: (code: string) => void; repository?: StatTemplateRepository; fileTransfer?: { readImportPack: () => Promise<string | null>; writeExportPack: (contents: string, filename: string) => void } } = {}) => render(
  <StatCodeTemplateDialog
    open onOpenChange={vi.fn()} kind="worldTool" timing={timing} params={params} stats={stats}
    hasExistingCode={false} onInsert={extra.onInsert ?? vi.fn()} repository={extra.repository ?? memoryRepository()}
    fileTransfer={extra.fileTransfer}
  />,
);

const openStat = (repository: StatTemplateRepository = memoryRepository()) => render(
  <StatCodeTemplateDialog
    open onOpenChange={vi.fn()} timing="after" stats={stats} currentStatId="s1"
    hasExistingCode={false} onInsert={vi.fn()} repository={repository}
  />,
);

const generated = () => document.querySelector('pre')?.textContent ?? '';
const listed = () => screen.getAllByRole('button').map((button) => button.textContent);

describe('a World Tool box’s menu', () => {
  it('lists only the World Tool templates for the Tool’s timing', async () => {
    openTool('call', [param('amount')]);
    expect(await screen.findByRole('button', { name: 'Report a Stat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change a Stat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a Diary Line' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Highlight a Name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Weighted Blend' })).toBeNull();
  });

  it('follows a timing change', async () => {
    const { rerender } = openTool('call', [param('amount')]);
    expect(await screen.findByRole('button', { name: 'Roll Dice' })).toBeInTheDocument();
    rerender(
      <StatCodeTemplateDialog
        open onOpenChange={vi.fn()} kind="worldTool" timing="output" params={[param('amount')]} stats={stats}
        hasExistingCode={false} onInsert={vi.fn()} repository={memoryRepository()}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Highlight a Name' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Roll Dice' })).toBeNull();
  });

  it('never shows in a stat box', async () => {
    openStat();
    expect(await screen.findByRole('button', { name: 'Weighted Blend' })).toBeInTheDocument();
    for (const name of ['Report a Stat', 'Change a Stat', 'Pin a Memory', 'Add a Diary Line']) {
      expect(listed(), name).not.toContain(name);
    }
  });
});

describe('the Parameter slot', () => {
  it('lists the Tool’s Parameters of the slot’s type, then a row for a new one, and fills the picked name', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    openTool('call', [param('bonus'), param('note', 'string'), param('')], { onInsert });
    await user.click(await screen.findByRole('button', { name: 'Change a Stat' }));
    await user.click(screen.getByRole('combobox', { name: 'Amount' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['bonus', 'amountNew']);
    await user.click(screen.getByRole('option', { name: 'bonus' }));
    await user.click(screen.getByRole('combobox', { name: 'Stat' }));
    await user.click(await screen.findByRole('option', { name: 'Warmth' }));

    await waitFor(() => expect(generated()).toContain('args["bonus"]'));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));
    // An existing Parameter adds nothing to the Tool.
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('Number(args["bonus"])'), []);
  });

  it('leaves Insert open on a Tool with no Parameters and hands back the Parameter it names', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    openTool('call', [param('')], { onInsert });
    await user.click(await screen.findByRole('button', { name: 'Roll Dice' }));
    expect(screen.getByRole('button', { name: 'Insert Code' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));
    expect(onInsert).toHaveBeenCalledWith(
      expect.stringContaining('Number(args["sides"])'),
      [{ name: 'sides', type: 'number', description: '', required: true, options: [] }],
    );
  });

  it('flags a default name that a Parameter of another type holds, and blocks Insert', async () => {
    const user = userEvent.setup();
    openTool('call', [param('sides', 'string')]);
    await user.click(await screen.findByRole('button', { name: 'Roll Dice' }));
    expect(await screen.findByText('“sides” is a Text Parameter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert Code' })).toBeDisabled();
  });

  it('leaves Insert open on a Tool with no Parameters for a template with no Parameter slot', async () => {
    const user = userEvent.setup();
    openTool('call', []);
    await user.click(await screen.findByRole('button', { name: 'Report a Stat' }));
    await user.click(screen.getByRole('combobox', { name: 'Stat' }));
    await user.click(await screen.findByRole('option', { name: 'Warmth' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert Code' })).toBeEnabled());
  });
});

describe('a saved World Tool template', () => {
  it('saves from the menu with its kind and the box’s timing', async () => {
    const user = userEvent.setup();
    const repository = memoryRepository();
    openTool('after', [param('amount')], { repository });
    await user.click(await screen.findByRole('button', { name: /New Template/i }));
    expect(await screen.findByRole('combobox', { name: 'Runs' })).toHaveTextContent('After the AI');
    await user.type(screen.getByLabelText('Name'), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    await waitFor(() => expect(repository.library).toEqual([expect.objectContaining({ name: 'Mine', kind: 'worldTool', timings: ['after'] })]));
  });

  it('exports in a version 2 pack with its kind, and imports back into World Tool menus only', async () => {
    const user = userEvent.setup();
    const mine: CodeTemplate = { id: 'mine', kind: 'worldTool', name: 'Mine', description: '', code: 'return 1;', timings: ['call', 'after'] };
    const writeExportPack = vi.fn();
    const first = openTool('call', [], { repository: memoryRepository([mine]), fileTransfer: { readImportPack: vi.fn(), writeExportPack } });
    await user.click(await screen.findByRole('button', { name: 'Mine' }));
    await user.click(screen.getByLabelText('Export templates'));
    const pack = JSON.parse(writeExportPack.mock.calls[0][0] as string);
    expect(pack.formamorphTemplates).toBe(2);
    expect(pack.templates).toEqual([expect.objectContaining({ name: 'Mine', kind: 'worldTool', timings: ['call', 'after'] })]);
    expect(pack.templates[0]).not.toHaveProperty('timing');
    first.unmount();

    const fresh = memoryRepository();
    const second = openTool('call', [], {
      repository: fresh, fileTransfer: { readImportPack: async () => writeExportPack.mock.calls[0][0] as string, writeExportPack: vi.fn() },
    });
    await user.click(await screen.findByLabelText('Import templates'));
    expect(await screen.findByRole('button', { name: 'Mine' })).toBeInTheDocument();
    expect(fresh.library).toEqual([expect.objectContaining({ kind: 'worldTool', timings: ['call', 'after'] })]);
    second.unmount();

    // The stat box runs After the AI, one of the template's timings, so only its kind keeps it out.
    openStat(fresh);
    expect(await screen.findByRole('button', { name: 'Weighted Blend' })).toBeInTheDocument();
    await waitFor(() => expect(listed()).not.toContain('Mine'));
  });
});
