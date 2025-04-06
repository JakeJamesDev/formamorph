import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getModelType } from '../../lib/UtilityComponents';
import ModelViewer from '../../views/ModelViewer';

export const EntityModal = ({ entity, isOpen, onOpenChange }) => {
  if (!entity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{entity.name}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow overflow-y-auto">
          <div className="grid gap-4 p-4">
            {entity.image && (
              <img src={entity.image} alt={entity.name} className="w-full h-auto" />
            )}
            <p>{entity.inGameDescription}</p>
            {entity.sound && (
              <audio controls>
                <source src={entity.sound.data} type={entity.sound.type} />
                Your browser does not support the audio element.
              </audio>
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
                  <ModelViewer modelData={entity.model.data} modelType={getModelType(entity.model.type)} />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
