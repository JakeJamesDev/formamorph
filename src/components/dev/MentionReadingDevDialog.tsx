// DEV only: the newest turn's Mention Reading, for verifying Character Mentions (`#dev?modal=mentionReading`).
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Meta } from '@/components/ui/typography';
import type { ChatMessage, Entity } from '@/types';
import { useCharacterMentionsState } from '@/lib/coref/characterMentionsApp';
import { newestTurnNarration, turnMentionReading, type MentionReadingMap } from '@/lib/coref/mentionReadings';

export function MentionReadingDevDialog({ open, onOpenChange, history, readings, cast }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: ChatMessage[];
  readings: MentionReadingMap;
  cast: Entity[];
}) {
  const state = useCharacterMentionsState();
  const newest = newestTurnNarration(history);
  const entry = newest ? readings[newest.turnId] : undefined;
  const reading = newest ? turnMentionReading(readings, newest.turnId, newest.narration) : null;
  const nameOf = (id: string | null) => (id === null ? '—' : cast.find((e) => e.id === id)?.name ?? id);
  const text = newest?.narration ?? '';
  const marked: ReactNode[] = [];
  let at = 0;
  for (const [i, m] of (reading?.mentions ?? []).slice().sort((a, b) => a.start - b.start).entries()) {
    if (m.start < at) continue;
    marked.push(text.slice(at, m.start));
    marked.push(
      <mark key={i} className={m.entityId ? 'bg-primary/20' : 'bg-muted'} aria-label={nameOf(m.entityId)}>
        {text.slice(m.start, m.end)}<sub>{nameOf(m.entityId)}</sub>
      </mark>,
    );
    at = m.end;
  }
  marked.push(text.slice(at));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Mention Reading</DialogTitle>
          <DialogDescription>
            Model {state.status}{state.model ? ` · ${state.model} v${state.version}` : ''}
            {entry ? ` · reading by ${entry.model} v${entry.version}` : ''} · turn {newest?.turnId ?? 'none'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          {!reading ? (
            <Meta>No reading for the newest turn.</Meta>
          ) : (
            <div className="space-y-4 text-body">
              <p className="whitespace-pre-wrap" data-testid="mention-reading-text">
                {marked}
              </p>
              <table className="w-full text-helper" data-testid="mention-reading-quotes">
                <thead><tr><th className="text-left">Quote</th><th className="text-left">Speaker</th></tr></thead>
                <tbody>
                  {reading.quotes.map((q) => (
                    <tr key={`${q.start}:${q.end}`}><td>{text.slice(q.start, q.end)}</td><td>{nameOf(q.speaker)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
