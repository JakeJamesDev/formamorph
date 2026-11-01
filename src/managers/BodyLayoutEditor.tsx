import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { BodyBackdropArt } from '@/components/BodyBackdropArt';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tip } from '@/components/ui/tooltip';
import { Hint } from '@/components/ui/typography';
import {
  boxAt, boxKey, boxStyle, clampAspect, dragMove, dragResize, grownBox, KEY_STEP, MAX_ASPECT, MIN_ASPECT, movedBox, sameBox, snapLines, stackOrder, withBackdropImage, withBox, withOutline,
  type BoxCorner, type BoxRef, type OutlineKind, type SnappedBox, type SnapReach,
} from '@/lib/bodyLayout';
import { readImageAspect } from '@/lib/imageAspect';
import { IMAGE_CAPS } from '@/lib/imageSlots';
import { useMountedRef } from '@/lib/useMountedRef';
import { ImageUpload } from '@/lib/UtilityComponents';
import { cn } from '@/lib/utils';
import type { Body, SlotBox } from '@/types';

const OUTLINES: { kind: OutlineKind; label: string }[] = [
  { kind: 'humanoid', label: 'Humanoid' },
  { kind: 'quadruped', label: 'Quadruped' },
  { kind: 'plain', label: 'Plain' },
];

const CUSTOM_IMAGE = 'image';

const CORNERS: BoxCorner[] = ['nw', 'ne', 'sw', 'se'];
const CORNER_SPOT: Record<BoxCorner, string> = {
  nw: '-left-2 -top-2 cursor-nwse-resize',
  ne: '-right-2 -top-2 cursor-nesw-resize',
  sw: '-left-2 -bottom-2 cursor-nesw-resize',
  se: '-right-2 -bottom-2 cursor-nwse-resize',
};
// A finger needs more than the dot it sees.
const COARSE_HIT = 'after:absolute after:content-[""] [@media(pointer:coarse)]:after:-inset-3';

const SNAP_PX = 6;
const MIN_STAGE_PX = 40;
const ASPECT_KEY_STEP = 0.02;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP],
};

/** A Body's figure: the Backdrop, one movable, sizable box per capacity unit, and a bottom edge that sets the aspect.
 *  A drag shows on a local copy and writes once on release, so it is one History step. */
function BodyLayoutCanvas({ body, onChange, labelOf, selected, onSelect, focusRequest, snap }: {
  body: Body;
  onChange: (next: Body) => void;
  labelOf: (box: BoxRef) => string;
  selected: BoxRef | null;
  onSelect: (box: BoxRef | null) => void;
  focusRequest: number;
  snap: boolean;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const boxNodes = useRef(new Map<string, HTMLDivElement>());
  const stopGesture = useRef<(() => void) | null>(null);
  const [live, setLive] = useState<Body | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const shown = live ?? body;

  useEffect(() => () => stopGesture.current?.(), []);

  // Arrow keys reach the box a row click selected.
  const selectedKey = selected && boxKey(selected);
  useEffect(() => {
    if (selectedKey) boxNodes.current.get(selectedKey)?.focus();
  }, [selectedKey, focusRequest]);

  const startGesture = (event: ReactPointerEvent, step: (e: PointerEvent, bounds: DOMRect) => Body) => {
    const node = stage.current;
    event.stopPropagation();
    if (!node || stopGesture.current || event.button !== 0) return false;
    event.preventDefault();
    const bounds = node.getBoundingClientRect();
    const { pointerId } = event;
    let latest: Body | null = null;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      latest = step(e, bounds);
      setLive(latest);
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', cancel);
      stopGesture.current = null;
    };
    const clear = () => { setLive(null); setGuides({}); };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      stop();
      clear();
      if (latest) onChange(latest);
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      stop();
      clear();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', cancel);
    stopGesture.current = stop;
    return true;
  };

  const dragBox = (event: ReactPointerEvent, ref: BoxRef, step: (dx: number, dy: number, reach: SnapReach | null) => SnappedBox) => {
    const lines = snapLines(body.entries, ref);
    const origin = { x: event.clientX, y: event.clientY };
    const started = startGesture(event, (e, bounds) => {
      const reach = snap && !e.altKey ? { lines, reachX: SNAP_PX / bounds.width, reachY: SNAP_PX / bounds.height } : null;
      const { box, guideX, guideY } = step((e.clientX - origin.x) / bounds.width, (e.clientY - origin.y) / bounds.height, reach);
      setGuides({ x: guideX, y: guideY });
      return { ...body, entries: withBox(body.entries, ref, box) };
    });
    if (started) onSelect(ref);
  };

  const dragEdge = (event: ReactPointerEvent) => {
    const grab = event.clientY - (stage.current?.getBoundingClientRect().bottom ?? event.clientY);
    startGesture(event, (e, bounds) => ({
      ...body, aspect: clampAspect(bounds.width / Math.max(MIN_STAGE_PX, e.clientY - grab - bounds.top)),
    }));
  };

  const onBoxKey = (event: KeyboardEvent, ref: BoxRef, box: SlotBox) => {
    const arrow = ARROWS[event.key];
    if (!arrow) return;
    event.preventDefault();
    const next = event.shiftKey ? grownBox(box, ...arrow) : movedBox(box, ...arrow);
    onChange({ ...body, entries: withBox(body.entries, ref, next) });
  };

  const onEdgeKey = (event: KeyboardEvent) => {
    const taller = event.key === 'ArrowDown';
    if (!taller && event.key !== 'ArrowUp') return;
    event.preventDefault();
    onChange({ ...body, aspect: clampAspect(body.aspect * (taller ? 1 - ASPECT_KEY_STEP : 1 + ASPECT_KEY_STEP)) });
  };

  const order = stackOrder(shown.entries);
  const topLayer = order.size + 1;
  const selectedBox = selected && boxAt(shown.entries, selected);

  return (
    <div
      ref={stage}
      data-body-layout-stage
      className="relative isolate w-full rounded-md border border-border bg-background/40"
      style={{ aspectRatio: shown.aspect }}
      onPointerDown={() => onSelect(null)}
    >
      <BodyBackdropArt backdrop={shown.backdrop} />
      {guides.x !== undefined && <div data-snap-guide="x" className="pointer-events-none absolute inset-y-0 w-px bg-primary" style={{ left: `${guides.x * 100}%`, zIndex: topLayer }} />}
      {guides.y !== undefined && <div data-snap-guide="y" className="pointer-events-none absolute inset-x-0 h-px bg-primary" style={{ top: `${guides.y * 100}%`, zIndex: topLayer }} />}
      {shown.entries.flatMap((entry) => entry.boxes.map((box, unit) => {
        const ref = { slotId: entry.slotId, unit };
        const key = boxKey(ref);
        const label = labelOf(ref);
        const isSelected = sameBox(selected, ref);
        return (
          <div
            key={key}
            ref={(node) => { if (node) boxNodes.current.set(key, node); else boxNodes.current.delete(key); }}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={isSelected}
            data-slot-box={label}
            className={cn(
              'absolute flex cursor-move touch-none select-none items-center justify-center rounded-sm border text-center text-helper leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              isSelected ? 'border-primary bg-primary/25 text-foreground' : 'border-foreground/50 bg-card/70 text-foreground hover:border-primary',
            )}
            style={boxStyle(box, order.get(key))}
            onPointerDown={(e) => dragBox(e, ref, (dx, dy, reach) => dragMove(box, dx, dy, reach))}
            onFocus={() => { if (!isSelected) onSelect(ref); }}
            onKeyDown={(e) => onBoxKey(e, ref, box)}
          >
            <span className="pointer-events-none line-clamp-2 overflow-hidden px-0.5">{label}</span>
          </div>
        );
      }))}
      {/* Selection never reorders boxes; only its handles sit above them (Q47). */}
      {selected && selectedBox && (
        <div className="pointer-events-none absolute" style={boxStyle(selectedBox, topLayer)}>
          {CORNERS.map((corner) => (
            <span
              key={corner}
              data-box-handle={corner}
              className={cn('pointer-events-auto absolute h-4 w-4 touch-none rounded-full border border-background bg-primary', CORNER_SPOT[corner], COARSE_HIT)}
              onPointerDown={(e) => dragBox(e, selected, (dx, dy, reach) => dragResize(selectedBox, corner, dx, dy, reach))}
            />
          ))}
        </div>
      )}
      {shown.backdrop.kind !== 'image' && (
        <span
          role="slider"
          tabIndex={0}
          aria-label="Backdrop Height"
          aria-orientation="vertical"
          aria-valuemin={MIN_ASPECT}
          aria-valuemax={MAX_ASPECT}
          aria-valuenow={shown.aspect}
          data-backdrop-edge
          className={cn('absolute -bottom-1.5 left-1/2 h-3 w-12 -translate-x-1/2 cursor-ns-resize touch-none rounded-full border border-border bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', COARSE_HIT)}
          style={{ zIndex: topLayer }}
          onPointerDown={dragEdge}
          onKeyDown={onEdgeKey}
        />
      )}
    </div>
  );
}

/** A Body's layout in its expanded row: the Backdrop and Snap to Others above, the figure left of the entry rows. */
export function BodyLayoutEditor({ body, onChange, labelOf, selected, onSelect, focusRequest, snap, onSnap, children }: {
  body: Body;
  onChange: (next: Body) => void;
  labelOf: (box: BoxRef) => string;
  selected: BoxRef | null;
  onSelect: (box: BoxRef | null) => void;
  /** Raising it moves focus to the selected box, even when the selection stays the same. */
  focusRequest: number;
  snap: boolean;
  onSnap: (on: boolean) => void;
  /** The slot rows. */
  children: ReactNode;
}) {
  const mounted = useMountedRef();
  const latest = useRef(body);
  latest.current = body;
  // Custom Image is picked but holds no file yet; the Backdrop stays as it was until one lands (Q71).
  const [asking, setAsking] = useState(false);
  const isImage = body.backdrop.kind === 'image';
  const choosing = asking || isImage;

  const pickBackdrop = (kind: string) => {
    if (kind === CUSTOM_IMAGE) {
      setAsking(true);
      return;
    }
    const outline = OUTLINES.find((o) => o.kind === kind);
    if (!outline) return;
    setAsking(false);
    // The outline the Body already has changes nothing, so a dragged aspect stays (Q77).
    if (body.backdrop.kind === outline.kind) return;
    onChange(withOutline(body, outline.kind));
  };

  const setImage = async (data: string) => {
    if (!data) {
      setAsking(false);
      if (latest.current.backdrop.kind === 'image') onChange(withOutline(latest.current, 'humanoid'));
      return;
    }
    const aspect = await readImageAspect(data, null);
    if (!mounted.current) return;
    setAsking(false);
    onChange(withBackdropImage(latest.current, data, aspect ?? undefined));
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-label" aria-hidden>Backdrop</span>
          <Select value={choosing ? CUSTOM_IMAGE : body.backdrop.kind} onValueChange={pickBackdrop}>
            <SelectTrigger className="h-8 w-36 text-label" aria-label="Backdrop"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OUTLINES.map(({ kind, label }) => <SelectItem key={kind} value={kind}>{label}</SelectItem>)}
              <SelectItem value={CUSTOM_IMAGE}>Custom Image</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Tip tip="Lines boxes up as you drag. Hold Alt to skip it for one drag." labelsChild={false}>
          <label className="flex items-center gap-2 text-label">
            <Checkbox checked={snap} onCheckedChange={(on) => onSnap(on === true)} />
            Snap to Others
          </label>
        </Tip>
      </div>
      {choosing && (
        <div className="grid max-w-[260px] gap-1">
          <ImageUpload
            id={`body-backdrop-${body.id}`}
            value={body.backdrop.kind === 'image' ? body.backdrop.image.data : ''}
            cap={IMAGE_CAPS.entity}
            onChange={(data) => void setImage(data)}
          />
          <Hint>The image sets the shape of the Backdrop</Hint>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-3">
        <div className="grid w-[260px] max-w-full shrink-0 gap-2.5">
          <BodyLayoutCanvas body={body} onChange={onChange} labelOf={labelOf} selected={selected} onSelect={onSelect} focusRequest={focusRequest} snap={snap} />
          <Hint>Arrow keys move the selected box. Shift + arrow keys resize it.</Hint>
        </div>
        <div className="grid min-w-[220px] flex-1 gap-1">{children}</div>
      </div>
    </div>
  );
}
