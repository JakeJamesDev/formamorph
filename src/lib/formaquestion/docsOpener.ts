import type { DocTarget } from '@/lib/docs/docsLinks';

type Opener = (target: DocTarget) => void;

let opener: Opener | null = null;

/** The mounted Formaquestion registers here while it can show the reader. Returns the unregister function. */
export function registerDocsOpener(next: Opener): () => void {
  opener = next;
  return () => {
    if (opener === next) opener = null;
  };
}

/** Opens the reader at the target. Returns false when no reader is mounted, so the caller can link out. */
export function openDocs(target: DocTarget): boolean {
  if (!opener) return false;
  opener(target);
  return true;
}

/**
 * Opens the reader for a plain click on a link and cancels the link. A click with a modifier or a
 * non-primary button keeps its own meaning, such as a new tab. Returns true when the reader took it.
 */
export function openDocsFromClick(
  event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault(): void },
  target: DocTarget,
): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (!openDocs(target)) return false;
  event.preventDefault();
  return true;
}
