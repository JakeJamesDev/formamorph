import type { LibraryDetails } from '@/types';

/** Read a file's creator credit, using the publisher only when the credit is blank. */
export function readLibraryDetails(shared: unknown, publisher?: unknown): LibraryDetails | undefined {
  const author = shared && typeof shared === 'object' && 'author' in shared ? shared.author : undefined;
  const credit = typeof author === 'string' && author.trim()
    ? author
    : typeof publisher === 'string' ? publisher.trim() : '';
  return credit ? { author: credit } : undefined;
}

/** Separate a shared file's library credit from the content that can enter a world. */
export function splitLibraryContent<T extends object>(shared: T, publisher?: unknown) {
  const { author: _author, ...content } = shared as T & { author?: unknown };
  return { content: content as T, libraryDetails: readLibraryDetails(shared, publisher) };
}
