import { useEffect, useRef, useState } from "react";
import { isDesktop, desktopVramStats } from "./imageGen/desktop";

export interface VramGpu {
  index: number | null;
  name: string;
  totalMB: number | null;
  usedMB: number | null;
  freeMB: number | null;
}

export interface VramProcess {
  pid: number | null;
  name: string;
  usedMB: number | null;
}

export type VramStatus = "connecting" | "online" | "no-gpu" | "offline";

export interface VramStats {
  status: VramStatus;
  gpus: VramGpu[];
  processes: VramProcess[];
  /** PID of our own process (the desktop main process, which hosts the bundled engine), for self-attribution. */
  selfPid: number | null;
  lastUpdated: number | null;
}

interface Options {
  enabled?: boolean;
  intervalMs?: number;
}

/**
 * Resolve Formamorph's own VRAM share for the widget overlay: the measured per-process figure (our pid in the
 * nvidia-smi list) when available, else the engine's own allocation estimate (marked estimated). Returns a
 * null footprint when neither is known (no model loaded, or no VRAM source).
 */
export function resolveOwnVram(
  stats: VramStats,
  engineVramMB: number | null,
): { ownUsedMB: number | null; ownEstimated: boolean } {
  const measured =
    stats.selfPid != null
      ? stats.processes.find((p) => p.pid === stats.selfPid && p.usedMB != null)?.usedMB ?? null
      : null;
  if (measured != null) return { ownUsedMB: measured, ownEstimated: false };
  return { ownUsedMB: engineVramMB, ownEstimated: engineVramMB != null };
}

// The raw payload from either source (the desktop IPC bridge or the standalone HTTP helper).
interface VramPayload {
  error?: string;
  gpus?: VramGpu[];
  processes?: VramProcess[];
  selfPid?: number | null;
}

// Live VRAM numbers, from the desktop main process (nvidia-smi over IPC) when running in the desktop build,
// otherwise the local HTTP helper (see scripts/vram-helper.mjs). Degrades gracefully: source down →
// "offline", source up but no NVIDIA GPU → "no-gpu".
export function useVramStats(helperUrl: string, { enabled = true, intervalMs = 2000 }: Options = {}): VramStats {
  const [stats, setStats] = useState<VramStats>({
    status: "connecting",
    gpus: [],
    processes: [],
    selfPid: null,
    lastUpdated: null,
  });
  const helperUrlRef = useRef(helperUrl);
  helperUrlRef.current = helperUrl;

  useEffect(() => {
    const desktop = isDesktop();
    // Desktop reads via IPC (no URL needed); the web build needs a helper URL to poll.
    if (!enabled || (!desktop && !helperUrl)) {
      setStats({ status: "offline", gpus: [], processes: [], selfPid: null, lastUpdated: null });
      return;
    }

    let cancelled = false;
    setStats((s) => ({ ...s, status: "connecting" }));

    const poll = async () => {
      try {
        let data: VramPayload;
        if (desktop) {
          data = (await desktopVramStats()) as VramPayload;
        } else {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 1500);
          try {
            const res = await fetch(helperUrlRef.current, { signal: controller.signal });
            data = await res.json();
          } finally {
            clearTimeout(timer);
          }
        }
        if (cancelled) return;
        if (data?.error === "nvidia-smi-not-found" || !Array.isArray(data?.gpus) || data.gpus.length === 0) {
          setStats({ status: "no-gpu", gpus: [], processes: [], selfPid: data?.selfPid ?? null, lastUpdated: Date.now() });
        } else {
          setStats({
            status: "online",
            gpus: data.gpus,
            processes: Array.isArray(data.processes) ? data.processes : [],
            selfPid: data.selfPid ?? null,
            lastUpdated: Date.now(),
          });
        }
      } catch {
        if (!cancelled) setStats({ status: "offline", gpus: [], processes: [], selfPid: null, lastUpdated: null });
      }
    };

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [helperUrl, enabled, intervalMs]);

  return stats;
}
