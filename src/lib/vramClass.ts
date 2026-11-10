import { useEffect, useState } from 'react';
import { LOW_VRAM_LIMIT_MB } from '../../electron/engineDevice.cjs';
import type { engineVramClass } from '../../electron/engineDevice.cjs';
import { isLocalLlmAvailable, desktopVramClass, type EngineDeviceSettings } from '@/lib/imageGen/desktop';
import { useSettings } from '@/contexts/SettingsContext';
import { useDevRoute } from '@/lib/devRouter';
import { useMountedRef } from '@/lib/useMountedRef';

/** The VRAM class of the device the built-in engine uses. */
export type VramClass = ReturnType<typeof engineVramClass>;

export const VRAM_CLASSES: readonly VramClass[] = ['low', 'ok', 'unknown'];

/** The class one reported total falls in, through the shell's limit. */
export const vramClassForTotal = (totalMb: number): VramClass => (totalMb <= LOW_VRAM_LIMIT_MB ? 'low' : 'ok');

/** The shell's answer for the saved settings; `unknown` off desktop or on failure. */
export async function readVramClass(saved: EngineDeviceSettings): Promise<VramClass> {
  if (!isLocalLlmAvailable()) return 'unknown';
  try {
    const answer = await desktopVramClass(saved);
    return VRAM_CLASSES.includes(answer) ? answer : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** The class for the saved settings, re-read when `enabled` turns true or a setting changes. */
export function useVramClass({ enabled = true }: { enabled?: boolean } = {}): VramClass {
  const { localGpuDevice, localEngineBackend } = useSettings();
  const [answer, setAnswer] = useState<VramClass>('unknown');
  const mountedRef = useMountedRef();
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void readVramClass({ gpuDevice: localGpuDevice, engineBackend: localEngineBackend })
      .then((next) => { if (current && mountedRef.current) setAnswer(next); });
    return () => { current = false; };
  }, [enabled, localGpuDevice, localEngineBackend, mountedRef]);

  // DEV only: `#dev?vramClass=<class>` or `#dev?vram=<MB>` stands in for the shell's answer.
  const route = useDevRoute();
  if (import.meta.env.DEV) {
    const named = VRAM_CLASSES.find((c) => c === route?.vramClass);
    if (named) return named;
    const devMb = Number(route?.vram);
    if (Number.isFinite(devMb) && devMb > 0) return vramClassForTotal(devMb);
  }
  return answer;
}
