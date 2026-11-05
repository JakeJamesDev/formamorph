import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'react-toastify';
import { getAllSaveRecords } from '@/components/modals/dbUtils';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { bundledWorlds } from '@/lib/bundledWorldText';
import { DEFAULT_WORLDS, forgetDeletedDefaultWorld } from '@/lib/defaultWorlds';
import { useDevRoute } from '@/lib/devRouter';
import { linkToast, toastError } from '@/lib/linkToast';
import {
  getUnreadableWorlds, hasAnnouncedWorlds, reportUnreadableWorld, subscribeUnreadableWorlds, takeUnannouncedWorlds,
  type UnreadableWorld,
} from '@/lib/unreadableWorlds';
import { useMountedRef } from '@/lib/useMountedRef';
import WorldStorageService from '@/services/WorldStorageService';

const NOTICE_TOAST = 'world-library-unreadable';

type Repair = 'restore' | 'download' | 'remove';

const COPY: Record<Repair, { action: string; hint: string; title: string; consequence: string; confirm: string }> = {
  restore: {
    action: 'Restore',
    hint: 'Restore replaces it with the original world. Your edits to it are lost.',
    title: 'Restore World',
    consequence: "This replaces the world with the original. You can't undo this.",
    confirm: 'Restore',
  },
  download: {
    action: 'Download Again',
    hint: 'Download Again removes this copy and opens its listing.',
    title: 'Download Again',
    consequence: "This removes your copy and opens its listing. You can't undo this.",
    confirm: 'Remove and Open Listing',
  },
  remove: {
    action: 'Remove',
    hint: 'If you have a backup of this world, use Backup & Restore. Otherwise, remove it.',
    title: 'Remove World',
    consequence: "This removes the world from your library. You can't undo this.",
    confirm: 'Remove',
  },
};

const seedOf = (id: string) => DEFAULT_WORLDS.find((world) => world.id === id);

const repairOf = (world: UnreadableWorld): Repair => {
  if (seedOf(world.id)) return 'restore';
  return world.sourceId ? 'download' : 'remove';
};

const noticeOf = (count: number) => (count === 1
  ? "A world in your library can't be read. Your other worlds still load."
  : `${count} worlds in your library can't be read. Your other worlds still load.`);

/** The names saves remember for these worlds. */
async function savedNames(worlds: readonly UnreadableWorld[]): Promise<Record<string, string>> {
  const wanted = new Set(worlds.filter((world) => !world.name).map((world) => world.id));
  if (wanted.size === 0) return {};
  const names: Record<string, string> = {};
  for (const save of await getAllSaveRecords()) {
    const name = save.currentState?.worldName;
    if (save.worldId && name && wanted.has(save.worldId)) names[save.worldId] = name;
  }
  return names;
}

/**
 * The player's way out of an unreadable world: one notice per session, and a dialog that repairs each entry.
 *
 * @param onChanged - Called after a repair, so the world grid can refresh
 * @param onOpenListing - Opens the listing a removed copy came from
 */
export function UnreadableWorldsDialog({ onChanged, onOpenListing }: {
  onChanged: () => void;
  onOpenListing: (listing: { id: string; kind: string }) => void;
}) {
  const worlds = useSyncExternalStore(subscribeUnreadableWorlds, getUnreadableWorlds);
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<UnreadableWorld | null>(null);
  const mounted = useMountedRef();
  const devRoute = useDevRoute();

  useEffect(() => {
    if (worlds.length === 0) {
      if (hasAnnouncedWorlds()) toast.dismiss(NOTICE_TOAST);
      setOpen(false);
      return;
    }
    if (takeUnannouncedWorlds() > 0) {
      linkToast(noticeOf(worlds.length), 'Review →', () => {
        toast.dismiss(NOTICE_TOAST);
        setOpen(true);
      }, { toastId: NOTICE_TOAST, autoClose: false });
    }
    // A save that can't be read only costs the name.
    savedNames(worlds).then((found) => { if (mounted.current) setNames(found); }).catch(() => {});
  }, [worlds, mounted]);

  useEffect(() => {
    if (!import.meta.env.DEV || devRoute?.modal !== 'unreadableWorlds') return;
    reportUnreadableWorld({ id: DEFAULT_WORLDS[0].id });
    reportUnreadableWorld({ id: 'dev-listing-copy', name: 'Listing Copy', sourceId: 'dev-listing' });
    reportUnreadableWorld({ id: 'dev-unnamed' });
    setOpen(true);
  }, [devRoute?.modal]);

  const nameOf = (world: UnreadableWorld) => (
    world.name || seedOf(world.id)?.defaultName || names[world.id] || 'Unnamed World'
  );

  const repair = async (world: UnreadableWorld) => {
    setPending(null);
    try {
      const seed = seedOf(world.id);
      if (seed) forgetDeletedDefaultWorld(world.id);
      const removed = await WorldStorageService.removeUnreadableWorld(world.id);
      if (removed && seed) {
        const { errors } = await WorldStorageService.loadDefaultWorlds([seed], bundledWorlds);
        if (errors.length > 0) throw new AggregateError(errors, 'The original world failed to load');
      }
      onChanged();
      if (removed && !seed && world.sourceId) onOpenListing({ id: world.sourceId, kind: 'world' });
    } catch (error) {
      toastError(error, { headline: `Couldn't repair "${nameOf(world)}".` });
    }
  };

  const pendingCopy = pending ? COPY[repairOf(pending)] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent surface="unreadableWorlds" className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Worlds That Can&apos;t Be Read</DialogTitle>
            <DialogDescription>Formamorph can&apos;t read these worlds. Your other worlds still load.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {worlds.map((world) => {
              const copy = COPY[repairOf(world)];
              return (
                <li key={world.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{nameOf(world)}</p>
                    <p className="text-meta text-muted-foreground">{copy.hint}</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPending(world)}>
                    {copy.action}
                  </Button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(next) => { if (!next) setPending(null); }}
        title={pendingCopy?.title}
        description={pendingCopy?.consequence ?? ''}
        confirmLabel={pendingCopy?.confirm}
        destructive
        onConfirm={() => { if (pending) void repair(pending); }}
      />
    </>
  );
}
