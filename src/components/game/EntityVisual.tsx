import { useState } from 'react';
import { Box, Check, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { resolveModelType } from '@/lib/UtilityComponents';
import ModelViewer from '@/views/ModelViewer';
import type { Entity } from '@/types';

/** The visual an entity can be shown by, if it has one at all. */
export type EntityVisualSource = Pick<Entity, 'id' | 'name' | 'image' | 'model'>;

/** Whether this entity has anything to show — an image or a 3D model. */
// eslint-disable-next-line react-refresh/only-export-components
export const hasEntityVisual = (entity?: EntityVisualSource | null): boolean =>
  !!(entity?.image || entity?.model?.data);

/** The button both viewers carry, reading as pressed once this is the picture the entity opens on. */
const DefaultToggle = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <Button variant={active ? 'default' : 'secondary'} aria-pressed={active} onClick={onClick}>
    {active && <Check className="mr-2 h-4 w-4" />}
    Display by Default
  </Button>
);

/**
 * An entity's picture wherever one is shown in game. An entity carrying both an image and a 3D model shows
 * one with a button in the corner opening the other, and each of those viewers offers to make what it is
 * showing the one this save opens on. With only a model, the model takes the image's place and is orbited in
 * situ, since there is nothing for a corner button to sit on top of.
 *
 * `onPreferenceChange` is what makes the preference offerable at all: without it (the World Editor's preview,
 * which has no save to write to) the viewers are plain.
 *
 * Fills its container, so the caller owns the sizing.
 */
export const EntityVisual = ({ entity, className, preference, onPreferenceChange }: {
  entity: EntityVisualSource;
  className?: string;
  preference?: 'model' | 'image';
  onPreferenceChange?: (next: 'model' | 'image' | undefined) => void;
}) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const model = entity.model?.data ? entity.model : undefined;
  const image = entity.image;

  if (!image) {
    return model ? (
      <ModelViewer model={model} modelType={resolveModelType(model)} className={className} />
    ) : null;
  }
  if (!model) {
    return (
      <Slot className={className}>
        <Picture image={image} name={entity.name} onZoom={() => setZoomOpen(true)} />
        <ImageZoomViewer src={image} alt={entity.name} open={zoomOpen} onOpenChange={setZoomOpen} />
      </Slot>
    );
  }

  // Both exist: the image wins unless the player said otherwise for this entity.
  const showingModel = preference === 'model';
  const toggle = (side: 'model' | 'image') => () =>
    onPreferenceChange?.(preference === side ? undefined : side);

  return (
    <Slot className={className} fill={showingModel}>
      {showingModel ? (
        <ModelViewer model={model} modelType={resolveModelType(model)} />
      ) : (
        <Picture image={image} name={entity.name} onZoom={() => setZoomOpen(true)} />
      )}
      <CornerButton
        label={showingModel ? 'View image' : 'View 3D model'}
        onClick={() => (showingModel ? setZoomOpen(true) : setModelOpen(true))}
      >
        {showingModel ? <ImageIcon className="h-4 w-4" /> : <Box className="h-4 w-4" />}
      </CornerButton>

      <ImageZoomViewer
        src={image}
        alt={entity.name}
        open={zoomOpen}
        onOpenChange={setZoomOpen}
        footer={onPreferenceChange && (
          <DefaultToggle active={preference === 'image'} onClick={toggle('image')} />
        )}
      />
      <Dialog open={modelOpen} onOpenChange={setModelOpen}>
        <DialogContent className="sm:max-w-[600px] h-[80dvh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{entity.name} — 3D Model</DialogTitle>
          </DialogHeader>
          {/* Mounted plainly, not gated on `modelOpen`: the dialog animates out over 200ms, and dropping the
              viewer the moment it closes empties the window mid-animation. Radix unmounts the content once
              the animation finishes, which is what releases the viewer's WebGL context. */}
          <ModelViewer model={model} modelType={resolveModelType(model)} className="flex-grow" />
          {onPreferenceChange && (
            <DialogFooter className="flex-shrink-0 sm:justify-center">
              <DefaultToggle active={preference === 'model'} onClick={toggle('model')} />
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Slot>
  );
};

/**
 * The picture's box. An image shrink-wraps, so a corner button rides the picture's own edge — the slot is
 * usually wider than the portrait it holds, and a button in the slot's corner reads as unattached. The model
 * viewer has no intrinsic size and would collapse to nothing wrapped that way, so it fills the slot instead.
 */
const Slot = ({ className, fill, children }: {
  className?: string;
  fill?: boolean;
  children: React.ReactNode;
}) => (
  <div className={`w-full h-full flex items-center justify-center ${className ?? ''}`}>
    <div className={fill ? 'relative w-full h-full' : 'relative inline-flex max-w-full max-h-full'}>
      {children}
    </div>
  </div>
);

const Picture = ({ image, name, onZoom }: { image: string; name: string; onZoom: () => void }) => (
  <img
    src={image}
    alt={name}
    className="max-w-full max-h-full object-contain cursor-zoom-in"
    title="Click to enlarge"
    onClick={onZoom}
  />
);

const CornerButton = ({ label, onClick, children }: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Button
    variant="secondary"
    size="icon"
    className="absolute top-1 right-1 h-8 w-8 opacity-80 hover:opacity-100"
    aria-label={label}
    title={label}
    onClick={onClick}
  >
    {children}
  </Button>
);

export default EntityVisual;
