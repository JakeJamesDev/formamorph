import { useEffect, useMemo, useState } from 'react';
import { useDevRoute } from '@/lib/devRouter';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { buildMemoryLedger, matchesMemoryFilter, MEMORY_FILTER_LABELS, MEMORY_FILTER_COUNT_LABELS, type MemoryFilter } from '@/lib/memoryView';
import { MemoryManagerModal } from '@/components/modals/MemoryManagerModal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pin, PinOff, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The Memory side-panel tab: the story's long-term memory at a glance. Lists every memory with the AI
 * selector's verdict (kept vs let go) and lets the player pin one in or out; a pin overrides the
 * selection until cleared. Recent turns (the verbatim floor) sit under the Recent divider — their verdict
 * is display-only until they age out, because they ride in context verbatim regardless.
 *
 * Rewriting, deleting, regenerating and hand-writing memories live one click away in the Memory Manager
 * (`MemoryManagerModal`); both surfaces read the same ledger so they can't disagree.
 */

/** Ordered by how present a memory is. The Manager carries the rest. */
const PANEL_FILTERS: MemoryFilter[] = ['all', 'verbatim', 'summary', 'held', 'custom'];

export const MemoryPanel = ({ onRegenerateMemory }: {
  onRegenerateMemory?: (turnId: string) => Promise<boolean>;
}) => {
  const {
    fullMessageHistory,
    memoryPins, setMemoryPins,
    milestoneSelection,
    memoryEdits, memoryDeleted, memoryNotes,
    gameTime, calendar,
    contextMemoryIds, rehydratedMemoryIds,
  } = useGameplay();
  const { memoryDigests, narrationVerbatimTurns, aiClock } = useSettings();
  const [managerOpen, setManagerOpen] = useState(false);
  // A subset of the Manager's chips: the ones that answer "is this in the story right now", plus Custom.
  // Editing states (Let Go, Edited, Deleted) belong to the Manager, where you can act on them.
  const [filter, setFilter] = useState<MemoryFilter>('all');

  // DEV-only: land straight on the manager (`#dev?view=gameViewer&modal=memoryManager`).
  const devRoute = useDevRoute();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (devRoute?.modal === 'memoryManager') setManagerOpen(true);
  }, [devRoute?.modal]);

  const ledger = useMemo(
    () => buildMemoryLedger({
      history: fullMessageHistory,
      overrides: { edits: memoryEdits, deleted: memoryDeleted, notes: memoryNotes },
      pins: memoryPins,
      selection: milestoneSelection,
      verbatimFloor: narrationVerbatimTurns,
      // Ages are shown only while the clock measures each turn; the flat hour would date them arbitrarily.
      clock: aiClock ? { nowHours: gameTime, calendar } : undefined,
      context: { bandIds: contextMemoryIds, rehydratedIds: rehydratedMemoryIds },
    }),
    [fullMessageHistory, memoryEdits, memoryDeleted, memoryNotes, memoryPins, milestoneSelection, narrationVerbatimTurns, aiClock, gameTime, calendar, contextMemoryIds, rehydratedMemoryIds],
  );

  const setPin = (id: string, pin: 'keep' | 'drop' | null) => {
    setMemoryPins((prev) => {
      const next = { ...prev };
      if (pin === null) delete next[id];
      else next[id] = pin;
      return next;
    });
  };

  const manageButton = (
    <Button variant="outline" size="sm" className="h-7 w-full text-meta" onClick={() => setManagerOpen(true)}>
      <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Manage Memories
    </Button>
  );
  const manager = (
    <MemoryManagerModal isOpen={managerOpen} onOpenChange={setManagerOpen} onRegenerate={onRegenerateMemory} />
  );

  const rows = ledger.rows.filter((r) => matchesMemoryFilter(r, filter));
  // The divider marks a boundary in the full chronological list; under a filter it would point at nothing.
  const dividerAt = filter === 'all' ? ledger.recentFrom : -1;
  // The empty states below are about the ledger, not the filter — a chip that matches nothing must not
  // read as "memory is off".
  const anyRows = ledger.rows.some((r) => !r.deleted);

  if (!memoryDigests && !anyRows) {
    return (
      <div className="space-y-2 p-2">
        <p className="text-helper text-muted-foreground">
          Memory is off. Enable Memory Summaries in Settings to build a long-term memory of the story — or
          write your own memories by hand.
        </p>
        {manageButton}
        {manager}
      </div>
    );
  }
  if (!anyRows) {
    return (
      <div className="space-y-2 p-2">
        <p className="text-helper text-muted-foreground">
          Nothing here yet — memories appear as each turn is summarized.
        </p>
        {manageButton}
        {manager}
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Pinned: the count and the way into the manager stay reachable however far the list is scrolled. */}
        <div className="flex-shrink-0 space-y-1 border-b border-border p-2">
          {manageButton}
          <p className="text-meta text-muted-foreground">
            {filter === 'all'
              ? `${ledger.totalCount} ${MEMORY_FILTER_COUNT_LABELS.all}`
              : `${rows.length} of ${ledger.totalCount} ${MEMORY_FILTER_COUNT_LABELS[filter]}`}
          </p>
          <div className="flex flex-wrap gap-1">
            {PANEL_FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? 'default' : 'outline'}
                className="h-5 px-1.5 text-[10px]"
                onClick={() => setFilter(f)}
              >
                {MEMORY_FILTER_LABELS[f]}
              </Button>
            ))}
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-grow">
          <div className="p-2 space-y-1">
            {rows.length === 0 && (
              <p className="p-1 text-meta text-muted-foreground">No memories match that.</p>
            )}
            {rows.map((row, i) => (
              <div key={row.id}>
                {i === dividerAt && (
                  <div className="flex items-center gap-2 py-1" aria-label="Recent Memories">
                    <div className="h-px flex-grow bg-border" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Recent</span>
                    <div className="h-px flex-grow bg-border" />
                  </div>
                )}
                {/* The accent marks the minority state — what actually reached the model last turn. In a
                    long story most kept memories sit out any given turn, so marking those instead would
                    fade the whole panel and leave the informative row unmarked. */}
                <div
                  title={row.asScene ? 'Sent as a full scene last turn' : row.inContext ? 'Sent to the story last turn' : undefined}
                  className={cn(
                    'group flex items-start gap-1 rounded border border-border p-2',
                    !row.kept && 'opacity-50',
                    row.isNote && 'border-primary/40',
                    row.inContext && 'border-l-2 border-l-primary',
                  )}
                >
                  <div className="flex-grow">
                    <p className={cn('text-meta', !row.kept && 'line-through')}>{row.text}</p>
                    {row.stamp && <p className="mt-0.5 text-[10px] text-muted-foreground">{row.stamp}</p>}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-0.5">
                    {row.pin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Clear Pin (Let the Story Decide)"
                        onClick={() => setPin(row.id, null)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {/* Player-written memories are never judged, so there is nothing to pin against. */}
                    {!row.isNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-6 w-6', row.pin && 'text-primary')}
                        title={row.kept ? 'Forget This Memory' : 'Pin This Memory'}
                        onClick={() => setPin(row.id, row.kept ? 'drop' : 'keep')}
                      >
                        {row.kept ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
      {manager}
    </>
  );
};
