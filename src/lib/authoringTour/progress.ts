/**
 * Authoring Tour progress, one record per world id: the current step and the items the tour created.
 *
 * Device-local, like the tutorial seen-state. Never part of a world or a save.
 */
import { useSyncExternalStore } from 'react';
import type { TourItems } from './steps';

export interface TourRecord {
  step: string;
  items: TourItems;
}

const STORAGE_KEY = 'formamorph.authoringTour';

function isRecord(v: unknown): v is TourRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Partial<TourRecord>;
  return typeof r.step === 'string' && !!r.items && typeof r.items === 'object';
}

function read(): Record<string, TourRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, r]) => isRecord(r))) as Record<string, TourRecord>;
  } catch {
    return {};
  }
}

const listeners = new Set<() => void>();
let snapshot: Record<string, TourRecord> = read();

function publish(next: Record<string, TourRecord>) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private-mode storage denial: the tour still runs for this session.
  }
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

/** Re-reads storage. Tests clear localStorage between cases and call this so the store follows. */
export function reloadTourProgress() {
  snapshot = read();
  listeners.forEach((l) => l());
}

export function readTourRecord(worldId: string | null): TourRecord | null {
  return worldId ? snapshot[worldId] ?? null : null;
}

/** This world's tour record, or null when no tour runs on it. */
export function useTourRecord(worldId: string | null): TourRecord | null {
  return useSyncExternalStore(subscribe, () => readTourRecord(worldId), () => null);
}

export function writeTourRecord(worldId: string, record: TourRecord) {
  publish({ ...snapshot, [worldId]: record });
}

export function clearTourRecord(worldId: string) {
  if (!(worldId in snapshot)) return;
  const { [worldId]: _gone, ...rest } = snapshot;
  publish(rest);
}

/** Drops every record whose world is not in `keep`. */
export function pruneTourRecords(keep: ReadonlySet<string>) {
  const kept = Object.fromEntries(Object.entries(snapshot).filter(([id]) => keep.has(id)));
  if (Object.keys(kept).length !== Object.keys(snapshot).length) publish(kept);
}
