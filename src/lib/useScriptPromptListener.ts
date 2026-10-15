import { useEffect } from 'react';
import { cancelOpenPrompts, type ScriptPromptStore } from './scriptPrompts';

/**
 * Listens to `store` while the surface is mounted, so a script's ask waits for the player rather than canceling
 * (Q45). Unmount cancels every open prompt, so no script waits on a line that is gone.
 */
export function useScriptPromptListener(store: ScriptPromptStore): void {
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {});
    return () => {
      unsubscribe();
      cancelOpenPrompts(store);
    };
  }, [store]);
}
