import { useEffect, useState } from 'react';
import { LOW_VRAM_LIMIT_MB } from '../../electron/engineDevice.cjs';
import type { engineVramClass } from '../../electron/engineDevice.cjs';
import { isLocalLlmAvailable, desktopVramClass } from '@/lib/imageGen/desktop';
import { useDevRoute } from '@/lib/devRouter';
import { useMountedRef } from '@/lib/useMountedRef';

/** The VRAM class of the device the built-in engine uses. */
export type VramClass = ReturnType<typeof engineVramClass>;

export const VRAM_CLASSES: readonly VramClass[] = ['low', 'ok', 'unknown'];

/** The class one reported total falls in, through the shell's limit. */
export const vramClassForTotal = (totalMb: number): VramClass => (totalMb <= LOW_VRAM_LIMIT_MB ? 'low' : 'ok');

/** The desktop shell's answer; `unknown` outside the desktop build or when the shell can't answer. */
export async function readVramClass(): Promise<VramClass> {
  if (!isLocalLlmAvailable()) return 'unknown';
  try {
    const answer = await desktopVramClass();
    return VRAM_CLASSES.includes(answer) ? answer : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** The class, read once each time `enabled` turns true; `unknown` until the shell answers. */
export function useVramClass({ enabled = true }: { enabled?: boolean } = {}): VramClass {
  const [answer, setAnswer] = useState<VramClass>('unknown');
  const mountedRef = useMountedRef();
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void readVramClass().then((next) => { if (current && mountedRef.current) setAnswer(next); });
    return () => { current = false; };
  }, [enabled, mountedRef]);

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
