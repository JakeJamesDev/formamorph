/** A Find All Uses row on its way from the World Editor's selection to the box that shows its line. */

import { useSyncExternalStore } from 'react';
import type { CodeUse } from './codeUses';

export type CodeUseReveal = Pick<CodeUse, 'entityId' | 'rowId' | 'trait' | 'world' | 'tool' | 'timing' | 'scriptId' | 'line'>;

let pending: CodeUseReveal | null = null;
const listeners = new Set<() => void>();

const set = (next: CodeUseReveal | null) => {
  pending = next;
  listeners.forEach((listener) => listener());
};

/** Replaces any reveal still waiting. */
export const requestCodeUseReveal = (reveal: CodeUseReveal): void => set({ ...reveal });

/** Drops `reveal` once its box has shown the line. A newer request stays. */
export function settleCodeUseReveal(reveal: CodeUseReveal): void {
  if (pending === reveal) set(null);
}

export const clearCodeUseReveal = (): void => set(null);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** The waiting reveal when it is for the `panel` of `rowId` on `entityId`, else null. */
export function useCodeUseReveal(rowId: string, entityId: string | null, panel: 'stat' | 'trait' | 'world' | 'tool' = 'stat'): CodeUseReveal | null {
  const reveal = useSyncExternalStore(subscribe, () => pending, () => pending);
  const at = reveal?.trait ? 'trait' : reveal?.world ? 'world' : reveal?.tool ? 'tool' : 'stat';
  return reveal && reveal.rowId === rowId && reveal.entityId === entityId && at === panel ? reveal : null;
}
