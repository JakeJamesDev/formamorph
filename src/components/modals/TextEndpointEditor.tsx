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
import { PresetNameDialog } from './PresetNameDialog';
import { SamplerControl, type SamplerControlProps } from './SamplerControl';
import type { TextEndpointSource } from './settingsSource';

const ADD_PRESET_SENTINEL = '__add_text_preset__';

const ENDPOINT_SAMPLERS = [
  ['endpointTemperature', 'temperature', 0, 2, 0.05],
  ['endpointRepetitionPenalty', 'repetitionPenalty', 1, 1.5, 0.02],
  ['endpointTopP', 'topP', 0, 1, 0.05],
  ['endpointTopK', 'topK', 0, 100, 1],
  ['endpointMinP', 'minP', 0, 0.5, 0.01],
] as const;

/**
 * The text-endpoint editor: the preset select with add, rename, delete and reset, then the active preset's
 * fields. It renders as siblings so the caller's flex column lays it out. The read-only built-ins are the
 * shared endpoint ("Default") and, on desktop, the bundled engine — a preset rather than a mode so a single
 * prompt can be routed to it. The select stays visible for every preset, including the engine, or there'd be
 * no way back.
 */
export function TextEndpointEditor({ source, advanced, onOpenConnectionGuide }: {
  source: TextEndpointSource;
  advanced: boolean;
  onOpenConnectionGuide: () => void;
}) {
  const {
    endpointUrl, setEndpointUrl, apiToken, setApiToken, modelName, setModelName,
    maxTokens, setMaxTokens, maxOutputOverrideEnabled, setMaxOutputOverrideEnabled,
    endpointSamplerOverrides, setEndpointSamplerEnabled, setEndpointSamplerValue,
    contextWindow, contextWindowOverride, setContextWindowOverride,
    detectedContextWindow, detectStatus, detectContextWindow,
    localModelActive, builtinTextEndpointPresets, textEndpointPresets,
    activeTextEndpointPresetId, activeTextEndpointPresetIsBuiltIn, activeTextEndpointPresetName,
    activeTextEndpointIsDemoAI,
    selectTextEndpointPreset, addTextEndpointPreset, renameTextEndpointPreset,
    deleteTextEndpointPreset, resetTextEndpointPreset,
  } = source;
  const builtIn = activeTextEndpointPresetIsBuiltIn;
  const sharedEndpointActive = builtIn && !localModelActive;

  const [presetDialog, setPresetDialog] = useState<{ mode: 'add' | 'rename' } | null>(null);
  const handlePresetSelect = (v: string) => {
    if (v === ADD_PRESET_SENTINEL) setPresetDialog({ mode: 'add' });
    else selectTextEndpointPreset(v);
  };
  const handlePresetNameSubmit = (name: string) => {
    if (presetDialog?.mode === 'add') addTextEndpointPreset(name);
    else if (presetDialog?.mode === 'rename') renameTextEndpointPreset(activeTextEndpointPresetId, name);
  };

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
        text: activeTextEndpointIsDemoAI
          ? "You're on the Demo AI. Add or pick a preset to set or detect the context window."
          : 'Add or pick a preset to set or detect the context window',
      }
    : contextOverLimit
    ? { red: true, text: `Above the detected limit (${detectedContextWindow?.toLocaleString()} tok) — the server may truncate requests.` }
    : detectStatus === 'error'
      ? { red: true, text: "Couldn't detect context length from this endpoint." }
      : detectStatus === 'detecting'
        ? { red: false, text: 'Detecting context length…' }
        : detectStatus === 'success'
          ? { red: false, text: `Detected ${(detectedContextWindow ?? contextWindow).toLocaleString()} tok from the endpoint.` }
          : { red: false, text: 'Auto-detected from your endpoint; lower it if the model feels constantly full.' };

  const samplerControls: SamplerControlProps[] = ENDPOINT_SAMPLERS.map(([id, key, min, max, step]) => {
    const copy = SETTINGS_COPY[id];
    return {
      id,
      label: copy.label,
      hint: copy.description ?? '',
      min,
      max,
      step,
      custom: endpointSamplerOverrides[key].enabled,
      value: endpointSamplerOverrides[key].value,
      defaultValue: undefined,
      onCustomChange: (enabled: boolean) => setEndpointSamplerEnabled(key, enabled),
      onValueChange: (value: number) => setEndpointSamplerValue(key, value),
    };
  });

  const readOnlyField = builtIn ? 'opacity-60 cursor-not-allowed' : undefined;

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0 pt-4">
        <span className="text-helper text-muted-foreground">{SETTINGS_COPY.textPreset.label}</span>
        {!builtIn && (
          <ConfirmDialog
            title="Delete Preset"
            description={`Delete the "${activeTextEndpointPresetName}" preset? This can't be undone.`}
            onConfirm={() => deleteTextEndpointPreset(activeTextEndpointPresetId)}
          >
            <Button variant="outline" size="sm">Delete</Button>
          </ConfirmDialog>
        )}
        {!builtIn && (
          <ConfirmDialog
            title="Reset Preset"
            description={`Reset the "${activeTextEndpointPresetName}" preset to its default values? This can't be undone.`}
            onConfirm={() => resetTextEndpointPreset(activeTextEndpointPresetId)}
          >
            <Button variant="outline" size="sm">Reset</Button>
          </ConfirmDialog>
        )}
        <Select value={activeTextEndpointPresetId} onValueChange={handlePresetSelect}>
          <SelectTrigger className="flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {builtinTextEndpointPresets.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
            {textEndpointPresets.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={ADD_PRESET_SENTINEL}>Add New Preset…</SelectItem>
          </SelectContent>
        </Select>
        {!builtIn && (
          <Button variant="outline" size="sm" onClick={() => setPresetDialog({ mode: 'rename' })}>Rename</Button>
        )}
      </div>
      <p className="flex-shrink-0 pt-1 text-helper text-muted-foreground">{SETTINGS_COPY.textPreset.description}</p>
      {/* The engine has no URL or token to edit — its runtime panel stands in for the field set. */}
      {localModelActive ? <LocalModelPanel /> : (
        <ScrollArea className="flex-1 min-h-0">
          <div className="grid gap-4 py-4">
            <Row top htmlFor="endpointUrl" {...rowCopy('endpointUrl')}>
              <div className="grid gap-1" data-row-stacked>
                <Input
                  id="endpointUrl"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  readOnly={builtIn}
                  className={readOnlyField}
                />
                {endpointUrlWasCompleted(endpointUrl) && (
                  <p className="text-helper text-muted-foreground">
                    Requests go to <span className="font-mono break-all">{normalizeEndpointUrl(endpointUrl)}</span>
                  </p>
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
                    className={builtIn ? 'flex-grow opacity-60 cursor-not-allowed' : 'flex-grow'}
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
                <div className={contextStatus.red ? 'text-helper text-destructive' : 'text-helper text-muted-foreground'}>
                  {contextStatus.text}
                </div>
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
                    <label htmlFor="maxTokensEnabled" className="text-label">Override endpoint limit</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      id="maxTokens"
                      type="number"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(numInput(e.target.value, 1))}
                      disabled={sharedEndpointActive || !maxOutputOverrideEnabled}
                    />
                    {!maxOutputOverrideEnabled && <span className="text-helper text-muted-foreground">No Limit</span>}
                  </div>
                </div>
              </Row>
              <Section title="Sampling">
                <p className="text-helper text-muted-foreground">
                  Per-prompt settings and built-in prompt values take priority over Temperature and Repetition Penalty. Leave a switch off to send no endpoint override.
                </p>
                <div className="grid gap-4 pt-3">
                  {samplerControls.map((control) => <SamplerControl key={control.id} {...control} />)}
                </div>
              </Section>
            </>)}
            <div className="flex justify-start">
              <ConfirmDialog
                {...SETTINGS_CONFIRMS.resetAiEndpoint}
                onConfirm={handleResetEndpoint}
              >
                <Button variant="outline" className="flex items-center gap-2" disabled={builtIn}>
                  {SETTINGS_BUTTONS.resetAiEndpoint}
                </Button>
              </ConfirmDialog>
            </div>
          </div>
        </ScrollArea>
      )}
      <PresetNameDialog
        open={presetDialog !== null}
        mode={presetDialog?.mode ?? 'add'}
        initialName={presetDialog?.mode === 'rename' ? activeTextEndpointPresetName : ''}
        onOpenChange={(o) => { if (!o) setPresetDialog(null); }}
        onSubmit={handlePresetNameSubmit}
      />
    </>
  );
}
