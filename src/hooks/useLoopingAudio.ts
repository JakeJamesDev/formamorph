import { useEffect } from 'react';

/**
 * Loops `src` while it is set and stops it on change or unmount. A source the browser can't play stays
 * silent: the `play()` rejection is logged, never thrown to the global error toast.
 */
export function useLoopingAudio(src: string | null | undefined): void {
  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.loop = true;
    audio.play().catch((e: unknown) => console.warn('Audio did not play:', e));
    return () => audio.pause();
  }, [src]);
}
