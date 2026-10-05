/** The Help tab as other screens see it, so a screen's tutorial can point at a tab it does not render. */
import { useSyncExternalStore } from 'react';
import type { Edge } from './tabPlace';

export interface HelpLauncher {
  element: HTMLElement;
  edge: Edge;
  /** Whether the Formaquestion window is open. */
  open: boolean;
}

let current: HelpLauncher | null = null;
const listeners = new Set<() => void>();

/** Null while no tab is on screen. */
export function publishHelpLauncher(next: HelpLauncher | null) {
  if (current?.element === next?.element && current?.edge === next?.edge && current?.open === next?.open) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

export function useHelpLauncher(): HelpLauncher | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
