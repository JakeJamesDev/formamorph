import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Row, ValueSlider, CheckRow } from '@/components/SettingsRows';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { useVramStats, resolveOwnVram } from '@/lib/useVramStats';
import { EngineStatusLine, GpuMemoryBox } from '@/components/LocalModelStatus';
import { setLocalLlmOptions } from '@/lib/imageGen/desktop';
import {
  LOCAL_GPU_LAYERS_MAX, GPU_LAYERS_AUTO, GPU_LAYERS_MAX, LOCAL_PARALLEL_REQUESTS_MAX, DEFAULT_MAX_TOKENS,
  DEFAULT_LOCAL_CONTEXT_SIZE, DEFAULT_LOCAL_GPU_LAYERS, DEFAULT_LOCAL_FLASH_ATTENTION, DEFAULT_LOCAL_PARALLEL_REQUESTS,
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
    maxTokens, setMaxTokens,
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

  // Whether the pending engine settings differ from what the current model was loaded with.
  const optionsDiffer =
    localContextSize !== engine.contextSize ||
    localGpuLayers !== engine.gpuLayers ||
    localFlashAttention !== engine.flashAttention ||
    localParallelRequests !== engine.parallelRequests;

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
      await setLocalLlmOptions({ contextSize: localContextSize, gpuLayers: localGpuLayers, flashAttention: localFlashAttention, parallelRequests: localParallelRequests });
    } finally {
      setReloading(false);
    }
  };

  const resetDefaults = () => {
    setLocalContextSize(DEFAULT_LOCAL_CONTEXT_SIZE);
    setLocalGpuLayers(DEFAULT_LOCAL_GPU_LAYERS);
    setLocalFlashAttention(DEFAULT_LOCAL_FLASH_ATTENTION);
    setLocalParallelRequests(DEFAULT_LOCAL_PARALLEL_REQUESTS);
    setMaxTokens(DEFAULT_MAX_TOKENS);
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
      <Tabs value={advancedMode ? 'advanced' : 'simple'} onValueChange={(v) => setAdvancedMode(v === 'advanced')} className="flex justify-center">
        <TabsList className="h-auto">
          <TabsTrigger value="simple" className="text-xs">Simple</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* GPU memory + engine status, shared with the model-manager popup. */}
      <GpuMemoryBox stats={vram} {...resolveOwnVram(vram, engine.engineVramMB)} />

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_3fr] sm:items-center gap-4">
        <label className="text-left sm:text-right">Local Model</label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setShowManager(true)}>Manage models…</Button>
          <EngineStatusLine engine={engine} />
        </div>
      </div>

      {/* Simple rows — always visible */}
      <Row label="Context Size" htmlFor="localContextSize" hint="How much the model keeps in context — also its VRAM cost. Capped at the loaded model's trained maximum. Applies on reload.">
        <ValueSlider id="localContextSize" value={Math.min(localContextSize, contextMax)} min={2048} max={contextMax} step={1024} onChange={setLocalContextSize} format={(v) => `${v.toLocaleString()} tok`} />
      </Row>

      {/* GPU: a simple on/off checkbox (on = Auto), or (in Advanced) an Auto/Max/Custom mode with a count slider. */}
      {advancedMode ? (
        <>
          <Row label="GPU Layers" htmlFor="localGpuMode" hint="How much of the model runs on the GPU. Auto fits as many layers as your VRAM allows; Max offloads the whole model (needed for large models / multi-GPU, can run out of VRAM); Custom pins an exact count. Applies on reload.">
            <Tabs value={gpuMode} onValueChange={setGpuMode}>
              <TabsList>
                <TabsTrigger value="auto">Auto</TabsTrigger>
                <TabsTrigger value="max">Max</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </Row>
          {gpuMode === 'custom' && (
            <Row label="Layers" htmlFor="localGpuLayers" hint="Number of model layers to offload. 0 = CPU-only. Applies on reload.">
              <ValueSlider id="localGpuLayers" value={localGpuLayers >= 0 ? localGpuLayers : LOCAL_GPU_LAYERS_MAX} min={0} max={LOCAL_GPU_LAYERS_MAX} step={1} onChange={setLocalGpuLayers} format={() => gpuLabel} />
            </Row>
          )}
        </>
      ) : (
        <CheckRow
          label="GPU"
          htmlFor="localGpuOn"
          checked={localGpuLayers !== 0}
          onChange={(v) => setLocalGpuLayers(v ? GPU_LAYERS_AUTO : 0)}
          hint="Run on the GPU (recommended). Off falls back to CPU-only — slower, works without a capable GPU. Applies on reload."
        />
      )}

      {/* Flash Attention groups with the reload settings above (all "apply on reload"). */}
      {advancedMode && (
        <CheckRow
          label="Flash Attention"
          htmlFor="localFlashAttention"
          checked={localFlashAttention}
          onChange={setLocalFlashAttention}
          hint="Less KV-cache VRAM and often faster. On by default; turn it off only if an older GPU/backend won't run it. Applies on reload."
        />
      )}

      {/* Parallel slots split the context (each gets ~context / slots), so the per-slot window is worth showing. */}
      {advancedMode && (
        <Row label="Parallel Requests" htmlFor="localParallelRequests" hint="How many requests the model answers at once. Higher speeds up each turn (choices, stats, and more fetch together) but splits the context between slots and uses more VRAM. Applies on reload.">
          <ValueSlider
            id="localParallelRequests"
            value={localParallelRequests}
            min={1}
            max={LOCAL_PARALLEL_REQUESTS_MAX}
            step={1}
            onChange={setLocalParallelRequests}
            format={(v) => (v === 1 ? '1 (off)' : `${v} · ~${Math.floor(localContextSize / v).toLocaleString()} tok/slot`)}
          />
        </Row>
      )}

      {/* TODO: re-enable the Thinking toggle once reasoning models are supported (see memory
          reasoning-model-support). Hidden for now — reasoning models are excluded from the catalog. */}

      {/* Sampling settings, grouped together (all "apply to the next turn"). */}
      <Row label="Temperature" htmlFor="genTemperature" hint="Higher = more random/creative, lower = more focused. Applies to the next turn.">
        <ValueSlider id="genTemperature" value={genTemperature} min={0} max={2} step={0.05} onChange={setGenTemperature} format={(v) => v.toFixed(2)} />
      </Row>

      <Row label="Max Output Tokens" htmlFor="maxTokens" hint="Cap on the model's reply length. Applies to the next turn.">
        <ValueSlider id="maxTokens" value={maxTokens} min={128} max={8192} step={128} onChange={setMaxTokens} format={(v) => `${v.toLocaleString()} tok`} />
      </Row>

      {advancedMode && (
        <>
          <Row label="Top-p" htmlFor="genTopP" hint="Nucleus sampling cutoff — lower trims unlikely words. Applies to the next turn.">
            <ValueSlider id="genTopP" value={genTopP} min={0} max={1} step={0.05} onChange={setGenTopP} format={(v) => v.toFixed(2)} />
          </Row>

          <Row label="Top-k" htmlFor="genTopK" hint="Limits sampling to the K most likely tokens. 0 = off. Applies to the next turn.">
            <ValueSlider id="genTopK" value={genTopK} min={0} max={100} step={1} onChange={setGenTopK} format={(v) => (v === 0 ? 'Off' : String(v))} />
          </Row>

          <Row label="Min-p" htmlFor="genMinP" hint="Drops tokens below this fraction of the top token's probability. 0 = off. Applies to the next turn.">
            <ValueSlider id="genMinP" value={genMinP} min={0} max={0.5} step={0.01} onChange={setGenMinP} format={(v) => (v === 0 ? 'Off' : v.toFixed(2))} />
          </Row>

          <Row label="Repetition Penalty" htmlFor="genRepetitionPenalty" hint="Above 1 discourages repeating text. Applies to the next turn.">
            <ValueSlider id="genRepetitionPenalty" value={genRepetitionPenalty} min={1} max={1.5} step={0.02} onChange={setGenRepetitionPenalty} format={(v) => v.toFixed(2)} />
          </Row>
        </>
      )}

      </div>
      </ScrollArea>

      {/* Pinned footer — a shrink-0 flex sibling outside the scroll area (no separator), matching the
          community browser's paginated footer pattern. */}
      <div className="flex shrink-0 flex-col gap-2 pt-3">
        {/* After a failed load, point at the settings that fix an out-of-VRAM error and enable the retry. */}
        {loadFailed && (
          <p className="text-xs text-muted-foreground">
            The model didn’t fit in VRAM at these settings. Lower <strong>Context Size</strong>
            {advancedMode ? <> or <strong>GPU Layers</strong></> : <> (or turn on <strong>Advanced</strong> to lower GPU Layers)</>},
            then reload.
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" onClick={resetDefaults}>Reset to defaults</Button>
          <Button type="button" onClick={saveReload} disabled={!canReload}>
            {reloading || engine.status === 'loading' ? 'Reloading…' : loadFailed ? 'Retry with these settings' : 'Save & Reload Model'}
          </Button>
        </div>
      </div>

      <LocalModelModal open={showManager} onOpenChange={setShowManager} />
    </div>
  );
}
