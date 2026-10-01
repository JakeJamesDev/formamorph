import { useSyncExternalStore } from 'react';
import { surfaceRegistry, type Surface } from './surfaceRegistry';

/** What the player has open, live. */
export function useSurface(): Surface {
  return useSyncExternalStore(surfaceRegistry.subscribe, surfaceRegistry.get);
}
