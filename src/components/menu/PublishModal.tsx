import { useState, useEffect } from "react";
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
import WorldStorageService from "@/services/WorldStorageService";
import { type WorldRecord } from "@/components/WorldDetails";

interface PublishModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  /** The locally-selected world to publish (its `data` is uploaded). */
  selectedWorld: WorldRecord | null;
}

/** Publish the selected local world to the server — as a new world or by overriding one of the user's
 *  existing published worlds. Owns its own publish/paging state; loads the user's worlds when opened. */
export function PublishModal({ open, onOpenChange, isAuthenticated, selectedWorld }: PublishModalProps) {
  const [userWorlds, setUserWorlds] = useState<WorldRecord[]>([]);
  const [selectedWorldToOverride, setSelectedWorldToOverride] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Fetch user's published worlds
  const fetchUserWorlds = async () => {
    if (!isAuthenticated) return;

    try {
      const worlds = await WorldStorageService.getUserWorlds();
      setUserWorlds(worlds);

      // Set default selection to "publish as new"
      setSelectedWorldToOverride('new');
    } catch (error) {
      console.error('Error fetching user worlds:', error);
      setPublishError('Failed to load your published worlds');
    }
  };

  // Handle publishing as a new world
  const handlePublishAsNew = async () => {
    setPublishError('');
    setIsPublishing(true);

    try {
      // Get the current world data
      const worldToPublish = selectedWorld!.data;

      // Ensure tags are included in the world data
      if (!worldToPublish.worldOverview.tags) {
        worldToPublish.worldOverview.tags = [];
      }

      // Publish the world
      await WorldStorageService.publishWorld(worldToPublish);

      // Update the user worlds list directly
      const updatedWorlds = await WorldStorageService.getUserWorlds();
      setUserWorlds(updatedWorlds);

      // Close the modal and show success message
      onOpenChange(false);
      toast.success('World published successfully!');
    } catch (error) {
      setPublishError((error as Error).message || 'Failed to publish world');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle overriding an existing world
  const handleOverrideWorld = async () => {
    if (!selectedWorldToOverride) return;

    // If "new" is selected, call handlePublishAsNew instead
    if (selectedWorldToOverride === 'new') {
      return handlePublishAsNew();
    }

    setPublishError('');
    setIsPublishing(true);

    try {
      // Get the current world data
      const worldToPublish = selectedWorld!.data;

      // Ensure tags are included in the world data
      if (!worldToPublish.worldOverview.tags) {
        worldToPublish.worldOverview.tags = [];
      }

      // Update the existing world
      await WorldStorageService.publishWorld(worldToPublish, selectedWorldToOverride);

      // Update the user worlds list directly
      const updatedWorlds = await WorldStorageService.getUserWorlds();
      setUserWorlds(updatedWorlds);

      // Close the modal and show success message
      onOpenChange(false);
      toast.success('World updated successfully!');
    } catch (error) {
      setPublishError((error as Error).message || 'Failed to update world');
    } finally {
      setIsPublishing(false);
    }
  };

  // Load user worlds when the publish modal is opened
  useEffect(() => {
    if (open) {
      fetchUserWorlds();
    }
    // Fetch only when the publish modal opens or auth changes — not on fetchUserWorlds identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAuthenticated]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Publish World</DialogTitle>
          <DialogDescription>
            Publish your world to share it with other players.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {publishError && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md text-sm text-red-800 dark:text-red-300">
              {publishError}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Select Publish Option</h3>

            <RadioGroup value={selectedWorldToOverride ?? undefined} onValueChange={setSelectedWorldToOverride}>
              {/* Publish as new option */}
              <div className="flex items-start space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <RadioGroupItem value="new" id="publish-new" />
                <div className="grid gap-1">
                  <Label htmlFor="publish-new">Publish as new world</Label>
                </div>
              </div>

              {/* Existing worlds */}
              {userWorlds.length > 0 && (
                <>
                  <div className="mt-4 mb-2">
                    <h4 className="text-sm font-medium">Or update existing world:</h4>
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
                      <div key={worldId} className="flex items-start space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
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

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPublishing}>
            Cancel
          </Button>

          <Button
            onClick={selectedWorldToOverride === 'new' ? handlePublishAsNew : handleOverrideWorld}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
