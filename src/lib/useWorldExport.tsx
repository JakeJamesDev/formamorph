import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { World } from '@/types';
import { downloadBlob } from './downloadBlob';
import { serializeJsonBlob } from './jsonFileWorkerUtils';
import { APP_VERSION, WORLD_FILE_KIND } from './version';
import { embedWorldRemoteImages, remoteWorldImages } from './embedRemoteImages';

/** The world queued behind the linked-images choice, with the filename its download will use. */
interface PendingExport {
  world: World;
  filename: string;
}

/**
 * Writing a world out to a `.json` the user can share: the optimize offer, the keep-links-or-embed choice,
 * and the off-thread serialize. Render `dialog` once in the host and call `exportWorld(world)`.
 *
 * `promptWorld` comes from the host's own `useDownscalePrompt` so both dialogs share one instance.
 */
export function useWorldExport(promptWorld: (world: World) => Promise<World | null>) {
  const [pending, setPending] = useState<PendingExport | null>(null);
  const [embedding, setEmbedding] = useState<{ done: number; total: number } | null>(null);

  const writeWorldFile = useCallback(async (world: World, filename: string) => {
    const { id: _id, ...worldFields } = world;
    // Both callers hand over a world already migrated to the current shape, so the export stamps this version.
    const worldData = { formamorphKind: WORLD_FILE_KIND, ...worldFields, version: APP_VERSION };
    // Serialized off-thread: a world's embedded base64 images make this stringify a multi-second main-thread stall.
    downloadBlob(await serializeJsonBlob(worldData, 2), `${filename}.json`);
  }, []);

  /** "Download and embed": fetch every linked image into the exported copy, then report what failed. */
  const exportEmbedded = useCallback(async ({ world, filename }: PendingExport) => {
    setEmbedding({ done: 0, total: remoteWorldImages(world).length });
    try {
      const { world: embedded, failures } = await embedWorldRemoteImages(world, (done, total) => setEmbedding({ done, total }));
      if (failures.length) {
        toast.warning(`${failures.length} image${failures.length > 1 ? 's' : ''} couldn't be downloaded and stayed linked.`);
      }
      await writeWorldFile(embedded, filename);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setEmbedding(null);
      setPending(null);
    }
  }, [writeWorldFile]);

  const exportWorld = useCallback(async (world: World) => {
    // Offer to downscale oversized images BEFORE writing the file so the download itself is the smaller size.
    // This affects only the exported file — the caller's state and the stored world are left untouched.
    const downscaled = await promptWorld(world);
    const w = downscaled ?? world;
    const filename = w.worldOverview?.name || 'rpg_world';
    // A world with linked images has a choice to make first; one without exports straight through.
    if (remoteWorldImages(w).length) { setPending({ world: w, filename }); return; }
    await writeWorldFile(w, filename);
  }, [promptWorld, writeWorldFile]);

  const linked = pending ? remoteWorldImages(pending.world).length : 0;

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(o) => { if (!o && !embedding) setPending(null); }}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Linked Images</DialogTitle>
          <DialogDescription>
            {pending && `This world links to ${linked} image${linked > 1 ? 's' : ''} instead of storing them. How should the exported file handle them?`}
          </DialogDescription>
        </DialogHeader>
        {embedding ? (
          <p className="text-helper text-muted-foreground">
            Downloading images… {embedding.done} of {embedding.total}
          </p>
        ) : (
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={async () => { const p = pending; setPending(null); if (p) await writeWorldFile(p.world, p.filename); }}>
              Keep Links — Smaller File
            </Button>
            <Button variant="outline" className="w-full" onClick={() => { if (pending) void exportEmbedded(pending); }}>
              Download and Embed — Works Offline
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );

  return { exportWorld, dialog };
}
