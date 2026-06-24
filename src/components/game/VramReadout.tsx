import type { VramStats } from "@/lib/useVramStats";

const GB = 1024;

function fmtGB(mb: number | null): string {
  return mb == null ? "?" : (mb / GB).toFixed(1);
}

// Live VRAM readout shared by the Settings dialog and the TTS modal. Takes the polled
// stats as a prop so the parent owns a single useVramStats poll (no double-polling).
// `compact` (TTS modal) shows only the GPU bars and renders nothing until online.
export default function VramReadout({ stats, compact = false }: { stats: VramStats; compact?: boolean }) {
  if (stats.status !== "online") {
    if (compact) return null;
    const msg =
      stats.status === "connecting"
        ? "Connecting to VRAM helper…"
        : stats.status === "no-gpu"
          ? "No NVIDIA GPU detected."
          : "VRAM helper not running — start it with npm run vram-helper.";
    return <p className="text-xs text-muted-foreground">{msg}</p>;
  }

  return (
    <div className="space-y-3 text-xs">
      {stats.gpus.map((gpu) => {
        const usedPct =
          gpu.totalMB && gpu.usedMB != null ? (gpu.usedMB / gpu.totalMB) * 100 : 0;
        const barColor =
          usedPct >= 90 ? "bg-red-500" : usedPct >= 50 ? "bg-yellow-500" : "bg-green-500";
        return (
          <div key={gpu.index ?? gpu.name} className="space-y-1">
            <div className="flex justify-between">
              <span className="truncate">{gpu.name}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {fmtGB(gpu.usedMB)} / {fmtGB(gpu.totalMB)} GB
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted/70 overflow-hidden">
              <div className={`h-full ${barColor} transition-all`} style={{ width: `${usedPct}%` }} />
            </div>
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
