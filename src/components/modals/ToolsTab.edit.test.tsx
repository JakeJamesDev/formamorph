import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import rawWorld from '../../../testing/baseline/sedge-landing.json';
import type { Tool } from '@/types';
import { migrateWorld } from '@/lib/version';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { buildToolSnapshot } from '@/lib/tools/toolSnapshot';
import { ToolsHarness as Harness } from '@/test/toolsTab';
import { current, switchesOf, toolsState } from '@/test/toolsTabState';

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

/**
 * Edit mode and Try It, driven through the real store operations and the real Tool Runner, so every
 * assertion reads the state the tab wrote or the result the runner returned.
 */

const weather = (patch: Partial<Tool> = {}): Tool => ({
  id: 'u-weather', name: 'get_weather', description: 'Purpose: weather.', params: [
    { name: 'place', type: 'string', description: 'Where.', required: true, options: [] },
  ],
  handler: { kind: 'template', body: 'Sunny in {{arg:place}}.' }, emptyResult: '{"matches": []}',
  offeredTo: ['narration'], ...patch,
});

const userStore = (tools: Tool[] = []) => toolsState(tools);

const saved = () => current().tools;
const list = () => within(screen.getByRole('navigation', { name: 'Tools' }));
const tab = (name: string) => screen.getByRole('tab', { name });
const saveButton = () => screen.getByRole('button', { name: 'Save Tool' });
const nameInput = () => within(screen.getByRole('tabpanel')).getAllByRole('textbox', { name: 'Name' })[0];

async function pickHandler(user: ReturnType<typeof userEvent.setup>, kind: string) {
  await user.click(screen.getByRole('combobox', { name: 'Handler Type' }));
  await user.click(await screen.findByRole('option', { name: kind }));
}

async function openEditor(user: ReturnType<typeof userEvent.setup>, tools: Tool[] = [weather()], fullscreen = false) {
  render(<Harness initial={userStore(tools)} fullscreen={fullscreen} />);
  await user.click(list().getByRole('button', { name: tools[0].name }));
  await user.click(screen.getByRole('button', { name: 'Edit' }));
}

describe('creating a Tool', () => {
  it('saves a new lookup Tool built across the three tabs and selects it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore()} />);
    await user.click(list().getByRole('button', { name: 'New Tool' }));
    expect(screen.getByRole('tablist', { name: 'Tool Fields' })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Name the Tool (Definition) and pick the parameter to search by (Handler) to save');

    await user.type(nameInput(), 'find_person');
    await user.click(screen.getByRole('button', { name: 'Add Outline' }));

    await user.click(tab('Parameters'));
    await user.click(screen.getByRole('button', { name: 'Add Parameter' }));
    await user.type(within(screen.getByRole('group', { name: 'Parameter 1' })).getByRole('textbox', { name: 'Name' }), 'who');

    await user.click(tab('Handler'));
    await user.click(screen.getByRole('combobox', { name: 'By Parameter' }));
    await user.click(await screen.findByRole('option', { name: 'who' }));


    expect(saveButton()).toBeEnabled();
    await user.click(saveButton());

    const [made] = saved();
    expect(made).toMatchObject({
      name: 'find_person',
      description: 'Purpose: \nUse when: \nInput: \nOutput: ',
      params: [{ name: 'who', type: 'string', required: true }],
      handler: { kind: 'lookup', source: 'entities', param: 'who', returns: 'full' },
      offeredTo: ['narration'],
    });
    expect(made).not.toHaveProperty('callLimit');
    expect(switchesOf('mine')).toEqual({ [made.id]: true });
    expect(switchesOf('other')).toEqual({});
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('find_person');
  });
});

describe('editing a Tool', () => {
  it('saves the change under the same id', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.clear(nameInput());
    await user.type(nameInput(), 'get_forecast');
    await user.click(saveButton());
    expect(saved()).toEqual([expect.objectContaining({ id: 'u-weather', name: 'get_forecast' })]);
  });

  it('discards the draft on Cancel', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.type(nameInput(), '_x');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(saved()).toEqual([weather()]);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('get_weather');
  });

  it('edits, retypes and removes parameters', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.click(tab('Parameters'));
    await user.click(screen.getByRole('button', { name: 'Add Parameter' }));
    const second = within(screen.getByRole('group', { name: 'Parameter 2' }));
    await user.type(second.getByRole('textbox', { name: 'Name' }), 'mood');
    await user.click(second.getByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'One of a List' }));
    await user.type(second.getByRole('textbox', { name: 'Options' }), ' calm, angry ,');
    await user.click(second.getByRole('checkbox', { name: 'Required' }));
    await user.click(within(screen.getByRole('group', { name: 'Parameter 1' })).getByRole('button', { name: 'Remove Parameter' }));
    await user.click(saveButton());
    expect(saved()[0].params).toEqual([
      { name: 'mood', type: 'enum', description: '', required: false, options: ['calm', 'angry'] },
    ]);
  });

  it('switches handler kind and writes each kind’s fields', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.click(tab('Handler'));
    expect(screen.getByRole('textbox', { name: 'Template' })).toHaveTextContent('Sunny in place.');

    await pickHandler(user, 'Lookup');
    await user.click(screen.getByRole('combobox', { name: 'Search' }));
    await user.click(await screen.findByRole('option', { name: 'Locations' }));
    await user.click(screen.getByRole('combobox', { name: 'Returns' }));
    await user.click(await screen.findByRole('option', { name: 'Summary' }));
    await user.click(saveButton());
    expect(saved()[0].handler).toEqual({ kind: 'lookup', source: 'locations', param: 'place', returns: 'summary' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(tab('Handler'));
    await pickHandler(user, 'Script');
    await user.click(screen.getByRole('button', { name: 'What a Script Can Read' }));
    const readable = within(await screen.findByLabelText('What the script can read'));
    expect(readable.getAllByRole('term').map((t) => t.textContent)).toEqual(['args', 'world', 'scene', 'placeholders', 'console']);
    expect(readable.getAllByRole('definition')[0]).toHaveTextContent('{ place }');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('textbox', { name: 'Script' })).toBeInTheDocument();
    await user.click(saveButton());
    expect(saved()[0].handler).toEqual({ kind: 'script', code: '' });
  });

  it('restores each handler type’s fields when you switch back, until the edit ends', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.click(tab('Handler'));
    await pickHandler(user, 'Script');
    await user.type(screen.getByRole('textbox', { name: 'Script' }), 'return 1;');
    await user.click(tab('Definition'));
    await user.click(tab('Handler'));
    await pickHandler(user, 'Template');
    expect(screen.getByRole('textbox', { name: 'Template' })).toHaveTextContent('Sunny in place.');
    await pickHandler(user, 'Script');
    expect(screen.getByRole('textbox', { name: 'Script' })).toHaveTextContent('return 1;');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(tab('Handler'));
    await pickHandler(user, 'Script');
    expect(screen.getByRole('textbox', { name: 'Script' })).toHaveTextContent(/^$/);
  });

  it('writes the empty result and keeps the call limit set on the read page', async () => {
    const user = userEvent.setup();
    await openEditor(user, [weather({ callLimit: 2 })]);
    await user.click(tab('Handler'));
    const empty = screen.getByRole('textbox', { name: 'Empty Result' });
    await user.clear(empty);
    fireEvent.change(empty, { target: { value: '{"none": true}' } });
    await user.click(saveButton());
    expect(saved()[0].emptyResult).toBe('{"none": true}');
    expect(saved()[0].callLimit).toBe(2);
  });
});

describe('the edit tabs', () => {
  it('shows Definition, Parameters and Handler only, with no built-in notice', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    const strip = within(screen.getByRole('tablist', { name: 'Tool Fields' }));
    expect(strip.getAllByRole('tab').map((t) => t.getAttribute('aria-label'))).toEqual(['Definition', 'Parameters', 'Handler']);
    expect(screen.queryByText(/Built-in Tools keep their definition/)).toBeNull();
  });
});

describe('editor copy', () => {
  const status = () => screen.getByRole('status');
  const param = (name: string, patch: Partial<Tool['params'][number]> = {}): Tool['params'][number] =>
    ({ name, type: 'string', description: '', required: true, options: [], ...patch });

  it('says what the Description is for', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    expect(screen.getByText('Tells the AI what the Tool does and when to call it')).toBeInTheDocument();
  });

  it.each([
    ['Entities', 'Matches entity names and aliases, in any case'],
    ['Locations', 'Matches location names, in any case'],
    ['Dictionary Entries', 'Matches dictionary names and trigger keywords, in any case'],
  ])('shows one match hint for %s under the whole lookup row', async (label, hint) => {
    const user = userEvent.setup();
    await openEditor(user, [weather({ handler: { kind: 'lookup', source: 'entities', param: 'place', returns: 'full' } })]);
    await user.click(tab('Handler'));
    await user.click(screen.getByRole('combobox', { name: 'Search' }));
    await user.click(await screen.findByRole('option', { name: label }));
    expect(screen.getAllByText(hint)).toHaveLength(1);
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveAccessibleDescription(hint);
    // Under the grid, not inside a column: By Parameter carries no hint, so its label stays level with Search's.
    const byParameter = screen.getByRole('combobox', { name: 'By Parameter' });
    expect(screen.getByText(hint).closest('.grid')).not.toBe(byParameter.closest('.grid'));
    expect(byParameter).not.toHaveAccessibleDescription(hint);
  });

  it('names an unnamed parameter by its position', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.click(tab('Parameters'));
    await user.click(screen.getByRole('button', { name: 'Add Parameter' }));
    expect(status()).toHaveTextContent(/^Name parameter 2 \(Parameters\) to save$/);
  });

  it('joins one phrase per problem, in tab order', async () => {
    const user = userEvent.setup();
    await openEditor(user, [weather({
      name: 'bad name',
      params: [param('where'), param('where'), param('mood', { type: 'enum' })],
      handler: { kind: 'lookup', source: 'entities', param: 'who', returns: 'full' },
    })]);
    expect(status()).toHaveTextContent(
      /^Rename the Tool \(Definition\), rename parameter 1 \(Parameters\), rename parameter 2 \(Parameters\), add options to parameter 3 \(Parameters\), and pick the parameter to search by \(Handler\) to save$/,
    );
  });

  it('uses the Handler tab’s inline text for the lookup phrase', async () => {
    const user = userEvent.setup();
    await openEditor(user, [weather({ handler: { kind: 'lookup', source: 'entities', param: 'who', returns: 'full' } })]);
    await user.click(tab('Handler'));
    const inline = screen.getByRole('combobox', { name: 'By Parameter' });
    expect(inline).toHaveAccessibleDescription('Pick the parameter to search by');
    expect(status()).toHaveTextContent(/^Pick the parameter to search by \(Handler\) to save$/);
  });

  it('labels the boolean type True/False and keeps a saved boolean parameter unchanged', async () => {
    const user = userEvent.setup();
    const flag = param('loud', { type: 'boolean', required: false });
    await openEditor(user, [weather({ params: [flag], handler: { kind: 'template', body: 'Loud.' } })]);
    await user.click(tab('Parameters'));
    const type = within(screen.getByRole('group', { name: 'Parameter 1' })).getByRole('combobox', { name: 'Type' });
    expect(type).toHaveTextContent('True/False');
    await user.click(type);
    expect(await screen.findByRole('option', { name: 'True/False' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(saveButton());
    expect(saved()[0].params).toEqual([flag]);
  });
});

describe('the enabled bit', () => {
  it('has no Enabled checkbox in the editor, and saving an edit leaves the preset’s switch off', async () => {
    const user = userEvent.setup();
    await openEditor(user, [weather()]);
    for (const t of ['Definition', 'Parameters', 'Handler']) {
      await user.click(tab(t));
      expect(screen.queryByRole('checkbox', { name: 'Enabled' })).toBeNull();
    }
    await user.click(tab('Definition'));
    await user.type(nameInput(), '_x');
    await user.click(saveButton());
    expect(saved()[0]).toMatchObject({ name: 'get_weather_x' });
    expect(switchesOf('mine')).toEqual({});
  });
});

describe('the editor layout', () => {
  const grid = () => screen.getByTestId('tool-editor-grid');

  it('keeps the fixed Try It track when docked', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    expect(grid()).toHaveClass('lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]');
  });

  it('gives Try It one third of the width in full screen, with a 22rem floor', async () => {
    const user = userEvent.setup();
    await openEditor(user, [weather()], true);
    expect(grid()).toHaveClass('lg:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]');
    expect(grid()).not.toHaveClass('lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]');
  });
});

describe('name validation', () => {
  const other = weather({ id: 'u-dice', name: 'roll_dice' });

  it.each([
    ['a bad character', 'get weather', 'Use only letters, digits, _ and -, from 1 to 64 characters'],
    ['a name over 64 characters', 'x'.repeat(65), 'Use only letters, digits, _ and -, from 1 to 64 characters'],
    ['another Tool’s name', 'roll_dice', 'Another of your Tools uses this name'],
    ['a catalog name', 'get_entity', 'A built-in Tool uses this name'],
  ])('blocks Save on %s and says why', async (_, name, message) => {
    const user = userEvent.setup();
    await openEditor(user, [weather(), other]);
    await user.clear(nameInput());
    await user.type(nameInput(), name);
    expect(nameInput()).toHaveAccessibleDescription(message);
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Rename the Tool (Definition) to save');
  });

  it('takes a 64-character name', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.clear(nameInput());
    await user.type(nameInput(), 'x'.repeat(64));
    expect(nameInput()).toHaveAttribute('aria-invalid', 'false');
    expect(saveButton()).toBeEnabled();
  });
});

describe('Try It', () => {
  const tryIt = () => within(screen.getAllByRole('region', { name: 'Try It' })[0]);
  const result = () => screen.findByTestId('try-it-result');

  it('runs a saved Tool from the read view on the sample world, with highlighted JSON', async () => {
    const user = userEvent.setup();
    const lookup = weather({ params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
      handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'summary' } });
    render(<Harness initial={userStore([lookup])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(tryIt().getByText('Runs on a sample world')).toBeInTheDocument();
    await user.type(tryIt().getByRole('textbox', { name: 'name' }), 'wren');
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    const shown = await result();
    expect(shown).toHaveTextContent('"name": "Wren"');
    expect(shown).toHaveTextContent('The unhurried lamp-keeper.');
    await waitFor(() => expect(shown.querySelector('.tok-string')).not.toBeNull());
  });

  it('runs on the open world when one is given', async () => {
    const user = userEvent.setup();
    const world: AuthoredWorld = migrateWorld(structuredClone(rawWorld));
    const bram = world.entities.find((e) => e.id === 'ent-bram')!;
    const lookup = weather({ params: [{ name: 'name', type: 'string', description: '', required: true, options: [] }],
      handler: { kind: 'lookup', source: 'entities', param: 'name', returns: 'full' } });
    render(<Harness initial={userStore([lookup])} openWorld={() => buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? [])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    expect(tryIt().getByText('Runs on the world you have open')).toBeInTheDocument();
    await user.type(tryIt().getByRole('textbox', { name: 'name' }), bram.name);
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    expect(await result()).toHaveTextContent(`"id": "${bram.id}"`);
  });

  it('runs the unsaved draft beside the edit tabs', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.click(tab('Parameters'));
    await user.click(screen.getByRole('button', { name: 'Remove Parameter' }));
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    // The saved Tool would answer "Missing required parameter"; the draft has no parameter to miss.
    expect(await result()).toHaveTextContent('Sunny in {{arg:place}}.');
    expect(tryIt().queryByRole('alert')).toBeNull();
  });

  it('marks a result from before the last edit until the next run', async () => {
    const user = userEvent.setup();
    await openEditor(user);
    await user.type(tryIt().getByRole('textbox', { name: 'place' }), 'Sedge');
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    expect(await result()).toHaveTextContent('Sunny in Sedge.');
    expect(within(await result()).queryByRole('status')).toBeNull();

    await user.type(nameInput(), '_x');
    expect(within(await result()).getByRole('status')).toHaveTextContent('From before your last edit');
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(within(screen.getByTestId('try-it-result')).queryByRole('status')).toBeNull());
  });

  it('shows a missing argument as a readable message', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([weather()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    expect(await tryIt().findByRole('alert')).toHaveTextContent('Missing required parameter "place".');
  });

  it('shows a script error as a readable message', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([weather({ params: [], handler: { kind: 'script', code: 'return nobody.name;' } })])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    const alert = await tryIt().findByRole('alert', {}, { timeout: 5000 });
    expect(alert).toHaveTextContent(/^The script failed: .*nobody/);
    expect(alert.textContent).not.toContain('{');
  });

  it('shows what the AI receives, folded, with highlighting', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([weather()])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    const schema = screen.getByText('What the AI Receives').closest('details')!;
    expect(schema).not.toHaveAttribute('open');
    expect(schema).toHaveTextContent('"name": "get_weather"');
    expect(schema).toHaveTextContent('"required": [');
    await waitFor(() => expect(schema.querySelector('.tok-string')).not.toBeNull());
  });
});
