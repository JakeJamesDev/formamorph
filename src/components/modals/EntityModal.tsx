import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImageZoomViewer } from "@/components/ImageZoomViewer";
import { getModelType } from '../../lib/UtilityComponents';
import ModelViewer from '../../views/ModelViewer';
import AudioPlayer from '../game/AudioPlayer';
import type { Entity } from "@/types";

export const EntityModal = ({ entity, isOpen, onOpenChange }: {
  entity: Entity | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  // Shared pan/zoom viewer for the entity image (same as world thumbnails).
  const [zoomOpen, setZoomOpen] = useState(false);

  if (!entity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{entity.name}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow min-h-0 flex flex-col gap-4 p-4">
          {/* Image takes 3/4 of the body height (aspect ratio preserved); description fills the rest. */}
          {entity.image && (
            <div className="flex-[3] min-h-0 flex items-center justify-center">
              <img
                src={entity.image}
                alt={entity.name}
                className="max-h-full max-w-full object-contain cursor-zoom-in"
                title="Click to enlarge"
                onClick={() => setZoomOpen(true)}
              />
              <ImageZoomViewer
                src={entity.image}
                alt={entity.name}
                open={zoomOpen}
                onOpenChange={setZoomOpen}
              />
            </div>
          )}
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col gap-4 pr-3">
              {entity.inGameDescription?.trim() ? (
                <p>{entity.inGameDescription}</p>
              ) : (
                <p className="italic text-muted-foreground">No description provided.</p>
              )}
              {entity.sound && (
                <AudioPlayer src={entity.sound.data} className="w-full" />
              )}
              {entity.model && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button>View 3D Model</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>3D Model Viewer</DialogTitle>
                    </DialogHeader>
                    <ModelViewer model={entity.model} modelType={getModelType(entity.model.type)} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};
