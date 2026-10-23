import { useState } from 'react';
import { RemoteImg } from '@/lib/useRemoteImage';
import { Box, Check, Image as ImageIcon, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImageZoomViewer } from '@/components/ImageZoomViewer';
import { GalleryControls, type GalleryControlsProps } from '@/components/GalleryControls';
import { resolveModelType } from '@/lib/UtilityComponents';
import { entityImageData } from '@/lib/entityImages';
import type { EntityVisualSource } from '@/lib/entityVisual';
import { AvatarIcon } from '@/lib/elementIcons';
import ModelViewer from '@/views/ModelViewer';
import { SwipeImage } from './SwipeImage';
import type { Base64Data, EntityVisualKind } from '@/types';
import { Tip } from '@/components/ui/tooltip';

/** The button each viewer carries, reading as pressed once this is the visual the entity opens on. */
const DefaultToggle = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
  <Button variant={active ? 'default' : 'secondary'} aria-pressed={active} onClick={onClick}>
    {active && <Check className="mr-2 h-4 w-4" />}
    Display by Default
  </Button>
);

/** The default order, richest first. */
const ORDER: readonly EntityVisualKind[] = ['avatar', 'model', 'image'];

const VIEW: Record<EntityVisualKind, { label: string; icon: LucideIcon }> = {
  avatar: { label: 'View Avatar', icon: AvatarIcon },
  model: { label: 'View 3D Model', icon: Box },
  image: { label: 'View Image', icon: ImageIcon },
};

/**
 * An entity's visual wherever one is shown in game: its Avatar, its 3D model or its image, the first it has
 * in that order unless the player's preference names another it has. The shown visual fills the slot; each
 * other one sits behind a corner button that opens it in its own viewer, and each viewer offers to make what
 * it shows the one this save opens on. Avatars and models orbit in place. An entity carrying more than one
 * image pages between them, chevrons on a pointer device and a swipe on touch, and the zoom viewer stays on
 * whichever is showing.
 *
 * `onPreferenceChange` is what makes the preference offerable at all, and `onImageStep` what makes the gallery
 * pageable: without them (the World Editor's preview, which has no playthrough to hold either in) this shows
 * the primary image plainly. Both live in gameplay state, so the host supplies them: see
 * `useEntityVisualPreference` and `useEntityGallery`, which also supplies the visible `images` in play.
 *
 * `avatar` and `morphValues` come from the host for the same reason: the Avatar's source and the stat values
 * live in gameplay state.
 *
 * Fills its container, so the caller owns the sizing.
 */
export const EntityVisual = ({ entity, className, images: inPlay, avatar, preference, onPreferenceChange, imageIndex = 0, onImageStep, morphValues }: {
  entity: EntityVisualSource;
  /** The images visible in play, in author order. Absent, the authored gallery, rules ignored. */
  images?: readonly Base64Data[];
  /** The entity's Avatar viewer, when it has one in play. */
  avatar?: React.ReactNode;
  className?: string;
  preference?: EntityVisualKind;
  onPreferenceChange?: (next: EntityVisualKind | undefined) => void;
  imageIndex?: number;
  onImageStep?: (by: number) => void;
  /** The shape keys the entity's own stats drive on its model, in every viewer this opens. */
  morphValues?: Readonly<Record<string, number>>;
}) => {
  const [open, setOpen] = useState<EntityVisualKind | null>(null);

  const images = inPlay ?? entityImageData(entity);
  // A held index outlives the gallery it was taken from (an edited world, a reused panel), so clamp it here
  // rather than trusting it to still point at a picture.
  const index = images.length ? Math.min(imageIndex, images.length - 1) : 0;
  const current = images[index];
  const step = onImageStep;
  const model = entity.model?.data ? entity.model : undefined;
  const gallery = step && images.length > 1 ? { count: images.length, index, onStep: step } : undefined;

  const has: Record<EntityVisualKind, boolean> = { avatar: !!avatar, model: !!model, image: !!current };
  const available = ORDER.filter((kind) => has[kind]);
  if (!available.length) return null;
  const showing = preference && has[preference] ? preference : available[0];
  const others = available.filter((kind) => kind !== showing);

  const footer = (kind: EntityVisualKind) => (onPreferenceChange && available.length > 1 ? (
    <DefaultToggle active={preference === kind} onClick={() => onPreferenceChange(preference === kind ? undefined : kind)} />
  ) : undefined);
  const openChange = (kind: EntityVisualKind) => (next: boolean) => setOpen(next ? kind : null);
  const modelViewer = (viewerClass?: string) => model && (
    <ModelViewer model={model} modelType={resolveModelType(model)} morphValues={morphValues} className={viewerClass} />
  );

  return (
    <Slot className={className} fill={showing !== 'image'}>
      {showing === 'avatar' ? avatar
        : showing === 'model' ? modelViewer()
        : <Picture images={images} index={index} gallery={gallery} name={entity.name} onZoom={() => setOpen('image')} />}
      {others.length > 0 && (
        <div className="absolute top-1 right-1 flex flex-col gap-1">
          {others.map((kind) => {
            const { label, icon: Icon } = VIEW[kind];
            return (
              <CornerButton key={kind} label={label} onClick={() => setOpen(kind)}>
                <Icon className="h-4 w-4" />
              </CornerButton>
            );
          })}
        </div>
      )}

      {current && (
        <ImageZoomViewer
          src={current}
          alt={entity.name}
          open={open === 'image'}
          onOpenChange={openChange('image')}
          gallery={gallery}
          footer={footer('image')}
        />
      )}
      {model && (
        <ViewerDialog title={`${entity.name} — 3D Model`} description="Interactive 3D model. Drag to rotate, scroll to zoom." open={open === 'model'} onOpenChange={openChange('model')} footer={footer('model')}>
          {modelViewer('flex-grow')}
        </ViewerDialog>
      )}
      {avatar && (
        <ViewerDialog title={`${entity.name} — Avatar`} description="Interactive Avatar. Drag to rotate, scroll to zoom." open={open === 'avatar'} onOpenChange={openChange('avatar')} footer={footer('avatar')}>
          <div className="relative flex-grow min-h-0">{avatar}</div>
        </ViewerDialog>
      )}
    </Slot>
  );
};

/** A 3D visual opened from its corner button, with the preference control below it. */
const ViewerDialog = ({ title, description, open, onOpenChange, footer, children }: {
  title: string;
  description: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[600px] h-[80dvh] flex flex-col">
      <DialogHeader className="flex-shrink-0">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
      </DialogHeader>
      {/* Mounted plainly, not gated on `open`: the dialog animates out over 200ms, and dropping the viewer the
          moment it closes empties the window mid-animation. Radix unmounts the content once the animation
          finishes, which is what releases the viewer's WebGL context. */}
      {children}
      {footer && <DialogFooter className="flex-shrink-0 sm:justify-center">{footer}</DialogFooter>}
    </DialogContent>
  </Dialog>
);

/**
 * The visual's box. An image shrink-wraps, so a corner button rides the image's own edge: the slot is
 * usually wider than the image it holds, and a button in the slot's corner reads as unattached. A 3D viewer
 * has no intrinsic size and would collapse to nothing wrapped that way, so it fills the slot instead.
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
  images: readonly string[];
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
      className="h-8 w-8 opacity-80 hover:opacity-100"
      onClick={onClick}
    >
      {children}
    </Button>
  </Tip>
);

export default EntityVisual;
