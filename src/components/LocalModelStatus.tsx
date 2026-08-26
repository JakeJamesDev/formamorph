import { Progress } from '@/components/ui/progress';
import IndeterminateProgress from '@/components/ui/indeterminate-progress';
import { fmtGB, type VramStats } from '@/lib/useVramStats';
import VramReadout from '@/components/game/VramReadout';
import type { LocalLlmState } from '@/lib/imageGen/desktop';

const BACKEND_LABELS: Record<string, string> = { cuda: 'CUDA', vulkan: 'Vulkan', metal: 'Metal', cpu: 'CPU' };

/**
 * The local engine's status as a short colored line ("Engine: ready — model.gguf"), with a progress bar
 * under it while a model reads in. Shared by the endpoint panel and the model-manager popup so the two
 * never drift.
 */
export function EngineStatusLine({ engine, className }: { engine: LocalLlmState; className?: string }) {
  const loading = engine.status === 'loading';
  return (
    <div className={className}>
      <div className="text-meta text-muted-foreground">
        Engine:{' '}
        {engine.status === 'ready' ? <span className="text-success">ready — {engine.modelId}</span>
          : loading ? (
            <span className="text-warning">
              loading {engine.modelId}
              {engine.loadProgress != null && ` — ${engine.loadProgress}%`}…
            </span>
          )
          : engine.status === 'error' ? <span className="text-destructive">error: {engine.error}</span>
          : 'no model loaded'}
      </div>
      {/* A large model reads in over the better part of a minute. The bar is indeterminate until the engine
          reports its first percentage, so the wait never looks like nothing is happening. */}
      {loading && (
        <div className="mt-1">
          {engine.loadProgress == null
            ? <IndeterminateProgress />
            : <Progress value={engine.loadProgress} className="h-1" />}
        </div>
      )}
    </div>
  );
}

/**
 * The backend and device llama.cpp actually chose, plus the VRAM it sized the load against. Sits directly
 * under the nvidia-smi bars: a load that falls back to the CPU or to an iGPU over Vulkan then reads as a
 * visible mismatch with the card listed above it, instead of as an unexplained out-of-VRAM error.
 * Renders nothing until a backend has been selected.
 */
export function EngineDeviceLine({ engine }: { engine: LocalLlmState }) {
  if (!engine.gpuBackend) return null;
  const onCpu = engine.gpuBackend === 'cpu';
  const devices = engine.gpuDeviceNames?.length ? engine.gpuDeviceNames.join(', ') : null;
  return (
    <div className="mt-3 border-t border-border pt-2 text-meta text-muted-foreground">
      <span className="font-semibold">Engine device: </span>
      <span className={onCpu ? 'text-warning' : undefined}>
        {BACKEND_LABELS[engine.gpuBackend] ?? engine.gpuBackend}
      </span>
      {devices && <> — {devices}</>}
      {engine.deviceVramTotalMB != null && (
        <> · {fmtGB(engine.deviceVramFreeMB)} / {fmtGB(engine.deviceVramTotalMB)} GB free at load</>
      )}
    </div>
  );
}

/**
 * GPU memory box (label + VRAM bars, and the engine's own device when one is passed). Presentational — the
 * caller owns the `useVramStats` poll so there's never a double poll. Shared by the endpoint panel and the
 * model-manager popup.
 */
export function GpuMemoryBox({
  stats,
  className,
  ownUsedMB = null,
  ownEstimated = false,
  engine,
}: {
  stats: VramStats;
  className?: string;
  ownUsedMB?: number | null;
  ownEstimated?: boolean;
  engine?: LocalLlmState;
}) {
  return (
    <div className={`rounded-md border border-border p-3 ${className ?? ''}`}>
      <div className="mb-2 text-meta font-semibold text-muted-foreground">GPU memory</div>
      <VramReadout stats={stats} ownUsedMB={ownUsedMB} ownEstimated={ownEstimated} />
      {engine && <EngineDeviceLine engine={engine} />}
    </div>
  );
}
