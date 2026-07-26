import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { buildMemoryLedger, type MemoryRow } from '@/lib/memoryView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { HelpButton } from '@/components/HelpButton';
import { Pin, PinOff, RotateCcw, Trash2, Undo2, Pencil, RefreshCw, Plus, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The Memory Manager: the full surface for the story's long-term memory. The side panel stays the
 * at-a-glance ledger; this is where a memory is rewritten, regenerated, deleted or written from scratch.
 *
 * Every change is an override (lib/memoryOverrides) — the AI's original summary is never destroyed, so
 * "revert to original" and "restore" always have something to go back to. Design:
 * docs-internal/memory-editing-design.md.
 */

/** Character count past which the counter warns. A digest runs ~40 words; well past that a memory starts
 *  eating the recap budget it shares with every other memory. Advisory only — never blocks. */
export const MEMORY_SOFT_LIMIT = 400;

type Filter = 'all' | 'kept' | 'letGo' | 'edited' | 'mine' | 'deleted';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kept', label: 'Kept' },
  { id: 'letGo', label: 'Let go' },
  { id: 'edited', label: 'Edited' },
  { id: 'mine', label: 'Mine' },
  { id: 'deleted', label: 'Deleted' },
];

export const MemoryManagerModal = ({
  isOpen,
  onOpenChange,
  onRegenerate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Re-run the digest prompt for a turn; resolves false when there's nothing to summarize or it failed. */
  onRegenerate?: (turnId: string) => Promise<boolean>;
}) => {
  const {
    fullMessageHistory,
    memoryPins, setMemoryPins,
    milestoneSelection,
    memoryEdits, setMemoryEdits,
    memoryDeleted, setMemoryDeleted,
    memoryNotes, setMemoryNotes,
    isWaitingForAI,
  } = useGameplay();
  const { memoryDigests, narrationVerbatimTurns } = useSettings();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // The oldest memory anchors the scene; deleting it is allowed but warned about once (see ledger docs).
  const [confirmOldest, setConfirmOldest] = useState<string | null>(null);

  const ledger = useMemo(
    () => buildMemoryLedger({
      history: fullMessageHistory,
      overrides: { edits: memoryEdits, deleted: memoryDeleted, notes: memoryNotes },
      pins: memoryPins,
      selection: milestoneSelection,
      verbatimFloor: narrationVerbatimTurns,
    }),
    [fullMessageHistory, memoryEdits, memoryDeleted, memoryNotes, memoryPins, milestoneSelection, narrationVerbatimTurns],
  );

  const oldestId = ledger.rows.find((r) => !r.deleted && !r.isNote)?.id;
  const editedCount = ledger.rows.filter((r) => !r.deleted && r.edited === 'player').length;
  const mineCount = ledger.rows.filter((r) => !r.deleted && r.isNote).length;
  const hasChanges =
    Object.keys(memoryEdits).length > 0 || memoryDeleted.length > 0 || memoryNotes.length > 0 || Object.keys(memoryPins).length > 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ledger.rows.filter((r) => {
      if (filter === 'deleted' ? !r.deleted : r.deleted) return false;
      if (filter === 'kept' && !r.kept) return false;
      if (filter === 'letGo' && r.kept) return false;
      if (filter === 'edited' && !r.edited) return false;
      if (filter === 'mine' && !r.isNote) return false;
      if (q && !r.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledger.rows, filter, query]);

  const setPin = (id: string, pin: 'keep' | 'drop' | null) => {
    setMemoryPins((prev) => {
      const next = { ...prev };
      if (pin === null) delete next[id];
      else next[id] = pin;
      return next;
    });
  };

  const startEdit = (row: MemoryRow) => {
    setEditingId(row.id);
    setDraft(row.text);
    setAdding(false);
  };

  const saveEdit = (row: MemoryRow) => {
    const text = draft.trim();
    if (!text) return;
    if (row.isNote) {
      setMemoryNotes((prev) => prev.map((n) => (n.id === row.id ? { ...n, text } : n)));
    } else {
      // A player rewrite is intent: force-keep it, so the selector never quietly lets go of text the
      // player wrote. Clearing the pin later falls back to the stored verdict; the text stays edited.
      setMemoryEdits((prev) => ({ ...prev, [row.id]: { text, source: 'player' } }));
      setPin(row.id, 'keep');
    }
    setEditingId(null);
  };

  const revert = (row: MemoryRow) => {
    setMemoryEdits((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    // The auto-pin came with the edit, so it goes with it — back to the AI's own verdict.
    if (row.edited === 'player') setPin(row.id, null);
  };

  const addNote = () => {
    const text = draft.trim();
    if (!text) return;
    setMemoryNotes((prev) => [
      ...prev,
      // Anchored at the current message-history length, which places it chronologically among the
      // digests and never moves again.
      { id: crypto.randomUUID(), text, anchorTurn: fullMessageHistory.length },
    ]);
    setDraft('');
    setAdding(false);
  };

  const remove = (row: MemoryRow) => {
    if (!row.isNote && row.id === oldestId) { setConfirmOldest(row.id); return; }
    setMemoryDeleted((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
  };

  const restore = (row: MemoryRow) => setMemoryDeleted((prev) => prev.filter((id) => id !== row.id));

  const regenerate = async (row: MemoryRow) => {
    if (!onRegenerate) return;
    setRegenerating(row.id);
    const ok = await onRegenerate(row.id);
    setRegenerating(null);
    if (!ok) { toast.error('Could not rewrite that memory — try again in a moment.'); return; }
    // Regenerating over a rewrite discards the player's text, so the auto-pin that came with it goes too —
    // otherwise a keep-pin outlives the intent that set it, on text the player never wrote.
    if (row.edited === 'player') setPin(row.id, null);
  };

  const resetAll = () => {
    setMemoryEdits({});
    setMemoryDeleted([]);
    setMemoryNotes([]);
    setMemoryPins({});
    setConfirmReset(false);
  };

  const counter = (
    <span className={cn('text-[10px]', draft.length > MEMORY_SOFT_LIMIT ? 'text-amber-500' : 'text-muted-foreground')}>
      {draft.length}
      {draft.length > MEMORY_SOFT_LIMIT && ' — long memories crowd out the rest'}
    </span>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] h-[85dvh] max-h-[85dvh] flex flex-col gap-3">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2">
            Memories
            <HelpButton topicId="game.memoryManager" />
          </DialogTitle>
          <DialogDescription>
            {ledger.keptCount} of {ledger.totalCount} moments remembered
            {editedCount > 0 && ` · ${editedCount} edited`}
            {mineCount > 0 && ` · ${mineCount} yours`}
          </DialogDescription>
        </DialogHeader>

        {!memoryDigests && (
          <p className="rounded border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
            Memory Summaries are off, so the story isn&apos;t building its own memories — but anything you
            write here still rides with the story.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories…"
            className="h-8 flex-grow min-w-[140px] text-xs"
          />
          <Button size="sm" variant="outline" className="h-8" onClick={() => { setAdding(true); setEditingId(null); setDraft(''); }}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add memory
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              size="sm"
              variant={filter === f.id ? 'default' : 'outline'}
              className="h-6 px-2 text-[11px]"
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {adding && (
          <div className="rounded border border-primary/50 p-2 space-y-2">
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Something the story should remember…"
              className="min-h-[80px] text-xs"
            />
            <div className="flex items-center justify-between">
              {counter}
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAdding(false); setDraft(''); }}>Cancel</Button>
                <Button size="sm" className="h-7" onClick={addNote} disabled={!draft.trim()}>Add</Button>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-grow min-h-0 -mx-1 px-1">
          <div className="space-y-1 pb-2">
            {visible.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">
                {ledger.totalCount === 0
                  ? 'Nothing here yet — memories appear as each turn is summarized.'
                  : 'No memories match that.'}
              </p>
            )}
            {visible.map((row, i) => {
              // The Recent divider only means anything against the full chronological list.
              const showDivider = filter === 'all' && !query && i === ledger.recentFrom;
              const isEditing = editingId === row.id;
              return (
                <div key={row.id}>
                  {showDivider && (
                    <div className="flex items-center gap-2 py-1" aria-label="Recent memories">
                      <div className="h-px flex-grow bg-border" />
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Recent</span>
                      <div className="h-px flex-grow bg-border" />
                    </div>
                  )}
                  <div className={cn('rounded border border-border p-2', !row.kept && !isEditing && 'opacity-60')}>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="min-h-[80px] text-xs"
                        />
                        <div className="flex items-center justify-between">
                          {counter}
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}>
                              <X className="mr-1 h-3.5 w-3.5" /> Cancel
                            </Button>
                            <Button size="sm" className="h-7" onClick={() => saveEdit(row)} disabled={!draft.trim()}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Save
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-2">
                          <p className={cn('flex-grow text-xs', !row.kept && 'line-through')}>{row.text}</p>
                          <div className="flex flex-shrink-0 items-center gap-0.5">
                            {row.deleted ? (
                              <Button variant="ghost" size="icon" className="h-6 w-6" title="Restore this memory" onClick={() => restore(row)}>
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <>
                                {row.edited && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Revert to the original" onClick={() => revert(row)}>
                                    <Undo2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6" title="Edit this memory" onClick={() => startEdit(row)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {!row.isNote && onRegenerate && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    // Editing stays live mid-turn, but a regeneration is an AI request:
                                    // it waits for the turn rather than contending with it.
                                    title={isWaitingForAI ? 'Wait for the current turn to finish' : 'Have the story write this memory again'}
                                    disabled={regenerating !== null || isWaitingForAI}
                                    onClick={() => regenerate(row)}
                                  >
                                    {regenerating === row.id
                                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      : <RefreshCw className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                                {!row.isNote && row.pin && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Clear pin (let the story decide)" onClick={() => setPin(row.id, null)}>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {!row.isNote && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn('h-6 w-6', row.pin && 'text-primary')}
                                    title={row.kept ? 'Forget this memory' : 'Pin this memory'}
                                    onClick={() => setPin(row.id, row.kept ? 'drop' : 'keep')}
                                  >
                                    {row.kept ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-6 w-6" title="Delete this memory" onClick={() => remove(row)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {row.isNote && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Yours</Badge>}
                          {/* A deleted row has no ordinal — the remaining memories renumbered without it. */}
                          {!row.isNote && row.turnNumber > 0 && (
                            <span className="text-[9px] text-muted-foreground">Moment {row.turnNumber}</span>
                          )}
                          {row.edited === 'player' && <Badge variant="outline" className="h-4 px-1 text-[9px]">Edited</Badge>}
                          {row.edited === 'ai' && <Badge variant="outline" className="h-4 px-1 text-[9px]">Rewritten</Badge>}
                          {row.deleted && <Badge variant="outline" className="h-4 px-1 text-[9px]">Deleted</Badge>}
                        </div>
                        {row.edited && row.original && (
                          <p className="mt-1 border-l-2 border-border pl-2 text-[10px] text-muted-foreground">
                            Originally: {row.original}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-end border-t border-border pt-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={!hasChanges} onClick={() => setConfirmReset(true)}>
            Reset all my changes
          </Button>
        </div>
      </DialogContent>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={(o) => !o && setConfirmReset(false)}
        title="Reset every memory change?"
        description="Your edits, deletions, pins and hand-written memories all go away, leaving only what the story remembered on its own. This can't be undone."
        onConfirm={resetAll}
      />
      <ConfirmDialog
        open={confirmOldest !== null}
        onOpenChange={(o) => !o && setConfirmOldest(null)}
        title="Delete the story's opening memory?"
        description="This is the earliest thing the story remembers, and it's what keeps later scenes anchored to how everything began. Without it the story may re-establish the scene from scratch."
        onConfirm={() => {
          if (confirmOldest) setMemoryDeleted((prev) => (prev.includes(confirmOldest) ? prev : [...prev, confirmOldest]));
          setConfirmOldest(null);
        }}
      />
    </Dialog>
  );
};
