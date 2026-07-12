import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Row, ValueSlider, CheckRow } from '@/components/SettingsRows';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { useVramStats } from '@/lib/useVramStats';
import { EngineStatusLine, GpuMemoryBox } from '@/components/LocalModelStatus';
import { setLocalLlmOptions } from '@/lib/imageGen/desktop';
import {
  LOCAL_GPU_LAYERS_MAX, DEFAULT_MAX_TOKENS,
  DEFAULT_LOCAL_CONTEXT_SIZE, DEFAULT_LOCAL_GPU_LAYERS, DEFAULT_LOCAL_FLASH_ATTENTION,
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

  const gpuLabel = localGpuLayers === 0 ? 'Off (CPU)' : localGpuLayers >= LOCAL_GPU_LAYERS_MAX ? 'All (GPU)' : `${localGpuLayers} layers`;

  // Whether the pending engine settings differ from what the current model was loaded with.
  const optionsDiffer =
    localContextSize !== engine.contextSize ||
    localGpuLayers !== engine.gpuLayers ||
    localFlashAttention !== engine.flashAttention;

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
      await setLocalLlmOptions({ contextSize: localContextSize, gpuLayers: localGpuLayers, flashAttention: localFlashAttention });
    } finally {
      setReloading(false);
    }
  };

  const resetDefaults = () => {
    setLocalContextSize(DEFAULT_LOCAL_CONTEXT_SIZE);
    setLocalGpuLayers(DEFAULT_LOCAL_GPU_LAYERS);
    setLocalFlashAttention(DEFAULT_LOCAL_FLASH_ATTENTION);
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
      <GpuMemoryBox stats={vram} />

      <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
        <label className="text-right">Local Model</label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setShowManager(true)}>Manage models…</Button>
          <EngineStatusLine engine={engine} />
        </div>
      </div>

      {/* Simple rows — always visible */}
      <Row label="Context Size" htmlFor="localContextSize" hint="How much the model keeps in context — also its VRAM cost. Applies on reload.">
        <ValueSlider id="localContextSize" value={localContextSize} min={2048} max={32768} step={1024} onChange={setLocalContextSize} format={(v) => `${v.toLocaleString()} tok`} />
      </Row>

      {/* GPU: a simple on/off checkbox, or (in Advanced) the full layer slider that replaces it — 0 = off. */}
      {advancedMode ? (
        <Row label="GPU Layers" htmlFor="localGpuLayers" hint="Layers to offload to the GPU. 0 = CPU-only, max = all. Lower it to partially offload a model that doesn’t fully fit VRAM. Applies on reload.">
          <ValueSlider id="localGpuLayers" value={localGpuLayers} min={0} max={LOCAL_GPU_LAYERS_MAX} step={1} onChange={setLocalGpuLayers} format={() => gpuLabel} />
        </Row>
      ) : (
        <CheckRow
          label="GPU"
          htmlFor="localGpuOn"
          checked={localGpuLayers > 0}
          onChange={(v) => setLocalGpuLayers(v ? LOCAL_GPU_LAYERS_MAX : 0)}
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
          hint="Less KV-cache VRAM and often faster. Off by default for broad compatibility; try it on. Applies on reload."
        />
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
