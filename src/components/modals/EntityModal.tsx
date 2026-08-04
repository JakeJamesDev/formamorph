import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EntityVisual, hasEntityVisual } from '../game/EntityVisual';
import AudioPlayer from '../game/AudioPlayer';
import { usePlaceholderResolver } from "@/lib/usePlaceholderResolver";
import { useEntityVisualPreference } from "@/lib/useEntityVisualPreference";
import { useEntityGallery } from "@/lib/useEntityGallery";
import type { Entity } from "@/types";

export const EntityModal = ({ entity, isOpen, onOpenChange }: {
  entity: Entity | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const resolvePH = usePlaceholderResolver();
  const { preference, onPreferenceChange } = useEntityVisualPreference(entity?.id);
  const { imageIndex, onImageStep } = useEntityGallery(entity);

  if (!entity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90dvh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{entity.name}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow min-h-0 flex flex-col gap-4 p-4">
          {/* Picture takes 3/4 of the body height (aspect ratio preserved); description fills the rest. */}
          {hasEntityVisual(entity) && (
            <div className="flex-[3] min-h-0 flex items-center justify-center">
              <EntityVisual
                entity={entity}
                preference={preference}
                onPreferenceChange={onPreferenceChange}
                imageIndex={imageIndex}
                onImageStep={onImageStep}
              />
            </div>
          )}
          {/* Scroll area whose content sits vertically centered when short (min-h-full + justify-center)
              and scrolls from the top when long. */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="min-h-full flex flex-col justify-center">
              <div className="flex flex-col gap-4">
              {entity.playerDescription?.trim() ? (
                <p>{resolvePH(entity.playerDescription)}</p>
              ) : (
                <p className="italic text-muted-foreground">No description provided.</p>
              )}
              {entity.sound && (
                <AudioPlayer src={entity.sound.data} className="w-full" />
              )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
