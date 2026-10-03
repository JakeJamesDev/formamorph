import 'fake-indexeddb/auto';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { defaultEndpointSamplerOverrides } from '@/lib/endpointSamplers';
import { helpSettingsOf, type HelpSettings, type HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import { BUILTIN_ENGINE_PRESET_ID, textEndpointPresetCodec } from '@/lib/textEndpointPresets';
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

/** The three selects of the tab, in order: Answer Endpoint, Pick Endpoint, the editor's preset. */
const selects = () => {
  const [answer, pick, editor] = screen.getAllByRole('combobox');
  return { answer, pick, editor };
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
    expect(selects().editor).toHaveTextContent('game');
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
    expect(selects().editor).toHaveTextContent('small');
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
      expect(selects().editor).toHaveTextContent('Built-In Engine');
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

  it('picks a preset to edit without a change to the active endpoint or a route', async () => {
    renderTab({ answerEndpoint: 'small' });
    await choose(selects().editor, 'big');
    expect(selects().editor).toHaveTextContent('big');
    expect(screen.getByLabelText(/Model/, { selector: 'input' })).toHaveValue('big-model');
    expect(app.activeTextEndpointPresetId).toBe('game');
    expect(help).toMatchObject({ answerEndpoint: 'small', pickEndpoint: helpSettingsOf().pickEndpoint });
  });

  it('adds a preset, opens it in the editor, and changes no route', async () => {
    renderTab({ answerEndpoint: 'small' });
    const user = userEvent.setup();
    await choose(selects().editor, 'Add New Preset…');
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Fresh');
    await user.click(within(dialog).getByRole('button', { name: /Add|Save|Create/ }));

    expect(selects().editor).toHaveTextContent('Fresh');
    const added = app.textEndpointPresets.find((p) => p.name === 'Fresh');
    expect(added).toBeDefined();
    expect(app.textEndpointValuesFor(added!.id).model).toBe('small-model');
    expect(app.activeTextEndpointPresetId).toBe('game');
    expect(help).toMatchObject({ answerEndpoint: 'small', pickEndpoint: helpSettingsOf().pickEndpoint });
  });
});
