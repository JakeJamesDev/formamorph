import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool } from '@/types';
import {
  activeCatalogTools, activeUserTools, deleteTool, isBuiltInActive, saveTool, setToolOverride,
  type PromptPresetStore, type PromptValues,
} from '@/lib/promptPresets';
import { ToolsTab, type ToolFileTransfer } from './ToolsTab';
import { EMPTY_TOOLS_VIEW, type ToolsView } from './toolsView';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

/**
 * Settings → Tools, driven through the real preset-store operations, so every assertion reads the store the
 * tab wrote rather than a callback it happened to call.
 */

const tool = (patch: Partial<Tool> = {}): Tool => ({
  id: 'u-weather', name: 'get_weather', description: 'Purpose: weather.', params: [
    { name: 'place', type: 'string', description: 'Where.', required: true, options: [] },
  ],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: 'Nothing.', offeredTo: ['narration'], enabled: true, ...patch,
});
const script = tool({ id: 'u-dice', name: 'roll_dice', handler: { kind: 'script', code: 'return 4;' } });

const userStore = (tools: Tool[] = []): PromptPresetStore => ({
  activeId: 'mine', presets: [{ id: 'mine', name: 'Mine', values: {} as PromptValues, tools }],
});
const builtinStore = (): PromptPresetStore => ({ activeId: 'experimental', presets: [] });

let store: PromptPresetStore;

function Harness({ initial, toolsSupported = true, fileTransfer }: {
  initial: PromptPresetStore; toolsSupported?: boolean; fileTransfer?: ToolFileTransfer;
}) {
  const [s, setS] = useState(initial);
  const [view, setView] = useState<ToolsView>(EMPTY_TOOLS_VIEW);
  store = s;
  return (
    <ToolsTab
      catalogTools={activeCatalogTools(s)}
      userTools={activeUserTools(s)}
      builtinPreset={isBuiltInActive(s)}
      toolsSupported={toolsSupported}
      onSaveTool={(t) => setS((prev) => saveTool(prev, t))}
      onDeleteTool={(id) => setS((prev) => deleteTool(prev, id))}
      onSetOverride={(id, o) => setS((prev) => setToolOverride(prev, id, o))}
      view={view}
      onViewChange={setView}
      presetSelector={<span>Preset</span>}
      fullscreen={false}
      onToggleFullscreen={() => {}}
      appVersion="9.9.9"
      fileTransfer={fileTransfer}
    />
  );
}

const list = () => within(screen.getByRole('navigation', { name: 'Tools' }));
/** The rows: every button with a text name, which leaves out the icon-only Import and Export. */
const listed = () => list().getAllByRole('button').filter((b) => !b.hasAttribute('aria-label')).map((b) => b.textContent);
const enabledBox = () => screen.getByRole('checkbox', { name: 'Enabled' });
const heading = () => screen.getByRole('heading', { level: 3 }).textContent;

beforeEach(() => { Object.values(toast).forEach((f) => f.mockClear()); });

describe('the list', () => {
  it('shows the catalog under Built-In and the preset’s own Tools under My Tools, sorted', () => {
    render(<Harness initial={userStore([script, tool()])} />);
    expect(listed()).toEqual(['get_entity', 'get_weather', 'roll_dice', 'New Tool']);
  });

  it('shows the same catalog on a built-in preset, with no Tools of its own', () => {
    render(<Harness initial={builtinStore()} />);
    expect(listed()).toEqual(['get_entity', 'New Tool']);
    expect(list().getByRole('button', { name: 'New Tool' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Import Tools' })).toBeDisabled();
  });
});

describe('the read view', () => {
  it('shows the selected Tool’s name, summary, description and folded schema', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([tool({ callLimit: 2, offeredTo: ['narration', 'director'] })])} />);
    expect(heading()).toBe('get_entity');
    expect(screen.getByText(/Looks up entities by name and returns the full description · Offered to Narration · 4 calls per request/)).toBeInTheDocument();

    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(heading()).toBe('get_weather');
    expect(screen.getByText('Returns a template · Offered to Narration, Director · 2 calls per request')).toBeInTheDocument();
    expect(screen.getByText('Purpose: weather.')).toBeInTheDocument();
    const schema = screen.getByText('What the AI Receives').closest('details')!;
    expect(schema).not.toHaveAttribute('open');
    expect(JSON.parse(schema.querySelector('pre')!.textContent!)).toMatchObject({ type: 'function', function: { name: 'get_weather' } });
  });
});

describe('Enabled', () => {
  it('writes the catalog override on a user preset, keeping its prompts', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore()} />);
    await user.click(enabledBox());
    expect(store.presets[0].toolOverrides).toEqual({ get_entity: { enabled: true, offeredTo: ['narration'] } });
    expect(enabledBox()).toBeChecked();
  });

  it('writes a user Tool’s own flag and leaves the others alone', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([tool(), script])} />);
    await user.click(list().getByRole('button', { name: 'roll_dice' }));
    await user.click(enabledBox());
    expect(activeUserTools(store).map((t) => [t.name, t.enabled])).toEqual([['get_weather', true], ['roll_dice', false]]);
  });

  it('is disabled on a built-in preset and shows its shipped setting', () => {
    render(<Harness initial={builtinStore()} />);
    expect(enabledBox()).toBeDisabled();
    expect(enabledBox()).toBeChecked();
  });
});

describe('Duplicate', () => {
  it('copies a built-in Tool into My Tools on a user preset and selects the copy', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore()} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    const [copy] = activeUserTools(store);
    expect(copy).toMatchObject({ name: 'get_entity_copy', handler: { kind: 'lookup' } });
    expect(copy.id).not.toBe('get_entity');
    expect(heading()).toBe('get_entity_copy');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('asks for a preset copy first on a built-in preset and saves nothing', async () => {
    const user = userEvent.setup();
    render(<Harness initial={builtinStore()} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.getByRole('status')).toHaveTextContent('Duplicate the preset first');
    expect(store).toEqual(builtinStore());
  });
});

describe('Delete', () => {
  it('asks first, then removes only the chosen Tool', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([tool(), script])} />);
    await user.click(list().getByRole('button', { name: 'roll_dice' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(activeUserTools(store)).toHaveLength(2);

    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(activeUserTools(store)).toEqual([tool()]);
    expect(listed()).toEqual(['get_entity', 'get_weather', 'New Tool']);
  });

  it('keeps the Tool when the confirmation is canceled', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([tool()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(activeUserTools(store)).toEqual([tool()]);
  });
});

describe('edit mode', () => {
  it('opens an empty edit shell from Edit and New Tool, and Cancel returns to the read view', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([tool()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('Edit get_weather')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(heading()).toBe('get_weather');

    await user.click(list().getByRole('button', { name: 'New Tool' }));
    expect(screen.getByText('New Tool')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Tools' })).toBeNull();
  });
});

describe('import and export', () => {
  it('round-trips My Tools through a pack, skipping names the preset holds', async () => {
    const user = userEvent.setup();
    let written = '';
    const transfer: ToolFileTransfer = {
      writeExportPack: vi.fn((contents: string) => { written = contents; }),
      readImportPack: vi.fn(async () => written),
    };
    const { unmount } = render(<Harness initial={userStore([tool(), script])} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Export Tools' }));
    expect(transfer.writeExportPack).toHaveBeenCalledWith(expect.any(String), 'tools.json');
    expect(JSON.parse(written)).toEqual({ formamorphTools: 1, appVersion: '9.9.9', tools: [tool(), script] });
    unmount();

    render(<Harness initial={userStore([tool()])} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Import Tools' }));
    await waitFor(() => expect(activeUserTools(store)).toHaveLength(2));
    const imported = activeUserTools(store)[1];
    expect(imported).toEqual({ ...script, id: imported.id });
    expect(imported.id).not.toBe(script.id);
    expect(toast.info).toHaveBeenCalledWith('Already in this preset: get_weather');
    expect(toast.warn).toHaveBeenCalledWith(expect.stringContaining('Script Tool'));
  });

  it('shows no Script notice for a pack without scripts', async () => {
    const user = userEvent.setup();
    const transfer: ToolFileTransfer = {
      writeExportPack: vi.fn(),
      readImportPack: vi.fn(async () => JSON.stringify({ formamorphTools: 1, tools: [tool()] })),
    };
    render(<Harness initial={userStore()} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Import Tools' }));
    await waitFor(() => expect(activeUserTools(store)).toHaveLength(1));
    expect(toast.success).toHaveBeenCalledWith('Imported 1 Tool');
    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('imports a pack chosen in the file picker', async () => {
    render(<Harness initial={userStore()} />);
    const input = screen.getByTestId('tool-pack-input') as HTMLInputElement;
    const contents = JSON.stringify({ formamorphTools: 1, tools: [tool()] });
    const file = new File([contents], 'tools.json', { type: 'application/json' });
    // jsdom's File lacks Blob.text(), which every browser has.
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(activeUserTools(store).map((t) => t.name)).toEqual(['get_weather']));
    expect(input.value).toBe('');
  });

  it('reports a file that is not a pack and changes nothing', async () => {
    const user = userEvent.setup();
    const transfer: ToolFileTransfer = { writeExportPack: vi.fn(), readImportPack: vi.fn(async () => '{"templates":[]}') };
    render(<Harness initial={userStore()} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Import Tools' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That file isn’t a Formamorph Tool pack.'));
    expect(activeUserTools(store)).toEqual([]);
  });
});

describe('the endpoint notice', () => {
  it('shows only when the text endpoint won’t receive Tools', () => {
    const { rerender } = render(<Harness initial={userStore()} toolsSupported={false} />);
    expect(screen.getByRole('note')).toHaveTextContent("won't receive Tools");
    rerender(<Harness initial={userStore()} toolsSupported />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
