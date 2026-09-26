import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tool } from '@/types';
import { ToolsHarness as Harness } from '@/test/toolsTab';
import { choosePreset, current, switchesOf, toolsState } from '@/test/toolsTabState';
import type { ToolFileTransfer } from './ToolsTab';

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
    expect(listed()).toEqual(['get_entity', 'get_weather', 'roll_dice', 'New Tool']);
  });

  it('lists every Tool under whichever preset the selector shows', () => {
    render(<Harness initial={userState([script, tool()])} />);
    choosePreset('other');
    expect(listed()).toEqual(['get_entity', 'get_weather', 'roll_dice', 'New Tool']);
    choosePreset('experimental');
    expect(listed()).toEqual(['get_entity', 'get_weather', 'roll_dice', 'New Tool']);
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
    expect(screen.getByText('New Tool')).toBeInTheDocument();
  });
});

describe('the read view', () => {
  it('shows the selected Tool’s name, summary, description and folded schema', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userState([tool({ callLimit: 2, offeredTo: ['narration', 'director'] })])} />);
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
    expect(listed()).toEqual(['get_entity', 'get_weather', 'New Tool']);
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
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That file isn’t a Formamorph Tool pack.'));
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
