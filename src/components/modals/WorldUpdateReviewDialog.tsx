import { useEffect, useMemo, useState } from 'react';
import { HelpButton } from '@/components/HelpButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint, Meta } from '@/components/ui/typography';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KIND_LABELS } from '@/lib/catalogKinds';
import { actionChoices, type UpdateAction } from '@/lib/componentUpdates';
import { CONTENT_LINK_LABELS } from '@/lib/contentLink';
import { defaultWorldUpdateAction, type WorldUpdateRow, type WorldUpdateRowKind } from '@/lib/worldUpdateReview';
import type { WorldUpdateReview } from '@/lib/useDownloadCoordinator';

/** What each group of rows is called, and what Apply does to the rows in it. */
const GROUPS: { kind: WorldUpdateRowKind; title: string; note?: string }[] = [
  { kind: 'changed', title: 'Changed Content' },
  { kind: 'added', title: 'New Required Content', note: 'Apply Updates downloads these sources and links a copy of each to this world.' },
  {
    kind: 'dropped',
    title: 'No Longer Required',
    note: 'Apply Updates keeps these copies and clears their source. They become independent copies.',
  },
];

/** The line under a row's name: which library the component belongs to, and whether Apply can reach it. */
function rowDetail(row: WorldUpdateRow): string {
  const library = row.library ? KIND_LABELS[row.library].one : '';
  if (!row.unavailable) return library;
  return library ? `${library} · Not on Community Creations` : 'Not on Community Creations';
}

/** One component, with the choice it offers or the outcome it states. */
function ComponentRow({ row, action, onChoose }: {
  row: WorldUpdateRow;
  action: UpdateAction;
  onChoose: (action: UpdateAction) => void;
}) {
  const choices = row.rowKind === 'changed' ? actionChoices(row.state ?? 'linked') : [];

  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-label font-medium">{row.name}</p>
          <Meta as="p">{rowDetail(row)}</Meta>
        </div>
        {/* The state is what decides a changed row's default, so it is shown there. On a dropped row it
            would contradict the group's own note, which says the copy stops following anything. */}
        {row.rowKind === 'changed' && row.state && (
          <Badge variant="secondary" className="shrink-0">{CONTENT_LINK_LABELS[row.state]}</Badge>
        )}
      </div>

      {choices.length > 0 && (
        <>
          <Select value={action} onValueChange={(next) => onChoose(next as UpdateAction)}>
            <SelectTrigger className="w-full" aria-label={`Action for ${row.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((choice) => (
                <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {row.state === 'local-replacement' && <Hint>Keep Mine keeps this world&apos;s edits.</Hint>}
        </>
      )}
    </li>
  );
}

export interface WorldUpdateReviewDialogProps {
  open: boolean;
  /** The review to draw. Held through the close animation, so it outlives `open`. */
  review: WorldUpdateReview | null;
  /** Run the update with these actions, keyed by listing. */
  onApply: (actions: Record<string, UpdateAction>) => void;
  onCancel: () => void;
}

/**
 * The player's review of one world update, before any of it is written.
 *
 * Updating an installed copy replaces its content with the author's current version, which reaches every
 * linked component in it. This is where the player says which of those they keep. Choosing changes
 * nothing; Apply Updates runs the whole world in one write.
 */
export function WorldUpdateReviewDialog({ open, review, onApply, onCancel }: WorldUpdateReviewDialogProps) {
  const [actions, setActions] = useState<Record<string, UpdateAction>>({});

  // Each review starts on the defaults its rows imply.
  useEffect(() => {
    setActions(Object.fromEntries((review?.rows ?? []).map((row) => [row.sourceId, defaultWorldUpdateAction(row)])));
  }, [review]);

  const groups = useMemo(
    () => GROUPS.map((group) => ({ ...group, rows: (review?.rows ?? []).filter((row) => row.rowKind === group.kind) }))
      .filter((group) => group.rows.length > 0),
    [review],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[640px]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            Update This World
            <HelpButton topicId="library.linkedContent" initialTab="Updates" />
          </DialogTitle>
          <DialogDescription>
            {`Updating “${review?.localName ?? ''}” overwrites it with the author's current version. `}
            Select an action for each linked copy.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          <div className="space-y-4 pr-1">
            {groups.map((group) => (
              <section key={group.kind} className="space-y-2">
                <p className="text-label font-medium">{group.title}</p>
                {group.note && <Meta as="p">{group.note}</Meta>}
                <ul className="space-y-2">
                  {group.rows.map((row) => (
                    <ComponentRow
                      key={row.sourceId}
                      row={row}
                      action={actions[row.sourceId] ?? defaultWorldUpdateAction(row)}
                      onChoose={(next) => setActions((held) => ({ ...held, [row.sourceId]: next }))}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={() => onApply(actions)}>Apply Updates</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
