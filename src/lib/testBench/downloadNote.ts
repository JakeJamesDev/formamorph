/**
 * Which worlds have already been told that editing a downloaded copy diverges it from its source.
 *
 * Bench-local, like every other piece of Bench state: stored under the world's id in localStorage, never in
 * the world itself. The note is a courtesy on the first fix, so a copy that has been told once stays told
 * across sessions rather than repeating the same line every time the editor reopens.
 */
const STORAGE_KEY = 'FORMAMORPH_benchDownloadNoted';

const notedIds = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const hasSeenDownloadNote = (worldId: string): boolean => notedIds().includes(worldId);

export const markDownloadNoteSeen = (worldId: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...notedIds(), worldId])]));
  } catch {
    // A full or blocked localStorage costs one repeated note, nothing else.
  }
};
