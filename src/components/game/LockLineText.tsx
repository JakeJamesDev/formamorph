import { Lock } from 'lucide-react';
import { GateLineText } from '@/components/game/GateLineText';
import type { LockLine } from '@/lib/inPlayWorld';

/** A locked location's line as the player reads it: the author's Locked text resolved, or the lock line. */
export function LockLineText({ line, resolveText }: { line: LockLine; resolveText: (text: string) => string }) {
  return 'text' in line ? <>{resolveText(line.text)}</> : <GateLineText parts={line.parts} />;
}

/** The lock beside a locked location's name. */
export const LockMark = () => <Lock role="img" aria-label="Locked" className="h-3.5 w-3.5 shrink-0" />;
