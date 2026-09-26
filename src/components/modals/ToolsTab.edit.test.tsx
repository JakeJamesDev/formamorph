import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import rawWorld from '../../../testing/baseline/sedge-landing.json';
import type { Tool } from '@/types';
import {
  activeCatalogTools, activeUserTools, deleteTool, isBuiltInActive, saveTool, setToolOverride,
  type PromptPresetStore, type PromptValues,
} from '@/lib/promptPresets';
import { migrateWorld } from '@/lib/version';
import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { buildToolSnapshot, type ToolSnapshot } from '@/lib/tools/toolSnapshot';
import { ToolsTab } from './ToolsTab';
import { EMPTY_TOOLS_VIEW, type ToolsView } from './toolsView';

vi.mock('react-toastify', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

/**
 * Edit mode and Try It, driven through the real preset-store operations and the real Tool Runner, so every
 * assertion reads the store the tab wrote or the result the runner returned.
 */

const weather = (patch: Partial<Tool> = {}): Tool => ({
  id: 'u-weather', name: 'get_weather', description: 'Purpose: weather.', params: [
    { name: 'place', type: 'string', description: 'Where.', required: true, options: [] },
  ],
  handler: { kind: 'template', body: 'Sunny in {{arg:place}}.' }, emptyResult: '{"matches": []}',
  offeredTo: ['narration'], enabled: true, ...patch,
});

const userStore = (tools: Tool[] = []): PromptPresetStore => ({
  activeId: 'mine', presets: [{ id: 'mine', name: 'Mine', values: {} as PromptValues, tools }],
});

let store: PromptPresetStore;

function Harness({ initial, openWorld }: { initial: PromptPresetStore; openWorld?: () => ToolSnapshot }) {
  const [s, setS] = useState(initial);
  const [view, setView] = useState<ToolsView>(EMPTY_TOOLS_VIEW);
  store = s;
  return (
    <ToolsTab
      catalogTools={activeCatalogTools(s)}
      userTools={activeUserTools(s)}
      builtinPreset={isBuiltInActive(s)}
      toolsSupported
      toolsEnabled
      onSaveTool={(t) => setS((prev) => saveTool(prev, t))}
      onDeleteTool={(id) => setS((prev) => deleteTool(prev, id))}
      onSetOverride={(id, o) => setS((prev) => setToolOverride(prev, id, o))}
      view={view}
      onViewChange={setView}
      presetSelector={<span>Preset</span>}
      fullscreen={false}
      onToggleFullscreen={() => {}}
      appVersion="9.9.9"
      openWorld={openWorld}
    />
  );
}

const saved = () => activeUserTools(store);
const list = () => within(screen.getByRole('navigation', { name: 'Tools' }));
const tab = (name: string) => screen.getByRole('tab', { name });
const saveButton = () => screen.getByRole('button', { name: 'Save Tool' });
const nameInput = () => within(screen.getByRole('tabpanel')).getAllByRole('textbox', { name: 'Name' })[0];

async function openEditor(user: ReturnType<typeof userEvent.setup>, tools: Tool[] = [weather()]) {
  render(<Harness initial={userStore(tools)} />);
  await user.click(list().getByRole('button', { name: tools[0].name }));
  await user.click(screen.getByRole('button', { name: 'Edit' }));
}

describe('creating a Tool', () => {
  it('saves a new lookup Tool built across the four tabs and selects it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore()} />);
    await user.click(list().getByRole('button', { name: 'New Tool' }));
    expect(screen.getByRole('tablist', { name: 'Tool Fields' })).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Check Definition and Handler to save');

    await user.type(nameInput(), 'find_person');
    await user.click(screen.getByRole('button', { name: 'Add Outline' }));

    await user.click(tab('Parameters'));
    await user.click(screen.getByRole('button', { name: 'Add Parameter' }));
    await user.type(within(screen.getByRole('group', { name: 'Parameter 1' })).getByRole('textbox', { name: 'Name' }), 'who');

    await user.click(tab('Handler'));
    await user.click(screen.getByRole('combobox', { name: 'By Parameter' }));
    await user.click(await screen.findByRole('option', { name: 'who' }));

    await user.click(tab('Availability'));
    await user.click(screen.getByRole('checkbox', { name: 'Choices' }));
    await user.type(screen.getByRole('textbox', { name: 'Calls per Request' }), '7');

    expect(saveButton()).toBeEnabled();
    await user.click(saveButton());

    const [made] = saved();
    expect(made).toMatchObject({
      name: 'find_person',
      description: 'Purpose: \nUse when: \nInput: \nOutput: ',
      params: [{ name: 'who', type: 'string', required: true }],
      handler: { kind: 'lookup', source: 'entities', param: 'who', returns: 'full' },
      offeredTo: ['narration', 'choices'],
      callLimit: 7,
      enabled: true,
    });
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

    await user.click(screen.getByRole('radio', { name: 'Lookup' }));
    await user.click(screen.getByRole('combobox', { name: 'Search' }));
    await user.click(await screen.findByRole('option', { name: 'Locations' }));
    await user.click(screen.getByRole('combobox', { name: 'Returns' }));
    await user.click(await screen.findByRole('option', { name: 'Summary' }));
    await user.click(saveButton());
    expect(saved()[0].handler).toEqual({ kind: 'lookup', source: 'locations', param: 'place', returns: 'summary' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(tab('Handler'));
    await user.click(screen.getByRole('radio', { name: 'Script' }));
    const readable = screen.getByLabelText('What the script can read');
    expect(within(readable).getAllByRole('term').map((t) => t.textContent)).toEqual(['args', 'world', 'scene', 'console']);
    expect(within(readable).getAllByRole('definition')[0]).toHaveTextContent('{ place }');
    expect(screen.getByRole('textbox', { name: 'Script' })).toBeInTheDocument();
    await user.click(saveButton());
    expect(saved()[0].handler).toEqual({ kind: 'script', code: '' });
  });

  it('writes the empty result, and a blank call limit falls back to the default', async () => {
    const user = userEvent.setup();
    await openEditor(user, [weather({ callLimit: 2 })]);
    await user.click(tab('Handler'));
    const empty = screen.getByRole('textbox', { name: 'Empty Result' });
    await user.clear(empty);
    fireEvent.change(empty, { target: { value: '{"none": true}' } });
    await user.click(tab('Availability'));
    await user.clear(screen.getByRole('textbox', { name: 'Calls per Request' }));
    await user.click(saveButton());
    expect(saved()[0].emptyResult).toBe('{"none": true}');
    expect(saved()[0]).not.toHaveProperty('callLimit');
  });
});

describe('name validation', () => {
  const other = weather({ id: 'u-dice', name: 'roll_dice' });

  it.each([
    ['a bad character', 'get weather', 'Use only letters, digits, _ and -, from 1 to 64 characters'],
    ['a name over 64 characters', 'x'.repeat(65), 'Use only letters, digits, _ and -, from 1 to 64 characters'],
    ['another Tool’s name', 'roll_dice', 'Another Tool in this preset uses this name'],
    ['a catalog name', 'get_entity', 'A built-in Tool uses this name'],
  ])('blocks Save on %s and says why', async (_, name, message) => {
    const user = userEvent.setup();
    await openEditor(user, [weather(), other]);
    await user.clear(nameInput());
    await user.type(nameInput(), name);
    expect(nameInput()).toHaveAccessibleDescription(message);
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Check Definition to save');
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
    expect(screen.queryByRole('alert')).toBeNull();
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
    expect(await screen.findByRole('alert')).toHaveTextContent('Missing required parameter "place".');
  });

  it('shows a script error as a readable message', async () => {
    const user = userEvent.setup();
    render(<Harness initial={userStore([weather({ params: [], handler: { kind: 'script', code: 'return nobody.name;' } })])} />);
    await user.click(list().getByRole('button', { name: 'get_weather' }));
    await user.click(tryIt().getByRole('button', { name: 'Run' }));
    const alert = await screen.findByRole('alert', {}, { timeout: 5000 });
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
