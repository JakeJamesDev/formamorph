import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { HelpButton } from '@/components/HelpButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CollapsibleSection } from '@/components/ui/collapsible-section';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint, Meta } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  actionChoices, defaultAction, diffContent, diffHasChanges,
  type ContentDiff, type UpdateAction, type UpdateRow,
} from '@/lib/componentUpdates';
import { applyUpdate, liveCopyFor, liveWorldFor, type LiveWorld } from '@/lib/componentUpdateRun';
import { CONTENT_LINK_LABELS } from '@/lib/contentLink';
import type { LibrarySource, LinkableContent } from '@/lib/linkedContent';
import WorldStorageService from '@/services/WorldStorageService';
import type { Dictionary, Entity } from '@/types';

/** A row's key. A world can hold the same library item twice, so the copy is part of the identity. */
const rowKey = (row: UpdateRow) => `${row.worldId}:${row.itemId}`;

/** Two values side by side, under what they belong to. `side` names where the incoming value came from. */
function Comparison({ label, current, incoming, side }: {
  label: string; current?: string; incoming?: string; side: string;
}) {
  return (
    <div className="space-y-1 rounded-md border p-2">
      <p className="text-meta font-medium">{label}</p>
      {current !== undefined && (
        <Meta as="p" className="whitespace-pre-wrap break-words">
          <span className="font-medium">This world: </span>{current}
        </Meta>
      )}
      {incoming !== undefined && (
        <Meta as="p" className="whitespace-pre-wrap break-words">
          <span className="font-medium">{side}: </span>{incoming}
        </Meta>
      )}
    </div>
  );
}

/** One group of entry comparisons, drawn only when the group has something in it. */
function EntryGroup({ title, rows, side }: {
  title: string; rows: ContentDiff['changedEntries']; side: string;
}) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <Meta as="p" className="font-medium">{title}</Meta>
      {rows.map((row) => (
        <Comparison
          key={`${title}:${row.key}`}
          label={row.label}
          current={row.current}
          incoming={row.incoming}
          side={side}
        />
      ))}
    </div>
  );
}

/** What the source changed, changed content first and unchanged content behind its own disclosure. */
function ChangeList({ diff, side }: { diff: ContentDiff; side: string }) {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const unchangedCount = diff.unchanged.length + diff.unchangedEntries.length;

  return (
    <div className="space-y-3">
      {!diffHasChanges(diff) && (
        <Meta as="p">This copy has none of the changed fields.</Meta>
      )}
      {diff.changed.map((row) => (
        <Comparison key={row.field} label={row.label} current={row.current} incoming={row.incoming} side={side} />
      ))}
      <EntryGroup title="Changed Entries" rows={diff.changedEntries} side={side} />
      <EntryGroup title="Added Entries" rows={diff.addedEntries} side={side} />
      <EntryGroup title="Removed Entries" rows={diff.removedEntries} side={side} />

      {unchangedCount > 0 && (
        <CollapsibleSection
          title={<>Unchanged Content <Meta>({unchangedCount})</Meta></>}
          open={showUnchanged}
          onOpenChange={setShowUnchanged}
        >
          {diff.unchanged.map((row) => (
            <Comparison key={row.field} label={row.label} current={row.current} side={side} />
          ))}
          <EntryGroup title="Unchanged Entries" rows={diff.unchangedEntries} side={side} />
        </CollapsibleSection>
      )}
    </div>
  );
}

/** One world, its chosen action, and the comparison it can open. */
function WorldUpdateRow({ row, action, diff, failure, busy, side, onChoose, onExpand, onRetry }: {
  row: UpdateRow;
  action: UpdateAction;
  /** What the comparison calls the incoming side. */
  side: string;
  /** The comparison, once View Changes has loaded it. */
  diff: ContentDiff | null | undefined;
  failure?: string;
  busy: boolean;
  onChoose: (action: UpdateAction) => void;
  onExpand: () => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const choices = actionChoices(row.state);
  const selectId = `update-action-${rowKey(row)}`;

  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-label font-medium">{row.worldName}</p>
          <Meta as="p" className="truncate">{row.itemName}</Meta>
        </div>
        <Badge variant="secondary" className="shrink-0">{CONTENT_LINK_LABELS[row.state]}</Badge>
      </div>

      {failure ? (
        <>
          <p className="text-meta text-destructive">{failure}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={onRetry}>Retry</Button>
        </>
      ) : (
        <>
          <Select value={action} onValueChange={(next) => onChoose(next as UpdateAction)} disabled={busy}>
            <SelectTrigger id={selectId} className="w-full" aria-label={`Action for ${row.worldName}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {row.state === 'local-replacement' && <Hint>Keep Mine keeps this world&apos;s edits.</Hint>}

          <CollapsibleSection
            title="View Changes"
            open={open}
            onOpenChange={(next) => { setOpen(next); if (next) onExpand(); }}
          >
            {diff === undefined ? <Meta as="p">Reading this copy.</Meta>
              : diff === null ? <p className="text-meta text-destructive">Formamorph could not read this copy.</p>
                : <ChangeList diff={diff} side={side} />}
          </CollapsibleSection>
        </>
      )}
    </li>
  );
}

/** A review whose incoming content came from an imported file rather than from the library item. */
export interface IncomingFile {
  /** What each comparison calls the incoming side. One word, because it labels a value inline. */
  label: string;
  /** The sentence the review opens with. */
  description: string;
  /** Write the incoming content into the library item. Run once before the rows are applied, so every
   *  world updates to the revision the item then holds. Must be safe to run again after a retry. */
  commit: () => Promise<void>;
}

export interface UpdateAvailableDialogProps {
  /** The library item the review is for. Null draws nothing. */
  source: LibrarySource | null;
  /** The item's content, for Update and for every comparison. Null where the item's content is gone. */
  sourceData: LinkableContent | null;
  /** The worlds behind the source, from `affectedCopies`. */
  rows: UpdateRow[];
  /** Worlds whose copies are held in memory, read and written there rather than in storage. */
  live?: LiveWorld[];
  /** Present when the review is about a file the player imported. */
  incoming?: IncomingFile;
  onClose: () => void;
}

/**
 * The player's review of one library item's update, world by world.
 *
 * Choosing an action changes nothing. Apply Updates runs the whole list, one world at a time: a world
 * that fails keeps the content it had and offers Retry, while every other world's result stands.
 */
export function UpdateAvailableDialog({
  source, sourceData, rows, live, incoming, onClose,
}: UpdateAvailableDialogProps) {
  const [actions, setActions] = useState<Record<string, UpdateAction>>({});
  const [diffs, setDiffs] = useState<Record<string, ContentDiff | null | undefined>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  // Each review starts fresh: the defaults its rows' states imply, and nothing read or attempted yet.
  useEffect(() => {
    setActions(Object.fromEntries(rows.map((row) => [rowKey(row), defaultAction(row.state)])));
    setDiffs({});
    setFailures({});
  }, [rows]);

  const failed = Object.keys(failures);
  const shown = useMemo(
    () => (failed.length ? rows.filter((row) => failures[rowKey(row)]) : rows),
    [rows, failures, failed.length],
  );

  /** Read one world's copy so its comparison can be drawn. Read once per row, on first expand. */
  const loadDiff = async (row: UpdateRow) => {
    const key = rowKey(row);
    if (key in diffs || !sourceData) return;
    setDiffs((held) => ({ ...held, [key]: undefined }));
    try {
      const world = liveWorldFor(live, row);
      const copy = world ? liveCopyFor(world, row) : await readStoredCopy(row);
      setDiffs((held) => ({ ...held, [key]: copy ? diffContent(copy, sourceData) : null }));
    } catch {
      setDiffs((held) => ({ ...held, [key]: null }));
    }
  };

  const runRows = async (targets: UpdateRow[]) => {
    if (!source) return;
    setApplying(true);
    const broke: Record<string, string> = {};
    let done = 0;
    // The library item takes the incoming content first: a world told to update follows that item, so
    // updating a world before the item holds the revision would leave the two disagreeing.
    if (incoming) {
      try {
        await incoming.commit();
      } catch (error) {
        setApplying(false);
        toast.error((error as Error).message || 'Could not save the imported content to your library.');
        return;
      }
    }
    for (const row of targets) {
      try {
        await applyUpdate(row, actions[rowKey(row)] ?? defaultAction(row.state), source, sourceData, live);
        done += 1;
      } catch (error) {
        broke[rowKey(row)] = (error as Error).message || `Formamorph could not update ${row.worldName}.`;
      }
    }
    // Only the rows this run attempted change: a Retry on one world must leave another world's failure
    // standing, rather than closing the review over a world that was never updated.
    const attempted = new Set(targets.map(rowKey));
    const left = Object.fromEntries(
      Object.entries(failures).filter(([key]) => !attempted.has(key)).concat(Object.entries(broke)),
    );
    setFailures(left);
    setApplying(false);

    if (done) toast.success(done === 1 ? 'Updated one world.' : `Updated ${done} worlds.`);
    const stuck = Object.keys(left).length;
    if (stuck) {
      toast.error(stuck === 1
        ? 'Could not update one world. Try again.'
        : `Could not update ${stuck} worlds. Try again.`);
      return;
    }
    onClose();
  };

  const open = !!source;
  const noun = rows[0]?.kind === 'dictionary' ? 'dictionary' : 'entity';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !applying) onClose(); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[640px]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Update Available
            <HelpButton topicId="library.linkedContent" initialTab="Updates" />
          </DialogTitle>
          <DialogDescription>
            {failed.length
              ? 'These worlds were not updated. Select Apply Updates again, or close the review.'
              : incoming?.description
                ?? `The library ${noun} “${source?.name ?? ''}” has a new version. Select an action for each world.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          <ul className="space-y-3 pr-1">
            {shown.map((row) => {
              const key = rowKey(row);
              return (
                <WorldUpdateRow
                  key={key}
                  row={row}
                  action={actions[key] ?? defaultAction(row.state)}
                  diff={diffs[key]}
                  failure={failures[key]}
                  busy={applying}
                  side={incoming?.label ?? 'Library'}
                  onChoose={(next) => setActions((held) => ({ ...held, [key]: next }))}
                  onExpand={() => { void loadDiff(row); }}
                  onRetry={() => { void runRows([row]); }}
                />
              );
            })}
          </ul>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={applying} onClick={onClose}>
            {failed.length ? 'Close' : 'Cancel'}
          </Button>
          {!failed.length && (
            <Button disabled={applying} onClick={() => { void runRows(rows); }}>
              {applying ? 'Applying...' : 'Apply Updates'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One stored world's copy, for a comparison. */
async function readStoredCopy(row: UpdateRow): Promise<LinkableContent | undefined> {
  const data = await WorldStorageService.getWorldData(row.worldId) as {
    entities?: Entity[]; dictionaries?: Dictionary[];
  };
  const list = row.kind === 'dictionary' ? data.dictionaries : data.entities;
  return list?.find((item) => item.id === row.itemId);
}
