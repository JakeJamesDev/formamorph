import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { DEFAULT_TEXT_ENDPOINT_VALUES, defaultPresetName, textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { TextEndpointEditor } from './TextEndpointEditor';
import { activePresetEditor, type TextEndpointEditorModel } from './textEndpointEditorModel';

// The bundled-engine panel talks to Electron IPC; these cases never select the engine.
vi.mock('@/components/modals/LocalModelPanel', () => ({ LocalModelPanel: () => null }));
vi.mock('@/lib/reasoningEffort', async () => ({
  ...await vi.importActual<typeof import('@/lib/reasoningEffort')>('@/lib/reasoningEffort'),
  detectReasoningCapability: vi.fn().mockResolvedValue(null),
  resolveReasoningCapability: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/contextLength', async () => ({
  ...await vi.importActual<typeof import('@/lib/contextLength')>('@/lib/contextLength'),
  fetchContextLength: () => Promise.resolve(null),
}));

const preset = (id: string, endpoint: string) => ({ id, name: id, values: { ...DEFAULT_TEXT_ENDPOINT_VALUES, endpoint } });

function Editor({ onOpenConnectionGuide = () => {} }: { onOpenConnectionGuide?: () => void }) {
  return <TextEndpointEditor model={activePresetEditor(useSettings())} advanced onOpenConnectionGuide={onOpenConnectionGuide} />;
}

/** A model on a preset that no settings context knows as active. */
function modelOn(id: string): TextEndpointEditorModel {
  return {
    presets: { builtIn: [{ id: 'default', name: 'Default' }], user: [{ id: 'llama', name: 'llama' }, { id: 'vllm', name: 'vllm' }] },
    edited: { id, name: id, builtIn: false, demoAI: false, engine: false },
    fields: {
      endpointUrl: `http://${id}.test/v1`, apiToken: '', modelName: 'local', maxTokens: 512, maxOutputOverrideEnabled: false,
      contextWindow: 8192, contextWindowOverride: null, detectedContextWindow: null, detectStatus: 'idle',
      samplerOverrides: DEFAULT_TEXT_ENDPOINT_VALUES.samplerOverrides,
    },
    edit: {
      setEndpointUrl: vi.fn(), setApiToken: vi.fn(), setModelName: vi.fn(), setMaxTokens: vi.fn(),
      setMaxOutputOverrideEnabled: vi.fn(), setContextWindowOverride: vi.fn(), detectContextWindow: vi.fn(),
      setSamplerEnabled: vi.fn(), setSamplerValue: vi.fn(),
    },
    onSelect: vi.fn(), onAdd: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onReset: vi.fn(),
  };
}

const renderEditor = (onOpenConnectionGuide?: () => void) =>
  render(<SettingsProvider><Editor onOpenConnectionGuide={onOpenConnectionGuide} /></SettingsProvider>);

describe('TextEndpointEditor', () => {
  beforeEach(() => {
    localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({
      activeId: 'llama',
      presets: [preset('llama', 'http://llama.test/v1'), preset('vllm', 'http://vllm.test/v1')],
    }));
  });
  afterEach(() => localStorage.clear());

  it('selects a preset and shows its fields', async () => {
    renderEditor();
    const user = userEvent.setup();
    expect(screen.getByLabelText(/Endpoint URL/)).toHaveValue('http://llama.test/v1');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'vllm' }));
    expect(screen.getByLabelText(/Endpoint URL/)).toHaveValue('http://vllm.test/v1');
    expect(screen.getByLabelText(/Endpoint URL/)).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
  });

  it('locks the fields on a built-in preset', async () => {
    renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: defaultPresetName() }));
    expect(screen.getByLabelText(/Endpoint URL/)).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
  });

  it('adds a preset from the select and makes it active', async () => {
    renderEditor();
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Add New Preset…' }));
    await user.type(await screen.findByPlaceholderText('Preset name'), 'Kobold');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('combobox')).toHaveTextContent('Kobold');
  });

  it('edits the preset its model names, through its handlers only', async () => {
    const model = modelOn('vllm');
    render(<TextEndpointEditor model={model} advanced onOpenConnectionGuide={() => {}} />);
    const user = userEvent.setup();
    expect(screen.getByRole('combobox')).toHaveTextContent('vllm');
    expect(screen.getByLabelText(/Endpoint URL/)).toHaveValue('http://vllm.test/v1');

    await user.type(screen.getByLabelText(/Model Name/), 'x');
    expect(model.edit.setModelName).toHaveBeenLastCalledWith('localx');

    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await user.type(await screen.findByPlaceholderText('Preset name'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(model.onRename).toHaveBeenCalledWith('vllm', 'vllm2');

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'llama' }));
    expect(model.onSelect).toHaveBeenCalledWith('llama');
  });

  it('keeps Reset AI Endpoint in the footer, outside the scrolled fields', () => {
    renderEditor();
    const reset = screen.getByRole('button', { name: 'Reset AI Endpoint' });
    expect(reset.closest('[data-radix-scroll-area-viewport]')).toBeNull();
    expect(screen.getByLabelText(/Endpoint URL/).closest('[data-radix-scroll-area-viewport]')).not.toBeNull();
  });

  it('opens the connection guide through its handler', async () => {
    const onOpen = vi.fn();
    renderEditor(onOpen);
    await userEvent.setup().click(screen.getByRole('button', { name: /trouble connecting/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
});
