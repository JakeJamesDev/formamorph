import { useSyncExternalStore } from 'react';
import { SCRIPT_TIMINGS } from '@/lib/scripts';
import type { ScriptTiming } from '@/types';

/** What the open script home's panel offers the help window's Insert. */
export interface ScriptInsertTarget {
  /** The open home's name, which heads the Insert menu. */
  homeName: string;
  /** Writes a new script of one timing into the home. */
  insert: (timing: ScriptTiming, code: string) => void;
}

let target: ScriptInsertTarget | null = null;
const listeners = new Set<() => void>();
const eventListeners = new Set<(event: ScriptInsertEvent) => void>();

const notify = () => listeners.forEach((listener) => listener());

/** The mounted home panel registers here. Returns the unregister function. */
export function registerScriptInsert(next: ScriptInsertTarget): () => void {
  target = next;
  notify();
  return () => {
    if (target !== next) return;
    target = null;
    notify();
  };
}

/** Calls `listener` when a panel registers or unregisters. Returns the unsubscribe function. */
export function subscribeScriptInsert(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The registered panel, or null when no script home is open. */
export const scriptInsertTarget = (): ScriptInsertTarget | null => target;

/** The registered panel, kept current as panels mount and unmount. */
export function useScriptInsertTarget(): ScriptInsertTarget | null {
  return useSyncExternalStore(subscribeScriptInsert, scriptInsertTarget, scriptInsertTarget);
}

/** What the panel did with an insert: it writes every one as a new script. */
export type ScriptInsertEvent = 'written';

/** The panel reports each insert, so the help window's sheet can close for it. */
export function reportScriptInsert(event: ScriptInsertEvent): void {
  eventListeners.forEach((listener) => listener(event));
}

/** Calls `listener` with each insert the panel reports. Returns the unsubscribe function. */
export function onScriptInsert(listener: (event: ScriptInsertEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

const asTiming = (word: string | undefined): ScriptTiming | undefined => {
  const lower = word?.trim().toLowerCase();
  return SCRIPT_TIMINGS.find((timing) => timing === lower);
};

/** The timing a block's fence names and its code. A first line that is only a timing word is dropped and read as the tag. */
export function insertableSnippet(code: string, meta: string | undefined): { timing: ScriptTiming | undefined; code: string } {
  const timing = asTiming(meta);
  const [first, ...rest] = code.split('\n');
  const lineTiming = asTiming(first);
  return lineTiming ? { timing: timing ?? lineTiming, code: rest.join('\n') } : { timing, code };
}
