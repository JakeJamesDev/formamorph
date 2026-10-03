// The Formaquestion Tools and the gameplay Tools are two lists (ADR-0010): a Tool saved on one tab never
// reaches the other's store, on the device or in the providers.
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { HELP_ROLL } from '@/lib/formaquestion/helpRoll';
import { helpSettingsCodec } from '@/lib/formaquestion/helpSettings';
import { helpTool } from '@/test/helpFixtures';
import { ToolsTab } from './FormaquestionToolsTab';
import { useHelpSettings } from './useHelpSettings';

const FIND_PERSON = helpTool();
const WEATHER = helpTool({ id: 'g-1', name: 'get_weather', handler: { kind: 'template', body: 'Sunny.' }, params: [], offeredTo: ['narration'] });

let game: ReturnType<typeof useSettings>;
let help: ReturnType<typeof useHelpSettings>;
function Both() {
  game = useSettings();
  help = useHelpSettings();
  const [settings, change] = help;
  return <ToolsTab settings={settings} onChange={change} toolsSupported />;
}

const list = () => within(screen.getByRole('navigation', { name: 'Tools' }));
const listed = () => list().getAllByRole('button').filter((button) => !button.hasAttribute('aria-label')).map((button) => button.textContent);

afterEach(() => localStorage.clear());

describe('the two Tool lists', () => {
  it('keep a Formaquestion Tool out of the gameplay store, and a gameplay Tool off the Formaquestion tab', async () => {
    const user = userEvent.setup();
    render(<SettingsProvider><Both /></SettingsProvider>);
    act(() => game.saveTool(WEATHER));
    expect(game.userTools.map((t) => t.name)).toEqual([WEATHER.name]);
    expect(listed()).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name, 'New Tool']);

    const input = screen.getByTestId('tool-pack-input') as HTMLInputElement;
    const contents = JSON.stringify({ formamorphTools: 1, appVersion: '3.1.2', tools: [FIND_PERSON] });
    const file = new File([contents], 'tools.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
    await user.upload(input, file);
    await screen.findByRole('button', { name: FIND_PERSON.name });

    expect(listed()).toEqual([DOCS_LOOKUP.name, HELP_ROLL.name, FIND_PERSON.name, 'New Tool']);
    expect(help[0].tools.map((t) => t.name)).toEqual([FIND_PERSON.name]);
    expect(game.userTools.map((t) => t.name)).toEqual([WEATHER.name]);
    const stored = helpSettingsCodec.parse(localStorage.getItem('FORMAMORPH_helpSettings')!);
    expect(stored.tools.map((t) => t.name)).toEqual([FIND_PERSON.name]);
    expect(localStorage.getItem('FORMAMORPH_tools')).not.toContain(FIND_PERSON.name);
  });
});
