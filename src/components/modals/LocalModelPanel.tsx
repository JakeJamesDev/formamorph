import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalLlmStatus } from '@/lib/useLocalLlmStatus';
import { setLocalLlmOptions } from '@/lib/imageGen/desktop';
import {
  LOCAL_GPU_LAYERS_MAX,
  DEFAULT_LOCAL_CONTEXT_SIZE, DEFAULT_LOCAL_GPU_LAYERS, DEFAULT_LOCAL_FLASH_ATTENTION,
  DEFAULT_GEN_TEMPERATURE, DEFAULT_GEN_TOP_P, DEFAULT_GEN_REPETITION_PENALTY,
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
    genTemperature, setGenTemperature,
    genTopP, setGenTopP,
    genRepetitionPenalty, setGenRepetitionPenalty,
    disableThinking, setDisableThinking,
    advancedMode, setAdvancedMode,
  } = useSettings();
  const engine = useLocalLlmStatus();
  const [showManager, setShowManager] = useState(false);
  const [reloading, setReloading] = useState(false);

  const engineText =
    engine.status === 'ready' ? `Loaded: ${engine.modelId}`
    : engine.status === 'loading' ? `Loading ${engine.modelId}…`
    : engine.status === 'error' ? `Error: ${engine.error}`
    : 'No model loaded';

  const gpuLabel = localGpuLayers === 0 ? 'Off (CPU)' : localGpuLayers >= LOCAL_GPU_LAYERS_MAX ? 'All (GPU)' : `${localGpuLayers} layers`;

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
    setGenTemperature(DEFAULT_GEN_TEMPERATURE);
    setGenTopP(DEFAULT_GEN_TOP_P);
    setGenRepetitionPenalty(DEFAULT_GEN_REPETITION_PENALTY);
  };

  return (
    <>
      <div className="grid grid-cols-[1fr_3fr] items-center gap-4">
        <label className="text-right">Local Model</label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setShowManager(true)}>Manage models…</Button>
          <span className={`text-xs ${engine.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{engineText}</span>
        </div>
      </div>

      {/* Detail-level toggle: Advanced reveals the extra rows below the always-visible simple ones. */}
      <Tabs value={advancedMode ? 'advanced' : 'simple'} onValueChange={(v) => setAdvancedMode(v === 'advanced')} className="flex justify-center">
        <TabsList className="h-auto">
          <TabsTrigger value="simple" className="text-xs">Simple</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
        </TabsList>
      </Tabs>

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

      <Row label="Temperature" htmlFor="genTemperature" hint="Higher = more random/creative, lower = more focused.">
        <ValueSlider id="genTemperature" value={genTemperature} min={0} max={2} step={0.05} onChange={setGenTemperature} format={(v) => v.toFixed(2)} />
      </Row>

      {advancedMode && (
        <>
          <CheckRow
            label="Flash Attention"
            htmlFor="localFlashAttention"
            checked={localFlashAttention}
            onChange={setLocalFlashAttention}
            hint="Less KV-cache VRAM and often faster. Off by default for broad compatibility; try it on. Applies on reload."
          />

          <CheckRow
            label="Thinking"
            htmlFor="localThinking"
            checked={!disableThinking}
            onChange={(v) => setDisableThinking(!v)}
            hint="Reasoning models spend time on a hidden scratchpad before writing. Turn off for faster replies (adds a /no_think directive; only affects models that support it)."
          />

          <Row label="Top-p" htmlFor="genTopP" hint="Nucleus sampling cutoff — lower trims unlikely words.">
            <ValueSlider id="genTopP" value={genTopP} min={0} max={1} step={0.05} onChange={setGenTopP} format={(v) => v.toFixed(2)} />
          </Row>

          <Row label="Repetition Penalty" htmlFor="genRepetitionPenalty" hint="Above 1 discourages repeating text.">
            <ValueSlider id="genRepetitionPenalty" value={genRepetitionPenalty} min={1} max={1.5} step={0.02} onChange={setGenRepetitionPenalty} format={(v) => v.toFixed(2)} />
          </Row>
        </>
      )}

      {/* Reset (left) restores safe defaults; Save & Reload (right) applies engine settings to the model. */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <Button type="button" variant="ghost" onClick={resetDefaults}>Reset to defaults</Button>
        <Button type="button" onClick={saveReload} disabled={reloading || engine.status === 'loading'}>
          {reloading || engine.status === 'loading' ? 'Reloading…' : 'Save & Reload Model'}
        </Button>
      </div>

      <LocalModelModal open={showManager} onOpenChange={setShowManager} />
    </>
  );
}
