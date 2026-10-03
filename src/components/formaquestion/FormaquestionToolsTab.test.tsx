import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { DEFAULT_HELP_SETTINGS, HELP_LOOKUP_CALL_LIMIT_MAX, helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { ToolsTab } from './FormaquestionToolsTab';

let help: HelpSettings;

function Harness({ initial, toolsSupported }: { initial: HelpSettingsChange; toolsSupported: boolean }) {
  const [settings, setSettings] = useState(() => helpSettingsOf(initial));
  help = settings;
  return <ToolsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} toolsSupported={toolsSupported} />;
}

const renderTab = (initial: HelpSettingsChange = {}, toolsSupported = true) => render(<Harness initial={initial} toolsSupported={toolsSupported} />);

const list = () => within(screen.getByRole('navigation', { name: 'Tools' }));
const limitBox = () => screen.getByRole('textbox', { name: 'Max Calls per Request' });

describe('the Formaquestion Tools tab', () => {
  it('lists the guide lookup alone, with no preset, no Offered To and no My Tools', () => {
    renderTab();
    expect(list().getAllByRole('button').map((button) => button.textContent)).toEqual([DOCS_LOOKUP.name]);
    expect(screen.queryByText('My Tools')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Offered To')).toBeNull();
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
    const enabled = screen.getByRole('checkbox', { name: 'Enabled' });
    expect(enabled).not.toBeChecked();
    await user.click(enabled);
    expect(help.lookup).toBe(true);
    await user.click(enabled);
    expect(help.lookup).toBe(false);
  });

  it('sets Max Calls per Request, and a blank field is the default', async () => {
    const user = userEvent.setup();
    renderTab();
    expect(limitBox()).toHaveValue('');
    expect(limitBox()).toHaveAttribute('placeholder', String(DEFAULT_HELP_SETTINGS.lookupCallLimit));
    expect(limitBox()).toHaveAccessibleDescription(`Takes up to ${HELP_LOOKUP_CALL_LIMIT_MAX} calls. Leave blank for the default of ${DEFAULT_HELP_SETTINGS.lookupCallLimit}.`);
    await user.type(limitBox(), '5');
    expect(help.lookupCallLimit).toBe(5);
    expect(limitBox()).toHaveValue('5');
    await user.clear(limitBox());
    expect(help.lookupCallLimit).toBe(DEFAULT_HELP_SETTINGS.lookupCallLimit);
    await user.type(limitBox(), '99');
    expect(help.lookupCallLimit).toBe(HELP_LOOKUP_CALL_LIMIT_MAX);
  });

  it('offers no edit, copy or delete action on the guide lookup', () => {
    renderTab({ lookup: true });
    for (const name of ['Edit', 'Duplicate', 'Delete', 'New Tool', 'Import Tools', 'Export Tools']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  it('says so when the answer endpoint does not take function calls, and never names the Output switch', () => {
    const { unmount } = renderTab({ lookup: true }, false);
    expect(screen.getByRole('note')).toHaveTextContent("Answer Endpoint won't receive");
    expect(screen.getByRole('note')).not.toHaveTextContent('Output');
    unmount();
    renderTab({ lookup: true }, true);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
