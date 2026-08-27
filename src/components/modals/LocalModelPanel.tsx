import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Hint } from '@/components/ui/typography';
import { Row, ValueSlider, CheckRow, Section } from '@/components/SettingsRows';
import { SETTINGS_BUTTONS } from './settingsCopy';
import { rowCopy } from './settingsRowCopy';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { useVramStats, resolveOwnVram } from '@/lib/useVramStats';
import { EngineStatusLine, GpuMemoryBox } from '@/components/LocalModelStatus';
import { setLocalLlmOptions, listLocalGpuDevices, pinnedEngineDevice, type EngineDeviceList } from '@/lib/imageGen/desktop';
import {
  LOCAL_GPU_LAYERS_MAX, GPU_LAYERS_AUTO, GPU_LAYERS_MAX, LOCAL_PARALLEL_REQUESTS_MAX, DEFAULT_MAX_TOKENS,
  DEFAULT_LOCAL_CONTEXT_SIZE, DEFAULT_LOCAL_GPU_LAYERS, DEFAULT_LOCAL_FLASH_ATTENTION, DEFAULT_LOCAL_PARALLEL_REQUESTS,
  LOCAL_GPU_DEVICE_AUTO, LOCAL_GPU_DEVICE_ALL, DEFAULT_LOCAL_GPU_DEVICE,
  DEFAULT_GEN_TEMPERATURE, DEFAULT_GEN_TOP_P, DEFAULT_GEN_REPETITION_PENALTY, DEFAULT_GEN_TOP_K, DEFAULT_GEN_MIN_P,
} from '@/contexts/settingsDefaults';
import { LocalModelModal } from './LocalModelModal';

/**
 * The desktop Endpoint tab's local-model view (shown when a custom endpoint is off). Model management sits
 * on top; the Simple/Advanced toggle reveals the extra rows. Engine settings (context / GPU / flash)
 * apply via Save & Reload; sampling applies to the next turn. Reset restores safe defaults.
 */
export function LocalModelPanel() {
  const {
    localContextSize, setLocalContextSize,
    localGpuLayers, setLocalGpuLayers,
    localFlashAttention, setLocalFlashAttention,
    localParallelRequests, setLocalParallelRequests,
    localGpuDevice, setLocalGpuDevice,
    localMaxTokens, setLocalMaxTokens,
    genTemperature, setGenTemperature,
    genTopP, setGenTopP,
    genRepetitionPenalty, setGenRepetitionPenalty,
    genTopK, setGenTopK,
    genMinP, setGenMinP,
    advancedMode, setAdvancedMode,
  } = useSettings();
  const engine = useLocalLlmStatus();
  const [showManager, setShowManager] = useState(false);
  const [reloading, setReloading] = useState(false);
  const vram = useVramStats('', { enabled: true });
  const [gpuDevices, setGpuDevices] = useState<EngineDeviceList>({ backend: null, devices: [], autoPick: null });

  // Every GPU the engine could pin to. Asked for once: it costs a short-lived engine process when nothing
  // has enumerated yet, and the list only changes when drivers do.
  useEffect(() => {
    let active = true;
    listLocalGpuDevices().then((d) => { if (active) setGpuDevices(d); }).catch(() => { /* leave the row on its no-GPU state */ });
    return () => { active = false; };
  }, []);

  // A chosen device the current enumeration no longer has (an eGPU unplugged, a driver removed). It stays
  // on the list, marked, so the row reads as a stale choice rather than as a blank control.
  const deviceMissing = localGpuDevice !== LOCAL_GPU_DEVICE_AUTO && localGpuDevice !== LOCAL_GPU_DEVICE_ALL
    && !gpuDevices.devices.includes(localGpuDevice);

  // GPU Layers mode (Auto / Max / a fixed Custom count), derived from the sentinel-carrying setting.
  const gpuMode = localGpuLayers === GPU_LAYERS_AUTO ? 'auto' : localGpuLayers === GPU_LAYERS_MAX ? 'max' : 'custom';
  const setGpuMode = (mode: string) => {
    if (mode === 'auto') setLocalGpuLayers(GPU_LAYERS_AUTO);
    else if (mode === 'max') setLocalGpuLayers(GPU_LAYERS_MAX);
    else setLocalGpuLayers(localGpuLayers >= 0 ? localGpuLayers : LOCAL_GPU_LAYERS_MAX); // Custom keeps any prior count
  };
  const gpuLabel = localGpuLayers === 0 ? 'Off (CPU)' : `${localGpuLayers} layers`;

  // Cap Context Size at the loaded model's trained ceiling; a smaller model can make a persisted value invalid.
  const contextMax = engine.maxContextSize ?? 32768;
  useEffect(() => {
    if (engine.maxContextSize && localContextSize > engine.maxContextSize) setLocalContextSize(engine.maxContextSize);
  }, [engine.maxContextSize, localContextSize, setLocalContextSize]);

  // The engine reports the device it pinned, not the setting that asked for it — Auto and a fallback both
  // mean no manual pin is in force. A choice that no longer resolves has nothing to gain from a reload.
  const pinnedDevice = engine.gpuDeviceOrigin === 'manual' ? pinnedEngineDevice(engine) : null;
  const deviceDiffers = localGpuLayers === 0
    // GPU off hides the device row, so a device change must not arm a reload it cannot explain.
    ? false
    : localGpuDevice === LOCAL_GPU_DEVICE_AUTO
    ? pinnedDevice != null
    // All GPUs undoes any pin, whoever made it — so it differs whenever one is in force.
    : localGpuDevice === LOCAL_GPU_DEVICE_ALL
      ? engine.gpuDeviceIndex != null
      : !deviceMissing && pinnedDevice !== localGpuDevice;

  // Whether the pending engine settings differ from what the current model was loaded with.
  const optionsDiffer =
    localContextSize !== engine.contextSize ||
    localGpuLayers !== engine.gpuLayers ||
    localFlashAttention !== engine.flashAttention ||
    localParallelRequests !== engine.parallelRequests ||
    deviceDiffers;

  // When Save & Reload can act: a loaded model whose settings changed, OR a failed load — so a context/GPU
  // setting that overflowed VRAM can be lowered and retried (the error state otherwise trapped the user).
  const loadFailed = engine.status === 'error';
  const canReload =
    engine.status !== 'loading' &&
    !reloading &&
    ((engine.status === 'ready' && optionsDiffer) || loadFailed);

  const saveReload = async () => {
    setReloading(true);
    try {
      await setLocalLlmOptions({ contextSize: localContextSize, gpuLayers: localGpuLayers, flashAttention: localFlashAttention, parallelRequests: localParallelRequests, gpuDevice: localGpuDevice });
    } finally {
      setReloading(false);
    }
  };

  const resetDefaults = () => {
    setLocalContextSize(DEFAULT_LOCAL_CONTEXT_SIZE);
    setLocalGpuLayers(DEFAULT_LOCAL_GPU_LAYERS);
    setLocalFlashAttention(DEFAULT_LOCAL_FLASH_ATTENTION);
    setLocalParallelRequests(DEFAULT_LOCAL_PARALLEL_REQUESTS);
    setLocalGpuDevice(DEFAULT_LOCAL_GPU_DEVICE);
    setLocalMaxTokens(DEFAULT_MAX_TOKENS);
    setGenTemperature(DEFAULT_GEN_TEMPERATURE);
    setGenTopP(DEFAULT_GEN_TOP_P);
    setGenRepetitionPenalty(DEFAULT_GEN_REPETITION_PENALTY);
    setGenTopK(DEFAULT_GEN_TOP_K);
    setGenMinP(DEFAULT_GEN_MIN_P);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Settings scroll above a pinned footer — same shape as our other dialog footers. */}
      <ScrollArea className="min-h-0 flex-1">
      <div className="grid content-start gap-4 pb-4">
      {/* Detail-level toggle: Advanced reveals the extra rows below the always-visible simple ones. */}
      <div className="flex justify-center">
        <ToggleGroup
          type="single"
          value={advancedMode ? 'advanced' : 'simple'}
          // A single ToggleGroup clears its value when the active item is clicked again; one of the two
          // detail levels is always in force, so an empty result is ignored rather than applied.
          onValueChange={(v) => { if (v) setAdvancedMode(v === 'advanced'); }}
          className="h-auto"
        >
          <ToggleGroupItem value="simple" className="text-meta">Simple</ToggleGroupItem>
          <ToggleGroupItem value="advanced" className="text-meta">Advanced</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* GPU memory + engine status, shared with the model-manager popup. */}
      <GpuMemoryBox stats={vram} engine={engine} {...resolveOwnVram(vram, engine.engineVramMB)} />

      <Row {...rowCopy('localModel')}>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setShowManager(true)}>{SETTINGS_BUTTONS.manageModels}</Button>
          <EngineStatusLine engine={engine} />
        </div>
      </Row>

      {/* When a change takes effect is a property of the whole group, not of any one row, so it belongs
          on the section header rather than at the end of every description. */}
      <Section title="Engine" hint="Sampling changes apply to the next turn; the rest need a reload.">
      {/* Simple rows — always visible */}
      <Row htmlFor="localContextSize" {...rowCopy('localContextSize')}>
        <ValueSlider id="localContextSize" value={Math.min(localContextSize, contextMax)} min={2048} max={contextMax} step={1024} onChange={setLocalContextSize} format={(v) => `${v.toLocaleString()} tok`} />
      </Row>

      {/* GPU: a simple on/off checkbox (on = Auto), or (in Advanced) an Auto/Max/Custom mode with a count slider. */}
      {advancedMode ? (
        <>
          <Row htmlFor="localGpuMode" {...rowCopy('localGpuLayers')}>
            <ToggleGroup
              type="single"
              value={gpuMode}
              // A single ToggleGroup clears its value when the active item is clicked again; a GPU mode is
              // always set, so an empty result is ignored rather than stored.
              onValueChange={(v) => { if (v) setGpuMode(v); }}
            >
              <ToggleGroupItem value="auto">Auto</ToggleGroupItem>
              <ToggleGroupItem value="max">Max</ToggleGroupItem>
              <ToggleGroupItem value="custom">Custom</ToggleGroupItem>
            </ToggleGroup>
          </Row>
          {gpuMode === 'custom' && (
            <Row htmlFor="localGpuLayers" {...rowCopy('localLayers')}>
              <ValueSlider id="localGpuLayers" value={localGpuLayers >= 0 ? localGpuLayers : LOCAL_GPU_LAYERS_MAX} min={0} max={LOCAL_GPU_LAYERS_MAX} step={1} onChange={setLocalGpuLayers} format={() => gpuLabel} />
            </Row>
          )}
        </>
      ) : (
        <CheckRow
          htmlFor="localGpuOn"
          checked={localGpuLayers !== 0}
          onChange={(v) => setLocalGpuLayers(v ? GPU_LAYERS_AUTO : 0)}
          {...rowCopy('localGpu')}
        />
      )}

      {/* Which GPU the engine loads onto. Visible in Simple too: on a machine with a discrete card beside
          an integrated one, this is the row that decides whether any model loads at all. Hidden while GPU
          is off (zero layers) — the whole model runs on the CPU then, so a device choice changes nothing. */}
      {localGpuLayers !== 0 && (
      <Row htmlFor="localGpuDevice" {...rowCopy('localGpuDevice')}>
        {gpuDevices.devices.length === 0 && !deviceMissing ? (
          // A 'cpu' backend answered and found nothing; a null one never answered at all. Saying "no GPU"
          // for the second would be a claim about the machine we haven't earned.
          <Hint>
            {gpuDevices.backend === null
              ? 'The engine couldn’t list your graphics cards.'
              : 'No GPU available — models run on the CPU.'}
          </Hint>
        ) : (
          <Select value={localGpuDevice} onValueChange={setLocalGpuDevice}>
            <SelectTrigger id="localGpuDevice"><SelectValue /></SelectTrigger>
            <SelectContent>
              {/* Auto names its result, so "which one?" is answered without a reload: the policy's pick,
                  the only card there is, or every card when it declines to choose between real ones. */}
              <SelectItem value={LOCAL_GPU_DEVICE_AUTO}>
                {gpuDevices.autoPick ? `Auto (${gpuDevices.autoPick})`
                  : gpuDevices.devices.length === 1 ? `Auto (${gpuDevices.devices[0]})`
                  : gpuDevices.devices.length > 1 ? 'Auto (All GPUs)'
                  : 'Auto'}
              </SelectItem>
              <SelectItem value={LOCAL_GPU_DEVICE_ALL}>All GPUs</SelectItem>
              {gpuDevices.devices.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              {deviceMissing && <SelectItem value={localGpuDevice}>{localGpuDevice} (not found)</SelectItem>}
            </SelectContent>
          </Select>
        )}
      </Row>
      )}

      {/* Flash Attention groups with the reload settings above (all "apply on reload"). */}
      {advancedMode && (
        <CheckRow
          htmlFor="localFlashAttention"
          checked={localFlashAttention}
          onChange={setLocalFlashAttention}
          {...rowCopy('localFlashAttention')}
        />
      )}

      {/* Parallel slots split the context (each gets ~context / slots), so the per-slot window is worth showing. */}
      {advancedMode && (
        <Row htmlFor="localParallelRequests" {...rowCopy('localParallelRequests')}>
          <ValueSlider
            id="localParallelRequests"
            value={localParallelRequests}
            min={1}
            max={LOCAL_PARALLEL_REQUESTS_MAX}
            step={1}
            onChange={setLocalParallelRequests}
            format={(v) => (v === 1 ? '1 (off)' : `${v} · ~${Math.floor(localContextSize / v).toLocaleString()} tok each`)}
          />
        </Row>
      )}

      {/* Sampling settings, grouped together (all "apply to the next turn"). */}
      <Row htmlFor="genTemperature" {...rowCopy('localTemperature')}>
        <ValueSlider id="genTemperature" value={genTemperature} min={0} max={2} step={0.05} onChange={setGenTemperature} format={(v) => v.toFixed(2)} />
      </Row>

      <Row htmlFor="maxTokens" {...rowCopy('localMaxTokens')}>
        <ValueSlider id="maxTokens" value={localMaxTokens} min={128} max={8192} step={128} onChange={setLocalMaxTokens} format={(v) => `${v.toLocaleString()} tok`} />
      </Row>

      {advancedMode && (
        <>
          <Row htmlFor="genTopP" {...rowCopy('localTopP')}>
            <ValueSlider id="genTopP" value={genTopP} min={0} max={1} step={0.05} onChange={setGenTopP} format={(v) => v.toFixed(2)} />
          </Row>

          <Row htmlFor="genTopK" {...rowCopy('localTopK')}>
            <ValueSlider id="genTopK" value={genTopK} min={0} max={100} step={1} onChange={setGenTopK} format={(v) => (v === 0 ? 'Off' : String(v))} />
          </Row>

          <Row htmlFor="genMinP" {...rowCopy('localMinP')}>
            <ValueSlider id="genMinP" value={genMinP} min={0} max={0.5} step={0.01} onChange={setGenMinP} format={(v) => (v === 0 ? 'Off' : v.toFixed(2))} />
          </Row>

          <Row htmlFor="genRepetitionPenalty" {...rowCopy('localRepetitionPenalty')}>
            <ValueSlider id="genRepetitionPenalty" value={genRepetitionPenalty} min={1} max={1.5} step={0.02} onChange={setGenRepetitionPenalty} format={(v) => v.toFixed(2)} />
          </Row>
        </>
      )}
      </Section>

      </div>
      </ScrollArea>

      {/* Pinned footer — a shrink-0 flex sibling outside the scroll area (no separator), matching the
          community browser's paginated footer pattern. */}
      <div className="flex shrink-0 flex-col gap-2 pt-3">
        {/* After a failed load, point at the settings that fix an out-of-VRAM error and enable the retry. */}
        {loadFailed && (
          <p className="text-helper text-muted-foreground">
            The model didn’t fit in VRAM at these settings. Lower <strong>Context Size</strong>
            {advancedMode ? <> or <strong>GPU Layers</strong></> : <> (or turn on <strong>Advanced</strong> to lower GPU Layers)</>},
            then reload.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={resetDefaults}>{SETTINGS_BUTTONS.resetToDefaults}</Button>
          <Button type="button" onClick={saveReload} disabled={!canReload}>
            {reloading || engine.status === 'loading'
              ? 'Reloading…'
              : loadFailed ? SETTINGS_BUTTONS.retryWithSettings : SETTINGS_BUTTONS.saveReloadModel}
          </Button>
        </div>
      </div>

      <LocalModelModal open={showManager} onOpenChange={setShowManager} />
    </div>
  );
}
