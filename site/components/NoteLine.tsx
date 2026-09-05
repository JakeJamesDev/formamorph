import { cn } from '@/lib/utils';

/** How the last thing the reader did went. Null before they have done anything. */
export type Note = { kind: 'success' | 'error'; text: string } | null;

/**
 * The line under a control saying how it went.
 *
 * The site has no toast container — the game's one is themed from a provider this entry deliberately
 * does not mount — so every answer is written where the control is, which is where the reader is
 * already looking.
 */
export function NoteLine({ note }: { note: Note }) {
  if (!note) return null;

  return (
    <p
      role={note.kind === 'error' ? 'alert' : 'status'}
      className={cn('text-helper', note.kind === 'error' ? 'text-destructive' : 'text-muted-foreground')}
    >
      {note.text}
    </p>
  );
}
