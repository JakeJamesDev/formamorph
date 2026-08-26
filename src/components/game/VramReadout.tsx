import { fmtGB, type VramStats } from "@/lib/useVramStats";

// Live VRAM readout shared by the Settings dialog and the TTS modal. Takes the polled
// stats as a prop so the parent owns a single useVramStats poll (no double-polling).
// `compact` (TTS modal) shows only the GPU bars and renders nothing until online.
// `ownUsedMB` (Endpoint panel) overlays Formamorph's own VRAM share on the primary GPU bar; `ownEstimated`
// marks it with a "~" when it's the engine's allocation estimate rather than a measured per-process figure.
export default function VramReadout({
  stats,
  compact = false,
  ownUsedMB = null,
  ownEstimated = false,
}: {
  stats: VramStats;
  compact?: boolean;
  ownUsedMB?: number | null;
  ownEstimated?: boolean;
}) {
  if (stats.status !== "online") {
    if (compact) return null;
    const msg =
      stats.status === "connecting"
        ? "Connecting to VRAM helper…"
        : stats.status === "no-gpu"
          ? "No NVIDIA GPU detected."
          : "VRAM helper not running — start it with npm run vram-helper.";
    return <p className="text-meta text-muted-foreground">{msg}</p>;
  }

  return (
    <div className="space-y-3 text-meta">
      {stats.gpus.map((gpu, i) => {
        const usedPct =
          gpu.totalMB && gpu.usedMB != null ? (gpu.usedMB / gpu.totalMB) * 100 : 0;
        const barColor =
          usedPct >= 90 ? "bg-destructive" : usedPct >= 50 ? "bg-warning" : "bg-success";
        // Attribute our footprint to the primary GPU (the estimate is a device total we can't split).
        const ownPct =
          i === 0 && ownUsedMB != null && gpu.totalMB ? Math.min(usedPct, (ownUsedMB / gpu.totalMB) * 100) : 0;
        return (
          <div key={gpu.index ?? gpu.name} className="space-y-1">
            <div className="flex justify-between">
              <span className="truncate">{gpu.name}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {fmtGB(gpu.usedMB)} / {fmtGB(gpu.totalMB)} GB
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted/70 overflow-hidden">
              <div className={`h-full ${barColor} transition-all`} style={{ width: `${usedPct}%` }} />
              {ownPct > 0 && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary transition-all"
                  style={{ width: `${ownPct}%` }}
                  title={`Formamorph: ${ownEstimated ? "~" : ""}${fmtGB(ownUsedMB)} GB`}
                />
              )}
            </div>
            {i === 0 && ownUsedMB != null && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
                <span>Formamorph: {ownEstimated ? "~" : ""}{fmtGB(ownUsedMB)} GB</span>
              </div>
            )}
          </div>
        );
      })}

      {!compact && stats.processes.length > 0 && (
        <div className="space-y-0.5">
          <div className="font-semibold text-muted-foreground">GPU processes</div>
          {stats.processes.map((p) => (
            <div key={p.pid ?? p.name} className="flex justify-between gap-2">
              <span className="truncate">{p.name}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {p.usedMB == null ? "usage N/A" : `${p.usedMB} MB`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
