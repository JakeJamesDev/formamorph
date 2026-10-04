import { useSyncExternalStore } from 'react';
import {
  readStoredMascotPlacement, readStoredMascotScale, writeStoredMascotPlacement, writeStoredMascotScale, type MascotPlacement, type MascotScale,
} from '@/lib/formaquestion/windowBox';

/** A per-device value every reader redraws on, so the window follows the Settings tab and the menu. */
function deviceValue<T>(read: () => T, write: (value: T) => void) {
  const listeners = new Set<() => void>();
  // Blocked storage keeps the value for this visit only.
  let unstored: T | null = null;
  const current = (): T => unstored ?? read();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  return {
    set(value: T): void {
      write(value);
      unstored = read() === value ? null : value;
      listeners.forEach((listener) => listener());
    },
    use: (): T => useSyncExternalStore(subscribe, current),
  };
}

const scale = deviceValue(readStoredMascotScale, writeStoredMascotScale);
const placement = deviceValue(readStoredMascotPlacement, writeStoredMascotPlacement);

/** Stores the Mascot scale on this device and redraws every reader of it. */
export const setMascotScale = (value: MascotScale): void => scale.set(value);
/** The Mascot scale this device keeps. */
export const useMascotScale = (): MascotScale => scale.use();

/** Stores the Mascot placement on this device and redraws every reader of it. */
export const setMascotPlacement = (value: MascotPlacement): void => placement.set(value);
/** The Mascot placement this device keeps. */
export const useMascotPlacement = (): MascotPlacement => placement.use();
