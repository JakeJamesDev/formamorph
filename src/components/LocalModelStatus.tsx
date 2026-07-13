import type { VramStats } from '@/lib/useVramStats';
import VramReadout from '@/components/game/VramReadout';
import type { LocalLlmState } from '@/lib/imageGen/desktop';

/**
 * The local engine's status as a short colored line ("Engine: ready — model.gguf"). Shared by the
 * endpoint panel and the model-manager popup so the two never drift.
 */
export function EngineStatusLine({ engine, className }: { engine: LocalLlmState; className?: string }) {
  return (
    <div className={`text-xs text-muted-foreground ${className ?? ''}`}>
      Engine:{' '}
      {engine.status === 'ready' ? <span className="text-success">ready — {engine.modelId}</span>
        : engine.status === 'loading' ? <span className="text-warning">loading {engine.modelId}…</span>
        : engine.status === 'error' ? <span className="text-destructive">error: {engine.error}</span>
        : 'no model loaded'}
    </div>
  );
}

/**
 * GPU memory box (label + VRAM bars). Presentational — the caller owns the `useVramStats` poll so there's
 * never a double poll. Shared by the endpoint panel and the model-manager popup.
 */
export function GpuMemoryBox({
  stats,
  className,
  ownUsedMB = null,
  ownEstimated = false,
}: {
  stats: VramStats;
  className?: string;
  ownUsedMB?: number | null;
  ownEstimated?: boolean;
}) {
  return (
    <div className={`rounded-md border border-border p-3 ${className ?? ''}`}>
      <div className="mb-2 text-xs font-semibold text-muted-foreground">GPU memory</div>
      <VramReadout stats={stats} ownUsedMB={ownUsedMB} ownEstimated={ownEstimated} />
    </div>
  );
}
