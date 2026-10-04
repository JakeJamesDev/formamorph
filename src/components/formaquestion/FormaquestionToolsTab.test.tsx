import { fireEvent, getDefaultNormalizer, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { HELP_ROLL } from '@/lib/formaquestion/helpRoll';
import { DEFAULT_HELP_SETTINGS, HELP_CALL_LIMIT_MAX, helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { helpWorld } from '@/lib/formaquestion/helpWorld';
import { sampleToolSnapshot } from '@/lib/tools/toolSnapshot';
import { sentenceShapeViolation } from '@/test/copyShape';
import { helpTool } from '@/test/helpFixtures';
import { TOOLS_COPY } from './formaquestionSettingsTabs';
import { ToolsTab } from './FormaquestionToolsTab';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));

let help: HelpSettings;

function Harness({ initial, toolsSupported }: { initial: HelpSettingsChange; toolsSupported: boolean }) {
  const [settings, setSettings] = useState(() => helpSettingsOf(initial));
  help = settings;
  return <ToolsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} toolsSupported={toolsSupported} />;
}

const renderTab = (initial: HelpSettingsChange = {}, toolsSupported = true) => render(<Harness initial={initial} toolsSupported={toolsSupported} />);

const FIND_PERSON = helpTool();

const list = () => within(screen.getByRole('navigation', { name: 'Tools' }));
const tab = (name: string) => screen.getByRole('tab', { name });
const nameField = () => within(screen.getByRole('tabpanel')).getAllByRole('textbox', { name: 'Name' })[0];
/** The rows: every button with a text name, which leaves out the icon-only Import and Export. */
const listed = () => list().getAllByRole('button').filter((button) => !button.hasAttribute('aria-label')).map((button) => button.textContent);
const limitBox = () => screen.getByRole('textbox', { name: 'Max Calls per Request' });
const enabledBox = () => screen.getByRole('checkbox', { name: 'Enabled' });

afterEach(() => vi.clearAllMocks());

describe('the Formaquestion Tools tab', () => {
  it('lists the guide lookup and the dice roll under Built-In and My Tools with New Tool, and no preset select', () => {
    renderTab();
    expect(listed()).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name, 'New Tool']);
    expect(screen.getByText('My Tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Tools' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Export Tools' })).toBeDisabled();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows the lookup’s description and parameters', () => {
    renderTab();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(DOCS_LOOKUP.name);
    expect(screen.getByText(DOCS_LOOKUP.description)).toBeInTheDocument();
    for (const param of DOCS_LOOKUP.params) expect(screen.getByText(param.description)).toBeInTheDocument();
  });

  it('turns lookup mode on and off with the row’s switch, off by default', async () => {
    const user = userEvent.setup();
    renderTab();
    expect(enabledBox()).not.toBeChecked();
    await user.click(enabledBox());
    expect(help.lookup).toBe(true);
    await user.click(enabledBox());
    expect(help.lookup).toBe(false);
  });

  it('shows a brief line for the lookup row within 12 words, in help-copy shape', () => {
    renderTab();
    expect(screen.getByText(TOOLS_COPY.lookupSummary)).toBeInTheDocument();
    expect(TOOLS_COPY.lookupSummary.split(/\s+/)).toHaveLength(12);
    expect(sentenceShapeViolation(TOOLS_COPY.lookupSummary)).toBeNull();
  });

  it('sets Max Calls per Request, and a blank field is the default', async () => {
    const user = userEvent.setup();
    renderTab();
    expect(limitBox()).toHaveValue('');
    expect(limitBox()).toHaveAttribute('placeholder', String(DEFAULT_HELP_SETTINGS.lookupCallLimit));
    expect(limitBox()).toHaveAccessibleDescription(`Takes up to ${HELP_CALL_LIMIT_MAX} calls. Leave blank for the default of ${DEFAULT_HELP_SETTINGS.lookupCallLimit}.`);
    await user.type(limitBox(), '5');
    expect(help.lookupCallLimit).toBe(5);
    expect(limitBox()).toHaveValue('5');
    await user.clear(limitBox());
    expect(help.lookupCallLimit).toBe(DEFAULT_HELP_SETTINGS.lookupCallLimit);
    await user.type(limitBox(), '99');
    expect(help.lookupCallLimit).toBe(HELP_CALL_LIMIT_MAX);
  });

  it('offers no edit, copy or delete action on the guide lookup or the dice roll', async () => {
    const user = userEvent.setup();
    renderTab({ lookup: true, roll: true });
    for (const row of [DOCS_LOOKUP.name, HELP_ROLL.name]) {
      await user.click(list().getByRole('button', { name: row }));
      for (const name of ['Edit', 'Duplicate', 'Delete']) expect(screen.queryByRole('button', { name }), `${row}: ${name}`).toBeNull();
    }
  });

  describe('the dice roll', () => {
    const selectRoll = async (user: ReturnType<typeof userEvent.setup>) => user.click(list().getByRole('button', { name: HELP_ROLL.name }));

    it('shows its own description and the catalog roll’s parameter', async () => {
      const user = userEvent.setup();
      renderTab();
      await selectRoll(user);
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(HELP_ROLL.name);
      // The description is one line per field, as the model reads it.
      expect(screen.getByText(HELP_ROLL.description, { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toBeInTheDocument();
      expect(screen.getByText(HELP_ROLL.params[0].description)).toBeInTheDocument();
    });

    it('turns on and off with its own switch, off by default, and leaves the lookup as it was', async () => {
      const user = userEvent.setup();
      renderTab();
      await selectRoll(user);
      const enabled = screen.getByRole('checkbox', { name: 'Enabled' });
      expect(enabled).not.toBeChecked();
      await user.click(enabled);
      expect(help).toMatchObject({ roll: true, lookup: false });
      await user.click(enabled);
      expect(help.roll).toBe(false);
    });

    it('sets its own Max Calls per Request, and a blank field is the catalog roll’s default', async () => {
      const user = userEvent.setup();
      renderTab();
      await selectRoll(user);
      expect(limitBox()).toHaveValue('');
      expect(limitBox()).toHaveAttribute('placeholder', String(DEFAULT_HELP_SETTINGS.rollCallLimit));
      await user.type(limitBox(), '7');
      expect(help).toMatchObject({ rollCallLimit: 7, lookupCallLimit: DEFAULT_HELP_SETTINGS.lookupCallLimit });
      await user.clear(limitBox());
      expect(help.rollCallLimit).toBe(DEFAULT_HELP_SETTINGS.rollCallLimit);
      await user.type(limitBox(), '99');
      expect(help.rollCallLimit).toBe(HELP_CALL_LIMIT_MAX);
    });
  });

  it('says so when the answer endpoint does not take function calls, and never names the Output switch', () => {
    const { unmount } = renderTab({ lookup: true }, false);
    expect(screen.getByRole('note')).toHaveTextContent("Answer Endpoint won't receive");
    expect(screen.getByRole('note')).not.toHaveTextContent('Output');
    unmount();
    renderTab({ lookup: true }, true);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('states next to the list that a Tool can send text of the open world, in help-copy shape', () => {
    renderTab();
    expect(screen.getByText(TOOLS_COPY.worldText)).toBeInTheDocument();
    expect(sentenceShapeViolation(TOOLS_COPY.worldText)).toBeNull();
  });
});

describe('the player’s Formaquestion Tools', () => {
  it('list under My Tools, off by default, with Max Calls per Request and no Offered To', async () => {
    const user = userEvent.setup();
    renderTab({ tools: [FIND_PERSON] });
    expect(listed()).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name, FIND_PERSON.name, 'New Tool']);
    await user.click(list().getByRole('button', { name: FIND_PERSON.name }));
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(FIND_PERSON.name);
    expect(enabledBox()).not.toBeChecked();
    expect(limitBox()).toBeInTheDocument();
    expect(screen.queryByText('Offered To')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('switch on and off per device, apart from the lookup switch', async () => {
    const user = userEvent.setup();
    renderTab({ tools: [FIND_PERSON] });
    await user.click(list().getByRole('button', { name: FIND_PERSON.name }));
    await user.click(enabledBox());
    expect(help.toolSwitches).toEqual({ 'h-1': true });
    expect(help.lookup).toBe(false);
    await user.click(enabledBox());
    expect(help.toolSwitches).toEqual({ 'h-1': false });
  });

  it('keep their call limit on the Tool', async () => {
    const user = userEvent.setup();
    renderTab({ tools: [FIND_PERSON] });
    await user.click(list().getByRole('button', { name: FIND_PERSON.name }));
    await user.type(limitBox(), '2');
    expect(help.tools[0].callLimit).toBe(2);
    expect(help.lookupCallLimit).toBe(DEFAULT_HELP_SETTINGS.lookupCallLimit);
  });

  it('refuse a fixed function’s name in the editor', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(list().getByRole('button', { name: 'New Tool' }));
    await user.type(nameField(), DOCS_LOOKUP.name);
    expect(screen.getByText('A built-in Tool uses this name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Tool' })).toBeDisabled();
  });

  it('start on when saved new, offered to no prompt, and off when imported (Q63)', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(list().getByRole('button', { name: 'New Tool' }));
    await user.type(nameField(), 'find_person');
    await user.click(tab('Parameters'));
    await user.click(screen.getByRole('button', { name: 'Add Parameter' }));
    await user.type(within(screen.getByRole('group', { name: 'Parameter 1' })).getByRole('textbox', { name: 'Name' }), 'who');
    await user.click(tab('Handler'));
    await user.click(screen.getByRole('combobox', { name: 'By Parameter' }));
    await user.click(await screen.findByRole('option', { name: 'who' }));
    await user.click(screen.getByRole('button', { name: 'Save Tool' }));

    const [made] = help.tools;
    expect(made).toMatchObject({ name: 'find_person', offeredTo: [] });
    expect(help.toolSwitches).toEqual({ [made.id]: true });
    expect(listed()).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name, 'find_person', 'New Tool']);
  });

  it('open in the editor from Edit, with the Tool’s own name', async () => {
    const user = userEvent.setup();
    renderTab({ tools: [FIND_PERSON] });
    await user.click(list().getByRole('button', { name: FIND_PERSON.name }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(nameField()).toHaveValue(FIND_PERSON.name);
    expect(screen.getByRole('button', { name: 'Save Tool' })).toBeEnabled();
    await user.type(nameField(), '_2');
    await user.click(screen.getByRole('button', { name: 'Save Tool' }));
    expect(help.tools.map((t) => t.name)).toEqual(['find_person_2']);
  });

  it('delete with a confirmation that names no preset, and the switch goes with the Tool', async () => {
    const user = userEvent.setup();
    renderTab({ tools: [FIND_PERSON], toolSwitches: { 'h-1': true } });
    await user.click(list().getByRole('button', { name: FIND_PERSON.name }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const notice = await screen.findByText(`Delete “${FIND_PERSON.name}”? This can't be undone.`);
    expect(notice).not.toHaveTextContent('preset');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(help.tools).toEqual([]);
    expect(help.toolSwitches).toEqual({});
  });

  it('import a pack from the gameplay Tools, and skip a Tool named as a fixed function', async () => {
    renderTab();
    const input = screen.getByTestId('tool-pack-input') as HTMLInputElement;
    const gameplay = helpTool({ id: 'g-1', offeredTo: ['narration'], callLimit: 2 });
    const taken = helpTool({ id: 'g-2', name: DOCS_LOOKUP.name });
    const contents = JSON.stringify({ formamorphTools: 1, appVersion: '3.1.2', tools: [gameplay, taken] });
    const file = new File([contents], 'tools.json', { type: 'application/json' });
    // jsdom's File lacks Blob.text(), which every browser has.
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(help.tools.map((t) => t.name)).toEqual([FIND_PERSON.name]));
    expect(help.tools[0]).toMatchObject({ offeredTo: ['narration'], callLimit: 2 });
    expect(help.tools[0].id).not.toBe('g-1');
    expect(toast.info).toHaveBeenCalledWith(`Already in My Tools: ${DOCS_LOOKUP.name}`);
  });

  it('run Try It on the open world when one is registered, else on the sample world', async () => {
    const user = userEvent.setup();
    const { unmount } = renderTab({ tools: [FIND_PERSON] });
    await user.click(list().getByRole('button', { name: FIND_PERSON.name }));
    expect(screen.getByText('Runs on a sample world')).toBeInTheDocument();
    unmount();
    const leave = helpWorld.register(sampleToolSnapshot);
    try {
      renderTab({ tools: [FIND_PERSON] });
      await user.click(list().getByRole('button', { name: FIND_PERSON.name }));
      expect(screen.getByText('Runs on the world you have open')).toBeInTheDocument();
    } finally {
      leave();
    }
  });
});
