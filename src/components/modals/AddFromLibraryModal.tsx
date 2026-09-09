import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Meta } from '@/components/ui/typography';
import { libraryItemData, libraryItems, LINK_EXPLANATIONS, type LibraryItemSummary, type LibraryKind } from '@/lib/librarySources';
import type { LinkableContent } from '@/lib/linkedContent';

/** One picked library item with the content behind it. */
export interface LibraryPick {
  source: LibraryItemSummary;
  data: LinkableContent;
}

interface AddFromLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: LibraryKind;
  title: string;
  description: string;
  /** Shown when the library has no items to pick from. */
  emptyMessage: string;
  /** The affirmative action's label. */
  confirmLabel: string;
  /** Pick exactly one instead of several. */
  single?: boolean;
  /** Hide the link choice and always link, which is what reconnecting an independent copy does. */
  alwaysLink?: boolean;
  /** Row content after the checkbox and before the name — a portrait or a count. */
  renderRow?: (item: LibraryItemSummary) => ReactNode;
  onConfirm: (picks: LibraryPick[], link: boolean) => void;
}

/**
 * Pick library items to bring into the world being edited.
 *
 * Every row names its author and where it came from, because two library items may share a name and the
 * name alone cannot tell them apart. The link choice decides whether the copies follow what they came from
 * or arrive independent; it is on by default, and picking an existing item never makes a second one.
 */
function AddFromLibraryModal({
  open, onOpenChange, kind, title, description, emptyMessage, confirmLabel,
  single, alwaysLink, renderRow, onConfirm,
}: AddFromLibraryModalProps) {
  const [list, setList] = useState<LibraryItemSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [link, setLink] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    setSearch('');
    setLink(true);
    setLoading(true);
    libraryItems(kind)
      .then(setList)
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [open, kind]);

  // Filter without sorting, so the library keeps the order the author knows it in.
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((item) => `${item.name} ${item.authorLine} ${item.sourceLine}`.toLowerCase().includes(term));
  }, [list, search]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      if (single) return prev.includes(id) ? [] : [id];
      return prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
    });

  const picked = useMemo(() => list.filter((item) => selectedIds.includes(item.id)), [list, selectedIds]);
  const linking = alwaysLink || link;
  const explanation = !linking
    ? LINK_EXPLANATIONS.independent
    : picked.some((item) => !item.owned) ? LINK_EXPLANATIONS.other : LINK_EXPLANATIONS.own;

  const handleConfirm = async () => {
    if (!selectedIds.length) return;
    // Preserve list order; skip any item that vanished between listing and confirming.
    const ordered = list.filter((item) => selectedIds.includes(item.id));
    const loaded = await Promise.all(ordered.map(async (source) => {
      const data = await libraryItemData(kind, source.id);
      return data ? { source, data } : null;
    }));
    onConfirm(loaded.filter((pick): pick is LibraryPick => pick !== null), linking);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="py-6 text-center text-helper text-muted-foreground">Loading…</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-helper text-muted-foreground">{emptyMessage}</p>
        ) : (
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the library"
              aria-label="Search the library"
            />
            <ScrollArea className="max-h-[50dvh] pr-2">
              <div className="space-y-1">
                {shown.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className="flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-secondary"
                  >
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    {renderRow?.(item)}
                    <div className="min-w-0 flex-grow">
                      <p className="truncate">{item.name}</p>
                      <Meta as="p" className="truncate">{item.authorLine} · {item.sourceLine}</Meta>
                    </div>
                  </div>
                ))}
                {shown.length === 0 && (
                  <p className="py-6 text-center text-helper text-muted-foreground">No match for that search.</p>
                )}
              </div>
            </ScrollArea>
            <div className="space-y-1">
              {!alwaysLink && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={link} onCheckedChange={(v) => setLink(v === true)} className="shrink-0" />
                  <span>Link to Library</span>
                </label>
              )}
              <Meta as="p">{explanation}</Meta>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={selectedIds.length === 0}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AddFromLibraryModal;
