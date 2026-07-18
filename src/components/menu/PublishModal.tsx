import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import WorldStorageService from "@/services/WorldStorageService";
import { type WorldRecord } from "@/components/WorldDetails";
import { KIND_LABELS } from "@/lib/catalogKinds";
import type { PublishPayload } from "@/lib/publishPayload";

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  /** What to publish, built by the per-kind helpers in `lib/publishPayload`. */
  payload: PublishPayload | null;
}

/**
 * Publish a world, character, or dictionary to the community server — as a new listing, or by replacing
 * one of the user's own. Kind-agnostic: it takes a ready payload and names itself from `payload.kind`, so
 * the mapping from each kind's fields lives in `lib/publishPayload` rather than here.
 *
 * The overwrite list is fetched per kind: your characters are never offered as targets for a world.
 */
export function PublishModal({ open, onOpenChange, isAuthenticated, payload }: PublishModalProps) {
  const [userWorlds, setUserWorlds] = useState<WorldRecord[]>([]);
  const [selectedWorldToOverride, setSelectedWorldToOverride] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  const kind = payload?.kind ?? 'world';
  const noun = KIND_LABELS[kind].one.toLowerCase();
  // What's open right now, readable from inside an async callback that captured an older `kind`.
  const kindRef = useRef(kind);
  kindRef.current = kind;

  // Fetch the user's listings of this kind — the only valid overwrite targets.
  const fetchUserWorlds = async () => {
    if (!isAuthenticated) return;

    try {
      const listings = await WorldStorageService.getUserWorlds(kind);
      // Only adopt a response that still matches what's open. Two publishes in quick succession (a world,
      // then a character) race: the world's slower request would otherwise resolve last and fill a
      // character dialog with worlds — every row then a wrong-kind overwrite target.
      if (kindRef.current !== kind) return;
      setUserWorlds(listings);
    } catch (error) {
      console.error('Error fetching user listings:', error);
      if (kindRef.current !== kind) return;
      setPublishError(`Failed to load your published ${KIND_LABELS[kind].many.toLowerCase()}`);
    }
  };

  /** Publish as a new listing, or replace `targetId` when given one. */
  const publish = async (targetId: string | null) => {
    if (!payload) return;
    setPublishError('');
    setIsPublishing(true);

    try {
      await WorldStorageService.publishItem(payload, targetId);

      // No refetch: the modal closes here and reloads its listings on the next open, so re-reading them
      // only to discard them is a round-trip the user waits on.
      onOpenChange(false);
      toast.success(`${KIND_LABELS[kind].one} ${targetId ? 'updated' : 'published'} successfully!`);
    } catch (error) {
      setPublishError((error as Error).message || `Failed to publish ${noun}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublish = () =>
    publish(selectedWorldToOverride && selectedWorldToOverride !== 'new' ? selectedWorldToOverride : null);

  // Load the user's listings when the publish modal is opened, or when the kind changes under it.
  useEffect(() => {
    if (!open) return;
    // Reset before the fetch, not after it. The modal is mounted for the app's lifetime, so its state
    // outlives a close: a target picked for a previous publish would otherwise still be selected — and
    // selectable — until the network resolved, or forever if it failed. Publishing in that window PUT the
    // new content over the old target, across kinds.
    setSelectedWorldToOverride('new');
    setUserWorlds([]);
    setPublishError('');
    fetchUserWorlds();
    // Fetch only when the modal opens, auth changes, or the kind changes — not on fetchUserWorlds identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated, kind]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Bounded height + a scrolling middle: the list grows with every world the author has published,
          and an unbounded dialog would grow out of the viewport (it's centered) taking the Publish button
          with it, unreachable. Header and footer stay put; only the options scroll. */}
      <DialogContent className="sm:max-w-[500px] max-h-[85dvh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Publish {KIND_LABELS[kind].one}</DialogTitle>
          <DialogDescription>
            Publish your {noun} to share it with other players.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="py-4 pr-3">
            {publishError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                {publishError}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Select Publish Option</h3>

              <RadioGroup value={selectedWorldToOverride ?? undefined} onValueChange={setSelectedWorldToOverride}>
                {/* Publish as new option */}
                <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                  <RadioGroupItem value="new" id="publish-new" />
                  <div className="grid gap-1">
                    <Label htmlFor="publish-new">Publish as new {noun}</Label>
                  </div>
                </div>

                {/* Existing worlds */}
                {userWorlds.length > 0 && (
                  <>
                    <div className="mt-4 mb-2">
                      <h4 className="text-sm font-medium">Or update existing {noun}:</h4>
                    </div>

                    {userWorlds.map(world => {
                      // Get the ID (server uses _id)
                      const worldId = world._id || world.id;

                      // Create a unique ID for the radio item
                      const radioId = `world-${worldId}`;

                      // Extract the first 5 characters of the ID for display
                      const shortId = worldId ? worldId.substring(0, 5) : '';

                      // Get download count
                      const downloads = world.downloads || 0;

                      return (
                        <div key={worldId} className="flex items-start space-x-2 p-2 rounded-md hover:bg-accent">
                          <RadioGroupItem value={worldId} id={radioId} />
                          <div className="grid gap-1">
                            <Label htmlFor={radioId}>
                              {world.name} ({shortId}, {downloads} downloads)
                            </Label>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </RadioGroup>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>

          <Button
            onClick={handlePublish}
            disabled={isPublishing || !payload}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
