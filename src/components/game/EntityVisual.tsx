import { useState } from 'react';
import { RemoteImg } from '@/lib/useRemoteImage';
import { Box, Check, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { GalleryControls, type GalleryControlsProps } from '@/components/GalleryControls';
import { resolveModelType } from '@/lib/UtilityComponents';
import { entityImages } from '@/lib/entityImages';
import ModelViewer from '@/views/ModelViewer';
import { SwipeImage } from './SwipeImage';
import type { Entity } from '@/types';
import { Tip } from '@/components/ui/tooltip';

/** The visual an entity can be shown by, if it has one at all. */
export type EntityVisualSource = Pick<Entity, 'id' | 'name' | 'images' | 'model'>;

/** Whether this entity has anything to show — a picture or a 3D model. */
// eslint-disable-next-line react-refresh/only-export-components
export const hasEntityVisual = (entity?: EntityVisualSource | null): boolean =>
  !!(entityImages(entity).length || entity?.model?.data);

/** The button both viewers carry, reading as pressed once this is the picture the entity opens on. */
const DefaultToggle = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <Button variant={active ? 'default' : 'secondary'} aria-pressed={active} onClick={onClick}>
    {active && <Check className="mr-2 h-4 w-4" />}
    Display by Default
  </Button>
);

/**
 * An entity's picture wherever one is shown in game. An entity carrying more than one pages between them —
 * chevrons on a pointer device, a swipe on touch — and the zoom viewer stays on whichever is showing. An
 * entity carrying both a picture and a 3D model shows one with a button in the corner opening the other, and
 * each of those viewers offers to make what it is showing the one this save opens on. With only a model, the
 * model takes the picture's place and is orbited in situ, since there is nothing for a corner button to sit
 * on top of.
 *
 * `onPreferenceChange` is what makes the preference offerable at all, and `onImageStep` what makes the gallery
 * pageable: without them (the World Editor's preview, which has no playthrough to hold either in) this shows
 * the primary picture plainly. Both live in gameplay state, so the host supplies them — see
 * `useEntityVisualPreference` and `useEntityGallery`.
 *
 * Fills its container, so the caller owns the sizing.
 */
export const EntityVisual = ({ entity, className, preference, onPreferenceChange, imageIndex = 0, onImageStep }: {
  entity: EntityVisualSource;
  className?: string;
  preference?: 'model' | 'image';
  onPreferenceChange?: (next: 'model' | 'image' | undefined) => void;
  imageIndex?: number;
  onImageStep?: (by: number) => void;
}) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const images = entityImages(entity);
  // A held index outlives the gallery it was taken from (an edited world, a reused panel), so clamp it here
  // rather than trusting it to still point at a picture.
  const index = images.length ? Math.min(imageIndex, images.length - 1) : 0;
  const current = images[index];
  const step = onImageStep;
  const model = entity.model?.data ? entity.model : undefined;
  const gallery = step && images.length > 1 ? { count: images.length, index, onStep: step } : undefined;

  if (!current) {
    return model ? (
      <ModelViewer model={model} modelType={resolveModelType(model)} className={className} />
    ) : null;
  }

  const picture = (
    <Picture images={images} index={index} gallery={gallery} name={entity.name} onZoom={() => setZoomOpen(true)} />
  );
  const zoomViewer = (footer?: React.ReactNode) => (
    <ImageZoomViewer
      src={current}
      alt={entity.name}
      open={zoomOpen}
      onOpenChange={setZoomOpen}
      gallery={gallery}
      footer={footer}
    />
  );

  if (!model) {
    return (
      <Slot className={className}>
        {picture}
        {zoomViewer()}
      </Slot>
    );
  }

  // Both exist: the picture wins unless the player said otherwise for this entity.
  const showingModel = preference === 'model';
  const toggle = (side: 'model' | 'image') => () =>
    onPreferenceChange?.(preference === side ? undefined : side);

  return (
    <Slot className={className} fill={showingModel}>
      {showingModel ? <ModelViewer model={model} modelType={resolveModelType(model)} /> : picture}
      <CornerButton
        label={showingModel ? 'View image' : 'View 3D model'}
        onClick={() => (showingModel ? setZoomOpen(true) : setModelOpen(true))}
      >
        {showingModel ? <ImageIcon className="h-4 w-4" /> : <Box className="h-4 w-4" />}
      </CornerButton>

      {zoomViewer(onPreferenceChange && (
        <DefaultToggle active={preference === 'image'} onClick={toggle('image')} />
      ))}
      <Dialog open={modelOpen} onOpenChange={setModelOpen}>
        <DialogContent className="sm:max-w-[600px] h-[80dvh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{entity.name} — 3D Model</DialogTitle>
          <DialogDescription className="sr-only">Interactive 3D model. Drag to rotate, scroll to zoom.</DialogDescription>
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

/** The showing picture plus, when there is a pageable gallery behind it, the controls to move through it. */
const Picture = ({ images, index, gallery, name, onZoom }: {
  images: string[];
  index: number;
  gallery?: GalleryControlsProps;
  name: string;
  onZoom: () => void;
}) => {
  if (!gallery) {
    return (
      // The alt already names the picture; the tip only says it opens.
      <Tip tip="Click to enlarge" labelsChild={false}>
        <RemoteImg
          src={images[index]}
          alt={name}
          className="max-w-full max-h-full object-contain cursor-zoom-in"
          onClick={onZoom}
        />
      </Tip>
    );
  }
  return (
    // `group` so the controls fade in from a hover over the picture rather than the whole slot.
    // justify-center: this box's width comes from the picture's intrinsic width (clamped to the slot), but a
    // height-constrained picture shrink-wraps narrower inside it and would otherwise sit flush left.
    <div className="group relative inline-flex max-w-full max-h-full justify-center">
      <SwipeImage images={images} index={index} onStep={gallery.onStep} alt={name} onZoom={onZoom} />
      <GalleryControls {...gallery} />
    </div>
  );
};

const CornerButton = ({ label, onClick, children }: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Tip tip={label}>
    <Button
      variant="secondary"
      size="icon"
      className="absolute top-1 right-1 h-8 w-8 opacity-80 hover:opacity-100"
      onClick={onClick}
    >
      {children}
    </Button>
  </Tip>
);

export default EntityVisual;
