import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { OptionSwitcher } from '@/components/SettingsRows';
import WorldStorageService from '@/services/WorldStorageService';
import {
  pendingCount, REVIEW_CHOICES, reviewRows, SHOW_FILTERS, SORT_ORDERS, stageAcknowledgment,
  stageDecision, visibleRows, waitingLabel,
  type PendingReviews, type ReviewRow, type ShowFilter, type SortOrder,
} from '@/lib/addonReview';
import type { ReviewState } from '@/lib/compatibleWorlds';
import { type AddonRow, type ListingRef } from '@/lib/worldDependencies';

/** One offer, with the author's saved answer and any decision staged against it. */
function AddonReviewRow({ row, now, disabled, onDecide, onAcknowledge }: {
  row: ReviewRow;
  now: number;
  disabled: boolean;
  onDecide: (row: ReviewRow, next: ReviewState) => void;
  onAcknowledge: (row: ReviewRow) => void;
}) {
  const waited = waitingLabel(row, now);
  return (
    <li className="space-y-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-label font-medium">{row.name}</p>
          <p className="text-meta text-muted-foreground">
            {row.kindLabel} · {row.author}{waited && ` · ${waited}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {row.showUpdatedBadge && <Badge variant="secondary">Updated since review</Badge>}
          {row.pending && <Badge variant="secondary">Pending change</Badge>}
        </div>
      </div>

      <OptionSwitcher
        value={row.state}
        onChange={(next) => onDecide(row, next)}
        options={REVIEW_CHOICES}
        ariaLabel={`Review ${row.name}`}
      />

      {/* Only where an update is unacknowledged. A changed decision acknowledges it too, so this is the
          control that keeps the decision. */}
      {row.showUpdatedBadge && (
        <Button variant="outline" size="sm" disabled={disabled} onClick={() => onAcknowledge(row)}>
          Mark Reviewed
        </Button>
      )}
    </li>
  );
}

/** A labeled Show or Sort control above the list. */
function ListControl<T extends string>({ id, label, value, onChange, options }: {
  id: string;
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface ManageAddonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The world listing being reviewed. Null draws nothing. */
  world: ListingRef | null;
}

/**
 * The world author's review of what other authors offer for their world.
 *
 * Every decision is staged. A saved decision changes what a download of the world offers, so the author
 * answers the list and Save Changes writes every answer at once.
 */
export function ManageAddonsDialog({ open, onOpenChange, world }: ManageAddonsDialogProps) {
  const [addons, setAddons] = useState<AddonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReviews>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ShowFilter>('attention');
  const [sort, setSort] = useState<SortOrder>('oldestWaiting');
  // Read once per load, not per render, so every waiting time on screen uses the same instant.
  const [now, setNow] = useState(() => Date.now());
  const [confirmingClose, setConfirmingClose] = useState(false);

  const worldId = world?.id ?? null;

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setAddons(await WorldStorageService.fetchAddons(id));
      setNow(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Each open starts a new review. The stage is discarded and the list is read again.
  useEffect(() => {
    if (!open || !worldId) return;
    setPending({});
    setConfirmingClose(false);
    void load(worldId);
  }, [open, worldId, load]);

  const rows = useMemo(() => reviewRows(addons, pending), [addons, pending]);
  const shown = useMemo(() => visibleRows(rows, filter, sort), [rows, filter, sort]);
  const changes = pendingCount(pending);

  const decide = (row: ReviewRow, next: ReviewState) => {
    setPending((staged) => stageDecision(staged, row, next));
  };

  const acknowledge = (row: ReviewRow) => {
    setPending((staged) => stageAcknowledgment(staged, row));
  };

  const save = async () => {
    if (!worldId) return;
    const sent = pending;
    setSaving(true);
    const failed: Record<string, ReviewState> = {};
    const refused: string[] = [];
    for (const [componentId, state] of Object.entries(sent)) {
      try {
        await WorldStorageService.setAddonReview(worldId, componentId, state);
      } catch {
        // A refused write stays staged and is named. Clearing it would report a decision the server never
        // recorded.
        failed[componentId] = state;
        refused.push(rows.find((row) => row.id === componentId)?.name ?? componentId);
      }
    }

    // Clear only the rows this save wrote, and only where the author has not answered them again since.
    // Replacing the whole stage would discard a decision made while the writes were in flight.
    setPending((current) => {
      const next = { ...current };
      for (const [componentId, state] of Object.entries(sent)) {
        if (next[componentId] !== state) continue;
        if (!(componentId in failed)) delete next[componentId];
      }
      return next;
    });
    setSaving(false);
    await load(worldId);

    const saved = Object.keys(sent).length - refused.length;
    if (saved > 0) toast.success(`Saved ${saved} decision${saved === 1 ? '' : 's'}.`);
    if (refused.length) toast.error(`Could not save: ${refused.join(', ')}. Try again.`);
  };

  // Closing discards the stage, so an unsaved review asks first. Discard Changes is the deliberate exit
  // and does not.
  const requestClose = (next: boolean) => {
    if (!next && changes && !saving) {
      setConfirmingClose(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="flex h-[85dvh] flex-col sm:max-w-[640px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Manage Add-ons</DialogTitle>
          <DialogDescription>
            Other authors offer this content for {world?.name || 'this world'}. Approved add-ons are
            recommended. Declined add-ons leave the download.
          </DialogDescription>
        </DialogHeader>

        {/* Side by side at every width. Stacked, the two fill a phone's dialog and leave the list no
            height. */}
        <div className="grid shrink-0 grid-cols-2 gap-3">
          <ListControl id="addon-show" label="Show" value={filter} onChange={setFilter} options={SHOW_FILTERS} />
          <ListControl id="addon-sort" label="Sort" value={sort} onChange={setSort} options={SORT_ORDERS} />
        </div>

        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          {loading ? (
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : error ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-helper text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => worldId && void load(worldId)}>Try Again</Button>
            </div>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-helper text-muted-foreground">
              {rows.length === 0
                ? 'No author offers content for this world yet.'
                : 'No add-on matches this filter. Select “Show” to see the rest.'}
            </p>
          ) : (
            <ul className="space-y-3 pr-1">
              {shown.map((row) => (
                <AddonReviewRow
                  key={row.id}
                  row={row}
                  now={now}
                  disabled={saving}
                  onDecide={decide}
                  onAcknowledge={acknowledge}
                />
              ))}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={!changes || saving} onClick={() => setPending({})}>
            Discard Changes
          </Button>
          <Button disabled={!changes || saving} onClick={() => void save()}>
            {saving ? 'Saving...' : `Save Changes${changes ? ` (${changes})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmingClose}
        onOpenChange={setConfirmingClose}
        title="Close without saving?"
        description={`${changes} decision${changes === 1 ? '' : 's'} will not be saved.`}
        onConfirm={() => { setConfirmingClose(false); onOpenChange(false); }}
        onCancel={() => setConfirmingClose(false)}
      />
    </Dialog>
  );
}
