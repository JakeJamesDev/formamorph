import { forwardRef, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { BodyBackdropArt } from '@/components/BodyBackdropArt';
import { ItemIconArt } from '@/components/ItemIconArt';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FlashTip, Tip } from '@/components/ui/tooltip';
import { boxKey, boxLabel, boxStyle, frameInBox, stackOrder } from '@/lib/bodyLayout';
import type { ShownItemIcon } from '@/lib/itemIcons';
import { cn } from '@/lib/utils';
import type { Body, SlotBox } from '@/types';

/** The doll's height cap. Its width follows the Body's aspect, up to the panel's width (Q49). */
const DOLL_MAX_HEIGHT = 320;

const BOX_BUTTON = 'rounded-sm border border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';

/** What one Slot Box shows. `detail` is the list row its popover holds. */
export interface DollFill {
  id: string;
  name: string;
  icon: ShownItemIcon;
  detail: ReactNode;
}

const FrameButton = forwardRef<HTMLButtonElement, ComponentProps<'button'> & { tip?: string }>(({ tip, ...rest }, ref) => (
  <Tip tip={tip}><button ref={ref} type="button" {...rest} /></Tip>
));
FrameButton.displayName = 'FrameButton';

/** A filled box: the frame fits an image, and only the frame takes the pointer (Q7, Q48). It never draws the name (Q10). */
function FilledBox({ fill, label, box, aspect }: { fill: DollFill; label: string; box: SlotBox; aspect: number }) {
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const image = fill.icon.kind === 'image' && !failed ? fill.icon.src : undefined;
  const frame = image && imageAspect ? frameInBox(box, aspect, imageAspect) : { w: 1, h: 1 };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <FrameButton
          tip={fill.name}
          aria-label={`${label}: ${fill.name}`}
          className={cn(BOX_BUTTON, 'pointer-events-auto flex items-center justify-center overflow-hidden bg-card/70 hover:border-primary')}
          style={{ width: `${frame.w * 100}%`, height: `${frame.h * 100}%` }}
        >
          {image && (
            <img
              src={image} alt="" className="h-full w-full object-contain"
              onLoad={(e) => setImageAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight || null)}
              onError={() => setFailed(true)}
            />
          )}
          {fill.icon.kind === 'icon' && <ItemIconArt id={fill.icon.id} className="h-full w-full" />}
        </FrameButton>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1"><ul>{fill.detail}</ul></PopoverContent>
    </Popover>
  );
}

/** An empty box: a blank outline, with the slot name on hover or tap (Q9, Q22). */
function EmptyBox({ slotName, label }: { slotName: string; label: string }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [taps, setTaps] = useState(0);
  return (
    <>
      <FrameButton
        ref={anchor}
        tip={slotName}
        aria-label={`${label}: Empty`}
        className={cn(BOX_BUTTON, 'pointer-events-auto h-full w-full hover:border-primary')}
        onClick={() => setTaps((n) => n + 1)}
      />
      {taps > 0 && <FlashTip anchor={anchor} tip={slotName} open cycle={taps} />}
    </>
  );
}

/** A Body's figure in play: its Backdrop, and one box per capacity unit with what fills it. A box takes no pointer itself, so a
 *  filled box's margin reaches the box below. */
export function BodyDoll({ body, slotName, fills }: {
  body: Body;
  slotName: (slotId: string) => string;
  fills: ReadonlyMap<string, DollFill>;
}) {
  const order = stackOrder(body.entries);
  return (
    <div
      role="group"
      aria-label="Equipped"
      data-body-doll
      className="relative isolate mx-auto rounded-md border border-border bg-background/40"
      style={{ aspectRatio: body.aspect, width: `min(100%, ${DOLL_MAX_HEIGHT * body.aspect}px)` }}
    >
      <BodyBackdropArt backdrop={body.backdrop} />
      {body.entries.flatMap((entry) => entry.boxes.map((box, unit) => {
        const key = boxKey({ slotId: entry.slotId, unit });
        const name = slotName(entry.slotId);
        const label = boxLabel(name, entry.boxes.length, unit);
        const fill = fills.get(key);
        return (
          <div key={key} data-doll-box={label} className="pointer-events-none absolute flex items-center justify-center" style={boxStyle(box, order.get(key))}>
            {fill
              // A new copy or image starts closed and measures again, so a reflow never leaves the last copy's popover open.
              ? <FilledBox key={`${fill.id}|${fill.icon.kind === 'image' ? fill.icon.src : ''}`} fill={fill} label={label} box={box} aspect={body.aspect} />
              : <EmptyBox slotName={name} label={label} />}
          </div>
        );
      }))}
    </div>
  );
}
