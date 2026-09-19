import { canonicalStringify } from './canonicalStringify';

/** One place where the live world differs from the saved baseline, under the dirty check's own rules. */
export interface DirtyDiffEntry {
  path: string;
  saved: string | undefined;
  live: string | undefined;
}

const PREVIEW_CHARS = 120;

const preview = (s: string | undefined): string | undefined =>
  (s !== undefined && s.length > PREVIEW_CHARS ? `${s.slice(0, PREVIEW_CHARS)}…(${s.length})` : s);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * The deepest paths at which two worlds compare as different to {@link canonicalStringify}, so the answer
 * names exactly what the editor's dirty flag is reacting to. Descends only where both sides are the same
 * kind of container; anything else is reported where it stands.
 */
export function dirtyDiff(saved: unknown, live: unknown, path = ''): DirtyDiffEntry[] {
  const a = canonicalStringify(saved, new WeakMap());
  const b = canonicalStringify(live, new WeakMap());
  if (a === b) return [];
  if (isRecord(saved) && isRecord(live) && Array.isArray(saved) === Array.isArray(live)) {
    const keys = [...new Set([...Object.keys(saved), ...Object.keys(live)])];
    const step = (key: string) => (Array.isArray(saved) ? `${path}[${key}]` : path ? `${path}.${key}` : key);
    return keys.flatMap((key) => dirtyDiff(saved[key], live[key], step(key)));
  }
  return [{ path, saved: preview(a), live: preview(b) }];
}
