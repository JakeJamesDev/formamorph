import { useSyncExternalStore } from 'react';
import { STAT_CODE_TIMINGS, type StatCodeTiming } from '@/lib/statCodeTiming';

/** What the open stat panel offers the help window's Insert. */
export interface StatCodeInsertTarget {
  /** The open stat's name, which heads the Insert menu. */
  statName: string;
  /** Writes code into one of the stat's boxes. */
  insert: (timing: StatCodeTiming, code: string) => void;
}

let target: StatCodeInsertTarget | null = null;
const listeners = new Set<() => void>();
const eventListeners = new Set<(event: StatCodeInsertEvent) => void>();

const notify = () => listeners.forEach((listener) => listener());

/** The mounted stat panel registers here. Returns the unregister function. */
export function registerStatCodeInsert(next: StatCodeInsertTarget): () => void {
  target = next;
  notify();
  return () => {
    if (target !== next) return;
    target = null;
    notify();
  };
}

/** Calls `listener` when a panel registers or unregisters. Returns the unsubscribe function. */
export function subscribeStatCodeInsert(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The registered panel, or null when no stat panel is open. */
export const statCodeInsertTarget = (): StatCodeInsertTarget | null => target;

/** The registered panel, kept current as panels mount and unmount. */
export function useStatCodeInsertTarget(): StatCodeInsertTarget | null {
  return useSyncExternalStore(subscribeStatCodeInsert, statCodeInsertTarget, statCodeInsertTarget);
}

/** What the panel did with an insert: wrote it, raised the replace confirm, or closed that confirm. */
export type StatCodeInsertEvent = 'written' | 'confirming' | 'settled';

/** The panel reports each step of an insert, so the help window can step aside for it. */
export function reportStatCodeInsert(event: StatCodeInsertEvent): void {
  eventListeners.forEach((listener) => listener(event));
}

/** Calls `listener` with each step the panel reports. Returns the unsubscribe function. */
export function onStatCodeInsert(listener: (event: StatCodeInsertEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

const asTiming = (word: string | undefined): StatCodeTiming | undefined => {
  const lower = word?.trim().toLowerCase();
  return STAT_CODE_TIMINGS.find((timing) => timing === lower);
};

/** The box a block's fence names and its code. A first line that is only a box name is dropped and read as the tag. */
export function insertableSnippet(code: string, meta: string | undefined): { slot: StatCodeTiming | undefined; code: string } {
  const slot = asTiming(meta);
  const [first, ...rest] = code.split('\n');
  const lineSlot = asTiming(first);
  return lineSlot ? { slot: slot ?? lineSlot, code: rest.join('\n') } : { slot, code };
}
