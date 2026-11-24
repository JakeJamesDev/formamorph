import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Meta } from '@/components/ui/typography';
import type { DiaryEntry } from '@/lib/diaryView';
import { cn } from '@/lib/utils';

/** One character's diary in Memories: each entry under its turn's memory, oldest first. */
export function MemoryDiaryView({ entries, memoryByTurn, emptyText }: {
  /** The entries to list, already filtered. */
  entries: readonly DiaryEntry[];
  /** Each turn's memory as the ledger reads it; a turn without one shows no context line. */
  memoryByTurn: ReadonlyMap<string, string>;
  /** What shows when `entries` is empty. */
  emptyText: ReactNode;
}) {
  if (entries.length === 0) return <Meta as="p" className="p-2">{emptyText}</Meta>;
  return (
    <div className="space-y-2 pb-2">
      {entries.map((entry) => {
        const memory = memoryByTurn.get(entry.turnId);
        return (
          <div key={entry.key} className="space-y-1" data-diary-entry={entry.key}>
            {memory && <p className="px-1 text-[10px] text-muted-foreground" data-diary-context>↳ {memory}</p>}
            <div className={cn('rounded border border-border p-2', entry.quiet && entry.scriptLines.length === 0 && 'opacity-60')}>
              {entry.text && (
                <p className={cn('text-meta', entry.quiet && 'italic text-muted-foreground')}>
                  {entry.quiet ? 'Nothing notable.' : entry.text}
                </p>
              )}
              {entry.scriptLines.length > 0 && (
                <div className={cn('flex items-start gap-1 text-meta text-muted-foreground', entry.text && 'mt-1')}>
                  <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px]">Script</Badge>
                  <span>{entry.scriptLines.join(' ')}</span>
                </div>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[9px] text-muted-foreground">Turn {entry.turnNumber}</span>
                {entry.edited === 'player' && <Badge variant="outline" className="h-4 px-1 text-[9px]">Edited</Badge>}
                {entry.edited === 'ai' && <Badge variant="outline" className="h-4 px-1 text-[9px]">Rewritten</Badge>}
              </div>
              {entry.edited && entry.original && (
                <p className="mt-1 border-l-2 border-border pl-2 text-[10px] text-muted-foreground">
                  Originally: {entry.original}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
