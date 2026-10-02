import type { TextEndpointSource } from './settingsSource';

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
