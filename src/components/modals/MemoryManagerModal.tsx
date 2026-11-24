import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'react-toastify';
import { useGameplay } from '@/contexts/GameplayContext';
import { useSettings } from '@/contexts/SettingsContext';
import { buildMemoryLedger, matchesMemoryFilter, MEMORY_FILTER_LABELS, MEMORY_FILTER_COUNT_LABELS, memorySentTip, CLEAR_PIN_LABEL, type MemoryRow, type MemoryFilter } from '@/lib/memoryView';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, dialogTitleControl } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { RegeneratePreview } from './RegeneratePreview';
import { HelpButton } from '@/components/HelpButton';
import { Pin, PinOff, RotateCcw, Trash2, Undo2, Pencil, RefreshCw, Plus, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { randomUUID } from '@/lib/uuid';
import { playerEdit, restoreAll, restoreMemory } from '@/lib/namedMemories';
import {
  deletedMemoryIds, hasDiaryChanges, hasMemoryChanges, withDiaryDeleted, withDiaryText, withMemoryDeleted, withMemoryText,
  withoutDiaryChanges, withoutDiaryText, withoutMemoryChanges, withoutMemoryText,
} from '@/lib/turnTextEdits';
import { buildDiaries, diaryCounts, diaryKey, visibleDiaryEntries, type DiaryEntry } from '@/lib/diaryView';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { NavRail, type NavRailGroup } from '@/components/NavRail';
import { EditorSectionsBar } from '@/components/editor/EditorSectionsBar';
import { useIsMobile } from '@/lib/useIsMobile';
import { NotebookPen, ScrollText } from 'lucide-react';
import { MemoryDiaryView, type DiaryEntryActions } from './MemoryDiaryView';

/**
 * The Memory Manager: the full surface for the story's long-term memory. The side panel stays the
 * at-a-glance ledger; this is where a memory is rewritten, regenerated, deleted or written from scratch.
 *
 * Every change lands in the text edit layer (lib/turnTextEdits) — the AI's original summary is never destroyed, so
 * "revert to original" and "restore" always have something to go back to. Design:
 * docs-internal/designs/memory-editing/design.md.
 */

/** Character count past which the counter warns. A digest runs ~40 words; well past that a memory starts
 *  eating the recap budget it shares with every other memory. Advisory only — never blocks. */
export const MEMORY_SOFT_LIMIT = 400;

/** Ordered by how present a memory is, most first: whole text, sent as a summary, merely kept. */
const FILTERS: MemoryFilter[] = ['all', 'verbatim', 'summary', 'held', 'letGo', 'edited', 'custom', 'deleted'];

const STORY_VIEW = 'story';
/** A diary's tab value. The prefix keeps a character named "story" apart. */
const diaryTabValue = (name: string) => `diary:${diaryKey(name)}`;
const RAIL_STORAGE_KEY = 'formamorph.memories.navRail';

export const MemoryManagerModal = ({
  isOpen,
  onOpenChange,
  onRegenerate,
  onRegenerateDiary,
  initialDiary,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The diary to open on, by name; Story when absent or when the save has no such diary. */
  initialDiary?: string;
  /** Re-run the digest prompt for a turn, waiting behind other AI work; `signal` cancels it. Resolves the new
   *  text, null when there's nothing to summarize or it failed, and undefined when it was canceled. */
  onRegenerate?: (turnId: string, signal: AbortSignal) => Promise<string | null | undefined>;
  /** Re-run the diary pass for one turn and name, as `onRegenerate` does for a memory. */
  onRegenerateDiary?: (turnId: string, name: string, signal: AbortSignal) => Promise<string | null | undefined>;
}) => {
  const {
    fullMessageHistory,
    memoryPins, setMemoryPins,
    milestoneSelection,
    turnTextEdits, setTurnTextEdits,
    memoryNotes, setMemoryNotes,
    gameTime, calendar,
    contextMemoryIds, rehydratedMemoryIds,
  } = useGameplay();
  const { memoryDigests, narrationVerbatimTurns, aiClock, characterDiaries } = useSettings();
  const isMobile = useIsMobile();

  const [view, setView] = useState(STORY_VIEW);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MemoryFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  // A regenerated text waits here for Keep or Discard; closing the window drops it.
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  // Closing the window drops the preview and a request that still waits or runs.
  useEffect(() => {
    if (isOpen) return;
    regenerateAbortRef.current?.abort();
    setRegenerating(null);
    setPreview(null);
  }, [isOpen]);
  // Each opening starts on the asked-for diary, or on Story.
  useEffect(() => {
    if (!isOpen) return;
    setView(initialDiary ? diaryTabValue(initialDiary) : STORY_VIEW);
    setQuery('');
    setShowHidden(false);
  }, [isOpen, initialDiary]);
  const [confirmReset, setConfirmReset] = useState(false);
  // The oldest memory anchors the scene; deleting it is allowed but warned about once (see ledger docs).
  const [confirmOldest, setConfirmOldest] = useState<string | null>(null);
  const regenerateAbortRef = useRef<AbortController | null>(null);
  // Leaving the game drops a regeneration that still waits or runs.
  useEffect(() => () => regenerateAbortRef.current?.abort(), []);

  const ledger = useMemo(
    () => buildMemoryLedger({
      history: fullMessageHistory,
      overrides: { textEdits: turnTextEdits, notes: memoryNotes },
      pins: memoryPins,
      selection: milestoneSelection,
      verbatimFloor: narrationVerbatimTurns,
      // Ages are shown only while the clock measures each turn; the flat hour would date them arbitrarily.
      clock: aiClock ? { nowHours: gameTime, calendar } : undefined,
      context: { bandIds: contextMemoryIds, rehydratedIds: rehydratedMemoryIds },
    }),
    [fullMessageHistory, turnTextEdits, memoryNotes, memoryPins, milestoneSelection, narrationVerbatimTurns, aiClock, gameTime, calendar, contextMemoryIds, rehydratedMemoryIds],
  );

  const oldestId = ledger.rows.find((r) => !r.deleted && !r.isNote)?.id;
  const editedCount = ledger.rows.filter((r) => !r.deleted && r.edited === 'player').length;
  const mineCount = ledger.rows.filter((r) => !r.deleted && r.isNote).length;
  const hasChanges = hasMemoryChanges(turnTextEdits) || Object.keys(memoryPins).length > 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ledger.rows.filter((r) => {
      if (r.id === preview?.id) return true; // a pending preview never hides behind a chip or a search
      if (!matchesMemoryFilter(r, filter)) return false;
      if (q && !r.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledger.rows, filter, query, preview?.id]);

  const diaries = useMemo(() => buildDiaries(fullMessageHistory, turnTextEdits), [fullMessageHistory, turnTextEdits]);

  // The turn can vanish while the preview is open (undo, re-roll): the preview closes and nothing is written.
  useEffect(() => {
    if (!preview) return;
    const live = ledger.rows.some((r) => r.id === preview.id)
      || diaries.some((d) => d.entries.some((e) => e.key === preview.id && !e.deleted));
    if (!live) setPreview(null);
  }, [preview, ledger.rows, diaries]);
  // A diary the save doesn't have shows Story; each opening sets the view again.
  const diary = view === STORY_VIEW ? undefined : diaries.find((d) => diaryTabValue(d.name) === view);
  const shownView = diary ? view : STORY_VIEW;

  const selectView = (next: string) => {
    setView(next);
    setQuery('');
    setAdding(false);
    setEditingId(null);
  };

  const memoryByTurn = useMemo(
    () => new Map(ledger.rows.filter((r) => !r.isNote && !r.deleted && r.text).map((r) => [r.id, r.text])),
    [ledger.rows],
  );
  const counts = diary ? diaryCounts(diary) : { read: 0, hidden: 0 };
  const diaryEntries = useMemo(
    () => (diary ? visibleDiaryEntries(diary, { query, showHidden }) : []),
    [diary, query, showHidden],
  );
  let diaryEmptyText: ReactNode = 'No entries to show.';
  if (query.trim()) diaryEmptyText = 'No entries match that.';
  else if (!showHidden && counts.hidden > 0) {
    diaryEmptyText = <>Every entry here is hidden. Turn on <strong>Show Hidden Entries</strong> to see them.</>;
  }

  const railGroups: NavRailGroup[] = [
    { id: 'story', tabs: [{ value: STORY_VIEW, label: 'Story', icon: ScrollText }] },
    { id: 'diaries', tabs: diaries.map((d) => ({ value: diaryTabValue(d.name), label: `${d.name}'s Diary`, icon: NotebookPen })) },
  ];
  const railed = diaries.length > 0;

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
      setMemoryNotes((prev) => playerEdit(prev, row.id, text));
    } else {
      // A player rewrite is intent: force-keep it, so the selector never quietly lets go of text the
      // player wrote. Clearing the pin later falls back to the stored verdict; the text stays edited.
      setTurnTextEdits((prev) => withMemoryText(prev, row.id, text, 'player'));
      setPin(row.id, 'keep');
    }
    setEditingId(null);
  };

  const revert = (row: MemoryRow) => {
    setTurnTextEdits((prev) => withoutMemoryText(prev, row.id));
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
      { id: randomUUID(), text, anchorTurn: fullMessageHistory.length },
    ]);
    setDraft('');
    setAdding(false);
  };

  const remove = (row: MemoryRow) => {
    if (!row.isNote && row.id === oldestId) { setConfirmOldest(row.id); return; }
    setTurnTextEdits((prev) => withMemoryDeleted(prev, row.id, true));
  };

  // The notes update reads the latest notes, so a turn that lands while the dialog is open keeps its writes. The
  // taken-name check reads the deletions of this render.
  const restore = (row: MemoryRow) => {
    setMemoryNotes((prev) => restoreMemory(prev, deletedMemoryIds(turnTextEdits), row.id).notes);
    setTurnTextEdits((prev) => withMemoryDeleted(prev, row.id, false));
  };

  /** Runs one regenerate for `id` and opens its preview. One runs at a time across the window. */
  const runRegenerate = async (
    id: string, run: (signal: AbortSignal) => Promise<string | null | undefined>, failure: string,
  ) => {
    const controller = new AbortController();
    regenerateAbortRef.current = controller;
    setRegenerating(id);
    const text = await run(controller.signal);
    if (controller.signal.aborted) return; // the Cancel press already reset the row
    setRegenerating(null);
    if (text === undefined) return; // the queue canceled it
    if (!text) { toast.error(failure); return; }
    setPreview({ id, text });
  };

  const regenerate = (row: MemoryRow) => {
    if (!onRegenerate) return;
    void runRegenerate(row.id, (signal) => onRegenerate(row.id, signal), 'Could not rewrite that memory — try again in a moment.');
  };

  const keepPreview = (row: MemoryRow, text: string) => {
    setPreview(null);
    setTurnTextEdits((prev) => withMemoryText(prev, row.id, text, 'ai'));
    // Keeping over a rewrite discards the player's text, so the auto-pin that came with it goes too —
    // otherwise a keep-pin outlives the intent that set it, on text the player never wrote.
    if (row.edited === 'player') setPin(row.id, null);
  };

  const cancelRegenerate = () => {
    regenerateAbortRef.current?.abort();
    regenerateAbortRef.current = null;
    setRegenerating(null);
  };

  const resetAll = () => {
    if (diary) {
      const { name } = diary;
      setTurnTextEdits((prev) => withoutDiaryChanges(prev, name));
    } else {
      setMemoryNotes((prev) => restoreAll(prev, deletedMemoryIds(turnTextEdits)).notes);
      setTurnTextEdits(withoutMemoryChanges);
      setMemoryPins({});
    }
    setConfirmReset(false);
  };
  const canReset = diary ? hasDiaryChanges(turnTextEdits, diary.name) : hasChanges;

  const counter = (
    <span className={cn('text-[10px]', !diary && draft.length > MEMORY_SOFT_LIMIT ? 'text-amber-500' : 'text-muted-foreground')}>
      {draft.length}
      {!diary && draft.length > MEMORY_SOFT_LIMIT && ' · Long memories leave less room for the others'}
    </span>
  );

  /** The edit box for the row or entry being edited. */
  const editor = (onSave: () => void) => (
    <div className="space-y-2">
      <Textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[80px] text-meta"
      />
      <div className="flex items-center justify-between">
        {counter}
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button size="sm" className="h-7" onClick={onSave} disabled={!draft.trim()}>
            <Check className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );

  const editingEntry = diary?.entries.find((e) => e.key === editingId);
  const saveDiaryEdit = (entry: DiaryEntry) => {
    const text = draft.trim();
    if (!text) return;
    setTurnTextEdits((prev) => withDiaryText(prev, entry.turnId, entry.name, text, 'player'));
    setEditingId(null);
  };
  const diaryActions: DiaryEntryActions = {
    editingKey: editingEntry ? editingEntry.key : null,
    editor: editingEntry ? editor(() => saveDiaryEdit(editingEntry)) : null,
    // A quiet entry starts empty: "nothing notable" is the AI's marker, not text to keep.
    onEdit: (entry) => { setEditingId(entry.key); setDraft(entry.quiet ? '' : entry.text); setAdding(false); },
    onRevert: (entry) => setTurnTextEdits((prev) => withoutDiaryText(prev, entry.turnId, entry.name)),
    onDelete: (entry) => setTurnTextEdits((prev) => withDiaryDeleted(prev, entry.turnId, entry.name, true)),
    onRestore: (entry) => setTurnTextEdits((prev) => withDiaryDeleted(prev, entry.turnId, entry.name, false)),
    onRegenerate: onRegenerateDiary && ((entry) => {
      void runRegenerate(
        entry.key, (signal) => onRegenerateDiary(entry.turnId, entry.name, signal), "Couldn't rewrite that entry. Try again in a moment.",
      );
    }),
    onCancelRegenerate: () => cancelRegenerate(),
    regeneratingKey: regenerating,
    regenerateBlocked: regenerating !== null || preview !== null,
    preview: preview && { key: preview.id, text: preview.text },
    onKeep: (entry, text) => {
      setPreview(null);
      setTurnTextEdits((prev) => withDiaryText(prev, entry.turnId, entry.name, text, 'ai'));
    },
    onDiscard: () => setPreview(null),
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent surface="memoryManager" className={cn('sm:max-w-[720px] h-[85dvh] max-h-[85dvh] flex flex-col gap-3', railed && !isMobile && 'sm:max-w-[900px]')}>
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2">
            Memories
            <HelpButton topicId="game.memoryManager" className={dialogTitleControl} />
          </DialogTitle>
          <DialogDescription>
            {diary ? (
              <>
                {`${counts.read} ${counts.read === 1 ? 'entry' : 'entries'}`}
                {counts.hidden > 0 && ` · ${counts.hidden} hidden`}
              </>
            ) : (
              <>
                {filter === 'all'
                  ? `${ledger.totalCount} ${MEMORY_FILTER_COUNT_LABELS.all}`
                  : `${visible.length} of ${ledger.totalCount} ${MEMORY_FILTER_COUNT_LABELS[filter]}`}
                {editedCount > 0 && ` · ${editedCount} edited`}
                {mineCount > 0 && ` · ${mineCount} yours`}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={shownView}
          onValueChange={selectView}
          orientation="vertical"
          activationMode={isMobile ? 'manual' : 'automatic'}
          className={cn('flex min-h-0 flex-1 gap-3', isMobile && 'flex-col')}
        >
          {railed && (isMobile ? (
            <EditorSectionsBar
              groups={railGroups}
              label="Memory Sections"
              bodyId="memory-sections"
              value={shownView}
              open={sectionsOpen}
              onOpenChange={setSectionsOpen}
            />
          ) : (
            <NavRail groups={railGroups} value={shownView} label="Memory Sections" storageKey={RAIL_STORAGE_KEY} className="-my-1" />
          ))}
          <TabsContent value={shownView} className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col gap-3">

            {!diary && !memoryDigests && (
              <Meta as="p" className="rounded border border-border bg-muted/40 p-2">
                <strong>Memory Summaries</strong> is off, so the story writes no memories of its own. Memories you add or edit
                here still go to the AI.
              </Meta>
            )}
            {diary && !characterDiaries && (
              <Meta as="p" className="rounded border border-border bg-muted/40 p-2">
                <strong>Character Diaries</strong> is off, so characters write no new diary entries.
              </Meta>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder={diary ? `Search ${diary.name}'s diary` : 'Search memories'}
                size="sm"
                className="flex-grow min-w-[140px]"
              />
              {!diary && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => { setAdding(true); setEditingId(null); setDraft(''); }}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Memory
                </Button>
              )}
            </div>
            {diary ? (
              <label className="flex h-6 cursor-pointer items-center gap-2 text-meta">
                <Checkbox checked={showHidden} onCheckedChange={(v) => setShowHidden(v === true)} className="shrink-0" />
                <span>Show Hidden Entries</span>
              </label>
            ) : (
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? 'default' : 'outline'}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setFilter(f)}
                >
                  {MEMORY_FILTER_LABELS[f]}
                </Button>
              ))}
            </div>
            )}

            {adding && (
              <div className="rounded border border-primary/50 p-2 space-y-2">
                <Textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write something the story should remember"
                  className="min-h-[80px] text-meta"
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
              {diary ? (
                <MemoryDiaryView
                  name={diary.name}
                  entries={diaryEntries}
                  memoryByTurn={memoryByTurn}
                  emptyText={diaryEmptyText}
                  showHidden={showHidden}
                  actions={diaryActions}
                />
              ) : (
              <div className="space-y-1 pb-2">
                {visible.length === 0 && (
                  <Meta as="p" className="p-2">
                    {ledger.totalCount === 0
                      ? 'No memories yet. A memory appears when a turn is summarized.'
                      : 'No memories match that.'}
                  </Meta>
                )}
                {visible.map((row, i) => {
                  // The Recent divider only means anything against the full chronological list.
                  const showDivider = filter === 'all' && !query && i === ledger.recentFrom;
                  const isEditing = editingId === row.id;
                  return (
                    <div key={row.id}>
                      {showDivider && (
                        <div className="flex items-center gap-2 py-1" aria-label="Recent Memories">
                          <div className="h-hairline flex-grow bg-border" />
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Recent</span>
                          <div className="h-hairline flex-grow bg-border" />
                        </div>
                      )}
                      {/* Accent marks what actually reached the model last turn — the minority state, and the
                          one the panel can't otherwise tell you. See MemoryPanel for the reasoning. */}
                      <div
                        className={cn(
                          'rounded border border-border p-2',
                          !row.kept && !isEditing && 'opacity-60',
                          row.inContext && !isEditing && 'border-l-2 border-l-primary',
                        )}
                      >
                        {isEditing ? editor(() => saveEdit(row)) : preview?.id === row.id ? (
                          <RegeneratePreview
                            current={row.text}
                            proposed={preview.text}
                            onKeep={() => keepPreview(row, preview.text)}
                            onDiscard={() => setPreview(null)}
                          />
                        ) : (
                          <>
                            <div className="flex items-start gap-2">
                              {/* The tip is on the text, not the row: a row-wide trigger would also fire under
                                  the action buttons, which have tips of their own. It covers the same span as the
                                  accent it explains, which is hidden while editing. */}
                              <Tip
                                labelsChild={false}
                                tip={memorySentTip(row)}
                              >
                                <p className={cn('flex-grow text-meta', !row.kept && 'line-through')}>{row.text}</p>
                              </Tip>
                              <div className="flex flex-shrink-0 items-center gap-0.5">
                                {row.deleted ? (
                                  <Tip tip="Restore This Memory">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => restore(row)}>
                                      <Undo2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </Tip>
                                ) : (
                                  <>
                                    {row.edited && (
                                      <Tip tip="Revert to the Original">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => revert(row)}>
                                          <Undo2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </Tip>
                                    )}
                                    <Tip tip="Edit This Memory">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(row)}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </Tip>
                                    {!row.isNote && onRegenerate && regenerating === row.id && (
                                      <Tip tip="Cancel Rewrite">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelRegenerate}>
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </Tip>
                                    )}
                                    {!row.isNote && onRegenerate && (
                                      // A regeneration is an AI request: it waits behind the turn and the
                                      // background passes, with a spinner and a cancel, rather than contending.
                                      <Tip tip="Have the Story Write This Memory Again">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          disabled={regenerating !== null || preview !== null}
                                          onClick={() => regenerate(row)}
                                        >
                                          {regenerating === row.id
                                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            : <RefreshCw className="h-3.5 w-3.5" />}
                                        </Button>
                                      </Tip>
                                    )}
                                    {!row.isNote && row.pin && (
                                      <Tip tip={CLEAR_PIN_LABEL}>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPin(row.id, null)}>
                                          <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                      </Tip>
                                    )}
                                    {!row.isNote && (
                                      <Tip tip={row.kept ? 'Forget This Memory' : 'Pin This Memory'}>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={cn('h-6 w-6', row.pin && 'text-primary')}
                                          onClick={() => setPin(row.id, row.kept ? 'drop' : 'keep')}
                                        >
                                          {row.kept ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                                        </Button>
                                      </Tip>
                                    )}
                                    <Tip tip="Delete This Memory">
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(row)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </Tip>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              {row.isNote && <Badge variant="secondary" className="h-4 px-1 text-[9px]">Yours</Badge>}
                              {row.name && <Badge variant="outline" className="h-4 px-1 text-[9px]">{row.name}</Badge>}
                              {/* Rehydration replaces the digest with the turn's original prose, so this row
                                  reached the model as a great deal more than the sentence shown here. */}
                              {row.asScene && <Badge variant="outline" className="h-4 px-1 text-[9px]">Scene</Badge>}
                              {/* A deleted row has no ordinal — the remaining memories renumbered without it. */}
                              {!row.isNote && row.turnNumber > 0 && (
                                <span className="text-[9px] text-muted-foreground">Memory {row.turnNumber}</span>
                              )}
                              {row.stamp && (
                                <span className="text-[9px] text-muted-foreground">
                                  {!row.isNote && row.turnNumber > 0 && '· '}{row.stamp}
                                </span>
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
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end border-t border-border pt-2">
          <Button size="sm" variant="ghost" className="h-7 text-meta text-muted-foreground" disabled={!canReset} onClick={() => setConfirmReset(true)}>
            Reset All My Changes
          </Button>
        </div>
      </DialogContent>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={(o) => !o && setConfirmReset(false)}
        {...(diary ? {
          title: `Reset Every Change to ${diary.name}'s Diary?`,
          description: "Your edits, kept rewrites and deletions in this diary are removed. Other diaries and the story's memories stay. This can't be undone.",
        } : {
          title: 'Reset Every Memory Change?',
          description: "Your edits, deletions and pins are removed. The memories you wrote yourself stay. This can't be undone.",
        })}
        onConfirm={resetAll}
      />
      <ConfirmDialog
        open={confirmOldest !== null}
        onOpenChange={(o) => !o && setConfirmOldest(null)}
        title="Delete the Story's Opening Memory?"
        description="It's the earliest thing the story remembers, and it keeps later scenes consistent with how the story began. Without it, the AI may set up the scene again from the start."
        onConfirm={() => {
          if (confirmOldest) setTurnTextEdits((prev) => withMemoryDeleted(prev, confirmOldest, true));
          setConfirmOldest(null);
        }}
      />
    </Dialog>
  );
};
