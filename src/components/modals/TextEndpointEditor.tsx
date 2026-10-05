import { useState } from 'react';
import { DEFAULT_ENDPOINT, DEFAULT_API_TOKEN, DEFAULT_MODEL_NAME, DEFAULT_MAX_TOKENS } from '@/contexts/settingsDefaults';
import { Row, Section } from '@/components/SettingsRows';
import { SETTINGS_COPY, SETTINGS_BUTTONS, SETTINGS_CONFIRMS } from '@/components/modals/settingsCopy';
import { rowCopy } from '@/components/modals/settingsRowCopy';
import { LocalModelPanel } from '@/components/modals/LocalModelPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from '@/components/ui/select';
import { normalizeEndpointUrl, endpointUrlWasCompleted } from '@/lib/endpointUrl';
import { numInput } from '@/lib/numInput';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { cn } from '@/lib/utils';
import { Hint, FieldError } from '@/components/ui/typography';
import { PresetHeader } from '@/components/presetHeader/PresetHeader';
import { presetHeaderActions } from '@/lib/presetHeaderActions';
import { EndpointReachabilityBadge } from './EndpointReachabilityBadge';
import { PresetNameDialog } from './PresetNameDialog';
import { SamplerControl, type SamplerControlProps } from './SamplerControl';
import type { TextEndpointEditorModel } from './textEndpointEditorModel';

const ADD_PRESET_SENTINEL = '__add_text_preset__';

const ENDPOINT_SAMPLERS = [
  { id: 'endpointTemperature', key: 'temperature', min: 0, max: 2, step: 0.05 },
  { id: 'endpointRepetitionPenalty', key: 'repetitionPenalty', min: 1, max: 1.5, step: 0.02 },
  { id: 'endpointTopP', key: 'topP', min: 0, max: 1, step: 0.05 },
  { id: 'endpointTopK', key: 'topK', min: 0, max: 100, step: 1 },
  { id: 'endpointMinP', key: 'minP', min: 0, max: 0.5, step: 0.01 },
] as const;

/** Waits for typing to stop so a half-typed URL or token is never probed. The caller keys it by preset, so a switch probes at once. */
const PROBE_DEBOUNCE_MS = 800;

/** The badge of the edited preset. It probes the normalized URL the route fields probe, so both share one cached answer. */
function EditedPresetBadge({ url, apiToken, model }: { url: string; apiToken: string; model: string }) {
  const target = {
    url: useDebouncedValue(normalizeEndpointUrl(url), PROBE_DEBOUNCE_MS),
    apiToken: useDebouncedValue(apiToken, PROBE_DEBOUNCE_MS),
    model: useDebouncedValue(model, PROBE_DEBOUNCE_MS),
    enabled: true,
  };
  return <EndpointReachabilityBadge target={target} />;
}

/**
 * The text-endpoint editor: the shared preset header (duplicate, rename, reset, delete), then the edited
 * preset's fields. It renders as siblings so the caller's flex column lays it out. The read-only built-ins are
 * the shared endpoint ("Default") and, on desktop, the bundled engine — a preset rather than a mode so a single
 * prompt can be routed to it. The select stays visible for every preset, including the engine, or there'd be
 * no way back. A `heading` swaps the select for a title.
 */
export function TextEndpointEditor({ model, advanced, onOpenConnectionGuide, presetDescription = SETTINGS_COPY.textPreset.description, heading }: {
  model: TextEndpointEditorModel;
  advanced: boolean;
  onOpenConnectionGuide: () => void;
  /** The help line under the preset select or heading. */
  presetDescription?: string;
  /** Replaces the preset select with a title, for a caller that picks the preset itself. */
  heading?: string;
}) {
  const { presets, edited, fields, edit, onSelect, onAdd, onRename, onDelete, onReset } = model;
  const {
    endpointUrl, apiToken, modelName, maxTokens, maxOutputOverrideEnabled, samplerOverrides,
    contextWindow, contextWindowOverride, detectedContextWindow, detectStatus,
  } = fields;
  const {
    setEndpointUrl, setApiToken, setModelName, setMaxTokens, setMaxOutputOverrideEnabled,
    setContextWindowOverride, detectContextWindow, setSamplerEnabled, setSamplerValue,
  } = edit;
  const builtIn = edited.builtIn;
  const sharedEndpointActive = builtIn && !edited.engine;

  const [presetDialog, setPresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const handlePresetSelect = (v: string) => {
    if (v === ADD_PRESET_SENTINEL) setPresetDialog({ mode: 'add' });
    else onSelect(v);
  };
  const handlePresetNameSubmit = (name: string) => {
    if (presetDialog?.mode === 'add') onAdd(name);
    else if (presetDialog?.mode === 'rename') onRename(edited.id, name);
  };

  // A copy needs no name dialog. The model's `onAdd` clones the edited preset and moves the caller to the copy.
  const presetActions = presetHeaderActions(builtIn, {
    duplicate: () => onAdd(`${edited.name} (copy)`),
    rename: () => setPresetDialog({ mode: 'rename' }),
    reset: {
      run: () => onReset(edited.id),
      description: `Reset the "${edited.name}" preset to its default values? This can't be undone.`,
    },
    delete: {
      run: () => onDelete(edited.id),
      description: `Delete the "${edited.name}" preset? This can't be undone.`,
    },
  });

  const handleResetEndpoint = () => {
    setEndpointUrl(DEFAULT_ENDPOINT);
    setModelName(DEFAULT_MODEL_NAME);
    setApiToken(DEFAULT_API_TOKEN);
    setContextWindowOverride(null);
    setMaxTokens(DEFAULT_MAX_TOKENS);
  };

  // Single status line under the Context Window field: red for over-limit or a failed manual detect,
  // gray for detecting / detected / the idle helper.
  const contextOverLimit =
    contextWindowOverride != null && detectedContextWindow != null && contextWindowOverride > detectedContextWindow;
  const contextStatus = builtIn
    ? {
        red: false,
        text: edited.demoAI
          ? "You're on the Demo AI. Add or pick a preset to set or detect the context window."
          : 'Add or pick a preset to set or detect the context window',
      }
    : contextOverLimit
    ? { red: true, text: `Above the detected limit of ${detectedContextWindow?.toLocaleString()} tok. The server may truncate requests.` }
    : detectStatus === 'error'
      ? { red: true, text: "Couldn't detect the context length from this endpoint" }
      : detectStatus === 'detecting'
        ? { red: false, text: 'Detecting context length…' }
        : detectStatus === 'success'
          ? { red: false, text: `Detected ${(detectedContextWindow ?? contextWindow).toLocaleString()} tok from the endpoint` }
          : { red: false, text: 'Auto-detected from your endpoint. Lower it if the context is often full.' };

  const samplerControls: SamplerControlProps[] = ENDPOINT_SAMPLERS.map(({ id, key, min, max, step }) => {
    const copy = SETTINGS_COPY[id];
    return {
      id,
      label: copy.label,
      hint: copy.description ?? '',
      min,
      max,
      step,
      custom: samplerOverrides[key].enabled,
      value: samplerOverrides[key].value,
      defaultValue: undefined,
      onCustomChange: (enabled: boolean) => setSamplerEnabled(key, enabled),
      onValueChange: (value: number) => setSamplerValue(key, value),
    };
  });

  const readOnlyField = builtIn ? 'opacity-60 cursor-not-allowed' : undefined;

  return (
    <>
      <div className="flex-shrink-0 pt-4">
        <PresetHeader
          actions={presetActions}
          {...(heading === undefined
            ? {
                label: SETTINGS_COPY.textPreset.label,
                select: (
                  <Select value={edited.id} onValueChange={handlePresetSelect}>
                    <SelectTrigger
                      aria-label={SETTINGS_COPY.textPreset.label}
                      className="flex-1 min-w-0"
                      {...targetAttribute('settingsEndpoints.text', 'text-preset')}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.builtIn.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                      {presets.user.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
                    </SelectContent>
                  </Select>
                ),
              }
            : { heading })}
        />
      </div>
      {/* The engine has no URL to probe. */}
      {!edited.engine && (
        <div className="flex-shrink-0 pt-1">
          <EditedPresetBadge key={edited.id} url={endpointUrl} apiToken={apiToken} model={modelName} />
        </div>
      )}
      <Hint className="flex-shrink-0 pt-1">{presetDescription}</Hint>
      {/* The engine has no URL or token to edit — its runtime panel stands in for the field set. */}
      {edited.engine ? <LocalModelPanel /> : (
        <ScrollArea landingRoom className="flex-1 min-h-0">
          <div className="grid gap-4 py-4">
            <Row top htmlFor="endpointUrl" target={targetAttribute('settingsEndpoints.text', 'endpoint-url')} {...rowCopy('endpointUrl')}>
              <div className="grid gap-1" data-row-stacked>
                <Input
                  id="endpointUrl"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  readOnly={builtIn}
                  className={readOnlyField}
                />
                {endpointUrlWasCompleted(endpointUrl) && (
                  <Hint>
                    Requests go to <span className="font-mono break-all">{normalizeEndpointUrl(endpointUrl)}</span>
                  </Hint>
                )}
              </div>
            </Row>
            <Row>
              <button
                type="button"
                className="justify-self-start text-helper text-muted-foreground underline hover:text-foreground"
                onClick={onOpenConnectionGuide}
              >
                {SETTINGS_BUTTONS.troubleConnecting}
              </button>
            </Row>
            <Row htmlFor="apiToken" {...rowCopy('apiToken')}>
              <Input
                id="apiToken"
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                readOnly={builtIn}
                className={readOnlyField}
              />
            </Row>
            <Row htmlFor="modelName" {...rowCopy('modelName')}>
              <Input
                id="modelName"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                readOnly={builtIn}
                className={readOnlyField}
              />
            </Row>
            {advanced && (<>
              <Row htmlFor="contextWindow" {...rowCopy('contextWindow')}>
                <div className="flex items-start gap-2">
                  <Input
                    id="contextWindow"
                    type="number"
                    className={cn('flex-grow', readOnlyField)}
                    value={contextWindow}
                    onChange={(e) => setContextWindowOverride(e.target.value === '' ? null : Number(e.target.value))}
                    readOnly={builtIn}
                  />
                  <Button
                    variant="outline"
                    onClick={() => detectContextWindow(true)}
                    disabled={builtIn || detectStatus === 'detecting'}
                  >
                    Detect
                  </Button>
                </div>
              </Row>
              <Row>
                {contextStatus.red ? <FieldError>{contextStatus.text}</FieldError> : <Hint>{contextStatus.text}</Hint>}
              </Row>
              <Row htmlFor="maxTokens" {...rowCopy('maxOutputTokens')}>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="maxTokensEnabled"
                      checked={maxOutputOverrideEnabled}
                      disabled={sharedEndpointActive}
                      onCheckedChange={(checked) => setMaxOutputOverrideEnabled(checked === true)}
                    />
                    <label htmlFor="maxTokensEnabled" className="text-label">Override Endpoint Limit</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      id="maxTokens"
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(numInput(e.target.value, 1))}
                      disabled={sharedEndpointActive || !maxOutputOverrideEnabled}
                    />
                    {!maxOutputOverrideEnabled && <Hint as="span">No Limit</Hint>}
                  </div>
                </div>
              </Row>
              <Section title="Sampling">
                <Hint>
                  Your per-prompt settings and built-in prompt values take priority over “Temperature” and “Repetition Penalty”. Leave a checkbox unchecked to send no override.
                </Hint>
                <div className="grid gap-4 pt-3">
                  {samplerControls.map((control) => <SamplerControl key={control.id} {...control} />)}
                </div>
              </Section>
            </>)}
          </div>
        </ScrollArea>
      )}
      {!edited.engine && (
        <div className="flex flex-wrap justify-start items-center gap-2 flex-shrink-0 pt-4">
          <ConfirmDialog
            {...SETTINGS_CONFIRMS.resetAiEndpoint}
            onConfirm={handleResetEndpoint}
          >
            <Button variant="outline" className="flex items-center gap-2" disabled={builtIn}>
              {SETTINGS_BUTTONS.resetAiEndpoint}
            </Button>
          </ConfirmDialog>
        </div>
      )}
      <PresetNameDialog
        open={presetDialog !== null}
        mode={presetDialog?.mode ?? 'add'}
        initialName={presetDialog?.mode === 'rename' ? edited.name : ''}
        onOpenChange={(o) => { if (!o) setPresetDialog(null); }}
        onSubmit={handlePresetNameSubmit}
      />
    </>
  );
}
