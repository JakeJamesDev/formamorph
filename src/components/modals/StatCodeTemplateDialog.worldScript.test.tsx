import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ScriptTiming, Stat, ToolScriptTiming } from '@/types';
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
const locations = [{ id: 'l1', name: 'North Gate' }, { id: 'l2', name: 'Inn' }];

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

type Transfer = { readImportPack: () => Promise<string | null>; writeExportPack: (contents: string, filename: string) => void };

const openWorld = (
  timing: ScriptTiming,
  extra: { onInsert?: (code: string) => void; repository?: StatTemplateRepository; fileTransfer?: Transfer } = {},
) => render(
  <StatCodeTemplateDialog
    open onOpenChange={vi.fn()} kind="worldScript" timing={timing} stats={stats} locations={locations}
    hasExistingCode={false} onInsert={extra.onInsert ?? vi.fn()} repository={extra.repository ?? memoryRepository()}
    fileTransfer={extra.fileTransfer}
  />,
);

const openStat = (timing: ScriptTiming, repository: StatTemplateRepository = memoryRepository()) => render(
  <StatCodeTemplateDialog
    open onOpenChange={vi.fn()} timing={timing} stats={stats} currentStatId="s1"
    hasExistingCode={false} onInsert={vi.fn()} repository={repository}
  />,
);

const openTool = (timing: ToolScriptTiming) => render(
  <StatCodeTemplateDialog
    open onOpenChange={vi.fn()} kind="worldTool" timing={timing} params={[]} stats={stats}
    hasExistingCode={false} onInsert={vi.fn()} repository={memoryRepository()}
  />,
);

const listed = () => screen.getAllByRole('button').map((button) => button.textContent);
const generated = () => document.querySelector('pre')?.textContent ?? '';

const WORLD_ONLY = ['Opening Location', 'Advance Time While a Trait Is On', 'Leave When a Stat Runs Out', 'Placeholder by Daypart',
  'Memory When a Trait Turns On', 'Diary Line When a Trait Turns On', 'Entity Stat Follows a Global Stat'];

describe('a world script box’s menu', () => {
  it('lists only the world script templates for the box’s timing', async () => {
    openWorld('after');
    expect(await screen.findByRole('button', { name: 'Leave When a Stat Runs Out' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Advance Time While a Trait Is On' })).toBeInTheDocument();
    for (const name of ['Opening Location', 'Memory When a Trait Turns On', 'Weighted Blend', 'Report a Stat']) {
      expect(listed(), name).not.toContain(name);
    }
  });

  it('follows a timing change', async () => {
    const { rerender } = openWorld('after');
    expect(await screen.findByRole('button', { name: 'Leave When a Stat Runs Out' })).toBeInTheDocument();
    rerender(
      <StatCodeTemplateDialog
        open onOpenChange={vi.fn()} kind="worldScript" timing="start" stats={stats} locations={locations}
        hasExistingCode={false} onInsert={vi.fn()} repository={memoryRepository()}
      />,
    );
    expect(await screen.findByRole('button', { name: 'Opening Location' })).toBeInTheDocument();
    expect(listed()).not.toContain('Leave When a Stat Runs Out');
  });

  it.each(['before', 'after', 'output', 'start', 'switch'] as const)('never shows in a stat box at %s', async (timing) => {
    openStat(timing);
    await screen.findByRole('button', { name: 'New Template' });
    for (const name of WORLD_ONLY) expect(listed(), name).not.toContain(name);
  });

  it.each(['call', 'output', 'after'] as const)('never shows in a World Tool box at %s', async (timing) => {
    openTool(timing);
    await screen.findByRole('button', { name: 'New Template' });
    for (const name of WORLD_ONLY) expect(listed(), name).not.toContain(name);
  });
});

describe('the location slot', () => {
  it('lists the world’s locations and fills the picked name in quotes', async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn();
    openWorld('start', { onInsert });
    await user.click(await screen.findByRole('button', { name: 'Opening Location' }));
    await user.click(screen.getByRole('combobox', { name: 'Place' }));
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['North Gate', 'Inn']);
    await user.click(screen.getByRole('option', { name: 'Inn' }));
    await waitFor(() => expect(generated()).toBe('location.move("Inn");'));
    await user.click(screen.getByRole('button', { name: 'Insert Code' }));
    expect(onInsert).toHaveBeenCalledWith('location.move("Inn");', []);
  });

  it('blocks Insert until a location is picked', async () => {
    const user = userEvent.setup();
    openWorld('start');
    await user.click(await screen.findByRole('button', { name: 'Opening Location' }));
    expect(screen.getByRole('button', { name: 'Insert Code' })).toBeDisabled();
  });
});

describe('a saved world script template', () => {
  it('saves from the menu with its kind and the box’s timing', async () => {
    const user = userEvent.setup();
    const repository = memoryRepository();
    openWorld('switch', { repository });
    await user.click(await screen.findByRole('button', { name: /New Template/i }));
    expect(await screen.findByRole('combobox', { name: 'Runs' })).toHaveTextContent('When a Trait Switches');
    await user.type(screen.getByLabelText('Name'), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    await waitFor(() => expect(repository.library).toEqual([expect.objectContaining({ name: 'Mine', kind: 'worldScript', timings: ['switch'] })]));
  });

  it('exports in a version 2 pack with its kind, and imports back into world script menus only', async () => {
    const user = userEvent.setup();
    const mine: CodeTemplate = { id: 'mine', kind: 'worldScript', name: 'Mine', description: '', code: 'location.move("Inn");', timings: ['after', 'start'] };
    const writeExportPack = vi.fn();
    const first = openWorld('start', { repository: memoryRepository([mine]), fileTransfer: { readImportPack: vi.fn(), writeExportPack } });
    await user.click(await screen.findByRole('button', { name: 'Mine' }));
    await user.click(screen.getByLabelText('Export templates'));
    const pack = JSON.parse(writeExportPack.mock.calls[0][0] as string);
    expect(pack.formamorphTemplates).toBe(2);
    expect(pack.templates).toEqual([expect.objectContaining({ name: 'Mine', kind: 'worldScript', timings: ['after', 'start'] })]);
    first.unmount();

    const fresh = memoryRepository();
    const second = openWorld('after', {
      repository: fresh, fileTransfer: { readImportPack: async () => writeExportPack.mock.calls[0][0] as string, writeExportPack: vi.fn() },
    });
    await user.click(await screen.findByLabelText('Import templates'));
    expect(await screen.findByRole('button', { name: 'Mine' })).toBeInTheDocument();
    expect(fresh.library).toEqual([expect.objectContaining({ kind: 'worldScript', timings: ['after', 'start'] })]);
    second.unmount();

    // The stat box runs After the AI, one of the template's timings, so only its kind keeps it out.
    openStat('after', fresh);
    expect(await screen.findByRole('button', { name: 'Weighted Blend' })).toBeInTheDocument();
    await waitFor(() => expect(listed()).not.toContain('Mine'));
  });
});
