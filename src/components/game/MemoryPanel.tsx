import { useMemo } from 'react';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { parseTurns } from '@/lib/turnBanding';
import { milestoneCandidates, agedMilestoneCandidates, resolveMilestoneKeep, type MilestoneSelection } from '@/lib/milestoneMemory';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pin, PinOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The Memory side-panel tab: the story's long-term memory as the player can shape it. Lists every
 * old-band digest with the AI selector's verdict (kept vs let go) and lets the player pin a memory in
 * or out; a pin overrides the selection until cleared. Recent turns (the verbatim floor and the
 * unfiltered recent band) are not listed — they always ride in context.
 */
export const MemoryPanel = () => {
  const { fullMessageHistory, memoryPins, setMemoryPins, milestoneSelection } = useGameplay();
  const { memoryDigests, narrationVerbatimTurns } = useSettings();

  const { candidates, keep, recentFrom } = useMemo(() => {
    const turns = parseTurns(fullMessageHistory);
    const cands = milestoneCandidates(turns);
    // Entries past the aged window are "Recent": their memory + verdict show the turn they form, but
    // they still ride in context verbatim regardless — the verdict takes effect only once aged.
    const agedCount = agedMilestoneCandidates(turns, narrationVerbatimTurns).length;
    const selection: MilestoneSelection | null = milestoneSelection
      ? {
          seen: new Set(milestoneSelection.seen),
          selected: milestoneSelection.selected === null ? null : new Set(milestoneSelection.selected),
        }
      : null;
    return { candidates: cands, keep: resolveMilestoneKeep(cands, selection, memoryPins), recentFrom: agedCount };
  }, [fullMessageHistory, narrationVerbatimTurns, milestoneSelection, memoryPins]);

  const setPin = (turnId: string, pin: 'keep' | 'drop' | null) => {
    setMemoryPins((prev) => {
      const next = { ...prev };
      if (pin === null) delete next[turnId];
      else next[turnId] = pin;
      return next;
    });
  };

  if (!memoryDigests) {
    return (
      <p className="p-2 text-sm text-muted-foreground">
        Memory is off. Enable Memory Digests in Settings to build a long-term memory of the story.
      </p>
    );
  }
  if (candidates.length === 0) {
    return (
      <p className="p-2 text-sm text-muted-foreground">
        Nothing here yet — memories appear as each turn is summarized.
      </p>
    );
  }

  const keptCount = candidates.filter((t) => t.turnId && keep.has(t.turnId)).length;
  return (
    <ScrollArea className="h-[calc(100%-1rem)]">
      <div className="p-2 space-y-1">
        <p className="text-xs text-muted-foreground mb-2">
          {keptCount} of {candidates.length} moments remembered. Faded lines have been let go —
          pin one to keep it in the story&apos;s memory.
        </p>
        {candidates.map((t, i) => {
          const id = t.turnId;
          if (!id) return null;
          const kept = keep.has(id);
          const pin = memoryPins[id];
          return (
            <div key={id}>
              {i === recentFrom && (
                <div className="flex items-center gap-2 py-1" aria-label="Recent memories">
                  <div className="h-px flex-grow bg-border" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Recent</span>
                  <div className="h-px flex-grow bg-border" />
                </div>
              )}
              <div
                className={cn(
                  'group flex items-start gap-1 rounded border border-border p-2',
                  !kept && 'opacity-50',
                )}
              >
              <p className={cn('flex-grow text-xs', !kept && 'line-through')}>{t.summary}</p>
              <div className="flex flex-shrink-0 items-center gap-0.5">
                {pin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Clear pin (let the story decide)"
                    onClick={() => setPin(id, null)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('h-6 w-6', pin && 'text-primary')}
                  title={kept ? 'Forget this memory' : 'Pin this memory'}
                  onClick={() => setPin(id, kept ? 'drop' : 'keep')}
                >
                  {kept ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </Button>
              </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
};
