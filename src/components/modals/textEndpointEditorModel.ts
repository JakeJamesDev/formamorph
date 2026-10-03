import { DEFAULT_CONTEXT_WINDOW } from '@/contexts/settingsDefaults';
import type { EndpointSampler, EndpointSamplerOverride } from '@/lib/endpointSamplers';
import { BUILTIN_ENGINE_PRESET_ID, isDemoAI, type TextEndpointValues } from '@/lib/textEndpointPresets';
import type { PresetEditorSource, TextEndpointSource } from './settingsSource';

type S = TextEndpointSource;

/** The preset the editor shows and edits, which need not be the active one. */
export interface EditedTextPreset {
  id: string;
  name: string;
  builtIn: boolean;
  /** The built-in Default on the hosted Demo AI. */
  demoAI: boolean;
  /** The bundled engine, whose runtime panel stands in for the fields. */
  engine: boolean;
}

/** What the text-endpoint editor reads and calls. The caller decides which preset it edits. */
export interface TextEndpointEditorModel {
  presets: { builtIn: readonly { id: string; name: string }[]; user: readonly { id: string; name: string }[] };
  edited: EditedTextPreset;
  fields: Pick<S,
    | 'endpointUrl' | 'apiToken' | 'modelName' | 'maxTokens' | 'maxOutputOverrideEnabled'
    | 'contextWindow' | 'contextWindowOverride' | 'detectedContextWindow' | 'detectStatus'
  > & { samplerOverrides: S['endpointSamplerOverrides'] };
  edit: Pick<S,
    | 'setEndpointUrl' | 'setApiToken' | 'setModelName' | 'setMaxTokens' | 'setMaxOutputOverrideEnabled'
    | 'setContextWindowOverride' | 'detectContextWindow'
  > & { setSamplerEnabled: S['setEndpointSamplerEnabled']; setSamplerValue: S['setEndpointSamplerValue'] };
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}

/** The editor on the active preset, as Settings → AI Endpoints uses it: a pick changes the active endpoint. */
export function activePresetEditor(s: TextEndpointSource): TextEndpointEditorModel {
  return {
    presets: { builtIn: s.builtinTextEndpointPresets, user: s.textEndpointPresets },
    edited: {
      id: s.activeTextEndpointPresetId,
      name: s.activeTextEndpointPresetName,
      builtIn: s.activeTextEndpointPresetIsBuiltIn,
      demoAI: s.activeTextEndpointIsDemoAI,
      engine: s.localModelActive,
    },
    fields: {
      endpointUrl: s.endpointUrl,
      apiToken: s.apiToken,
      modelName: s.modelName,
      maxTokens: s.maxTokens,
      maxOutputOverrideEnabled: s.maxOutputOverrideEnabled,
      contextWindow: s.contextWindow,
      contextWindowOverride: s.contextWindowOverride,
      detectedContextWindow: s.detectedContextWindow,
      detectStatus: s.detectStatus,
      samplerOverrides: s.endpointSamplerOverrides,
    },
    edit: {
      setEndpointUrl: s.setEndpointUrl,
      setApiToken: s.setApiToken,
      setModelName: s.setModelName,
      setMaxTokens: s.setMaxTokens,
      setMaxOutputOverrideEnabled: s.setMaxOutputOverrideEnabled,
      setContextWindowOverride: s.setContextWindowOverride,
      detectContextWindow: s.detectContextWindow,
      setSamplerEnabled: s.setEndpointSamplerEnabled,
      setSamplerValue: s.setEndpointSamplerValue,
    },
    onSelect: s.selectTextEndpointPreset,
    onAdd: s.addTextEndpointPreset,
    onRename: s.renameTextEndpointPreset,
    onDelete: s.deleteTextEndpointPreset,
    onReset: s.resetTextEndpointPreset,
  };
}

/** What the caller of a by-id editor owns: which preset shows, and the context-window check of it. */
export interface PresetEditorView {
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  detectStatus: TextEndpointEditorModel['fields']['detectStatus'];
  detectContextWindow: (force?: boolean) => Promise<void>;
}

/**
 * The editor on the preset `id` names, which need not be the active one. Its select and its Add change only
 * what the caller shows. The active preset reads the Settings editor's own fields, so both show the same.
 */
export function presetEditor(s: PresetEditorSource, id: string, view: PresetEditorView): TextEndpointEditorModel {
  const { onSelect, onAdd } = view;
  if (id === s.activeTextEndpointPresetId) return { ...activePresetEditor(s), onSelect, onAdd };

  const values = s.textEndpointValuesFor(id);
  const builtIn = s.builtinTextEndpointPresets.some((p) => p.id === id);
  const name = [...s.builtinTextEndpointPresets, ...s.textEndpointPresets].find((p) => p.id === id)?.name ?? id;
  const detected = s.detectedContextWindowFor(id);
  const edit = (change: (current: TextEndpointValues) => Partial<TextEndpointValues>) => s.editTextEndpointPreset(id, change);
  const editSampler = (sampler: EndpointSampler, patch: Partial<EndpointSamplerOverride>) => edit((current) => ({
    samplerOverrides: { ...current.samplerOverrides, [sampler]: { ...current.samplerOverrides[sampler], ...patch } },
  }));
  return {
    presets: { builtIn: s.builtinTextEndpointPresets, user: s.textEndpointPresets },
    edited: { id, name, builtIn, demoAI: isDemoAI({ endpointId: id, endpoint: values.endpoint }), engine: id === BUILTIN_ENGINE_PRESET_ID },
    fields: {
      endpointUrl: values.endpoint,
      apiToken: values.apiToken,
      modelName: values.model,
      maxTokens: values.maxOutputOverride.value,
      maxOutputOverrideEnabled: values.maxOutputOverride.enabled,
      contextWindow: builtIn ? DEFAULT_CONTEXT_WINDOW : values.contextWindowOverride ?? detected ?? DEFAULT_CONTEXT_WINDOW,
      contextWindowOverride: values.contextWindowOverride,
      detectedContextWindow: detected,
      detectStatus: view.detectStatus,
      samplerOverrides: values.samplerOverrides,
    },
    edit: {
      setEndpointUrl: (endpoint) => edit(() => ({ endpoint })),
      setApiToken: (apiToken) => edit(() => ({ apiToken })),
      setModelName: (model) => edit(() => ({ model })),
      setMaxTokens: (value) => edit((current) => ({ maxOutputOverride: { ...current.maxOutputOverride, value } })),
      setMaxOutputOverrideEnabled: (enabled) => edit((current) => ({ maxOutputOverride: { ...current.maxOutputOverride, enabled } })),
      setContextWindowOverride: (contextWindowOverride) => edit(() => ({ contextWindowOverride })),
      detectContextWindow: view.detectContextWindow,
      setSamplerEnabled: (sampler, enabled) => editSampler(sampler, { enabled }),
      setSamplerValue: (sampler, value) => editSampler(sampler, { value }),
    },
    onSelect,
    onAdd,
    onRename: s.renameTextEndpointPreset,
    onDelete: s.deleteTextEndpointPreset,
    onReset: s.resetTextEndpointPreset,
  };
}
