import type { ReactNode } from 'react';
import { Loader2, Pencil, RefreshCw, Trash2, Undo2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import type { DiaryEntry } from '@/lib/diaryView';
import { diaryHoldsMemory } from '@/lib/turnDigest';
import { cn } from '@/lib/utils';
import { RegeneratePreview } from './RegeneratePreview';

/** What a diary entry's controls do. The window owns the state; this view only shows it. */
export interface DiaryEntryActions {
  /** The entry being edited, by key, and its editor. */
  editingKey: string | null;
  editor: ReactNode;
  onEdit(entry: DiaryEntry): void;
  onRevert(entry: DiaryEntry): void;
  onDelete(entry: DiaryEntry): void;
  onRestore(entry: DiaryEntry): void;
  /** Absent: the game can't regenerate here, so the control doesn't show. */
  onRegenerate?: (entry: DiaryEntry) => void;
  onCancelRegenerate(): void;
  /** The entry whose regenerate waits or runs. */
  regeneratingKey: string | null;
  /** Another regenerate or a preview is pending, so Regenerate waits. */
  regenerateBlocked: boolean;
  preview: { key: string; text: string } | null;
  onKeep(entry: DiaryEntry, text: string): void;
  onDiscard(): void;
}

/** A diary text as the player reads it: a quiet one reads "Nothing notable." */
const shown = (text: string) => (text.trim() && diaryHoldsMemory(text.trim()) ? text : 'Nothing notable.');

/** One character's diary in Memories: each entry under its turn's memory, oldest first. */
export function MemoryDiaryView({ name, entries, memoryByTurn, emptyText, showHidden, actions }: {
  /** The diary's name as its row shows it. */
  name: string;
  /** The entries to list, already filtered. */
  entries: readonly DiaryEntry[];
  /** Each turn's memory as the ledger reads it; a turn without one shows no context line. */
  memoryByTurn: ReadonlyMap<string, string>;
  /** What shows when `entries` is empty. */
  emptyText: ReactNode;
  /** Show Hidden Entries is on: a deleted entry shows its text, struck through. */
  showHidden: boolean;
  actions: DiaryEntryActions;
}) {
  if (entries.length === 0) return <Meta as="p" className="p-2">{emptyText}</Meta>;
  return (
    <div className="space-y-2 pb-2">
      {entries.map((entry) => {
        const memory = memoryByTurn.get(entry.turnId);
        const editing = actions.editingKey === entry.key;
        const previewing = actions.preview?.key === entry.key;
        const dim = entry.deleted || (entry.quiet && entry.scriptLines.length === 0);
        // A deleted entry with script lines stays listed for them; its own text shows only with Show Hidden Entries.
        const text = entry.deleted && !showHidden ? '' : entry.text;
        return (
          <div key={entry.key} className="space-y-1" data-diary-entry={entry.key}>
            {memory && <p className="px-1 text-[10px] text-muted-foreground" data-diary-context>↳ {memory}</p>}
            <div className={cn('rounded border border-border p-2', dim && !editing && !previewing && 'opacity-60')}>
              {editing ? actions.editor : previewing && actions.preview ? (
                <RegeneratePreview
                  current={shown(entry.text)}
                  proposed={shown(actions.preview.text)}
                  onKeep={() => actions.preview && actions.onKeep(entry, actions.preview.text)}
                  onDiscard={actions.onDiscard}
                />
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-grow">
                      {text && (
                        <p className={cn('text-meta', entry.quiet && 'italic text-muted-foreground', entry.deleted && 'line-through')}>
                          {shown(text)}
                        </p>
                      )}
                      {entry.scriptLines.length > 0 && (
                        <div className={cn('flex items-start gap-1 text-meta text-muted-foreground', text && 'mt-1')}>
                          <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px]">Script</Badge>
                          <span>{entry.scriptLines.join(' ')}</span>
                        </div>
                      )}
                    </div>
                    {entry.aiEntry && <EntryControls name={name} entry={entry} actions={actions} />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">Turn {entry.turnNumber}</span>
                    {entry.edited === 'player' && <Badge variant="outline" className="h-4 px-1 text-[9px]">Edited</Badge>}
                    {entry.edited === 'ai' && <Badge variant="outline" className="h-4 px-1 text-[9px]">Rewritten</Badge>}
                    {entry.deleted && <Badge variant="outline" className="h-4 px-1 text-[9px]">Deleted</Badge>}
                  </div>
                  {entry.edited && entry.original !== undefined && (
                    <p className="mt-1 border-l-2 border-border pl-2 text-[10px] text-muted-foreground">
                      Originally: {shown(entry.original)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** An empty control slot, so the buttons beside it never move. */
const Slot = () => <span className="h-6 w-6" aria-hidden />;

/** The AI entry's controls, each in a fixed slot. Script lines have none. */
function EntryControls({ name, entry, actions }: { name: string; entry: DiaryEntry; actions: DiaryEntryActions }) {
  const regenerating = actions.regeneratingKey === entry.key;
  if (entry.deleted) {
    return (
      <div className="flex flex-shrink-0 items-center gap-0.5">
        <Slot /><Slot />{actions.onRegenerate && <><Slot /><Slot /></>}
        <Tip tip="Restore This Entry">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions.onRestore(entry)}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        </Tip>
      </div>
    );
  }
  return (
    <div className="flex flex-shrink-0 items-center gap-0.5">
      {entry.edited ? (
        <Tip tip="Revert to the Original">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions.onRevert(entry)}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
        </Tip>
      ) : <Slot />}
      <Tip tip="Edit This Entry">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions.onEdit(entry)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </Tip>
      {actions.onRegenerate && (regenerating ? (
        <Tip tip="Cancel Rewrite">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={actions.onCancelRegenerate}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </Tip>
      ) : <Slot />)}
      {actions.onRegenerate && (
        <Tip tip={`Have ${name} Write This Entry Again`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={actions.regenerateBlocked}
            onClick={() => actions.onRegenerate?.(entry)}
          >
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </Tip>
      )}
      <Tip tip="Delete This Entry">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions.onDelete(entry)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </Tip>
    </div>
  );
}
