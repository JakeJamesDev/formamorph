import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool } from '@/types';
import { ToolsHarness as Harness } from '@/test/toolsTab';
import { choosePreset, current, switchesOf, toolsState } from '@/test/toolsTabState';
import type { ToolFileTransfer } from './ToolsTab';
import { TOOL_CATALOG } from '@/lib/tools/toolCatalog';
import { withCatalogOverrides } from '@/lib/tools/catalogOverrides';
import { toolsOfferedTo } from '@/lib/tools/toolOffer';
import { PROMPT_TAB_REQUESTS, REQUEST_LABELS } from '@/lib/promptGroups';
import { toastTexts } from '@/test/toastText';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

/**
 * Settings → Tools, driven through the real store operations, so every assertion reads the state the tab
 * wrote rather than a callback it happened to call.
 */

const tool = (patch: Partial<Tool> = {}): Tool => ({
  id: 'u-weather', name: 'get_weather', description: 'Purpose: weather.', params: [
    { name: 'place', type: 'string', description: 'Where.', required: true, options: [] },
  ],
  handler: { kind: 'template', body: 'Sunny.' }, emptyResult: 'Nothing.', offeredTo: ['narration'], ...patch,
});
const script = tool({ id: 'u-dice', name: 'roll_dice', handler: { kind: 'script', code: 'return 4;' } });

/** The Built-In rows, in catalog order. */
const BUILT_IN = TOOL_CATALOG.map((t) => t.name);

const userState = (tools: Tool[] = []) => toolsState(tools);
const builtinState = (tools: Tool[] = []) => toolsState(tools, {}, 'experimental');

const list = () => within(screen.getByRole('navigation', { name: 'Tools' }));
/** The rows: every button with a text name, which leaves out the icon-only Import and Export. */
const listed = () => list().getAllByRole('button').filter((b) => !b.hasAttribute('aria-label')).map((b) => b.textContent);
const enabledBox = () => screen.getByRole('checkbox', { name: 'Enabled' });
const heading = () => screen.getByRole('heading', { level: 3 }).textContent;

beforeEach(() => { Object.values(toast).forEach((f) => f.mockClear()); });

describe('the list', () => {
  it('shows the catalog under Built-In and the player’s Tools under My Tools, sorted', () => {
    render(<Harness initial={userState([script, tool()])} />);
    expect(listed()).toEqual([...BUILT_IN, 'get_weather', 'roll_dice', 'New Tool']);
  });

  it('lists every Tool under whichever preset the selector shows', () => {
    render(<Harness initial={userState([script, tool()])} />);
    choosePreset('other');
    expect(listed()).toEqual([...BUILT_IN, 'get_weather', 'roll_dice', 'New Tool']);
    choosePreset('experimental');
    expect(listed()).toEqual([...BUILT_IN, 'get_weather', 'roll_dice', 'New Tool']);
  });

  it('offers New Tool and Import on a built-in preset, and an import arrives switched off', async () => {
    const user = userEvent.setup();
    const transfer: ToolFileTransfer = {
      writeExportPack: vi.fn(),
      readImportPack: vi.fn(async () => JSON.stringify({ formamorphTools: 1, tools: [tool()] })),
    };
    render(<Harness initial={builtinState()} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Import Tools' }));
    await waitFor(() => expect(current().tools.map((t) => t.name)).toEqual(['get_weather']));
    expect(switchesOf('experimental')).toEqual({ get_entity: true });

    await user.click(list().getByRole('button', { name: 'New Tool' }));
    expect(screen.getByRole('tablist', { name: 'Tool Fields' })).toBeInTheDocument();
  });
});

describe('the read view', () => {
  it('shows the selected Tool’s name, summary, description and folded schema', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool({ callLimit: 2, offeredTo: ['narration', 'director'] })])} />);
    expect(heading()).toBe('get_entity');
    expect(screen.getByText('Looks up entities by name and returns the full description')).toBeInTheDocument();

    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(heading()).toBe('get_weather');
    expect(screen.getByText('Returns a template')).toBeInTheDocument();
    expect(screen.getByText('Purpose: weather.')).toBeInTheDocument();
    const schema = screen.getByText('What the AI Receives').closest('details')!;
    expect(schema).not.toHaveAttribute('open');
    expect(JSON.parse(schema.querySelector('pre')!.textContent!)).toMatchObject({ type: 'function', function: { name: 'get_weather' } });
  });
});

describe('Enabled', () => {
  it('switches a catalog Tool on for the selected preset only', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState()} />);
    await user.click(enabledBox());
    expect(switchesOf('mine')).toEqual({ get_entity: true });
    expect(switchesOf('other')).toEqual({});
    expect(enabledBox()).toBeChecked();
  });

  it('switches one user Tool and leaves the others alone', async () => {
    const user = userEvent.setup();
    render(<Harness initial={toolsState([tool(), script], { 'u-weather': true })} />);
    await user.click(list().getByRole('button', { name: 'roll_dice' }));
    await user.click(enabledBox());
    expect(switchesOf('mine')).toEqual({ 'u-weather': true, 'u-dice': true });
  });

  it('shows and writes the switches of the preset the selector shows', async () => {
    const user = userEvent.setup();
    render(<Harness initial={toolsState([tool()], { 'u-weather': true })} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(enabledBox()).toBeChecked();
    choosePreset('other');
    expect(enabledBox()).not.toBeChecked();
    await user.click(enabledBox());
    expect(switchesOf('other')).toEqual({ 'u-weather': true });
    expect(switchesOf('mine')).toEqual({ 'u-weather': true });
  });

  it('shows a built-in preset’s shipped setting and switches it for that built-in only', async () => {
    const user = userEvent.setup();
    render(<Harness initial={builtinState([tool()])} />);
    expect(enabledBox()).toBeChecked();
    await user.click(enabledBox());
    expect(enabledBox()).not.toBeChecked();
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(enabledBox());
    expect(switchesOf('experimental')).toEqual({ get_entity: false, 'u-weather': true });
    expect(switchesOf('default')).toEqual({});
    expect(switchesOf('mine')).toEqual({});
    expect(current().store).toEqual(builtinState([tool()]).store);
  });
});

describe('Offered To', () => {
  const SHIPPED = structuredClone(TOOL_CATALOG);
  const offeredTo = () => screen.getByRole('combobox', { name: 'Offered To' });
  const pick = async (user: ReturnType<typeof userEvent.setup>, ...options: (string | RegExp)[]) => {
    await user.click(offeredTo());
    for (const name of options) await user.click(await screen.findByRole('option', { name }));
    await user.keyboard('{Escape}');
  };

  it('writes a user Tool’s definition live, with no Save step', async () => {
    const user = userEvent.setup();
    render(<Harness initial={toolsState([tool()], { 'u-weather': true })} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await pick(user, 'Choices, not selected');
    expect(current().tools).toEqual([tool({ offeredTo: ['narration', 'choices'] })]);
    expect(current().catalogOverrides).toEqual({});
    expect(screen.queryByRole('button', { name: 'Save Tool' })).toBeNull();
    expect(switchesOf('mine')).toEqual({ 'u-weather': true });
  });

  it('writes a catalog Tool’s global override live, leaves the catalog as shipped and its switch alone', async () => {
    const user = userEvent.setup();
    render(<Harness initial={toolsState([], { get_entity: true })} />);
    expect(heading()).toBe('get_entity');
    await pick(user, 'Narration, selected', 'Choices, not selected');
    expect(current().catalogOverrides).toEqual({ get_entity: { offeredTo: ['choices'] } });
    expect(current().tools).toEqual([]);
    expect(TOOL_CATALOG).toEqual(SHIPPED);
    expect(switchesOf('mine')).toEqual({ get_entity: true });
    const tools = withCatalogOverrides(TOOL_CATALOG, current().catalogOverrides);
    expect(toolsOfferedTo('choices', tools, switchesOf('mine'), true).map((t) => t.id)).toEqual(['get_entity']);
    expect(toolsOfferedTo('narration', tools, switchesOf('mine'), true)).toEqual([]);
  });

  it('shows the selected Tool’s own prompts after switching Tools', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool({ offeredTo: ['director'] })])} />);
    await pick(user, 'Choices, not selected');
    expect(within(offeredTo()).getByText('Choices')).toBeInTheDocument();
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(within(offeredTo()).getByText('Director')).toBeInTheDocument();
    expect(within(offeredTo()).queryByText('Choices')).toBeNull();
  });

  it('lists the prompts in the Prompts rail order', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState()} />);
    await user.click(offeredTo());
    const options = (await screen.findAllByRole('option')).map((o) => o.textContent);
    expect(options).toEqual(['Select All',...Object.values(PROMPT_TAB_REQUESTS).map((k) => REQUEST_LABELS[k]), 'Clear', 'Close']);
  });

  it('keeps Clear and Close in a footer outside the scroll list, through any search', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await pick(user, /^Select all \d+ options$/);
    await user.click(offeredTo());
    const listbox = (await screen.findByRole('option', { name: /^Narration/ })).closest('[role="listbox"]');
    await user.type(screen.getByPlaceholderText('Search options...'), 'zzz');
    for (const name of ['Clear', 'Close']) {
      const item = screen.getByRole('option', { name });
      expect(listbox).not.toContainElement(item);
    }
  });

  it('checks every prompt with Select All and shows one All Prompts chip, then clears them all', async () => {
    const user = userEvent.setup();
    const every = Object.values(PROMPT_TAB_REQUESTS);
    render(<Harness initial={userState([tool()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await pick(user, /^Select all \d+ options$/);
    expect(within(offeredTo()).getByText('All Prompts')).toBeInTheDocument();
    expect(within(offeredTo()).queryByText('Narration')).toBeNull();
    expect([...current().tools[0].offeredTo].sort()).toEqual([...every].sort());

    await pick(user, /^Select all \d+ options$/);
    expect(within(offeredTo()).getByText('No Prompts')).toBeInTheDocument();
    expect(current().tools[0].offeredTo).toEqual([]);
  });
});

describe('Max Calls per Request', () => {
  const limit = () => screen.getByRole('textbox', { name: 'Max Calls per Request' });

  it('writes a user Tool’s limit live, and a blank falls back to the default', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(limit()).toHaveAccessibleDescription('Leave blank for the default of 4');
    await user.type(limit(), '7');
    expect(current().tools[0].callLimit).toBe(7);

    await user.clear(limit());
    expect(current().tools[0]).not.toHaveProperty('callLimit');
  });

  it('writes a catalog Tool’s limit to the global override', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState()} />);
    await user.type(limit(), '3');
    expect(current().catalogOverrides).toEqual({ get_entity: { offeredTo: ['narration'], callLimit: 3 } });
    expect(current().tools).toEqual([]);
    expect(limit()).toHaveValue('3');
  });
});

describe('the footer actions', () => {
  it('offers Duplicate and no Edit for a built-in Tool, and Edit and Delete for a user Tool', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool()])} />);
    expect(heading()).toBe('get_entity');
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeEnabled();

    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
  });
});

describe('Duplicate', () => {
  it('copies a built-in Tool into My Tools, switched on for this preset only, and selects the copy', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState()} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    const [copy] = current().tools;
    expect(copy).toMatchObject({ name: 'get_entity_copy', handler: { kind: 'lookup' } });
    expect(copy.id).not.toBe('get_entity');
    expect(switchesOf('mine')).toEqual({ [copy.id]: true });
    expect(switchesOf('other')).toEqual({});
    expect(heading()).toBe('get_entity_copy');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('copies a built-in Tool on a built-in preset, switched on for that built-in only', async () => {
    const user = userEvent.setup();
    render(<Harness initial={builtinState()} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    const [copy] = current().tools;
    expect(copy).toMatchObject({ name: 'get_entity_copy' });
    expect(switchesOf('experimental')).toEqual({ get_entity: true, [copy.id]: true });
    expect(switchesOf('default')).toEqual({});
    expect(switchesOf('mine')).toEqual({});
  });

  it('offers no Duplicate for recall, whose source a user Tool cannot store', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState()} />);
    await user.click(list().getByRole('button', { name: 'recall' }));
    expect(heading()).toBe('recall');
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDisabled();
  });
});

describe('Delete', () => {
  it('asks first, then removes only the chosen Tool, from the list and from every preset', async () => {
    const user = userEvent.setup();
    const initial = toolsState([tool(), script], { 'u-weather': true, 'u-dice': true });
    initial.store.presets[1].enabledTools = { 'u-dice': true };
    render(<Harness initial={initial} />);
    await user.click(list().getByRole('button', { name: 'roll_dice' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText("Delete “roll_dice” from every preset? This can't be undone.")).toBeInTheDocument();
    expect(current().tools).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(current().tools).toEqual([tool()]);
    expect(switchesOf('mine')).toEqual({ 'u-weather': true });
    expect(switchesOf('other')).toEqual({});
    choosePreset('other');
    expect(listed()).toEqual([...BUILT_IN, 'get_weather', 'New Tool']);
  });

  it('edits and deletes a user Tool while a built-in preset is selected', async () => {
    const user = userEvent.setup();
    render(<Harness initial={builtinState([tool(), script])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(within(screen.getByRole('tabpanel')).getAllByRole('textbox', { name: 'Name' })[0], '_x');
    await user.click(screen.getByRole('button', { name: 'Save Tool' }));
    expect(current().tools.map((t) => t.name)).toEqual(['get_weather_x', 'roll_dice']);

    await user.click(list().getByRole('button', { name: 'roll_dice' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm' }));
    expect(current().tools.map((t) => t.name)).toEqual(['get_weather_x']);
  });

  it('keeps the Tool when the confirmation is canceled', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(current().tools).toEqual([tool()]);
  });
});

describe('edit mode', () => {
  it('opens the editor from Edit and New Tool, and Cancel returns to the read view', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool()])} />);
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
  it('round-trips My Tools through a pack, skipping names the list holds, with imports switched off', async () => {
    const user = userEvent.setup();
    let written = '';
    const transfer: ToolFileTransfer = {
      writeExportPack: vi.fn((contents: string) => { written = contents; }),
      readImportPack: vi.fn(async () => written),
    };
    const { unmount } = render(<Harness initial={toolsState([tool(), script], { 'u-weather': true })} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Export Tools' }));
    expect(transfer.writeExportPack).toHaveBeenCalledWith(expect.any(String), 'tools.json');
    expect(JSON.parse(written)).toEqual({ formamorphTools: 1, appVersion: '9.9.9', tools: [tool(), script] });
    unmount();

    render(<Harness initial={userState([tool()])} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Import Tools' }));
    await waitFor(() => expect(current().tools).toHaveLength(2));
    const imported = current().tools[1];
    expect(imported).toEqual({ ...script, id: imported.id });
    expect(imported.id).not.toBe(script.id);
    expect(switchesOf('mine')).toEqual({});
    expect(toast.info).toHaveBeenCalledWith('Already in My Tools: get_weather');
    expect(toast.warn).toHaveBeenCalledWith(expect.stringContaining('Script Tool'));
  });

  it('shows no Script notice for a pack without scripts', async () => {
    const user = userEvent.setup();
    const transfer: ToolFileTransfer = {
      writeExportPack: vi.fn(),
      readImportPack: vi.fn(async () => JSON.stringify({ formamorphTools: 1, tools: [tool()] })),
    };
    render(<Harness initial={userState()} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Import Tools' }));
    await waitFor(() => expect(current().tools).toHaveLength(1));
    expect(toast.success).toHaveBeenCalledWith('Imported 1 Tool');
    expect(toast.warn).not.toHaveBeenCalled();
  });

  it('imports a pack chosen in the file picker', async () => {
    render(<Harness initial={userState()} />);
    const input = screen.getByTestId('tool-pack-input') as HTMLInputElement;
    const contents = JSON.stringify({ formamorphTools: 1, tools: [tool()] });
    const file = new File([contents], 'tools.json', { type: 'application/json' });
    // jsdom's File lacks Blob.text(), which every browser has.
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(current().tools.map((t) => t.name)).toEqual(['get_weather']));
    expect(input.value).toBe('');
  });

  it('reports a file that is not a pack and changes nothing', async () => {
    const user = userEvent.setup();
    const transfer: ToolFileTransfer = { writeExportPack: vi.fn(), readImportPack: vi.fn(async () => '{"templates":[]}') };
    render(<Harness initial={userState()} fileTransfer={transfer} />);
    await user.click(screen.getByRole('button', { name: 'Import Tools' }));
    await waitFor(() => expect(toastTexts(toast.error)).toContain('That file isn’t a Formamorph Tool pack.View Details →'));
    expect(current().tools).toEqual([]);
  });
});

describe('the endpoint notice', () => {
  it('shows only when the text endpoint won’t receive Tools', () => {
    const { rerender } = render(<Harness initial={userState()} toolsSupported={false} />);
    expect(screen.getByRole('note')).toHaveTextContent("won't receive Tools");
    rerender(<Harness initial={userState()} toolsSupported />);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('names the Output switch when Tools are off, ahead of the endpoint notice', () => {
    render(<Harness initial={userState()} toolsSupported={false} toolsEnabled={false} />);
    expect(screen.getByRole('note')).toHaveTextContent('Turn on Tools in the Output tab');
  });
});
