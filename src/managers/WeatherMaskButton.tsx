import { useRef, useState, type ChangeEvent } from 'react';
import { Brush, Contrast, Copy, Eye, EyeOff, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tip } from '@/components/ui/tooltip';
import { useNaturalRatio } from '@/components/game/WeatherBackground';
import { useGameData } from '@/contexts/GameDataContext';
import { openBubbleMenu } from '@/lib/bubbleMenuOpen';
import { cn } from '@/lib/utils';
import { toastError } from '@/lib/linkToast';
import { trackWork } from '@/lib/pendingWork';
import { useMountedRef } from '@/lib/useMountedRef';
import { MASK_TINT, MASK_TINT_ALPHA, copySlotMask, fitMaskStyle, encodeMaskPng, maskEntry, maskUseCount, newMaskEntry, withSlotMask } from '@/lib/weatherMask';
import type { LayeredPicture } from '@/lib/layeredImages';
import type { GalleryImage } from '@/types';
import { MediaChooseButton } from './MediaPicker';
import { useMediaStep } from './useMediaItemActions';
import { WeatherMaskEditor } from './weatherMaskEditor/WeatherMaskEditor';

/** Choose dims nothing: a mask may be linked again on purpose. */
const NONE_LINKED: ReadonlySet<string> = new Set();

const TINT_COLOR = `rgba(${MASK_TINT.join(', ')}, ${MASK_TINT_ALPHA})`;

/**
 * One location image slot's Weather Mask button, drawn on the frame. Its menu offers Paint, Upload and Choose with
 * no mask; Edit, Replace, Choose, Show or Hide Mask and Remove with one, plus Copy for This Image while it is shared.
 */
export function WeatherMaskButton({ images, index, onImagesChange, pictures, subject, shown, onShownChange }: {
  /** The gallery's pictures, as the widget edits them. */
  images: readonly GalleryImage[];
  index: number;
  onImagesChange: (next: GalleryImage[]) => void;
  /** The composed picture behind each Layered Image tile, keyed by the tile's data. */
  pictures?: ReadonlyMap<string, LayeredPicture>;
  /** The location's name, placeholders labeled, for a new Mask's name and the History Step. */
  subject: string;
  /** Whether the frame tints its picture with the mask. */
  shown: boolean;
  onShownChange: (shown: boolean) => void;
}) {
  const { worldOverview, locations, addMedia } = useGameData();
  const list = worldOverview.mediaList;
  const step = useMediaStep();
  const mounted = useMountedRef();
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // The chosen action runs once the menu has closed, so a dialog or popover never fights its focus return.
  const pending = useRef<(() => void) | null>(null);
  const [reading, setReading] = useState(false);
  const [painting, setPainting] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const image = images[index] as GalleryImage | undefined;
  const entry = maskEntry(list, image?.weatherMask);
  const shared = entry ? maskUseCount(locations, entry.id) : 0;
  const isShared = shared >= 2;
  const disabled = !image || !list || reading;
  const name = entry ? `Weather Mask: ${entry.name}` : 'Weather Mask';

  const link = (id: string | undefined) => onImagesChange(withSlotMask(images, index, id));

  const take = async (file: File) => {
    setReading(true);
    try {
      const data = await encodeMaskPng(file);
      if (!mounted.current) return;
      if (entry) {
        const { hash: _stale, ...rest } = entry;
        void step(`Replace Weather Mask: ${subject}`, () => addMedia({ [entry.id]: { ...rest, data, type: 'image/png' } }));
      } else {
        const added = newMaskEntry(list, data, file.name, subject);
        // The record's write first, so the History Step is the record's.
        void step(`Add Weather Mask: ${subject}`, () => {
          link(added.id);
          addMedia({ [added.id]: added });
        });
      }
    } catch (e: unknown) {
      toastError(e, { headline: "Couldn't read the file" });
    } finally {
      if (mounted.current) setReading(false);
    }
  };
  /** Gives this slot its own copy of the shared mask, then opens the brush editor on it. */
  const copyForImage = () => {
    if (!entry) return;
    const copy = copySlotMask(list, entry, images, index);
    // The record's write first, so the History Step is the record's.
    void step(`Copy Weather Mask: ${subject}`, () => {
      onImagesChange(copy.images);
      addMedia({ [copy.entry.id]: copy.entry });
    });
    setPainting(true);
  };
  const painted = (data: string) => {
    setPainting(false);
    if (entry) {
      const { hash: _stale, ...rest } = entry;
      void step(`Edit Weather Mask: ${subject}`, () => addMedia({ [entry.id]: { ...rest, data, type: 'image/png' } }));
      return;
    }
    const added = newMaskEntry(list, data, undefined, subject);
    void step(`Paint Weather Mask: ${subject}`, () => {
      link(added.id);
      addMedia({ [added.id]: added });
    });
  };

  const picked = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared so picking the same file again still fires.
    e.target.value = '';
    if (file) void trackWork(take(file));
  };

  /** `now` runs inside the click, for a file picker that needs one; the rest wait for the menu to close. */
  const item = (key: string, label: string, Icon: typeof Brush, run: () => void, { destructive = false, now = false } = {}) => (
    <ContextMenuItem
      key={key}
      onSelect={() => { if (now) run(); else pending.current = run; }}
      className={cn(destructive && 'text-destructive focus:text-destructive')}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </ContextMenuItem>
  );

  const trigger = (
    <Button
      ref={button}
      type="button"
      variant="outline"
      size="icon"
      disabled={disabled}
      aria-label={name}
      aria-haspopup="menu"
      data-weather-mask-button=""
      className={cn('bg-background/80 backdrop-blur', entry && 'border-primary text-primary')}
      onClick={(event) => openBubbleMenu(event.currentTarget, 'right')}
    >
      <Contrast className="h-4 w-4" aria-hidden />
    </Button>
  );

  return (
    <div data-weather-mask={entry?.id ?? ''}>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={picked} data-weather-mask-file="" />
      <MediaChooseButton
        kind="mask"
        list={list}
        linkedIds={NONE_LINKED}
        open={choosing}
        onOpenChange={setChoosing}
        onPick={(chosen) => void step(`Add Weather Mask: ${subject}`, () => link(chosen.id))}
        anchor={(
          <span className="block">
            <ContextMenu>
              <Tip tip={name} labelsChild={false}>
                <ContextMenuTrigger asChild disabled={disabled}>{trigger}</ContextMenuTrigger>
              </Tip>
              <ContextMenuContent
                className="w-56"
                collisionPadding={8}
                onCloseAutoFocus={(event) => {
                  const next = pending.current;
                  pending.current = null;
                  if (!next) return;
                  event.preventDefault();
                  button.current?.focus();
                  next();
                }}
              >
                {entry && isShared && (
                  <>
                    {/* The count leads, so a long name truncates, never the count. */}
                    <ContextMenuLabel className="truncate" data-weather-mask-shared={shared}>
                      {`Shared by ${shared} images · ${entry.name}`}
                    </ContextMenuLabel>
                    <ContextMenuSeparator />
                  </>
                )}
                {entry
                  ? [
                      item('paint', 'Edit', Brush, () => setPainting(true)),
                      item('upload', 'Replace', Upload, () => input.current?.click(), { now: true }),
                      item('choose', 'Choose', Contrast, () => setChoosing(true)),
                      ...(isShared ? [item('copy', 'Copy for This Image', Copy, copyForImage)] : []),
                      shown
                        ? item('show', 'Hide Mask', EyeOff, () => onShownChange(false))
                        : item('show', 'Show Mask', Eye, () => onShownChange(true)),
                      <ContextMenuSeparator key="sep" />,
                      item('remove', 'Remove', X, () => void step(`Remove Weather Mask: ${subject}`, () => link(undefined)), { destructive: true }),
                    ]
                  : [
                      item('paint', 'Paint', Brush, () => setPainting(true)),
                      item('upload', 'Upload', Upload, () => input.current?.click(), { now: true }),
                      item('choose', 'Choose', Contrast, () => setChoosing(true)),
                    ]}
              </ContextMenuContent>
            </ContextMenu>
          </span>
        )}
      />
      {image && (
        <WeatherMaskEditor
          open={painting}
          pictures={[{ key: 'slot', label: '', picture: pictures?.get(image.data) ?? image.data }]}
          mask={entry?.data}
          sharedCount={shared}
          onSave={painted}
          onClose={() => setPainting(false)}
        />
      )}
    </div>
  );
}

/** A slot's mask drawn over its framed picture in the brush editor's tint, fit as the frame fits the picture. */
export function WeatherMaskTint({ image, pictures }: {
  image: GalleryImage | undefined;
  pictures?: ReadonlyMap<string, LayeredPicture>;
}) {
  const { worldOverview } = useGameData();
  const entry = maskEntry(worldOverview.mediaList, image?.weatherMask);
  const layered = image ? pictures?.get(image.data) : undefined;
  const ratio = useNaturalRatio(entry && image ? (layered?.canvas ?? image.data) : undefined);
  if (!entry || !ratio) return null;
  return (
    // The size container lets the mask box read the frame's size in `cq` units.
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md [container-type:size]" data-weather-mask-tint={entry.id}>
      <div className="h-full w-full" style={{ ...fitMaskStyle(entry.data, ratio, 'contain'), backgroundColor: TINT_COLOR }} />
    </div>
  );
}
