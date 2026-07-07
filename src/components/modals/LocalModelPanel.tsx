import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

/** A label + control row matching the Endpoint tab's two-column grid. */
function Row({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-[1fr_3fr] items-start gap-4">
      <label htmlFor={htmlFor} className="text-right pt-1">{label}</label>
      <div className="space-y-1">
        {children}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/** A slider with its current value shown to the right. */
function ValueSlider({ id, value, onChange, min, max, step, format }: {
  id: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Slider id={id} className="flex-grow" value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      <span className="w-24 text-right text-sm tabular-nums">{format(value)}</span>
    </div>
  );
}

/** A checkbox row matching the settings tabs: right-anchored label + checkbox + secondary text beside it. */
function CheckRow({ label, htmlFor, checked, onChange, hint }: {
  label: string; htmlFor: string; checked: boolean; onChange: (v: boolean) => void; hint: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_3fr] items-start gap-4">
      <label htmlFor={htmlFor} className="text-right leading-4">{label}</label>
      <div className="flex items-start gap-2">
        <Checkbox id={htmlFor} checked={checked} onCheckedChange={(c) => onChange(c === true)} className="shrink-0" />
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

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

  // Save & Reload only matters when a model is loaded and a pending engine setting differs from what it was
  // loaded with (the engine reports its applied options in its state).
  const optionsDiffer = engine.status === 'ready' && (
    localContextSize !== engine.contextSize ||
    localGpuLayers !== engine.gpuLayers ||
    localFlashAttention !== engine.flashAttention
  );

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
      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto pb-4">
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

      {/* Pinned footer — a shrink-0 flex sibling outside the scroll area (no separator), matching the
          community browser's paginated footer pattern. */}
      <div className="flex shrink-0 items-center justify-between gap-2 pt-3">
        <Button type="button" variant="ghost" onClick={resetDefaults}>Reset to defaults</Button>
        <Button type="button" onClick={saveReload} disabled={!optionsDiffer || reloading || engine.status === 'loading'}>
          {reloading || engine.status === 'loading' ? 'Reloading…' : 'Save & Reload Model'}
        </Button>
      </div>

      <LocalModelModal open={showManager} onOpenChange={setShowManager} />
    </div>
  );
}
