import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, EMPTY_HELP_PRESET_STORE } from '@/lib/formaquestion/helpPresets';
import { helpSettingsOf, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { PromptsTab } from './FormaquestionPromptsTab';

function Harness({ initial }: { initial: HelpSettingsChange }) {
  const [settings, setSettings] = useState(() => helpSettingsOf(initial));
  return <PromptsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} />;
}

/** The tab on a custom preset, so the footer's Reset and Compare are on screen. */
const renderMine = () => render(<Harness initial={{ presets: duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'mine', 'Mine') }} />);

const promptsWindow = () => screen.getByRole('dialog', { name: 'Prompts' });
const rail = () => within(screen.getByRole('navigation', { name: 'Prompts' }));

describe('Formaquestion Prompts full screen', () => {
  it('lifts the header, the rail, the editor and the footer into the window', async () => {
    const user = userEvent.setup();
    renderMine();
    await user.click(screen.getByRole('button', { name: 'Edit full screen' }));

    const box = promptsWindow();
    expect(within(box).getByTestId('help-preset-header-row')).toBeInTheDocument();
    expect(within(box).getByRole('navigation', { name: 'Prompts' })).toBeInTheDocument();
    expect(within(box).getByRole('textbox', { name: 'Answer Prompt' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Reset Answer Prompt' })).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: 'Compare Answer Prompt' })).toBeInTheDocument();
    // Moved, not copied: one header on screen.
    expect(screen.getAllByTestId('help-preset-header-row')).toHaveLength(1);
  });

  it('names the window without a visible title row, and keeps the toggle as the way out', async () => {
    const user = userEvent.setup();
    renderMine();
    await user.click(screen.getByRole('button', { name: 'Edit full screen' }));

    expect(promptsWindow()).toHaveAccessibleName('Prompts');
    const heading = within(promptsWindow()).getByRole('heading', { name: 'Prompts' });
    expect(heading.closest('.sr-only')).not.toBeNull();
    expect(within(promptsWindow()).getByRole('button', { name: 'Exit full screen' })).toBeInTheDocument();
  });

  it('stays in full screen across the rail and returns focus to the toggle', async () => {
    const user = userEvent.setup();
    renderMine();
    await user.click(screen.getByRole('button', { name: 'Edit full screen' }));
    await user.click(rail().getByRole('button', { name: 'Search' }));

    expect(within(promptsWindow()).getByRole('textbox', { name: 'Search Prompt' })).toBeInTheDocument();
    await user.click(within(promptsWindow()).getByRole('button', { name: 'Exit full screen' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Prompts' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit full screen' })));
  });

  it('offers the exit toggle on an Options view and puts focus on its rail row', async () => {
    const user = userEvent.setup();
    renderMine();
    await user.click(screen.getByRole('button', { name: 'Edit full screen' }));
    await user.click(rail().getByRole('button', { name: 'Answer Options' }));

    await user.click(within(screen.getByTestId('help-answer-options')).getByRole('button', { name: 'Exit full screen' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Prompts' })).toBeNull());
    // Docked, the Options view has no toggle: the row that names it takes focus instead.
    expect(within(screen.getByTestId('help-answer-options')).queryByRole('button', { name: /full screen/ })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(rail().getByRole('button', { name: 'Answer Options' })));
  });
});
