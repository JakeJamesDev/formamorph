import { useSyncExternalStore } from 'react';
import { readStoredMascotScale, writeStoredMascotScale, type MascotScale } from '@/lib/formaquestion/windowBox';

const listeners = new Set<() => void>();
// Blocked storage keeps the value for this visit only.
let unstored: MascotScale | null = null;

const read = (): MascotScale => unstored ?? readStoredMascotScale();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** Stores the scale on this device and redraws every reader of it, so the window follows the tab's slider. */
export function setMascotScale(scale: MascotScale): void {
  writeStoredMascotScale(scale);
  unstored = readStoredMascotScale() === scale ? null : scale;
  listeners.forEach((listener) => listener());
}

/** The Mascot scale this device keeps. */
export function useMascotScale(): MascotScale {
  return useSyncExternalStore(subscribe, read);
}
