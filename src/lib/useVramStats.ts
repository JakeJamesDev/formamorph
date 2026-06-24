import { useEffect, useRef, useState } from "react";

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
  lastUpdated: number | null;
}

interface Options {
  enabled?: boolean;
  intervalMs?: number;
}

// Polls the local nvidia-smi helper (see scripts/vram-helper.mjs) for live VRAM numbers.
// Degrades gracefully: helper down → "offline", helper up but no NVIDIA GPU → "no-gpu".
export function useVramStats(helperUrl: string, { enabled = true, intervalMs = 2000 }: Options = {}): VramStats {
  const [stats, setStats] = useState<VramStats>({
    status: "connecting",
    gpus: [],
    processes: [],
    lastUpdated: null,
  });
  const helperUrlRef = useRef(helperUrl);
  helperUrlRef.current = helperUrl;

  useEffect(() => {
    if (!enabled || !helperUrl) {
      setStats({ status: "offline", gpus: [], processes: [], lastUpdated: null });
      return;
    }

    let cancelled = false;
    setStats((s) => ({ ...s, status: "connecting" }));

    const poll = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      try {
        const res = await fetch(helperUrlRef.current, { signal: controller.signal });
        const data = await res.json();
        if (cancelled) return;
        if (data?.error === "nvidia-smi-not-found" || !Array.isArray(data?.gpus) || data.gpus.length === 0) {
          setStats({ status: "no-gpu", gpus: [], processes: [], lastUpdated: Date.now() });
        } else {
          setStats({
            status: "online",
            gpus: data.gpus,
            processes: Array.isArray(data.processes) ? data.processes : [],
            lastUpdated: Date.now(),
          });
        }
      } catch {
        if (!cancelled) setStats({ status: "offline", gpus: [], processes: [], lastUpdated: null });
      } finally {
        clearTimeout(timer);
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
