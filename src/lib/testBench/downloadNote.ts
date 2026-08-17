/**
 * Which worlds have already been told that editing a downloaded copy diverges it from its source.
 *
 * Bench-local, like every other piece of Bench state: stored under the world's id in localStorage, never in
 * the world itself. The note is a courtesy on the first fix, so a copy that has been told once stays told
 * across sessions rather than repeating the same line every time the editor reopens.
 */
import { readStorageJson, writeStorageJson } from '@/lib/keyedStorage';

const STORAGE_KEY = 'FORMAMORPH_benchDownloadNoted';

const notedIds = (): string[] => {
  const raw = readStorageJson('local', STORAGE_KEY);
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
};

export const hasSeenDownloadNote = (worldId: string): boolean => notedIds().includes(worldId);

export const markDownloadNoteSeen = (worldId: string): void => {
  writeStorageJson('local', STORAGE_KEY, [...new Set([...notedIds(), worldId])]);
};
