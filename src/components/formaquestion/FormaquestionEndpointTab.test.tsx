import 'fake-indexeddb/auto';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { BUILTIN_ENGINE_PRESET_ID, DEFAULT_TEXT_PRESET_ID, defaultPresetName, textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { sentenceShapeViolation } from '@/test/copyShape';
import { EndpointTab } from './FormaquestionEndpointTab';
import { ENDPOINT_COPY } from './formaquestionSettingsTabs';

vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  detectReasoningCapability: vi.fn().mockResolvedValue(null),
  resolveReasoningCapability: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/contextLength', async () => ({
  ...await vi.importActual<typeof import('@/lib/contextLength')>('@/lib/contextLength'),
  fetchContextLength: () => Promise.resolve(null),
}));
// The engine panel talks to Electron IPC. The marker shows which panel the editor chose.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => <div data-testid="local-model-panel" /> }));
vi.mock('@/lib/useEndpointReachable', () => ({ useEndpointReachable: () => ({ status: 'ok', checking: false, recheck: () => {} }) }));

const preset = (id: string) => ({
  id, name: id,
  values: { endpoint: `http://${id}.test/v1`, apiToken: '', model: `${id}-model`, contextWindowOverride: null, maxOutputOverride: { enabled: false, value: 1000 }, samplerOverrides: defaultEndpointSamplerOverrides() },
});

let app: ReturnType<typeof useSettings>;
let help: HelpSettings;

function Harness({ initial }: { initial: HelpSettingsChange }) {
  app = useSettings();
  const [settings, setSettings] = useState(() => helpSettingsOf(initial));
  help = settings;
  return <EndpointTab settings={settings} onChange={(change) => setSettings((current) => helpSettingsOf(change, current))} />;
}

const renderTab = (initial: HelpSettingsChange = {}) => render(<SettingsProvider><Harness initial={initial} /></SettingsProvider>);

/** The two selects of the tab, in order: Answer Endpoint, Search Endpoint. */
const selects = () => {
  const [answer, pick] = screen.getAllByRole('combobox');
  return { answer, pick };
};

async function choose(select: HTMLElement, option: string) {
  const user = userEvent.setup();
  await user.click(select);
  await user.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('FORMAMORPH_engineIsPresetMigrated', '1');
  localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({ activeId: 'game', presets: ['game', 'small', 'big'].map(preset) }));
});

describe('the Endpoint tab', () => {
  it('shows the defaults: Use Active Endpoint for answers, Same as Answer for picks', () => {
    renderTab();
    expect(selects().answer).toHaveTextContent('Use Active Endpoint (game)');
    expect(selects().pick).toHaveTextContent('Same as Answer (game)');
  });

  it('sets each route from its own select', async () => {
    renderTab();
    await choose(selects().answer, 'big');
    await choose(selects().pick, 'small');
    expect(help).toMatchObject({ answerEndpoint: 'big', pickEndpoint: 'small' });
    await choose(selects().pick, 'Use Active Endpoint (game)');
    expect(help.pickEndpoint).toBeNull();
    expect(app.activeTextEndpointPresetId).toBe('game');
  });

  it('shows a deleted preset as the default of its route', () => {
    renderTab({ answerEndpoint: 'deleted', pickEndpoint: 'deleted' });
    expect(selects().answer).toHaveTextContent('Use Active Endpoint (game)');
    expect(selects().pick).toHaveTextContent('Same as Answer (game)');
  });

  it('starts the editor on the preset answers go to, and edits that preset alone', async () => {
    renderTab({ answerEndpoint: 'small' });
    expect(screen.getByRole('heading', { name: 'Edit small' })).toBeInTheDocument();
    const field = screen.getByLabelText(/Model/, { selector: 'input' });
    await userEvent.setup().type(field, '-q4');
    expect(app.textEndpointValuesFor('small').model).toBe('small-model-q4');
    expect(app.modelName).toBe('game-model');
    expect(app.activeTextEndpointPresetId).toBe('game');
  });

  it('shows an edit of the active preset in the Settings fields', async () => {
    renderTab();
    await userEvent.setup().type(screen.getByLabelText(/Model/, { selector: 'input' }), '-v2');
    expect(app.modelName).toBe('game-model-v2');
  });

  it('shows an edit made in Settings', () => {
    renderTab();
    act(() => app.setModelName('game-model-v3'));
    expect(screen.getByLabelText(/Model/, { selector: 'input' })).toHaveValue('game-model-v3');
  });

  it('edits the Built-In Engine with the local model panel, as Settings does', () => {
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    try {
      renderTab({ answerEndpoint: BUILTIN_ENGINE_PRESET_ID });
      expect(screen.getByRole('heading', { name: 'Edit Built-In Engine' })).toBeInTheDocument();
      expect(screen.getByTestId('local-model-panel')).toBeInTheDocument();
      expect(screen.queryByLabelText(/Endpoint URL/)).toBeNull();
    } finally {
      delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop;
    }
  });

  it('writes each description as one short line', () => {
    for (const line of [ENDPOINT_COPY.answer.description, ENDPOINT_COPY.pick.description, ENDPOINT_COPY.presetHint]) {
      expect(sentenceShapeViolation(line), line).toBeNull();
      expect(line.split(/\s+/).length, line).toBeLessThanOrEqual(12);
    }
  });

  it('has no preset select: Answer and Pick are the only two', () => {
    renderTab();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('puts Answer and Pick in one row', () => {
    renderTab();
    const { answer, pick } = selects();
    const row = answer.closest('.grid');
    expect(row).toBe(pick.closest('.grid'));
    expect(row).toHaveClass('sm:grid-cols-2');
  });

  it('keeps Pick on Same as Answer through a Duplicate', async () => {
    renderTab({ answerEndpoint: 'small' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(selects().pick).toHaveTextContent('Same as Answer (small (copy))');
  });

  it('follows Answer in the heading and the fields', async () => {
    renderTab({ answerEndpoint: 'small' });
    expect(screen.getByRole('heading', { name: 'Edit small' })).toBeInTheDocument();
    await choose(selects().answer, 'big');
    expect(screen.getByRole('heading', { name: 'Edit big' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Model/, { selector: 'input' })).toHaveValue('big-model');
    expect(app.activeTextEndpointPresetId).toBe('game');
  });

  it('names the active preset in the heading while Answer follows it', () => {
    renderTab();
    expect(screen.getByRole('heading', { name: 'Edit game (Active Endpoint)' })).toBeInTheDocument();
  });

  it('duplicates the Answer preset, moves Answer to the copy, and the editor follows', async () => {
    renderTab({ answerEndpoint: 'small' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Duplicate' }));
    const added = app.textEndpointPresets.find((p) => p.name === 'small (copy)');
    expect(added).toBeDefined();
    expect(app.textEndpointValuesFor(added!.id).model).toBe('small-model');
    expect(help.answerEndpoint).toBe(added!.id);
    expect(screen.getByRole('heading', { name: 'Edit small (copy)' })).toBeInTheDocument();
    expect(selects().answer).toHaveTextContent('small (copy)');
    expect(app.activeTextEndpointPresetId).toBe('game');
  });

  it('duplicates the active preset when Answer follows it', async () => {
    renderTab();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Duplicate' }));
    const added = app.textEndpointPresets.find((p) => p.name === 'game (copy)');
    expect(app.textEndpointValuesFor(added!.id).model).toBe('game-model');
    expect(help.answerEndpoint).toBe(added!.id);
  });

  it('shows the heading with the preset icons, and no Import or Export', () => {
    renderTab({ answerEndpoint: 'small' });
    const header = screen.getByRole('heading', { name: 'Edit small' }).parentElement!;
    const names = Array.from(header.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Delete', 'Reset', 'Duplicate', 'Rename', 'Preset Actions']);
  });

  it('shows whether the edited preset answers, under the heading', () => {
    // Both routes follow the active endpoint here, so the one badge on screen is the editor's.
    renderTab();
    const badge = screen.getByText('Reachable');
    const heading = screen.getByRole('heading', { name: 'Edit game (Active Endpoint)' });
    expect(heading.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no badge on the Built-In Engine', () => {
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    try {
      renderTab({ answerEndpoint: BUILTIN_ENGINE_PRESET_ID });
      // One badge only: the Answer route's own.
      expect(screen.getAllByText('Reachable')).toHaveLength(1);
    } finally {
      delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop;
    }
  });

  it('offers only Duplicate on the Built-In Engine', () => {
    (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop = {};
    try {
      renderTab({ answerEndpoint: BUILTIN_ENGINE_PRESET_ID });
      const header = screen.getByRole('heading', { name: 'Edit Built-In Engine' }).parentElement!;
      const names = Array.from(header.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
      expect(names).toEqual(['Duplicate', 'Preset Actions']);
    } finally {
      delete (window as unknown as { formamorphDesktop?: unknown }).formamorphDesktop;
    }
  });

  it('renames the Answer preset from the header', async () => {
    renderTab({ answerEndpoint: 'small' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), '2');
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));
    expect(screen.getByRole('heading', { name: 'Edit small2' })).toBeInTheDocument();
    expect(help.answerEndpoint).toBe('small');
  });

  it('offers only Duplicate on a built-in preset', async () => {
    renderTab({ answerEndpoint: DEFAULT_TEXT_PRESET_ID });
    const header = screen.getByRole('heading', { name: `Edit ${defaultPresetName()}` }).parentElement!;
    const names = Array.from(header.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual(['Duplicate', 'Preset Actions']);
  });

  it('moves Answer to Use Active Endpoint when its preset is deleted', async () => {
    renderTab({ answerEndpoint: 'small' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(help.answerEndpoint).toBeNull();
    expect(app.textEndpointPresets.some((p) => p.id === 'small')).toBe(false);
    expect(screen.getByRole('heading', { name: 'Edit game (Active Endpoint)' })).toBeInTheDocument();
  });
});
