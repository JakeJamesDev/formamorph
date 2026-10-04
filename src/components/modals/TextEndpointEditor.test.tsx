import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { DEFAULT_TEXT_ENDPOINT_VALUES, defaultPresetName, textEndpointPresetCodec } from '@/lib/textEndpointPresets';
import { useEndpointReachable } from '@/lib/useEndpointReachable';
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

vi.mock('@/lib/useEndpointReachable', () => ({ useEndpointReachable: vi.fn() }));

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
    vi.mocked(useEndpointReachable).mockReset().mockReturnValue({ status: 'ok', checking: false, recheck: vi.fn() });
    localStorage.setItem('FORMAMORPH_textEndpointPresets', textEndpointPresetCodec.serialize({
      activeId: 'llama',
      presets: [preset('llama', 'http://llama.test/v1'), preset('vllm', 'http://vllm.test/v1')],
    }));
  });
  afterEach(() => localStorage.clear());

  it('shows whether the edited preset answers, under the select', () => {
    vi.mocked(useEndpointReachable).mockReturnValue({ status: 'unreachable', checking: false, recheck: vi.fn() });
    render(<TextEndpointEditor model={modelOn('vllm')} advanced onOpenConnectionGuide={() => {}} />);
    const badge = screen.getByText("Didn't answer");
    expect(screen.getByRole('combobox').compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Recheck' })).toBeInTheDocument();
  });

  it('probes the URL the route fields probe, so both surfaces share one answer', () => {
    const model = modelOn('vllm');
    model.fields.endpointUrl = 'http://vllm.test';
    render(<TextEndpointEditor model={model} advanced onOpenConnectionGuide={() => {}} />);
    expect(useEndpointReachable).toHaveBeenLastCalledWith('http://vllm.test/v1/chat/completions', '', 'local', true, 'text');
  });

  it('shows no badge on the bundled engine preset', () => {
    const engine = modelOn('engine');
    engine.edited = { ...engine.edited, builtIn: true, engine: true };
    render(<TextEndpointEditor model={engine} advanced onOpenConnectionGuide={() => {}} />);
    expect(screen.queryByText('Reachable')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Recheck' })).toBeNull();
    expect(useEndpointReachable).not.toHaveBeenCalled();
  });

  it('probes a URL once typing stops, never a half-typed one', () => {
    vi.useFakeTimers();
    try {
      const typed = (url: string) => {
        const model = modelOn('vllm');
        model.fields.endpointUrl = url;
        return <TextEndpointEditor model={model} advanced onOpenConnectionGuide={() => {}} />;
      };
      const { rerender } = render(typed('http://l'));
      rerender(typed('http://lo'));
      rerender(typed('http://localhost:5000/v1'));
      act(() => { vi.advanceTimersByTime(700); });
      const probed = () => vi.mocked(useEndpointReachable).mock.calls.map(([url]) => url);
      expect(probed()).toEqual(Array(probed().length).fill('http://l/v1/chat/completions'));

      act(() => { vi.advanceTimersByTime(200); });
      expect(vi.mocked(useEndpointReachable).mock.lastCall?.[0]).toBe('http://localhost:5000/v1/chat/completions');
      expect(probed()).not.toContain('http://lo/v1/chat/completions');
    } finally {
      vi.useRealTimers();
    }
  });

  it('probes a newly selected preset at once', () => {
    const preset = (id: string) => {
      const model = modelOn(id);
      return <TextEndpointEditor model={model} advanced onOpenConnectionGuide={() => {}} />;
    };
    const { rerender } = render(preset('vllm'));
    rerender(preset('llama'));
    expect(vi.mocked(useEndpointReachable).mock.lastCall?.[0]).toBe('http://llama.test/v1/chat/completions');
  });

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

  it('duplicates the preset without a name dialog and selects the copy', async () => {
    renderEditor();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(screen.queryByPlaceholderText('Preset name')).toBeNull();
    expect(screen.getByRole('combobox')).toHaveTextContent('llama (copy)');
    expect(screen.getByLabelText(/Endpoint URL/)).toHaveValue('http://llama.test/v1');
  });

  it('resets and deletes through a confirm that names the preset', async () => {
    const model = modelOn('vllm');
    render(<TextEndpointEditor model={model} advanced onOpenConnectionGuide={() => {}} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    const reset = await screen.findByRole('alertdialog');
    expect(reset.textContent).toContain('Reset the "vllm" preset');
    expect(model.onReset).not.toHaveBeenCalled();
    await user.click(within(reset).getByRole('button', { name: 'Confirm' }));
    expect(model.onReset).toHaveBeenCalledWith('vllm');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Confirm' }));
    expect(model.onDelete).toHaveBeenCalledWith('vllm');
  });

  it('offers no Import or Export, and only Duplicate on a built-in preset', async () => {
    const { unmount } = render(<TextEndpointEditor model={modelOn('vllm')} advanced onOpenConnectionGuide={() => {}} />);
    expect(screen.queryByRole('button', { name: /Import|Export/ })).toBeNull();
    unmount();

    const builtIn = modelOn('default');
    builtIn.edited = { ...builtIn.edited, builtIn: true };
    render(<TextEndpointEditor model={builtIn} advanced onOpenConnectionGuide={() => {}} />);
    for (const name of ['Rename', 'Reset', 'Delete']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();
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
