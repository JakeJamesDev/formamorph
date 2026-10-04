import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCS_LOOKUP } from '@/lib/formaquestion/docsLookup';
import { DEFAULT_HELP_PROMPTS } from '@/lib/formaquestion/helpPrompt';
import { activeHelpPreset, DEFAULT_HELP_PRESET_ID, duplicateHelpPreset, editHelpPrompt, EMPTY_HELP_PRESET_STORE } from '@/lib/formaquestion/helpPresets';
import { helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { helpTool } from '@/test/helpFixtures';
import { toastTexts } from '@/test/toastText';
import { PromptsTab } from './FormaquestionPromptsTab';

const toast = vi.hoisted(() => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock('react-toastify', () => ({ toast, ToastContainer: () => null }));
const download = vi.hoisted(() => vi.fn<(blob: Blob, filename: string) => void>());
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: download }));

let help: HelpSettings;

function Harness({ initial }: { initial: HelpSettingsChange }) {
  const [settings, setSettings] = useState(() => helpSettingsOf(initial));
  help = settings;
  return <PromptsTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} />;
}

/** A device with "Buddy" active, one Tool on, and lookup on at 6 calls. */
const buddy = (): HelpSettingsChange => ({
  presets: editHelpPrompt(duplicateHelpPreset(EMPTY_HELP_PRESET_STORE, DEFAULT_HELP_PRESET_ID, 'b', 'Buddy'), 'b', 'answer', 'Be a buddy.'),
  tools: [helpTool()],
  toolSwitches: { 'h-1': true },
  lookup: true,
  lookupCallLimit: 6,
});

/** Exports the active preset and returns the file text. */
async function exportText(): Promise<string> {
  await userEvent.setup().click(within(screen.getByTestId('help-preset-header-row')).getByRole('button', { name: 'Export' }));
  expect(download).toHaveBeenCalledTimes(1);
  const [blob, filename] = download.mock.calls[0];
  expect(filename).toBe('Buddy.help-preset.json');
  // jsdom's Blob lacks text(), so a FileReader reads it.
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });
}

/** Chooses `contents` in the import file picker. */
function importText(contents: string) {
  const file = new File([contents], 'preset.json', { type: 'application/json' });
  // jsdom's File lacks Blob.text(), which every browser has.
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(contents) });
  fireEvent.change(screen.getByTestId('help-preset-input'), { target: { files: [file] } });
}

beforeEach(() => {
  download.mockClear();
  Object.values(toast).forEach((f) => f.mockClear());
});

describe('the preset file on the Prompts tab', () => {
  it('exports the Default preset as a file that imports as a separate custom preset', async () => {
    const { unmount } = render(<Harness initial={{}} />);
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Export' }));
    const [blob, filename] = download.mock.calls[0];
    expect(filename).toBe('Default.help-preset.json');
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blob);
    });
    unmount();

    render(<Harness initial={{}} />);
    importText(text);
    await waitFor(() => expect(activeHelpPreset(help.presets).name).toBe('Default (2)'));
    expect(activeHelpPreset(help.presets).prompts).toEqual(DEFAULT_HELP_PROMPTS);
  });

  it('exports a custom preset and imports it on a clean profile', async () => {
    const { unmount } = render(<Harness initial={buddy()} />);
    const text = await exportText();
    unmount();

    render(<Harness initial={{}} />);
    importText(text);
    await waitFor(() => expect(activeHelpPreset(help.presets).name).toBe('Buddy'));
    expect(activeHelpPreset(help.presets).prompts.answer).toBe('Be a buddy.');
    expect(help.tools.map((t) => t.name)).toEqual(['find_person']);
    expect(help.toolSwitches[help.tools[0].id]).toBe(true);
    expect({ lookup: help.lookup, limit: help.lookupCallLimit }).toEqual({ lookup: true, limit: 6 });
    expect(screen.getByRole('combobox', { name: 'Preset' })).toHaveTextContent('Buddy');
    expect(toast.success).toHaveBeenCalledWith('Imported the “Buddy” preset');
  });

  it('names a skipped Tool, suffixes the preset and keeps what is stored', async () => {
    render(<Harness initial={buddy()} />);
    const text = await exportText();
    const before = help;
    importText(text);
    await waitFor(() => expect(activeHelpPreset(help.presets).name).toBe('Buddy (2)'));
    expect(help.presets.presets[0]).toEqual(before.presets.presets[0]);
    expect(help.tools).toEqual(before.tools);
    expect(toast.info).toHaveBeenCalledWith('Already in My Tools: find_person');
  });

  it('warns when the preset turns on a Script Tool it adds', async () => {
    render(<Harness initial={{ ...buddy(), tools: [helpTool({ handler: { kind: 'script', code: 'return 1;' } })] }} />);
    const text = await exportText();
    importText(text.replaceAll('find_person', 'find_other'));
    await waitFor(() => expect(help.tools).toHaveLength(2));
    expect(toast.warn).toHaveBeenCalledWith(expect.stringContaining('Script Tool'));
  });

  it('refuses a broken file and changes no preset, Tool or switch', async () => {
    render(<Harness initial={buddy()} />);
    const text = await exportText();
    const before = help;
    const broken = JSON.parse(text) as { functions: Record<string, unknown> };
    broken.functions[DOCS_LOOKUP.name] = { enabled: 'yes', maxCalls: 6 };
    importText(JSON.stringify(broken));
    await waitFor(() => expect(toastTexts(toast.error).join()).toContain(`functions.${DOCS_LOOKUP.name}.enabled`));
    expect(help).toBe(before);
  });
});
