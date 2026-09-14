import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Hint, Meta } from '@/components/ui/typography';
import { installedRows, onlineRows, type AssociationRow } from '@/lib/componentImport';
import type { LibraryKind } from '@/lib/librarySources';

const COPY = {
  entity: { title: 'Import Entity', confirm: 'Import Entity' },
  dictionary: { title: 'Import Dictionary', confirm: 'Import Dictionary' },
} as const;

export interface ImportComponentModalProps {
  /** Which library the file belongs to, or null while nothing is under review. */
  kind: LibraryKind | null;
  /** The content's own name, as the file gives it. */
  name: string;
  /** The worlds the file names, each matched against this machine. */
  rows: AssociationRow[];
  /** The installed worlds the player ticked, by listing id. */
  selected: readonly string[];
  /** The file names worlds this machine has not got, and the player is offline. */
  offline: boolean;
  onToggle: (listingId: string, on: boolean) => void;
  /** Open Community Creations on one of the worlds the file names. */
  onFind: (listingId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Review a component file about to join the library: what it is called, and which of the worlds it suits
 * it joins.
 *
 * Every world here is the file's own claim of compatibility. None of it links anything on its own: a
 * world is linked because the player ticked it, and a world this machine has not got is downloaded
 * through Community Creations like any other. Importing with nothing ticked adds the component alone.
 */
export function ImportComponentModal({
  kind, name, rows, selected, offline, onToggle, onFind, onCancel, onConfirm,
}: ImportComponentModalProps) {
  if (!kind) return null;
  const installed = installedRows(rows);
  const online = onlineRows(rows);
  const picked = new Set(selected);

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-[480px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{COPY[kind].title}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          <div className="space-y-4 pr-1">
            {!rows.length && (
              <Meta as="p">This file names no worlds. Importing adds it to your library on its own.</Meta>
            )}

            {installed.length > 0 && (
              <div className="space-y-2">
                <p className="text-label font-medium">Add To Your Worlds</p>
                {installed.map((row) => (
                  <label key={row.listingId} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={picked.has(row.listingId)}
                      onCheckedChange={(on) => onToggle(row.listingId, on === true)}
                      className="shrink-0"
                    />
                    <span className="truncate">{row.worldName ?? row.name}</span>
                  </label>
                ))}
                <Hint>Each world gets a linked copy. Your library keeps the original.</Hint>
              </div>
            )}

            {online.length > 0 && (
              <div className="space-y-2">
                <p className="text-label font-medium">Worlds You Do Not Have</p>
                {online.map((row) => (
                  <div key={row.listingId} className="flex items-center justify-between gap-2">
                    <span className="truncate">{row.name}</span>
                    <Button variant="outline" size="sm" disabled={offline} onClick={() => onFind(row.listingId)}>
                      Find It
                    </Button>
                  </div>
                ))}
                <Hint>
                  {offline
                    ? 'Formamorph cannot reach Community Creations, so these stay unresolved.'
                    : 'Find It opens Community Creations, where you download the world and its content.'}
                </Hint>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>{COPY[kind].confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
