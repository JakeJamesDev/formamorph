// The Layered Image editor's shared parts: the composed preview, Preview As, the
// Layer rows, the Variant strip and the Layer's settings. The desktop editor and the mobile pane lay them out.

import {
  useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, EyeOff, GripVertical, Maximize, Plus, Trash2, TriangleAlert, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { ImageRuleCog, ImageRuleSummary } from '@/components/editor/ImageRuleCog';
import { PictureImg } from '@/components/PictureImg';
import { HintInfo } from '@/components/SettingsRows';
import { TransitionControls, type TransitionCopy } from '@/components/TransitionControls';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { useGameData } from '@/contexts/GameDataContext';
import { applyImageOptimize, IMAGE_CAPS } from '@/lib/imageOptim';
import { unionBox, type DrawnBox, type ImageFacts } from '@/lib/imageFacts';
import {
  addLayer, addVariants, moveLayer, moveVariant, removeLayer, removeVariant, renameLayer, setLayerBlend, setLayerOpacity, setLayerTint, setLayerTransition,
  setVariantRule,
} from '@/lib/layeredEdit';
import { sameTransition, type MascotTransition } from '@/lib/formaquestion/mascotTransition';
import { canvasVariant, layerTransition, normalizeTint, shownVariant } from '@/lib/layeredImages';
import { toastError } from '@/lib/linkToast';
import { addedEntries, placeGalleryFile } from '@/lib/mediaGallery';
import { mediaNameFromFile } from '@/lib/mediaList';
import { labelPlaceholders } from '@/lib/placementLetters';
import { trackWork } from '@/lib/pendingWork';
import { readMediaFile } from '@/lib/UtilityComponents';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { useCodeRenameOffer } from '@/lib/useCodeRename';
import { useMountedRef } from '@/lib/useMountedRef';
import { RemoteImg } from '@/lib/useRemoteImage';
import { cn } from '@/lib/utils';
import type { LayerBlend, MediaLayer, MediaList } from '@/types';
import { DEFAULT_LOOK, draftOpacity, entryName, rigPicture, type Rig } from './layeredRig';
import { MediaChooseButton } from './MediaPicker';


/**
 * The composed picture on a checkerboard, so transparent areas read as empty. It scales to fill the box:
 * by its height, or by its width with `fit="width"` for a box with no height of its own.
 */
export function RigPreview({ rig, hidden, fit = 'height', zoomable = false, className }: {
  rig: Rig;
  hidden?: ReadonlySet<string>;
  fit?: 'height' | 'width';
  /** Wheel and the zoom buttons zoom; a drag pans the zoomed picture. */
  zoomable?: boolean;
  className?: string;
}) {
  const picture = rigPicture(rig, hidden);
  const size = canvasOf(rig)?.facts.size;
  const ratio = size ? size.width / size.height : 3 / 4;
  const zoom = useCanvasZoom();
  return (
    <div
      ref={zoom.ref}
      data-layered-preview={rig.entry.id}
      className={cn('relative flex min-h-0 select-none items-center justify-center overflow-hidden rounded-md bg-muted/30', zoomable && zoom.view.scale > 1 && 'cursor-grab', className)}
      // The browser's own image drag would take the pointer from the pan.
      onDragStart={(e) => e.preventDefault()}
      {...(zoomable && picture ? zoom.handlers : {})}
    >
      {picture
        ? (
          <div
            className={cn(CHECKER, fit === 'height' ? 'h-full max-w-full' : 'w-full')}
            style={{ aspectRatio: ratio, ...(zoomable ? zoom.style : {}) }}
            data-zoom={zoomable ? zoom.view.scale : undefined}
          >
            <PictureImg src={picture} crop alt={rig.entry.name} draggable={false} className="block h-full w-full" />
          </div>
        )
        : <Hint className="p-4 text-center">Add a Variant to see the picture</Hint>}
      {zoomable && picture && <ZoomBar zoom={zoom} />}
    </div>
  );
}

const MAX_ZOOM = 8;
const ZOOM_STEP = 1.25;
/** Pointer travel, in pixels, that turns a press into a pan rather than a click. */
const DRAG_SLOP = 3;

/** A canvas's zoom and pan: wheel zooms toward the pointer, a drag pans, a double-click fits. */
function useCanvasZoom() {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; from: { x: number; y: number }; moved: boolean } | null>(null);
  // Keeps the zoomed picture over the box: it pans at most as far as its growth.
  const clamp = (scale: number, x: number, y: number) => {
    const s = Math.min(MAX_ZOOM, Math.max(1, scale));
    const box = ref.current?.getBoundingClientRect();
    const mx = ((s - 1) * (box?.width ?? 0)) / 2, my = ((s - 1) * (box?.height ?? 0)) / 2;
    return { scale: s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
  };
  /** Zooms by `factor` about the point (px, py) from the box's center, or fits with a factor of 0. */
  const zoomBy = (factor: number, px = 0, py = 0) => setView((v) => {
    const scale = Math.min(MAX_ZOOM, Math.max(1, v.scale * factor));
    const k = scale / v.scale;
    return clamp(scale, px - (px - v.x) * k, py - (py - v.y) * k);
  });
  const fromCenter = (e: { clientX: number; clientY: number }) => {
    const box = ref.current!.getBoundingClientRect();
    return [e.clientX - box.left - box.width / 2, e.clientY - box.top - box.height / 2] as const;
  };
  const handlers = {
    onWheel: (e: ReactWheelEvent) => zoomBy(Math.exp(-e.deltaY * 0.002), ...fromCenter(e)),
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0 || (e.target as Element).closest('button')) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from: { x: view.x, y: view.y }, moved: false };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
      if (!d.moved) e.currentTarget.setPointerCapture?.(e.pointerId);
      d.moved = true;
      if (view.scale > 1) setView((v) => clamp(v.scale, d.from.x + dx, d.from.y + dy));
    },
    onPointerUp: (e: ReactPointerEvent) => {
      if (drag.current?.id === e.pointerId && !drag.current.moved) drag.current = null;
    },
    // A pan ends in a click; it must not also clear the selected Variant.
    onClickCapture: (e: ReactMouseEvent) => {
      if (drag.current?.moved) e.stopPropagation();
      drag.current = null;
    },
    onDoubleClick: (e: ReactMouseEvent) => { if (!(e.target as Element).closest('button')) setView({ scale: 1, x: 0, y: 0 }); },
  };
  return {
    ref, view, handlers, zoomBy,
    style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } satisfies CSSProperties,
  };
}

/** Zoom Out, the zoom level and Zoom In, then Fit, at the canvas's corner. */
function ZoomBar({ zoom }: { zoom: ReturnType<typeof useCanvasZoom> }) {
  const { scale } = zoom.view;
  return (
    <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-md border bg-background/90 p-0.5 backdrop-blur" data-zoom-bar="">
      <Tip tip="Zoom Out">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={scale <= 1} onClick={() => zoom.zoomBy(1 / ZOOM_STEP)}>
          <ZoomOut className="h-4 w-4" />
        </Button>
      </Tip>
      <Meta className="w-11 text-center tabular-nums" data-zoom-level="">{Math.round(scale * 100)}%</Meta>
      <Tip tip="Zoom In">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={scale >= MAX_ZOOM} onClick={() => zoom.zoomBy(ZOOM_STEP)}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </Tip>
      <Tip tip="Fit">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={scale === 1} onClick={() => zoom.zoomBy(0)}>
          <Maximize className="h-4 w-4" />
        </Button>
      </Tip>
    </div>
  );
}

/** A checkerboard, so a picture's transparent areas read as empty. */
const CHECKER = 'bg-[conic-gradient(hsl(var(--muted))_25%,transparent_0_50%,hsl(var(--muted))_0_75%,transparent_0)] bg-[length:16px_16px]';

/** Preview As: Default Look, then every world entity by name. */
export function PreviewAs({ rig, className }: { rig: Rig; className?: string }) {
  const { entities, placeholders } = useGameData();
  const named = useMemo(
    () => entities.map((e) => ({ id: e.id, name: labelPlaceholders(e.name, placeholders) || 'Unnamed' }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })),
    [entities, placeholders],
  );
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Label className="shrink-0 text-meta text-muted-foreground">Preview As</Label>
      <Select value={rig.as} onValueChange={rig.setAs}>
        <SelectTrigger className="h-8 w-48" aria-label="Preview As"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_LOOK}>Default Look</SelectItem>
          {named.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** What a Layer's thumbnails zoom to: the union of its Variants' drawn areas. */
const layerBox = (rig: Rig, layer: MediaLayer): DrawnBox | null =>
  unionBox(layer.variants.map((v) => {
    const data = rig.dataOf(v.mediaId);
    return data ? rig.facts.get(data)?.box : undefined;
  }));

/** The canvas image's data and size, when known. */
const canvasOf = (rig: Rig): { data: string; facts: ImageFacts } | undefined => {
  const base = canvasVariant(rig.entry);
  const data = base && rig.dataOf(base.mediaId);
  const facts = data && rig.facts.get(data);
  return data && facts ? { data, facts } : undefined;
};

/** `src` in a square box zoomed to `box`, optionally over the canvas image at 25% for context. */
function ZoomedArt({ rig, src, box, withBase }: { rig: Rig; src: string; box: DrawnBox | null; withBase: boolean }) {
  const canvas = canvasOf(rig);
  if (!box || !canvas) return <RemoteImg src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />;
  const { width: cw, height: ch } = canvas.facts.size;
  const w = box.w * cw, h = box.h * ch, m = Math.max(w, h);
  const style: CSSProperties = {
    width: `${(cw / m) * 100}%`, height: `${(ch / m) * 100}%`,
    left: `${50 - ((box.x * cw + w / 2) / m) * 100}%`, top: `${50 - ((box.y * ch + h / 2) / m) * 100}%`,
  };
  return (
    <span className="absolute" style={style}>
      {withBase && canvas.data !== src && <RemoteImg src={canvas.data} alt="" className="absolute inset-0 h-full w-full opacity-25" />}
      <RemoteImg src={src} alt="" className="absolute inset-0 h-full w-full" />
    </span>
  );
}

/** A Layer row's small thumbnail of what it shows now, zoomed to the Layer without the body. */
export function LayerThumb({ rig, layer }: { rig: Rig; layer: MediaLayer }) {
  const shown = layer.variants[shownVariant(layer, rig.list, rig.reads)];
  const src = shown && rig.dataOf(shown.mediaId);
  return (
    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-muted/50">
      {src && <ZoomedArt rig={rig} src={src} box={layerBox(rig, layer)} withBase={false} />}
    </span>
  );
}

/** The Layers top first, each row draggable by its handle. `row` draws a row's body. */
export function LayerList({ rig, row }: { rig: Rig; row: (layer: MediaLayer, handle: ReactNode) => ReactNode }) {
  const top = useMemo(() => [...rig.entry.layers].reverse(), [rig.entry.layers]);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const n = top.length;
    const from = top.findIndex((l) => l.id === active.id);
    const to = top.findIndex((l) => l.id === over.id);
    if (from === -1 || to === -1) return;
    // The list is top first; the entry is bottom first.
    rig.write(`Reorder Layers: ${rig.entry.name}`, moveLayer(rig.entry, n - 1 - from, n - 1 - to));
  };
  return (
    <EditorDndContext onDragEnd={onDragEnd}>
      <StableSortableContext items={top} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-0.5" data-layer-list="">
          {top.map((layer) => <SortableLayerRow key={layer.id} layer={layer} row={row} />)}
        </div>
      </StableSortableContext>
    </EditorDndContext>
  );
}

function SortableLayerRow({ layer, row }: { layer: MediaLayer; row: (layer: MediaLayer, handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: layer.id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label={`Drag ${layer.name}`}
      className="shrink-0 cursor-grab touch-none rounded text-muted-foreground hover:text-foreground"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} data-layer-row={layer.id}>
      {row(layer, handle)}
    </div>
  );
}

/** The eye that hides a Layer in the editor only. */
export function EyeToggle({ layer, hidden, onToggle }: { layer: MediaLayer; hidden: boolean; onToggle: () => void }) {
  return (
    <Tip tip={hidden ? 'Show in Editor' : 'Hide in Editor'}>
      <button type="button" aria-pressed={hidden} aria-label={`${hidden ? 'Show' : 'Hide'} ${layer.name} in Editor`} onClick={onToggle} className="shrink-0 rounded p-0.5 hover:bg-muted">
        {hidden ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4" />}
      </button>
    </Tip>
  );
}

/** Add Layer: a new top Layer, selected. */
export function AddLayerButton({ rig, className }: { rig: Rig; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      onClick={() => {
        const added = addLayer(rig.entry);
        rig.write(`Add Layer: ${rig.entry.name}`, added.entry);
        rig.select(added.layerId);
      }}
    >
      <Plus className="mr-1 h-4 w-4" />Add Layer
    </Button>
  );
}

/** The mismatch on `layer`'s Variant `mediaId`, if any. */
const mismatchOf = (rig: Rig, layer: MediaLayer, mediaId: string) =>
  rig.mismatches.find((m) => m.layerId === layer.id && m.mediaId === mediaId);

/** The selected Variant's index in `layer`, or -1 when none of its Variants is selected. */
export const pickedIndex = (rig: Rig, layer: MediaLayer): number =>
  (rig.pick?.layerId === layer.id ? layer.variants.findIndex((v) => v.mediaId === rig.pick?.mediaId) : -1);

/** The Layer's Variant tiles, draggable to reorder, then Choose and Import. Selecting a tile shows it in the preview. */
export function VariantStrip({ rig, layer, className }: { rig: Rig; layer: MediaLayer; className?: string }) {
  const ids = useMemo(() => layer.variants.map((v) => v.mediaId), [layer.variants]);
  const selected = pickedIndex(rig, layer);
  const showing = selected !== -1 ? selected : shownVariant(layer, rig.list, rig.reads);
  const box = layerBox(rig, layer);
  const onSelect = (mediaId: string) => rig.pickVariant(layer.id, mediaId);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    rig.write(`Reorder Variants: ${layer.name}`, moveVariant(rig.entry, layer.id, from, to));
    onSelect(String(active.id));
  };
  return (
    <div className={cn('flex flex-wrap items-start gap-2', className)} data-variant-strip={layer.id}>
      <EditorDndContext modifiers={[]} autoScroll={false} onDragEnd={onDragEnd}>
        <StableSortableContext items={ids} strategy={horizontalListSortingStrategy}>
          {layer.variants.map((variant, i) => (
            <VariantTile
              key={variant.mediaId}
              rig={rig}
              layer={layer}
              index={i}
              box={box}
              showing={i === showing}
              selected={i === selected}
              onSelect={() => onSelect(variant.mediaId)}
            />
          ))}
        </StableSortableContext>
      </EditorDndContext>
      <AddVariant rig={rig} layer={layer} onAdded={onSelect} />
    </div>
  );
}

function VariantTile({ rig, layer, index, box, showing, selected, onSelect }: {
  rig: Rig;
  layer: MediaLayer;
  index: number;
  box: DrawnBox | null;
  showing: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const variant = layer.variants[index];
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: variant.mediaId });
  const name = entryName(rig, variant.mediaId);
  const src = rig.dataOf(variant.mediaId);
  const ruled = !!variant.requires?.length;
  const mismatch = mismatchOf(rig, layer, variant.mediaId);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="group relative w-20 shrink-0"
      data-variant={variant.mediaId}
      data-variant-showing={showing ? '' : undefined}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={ruled ? `${name}, has a Visibility rule` : name}
        className={cn(
          'relative block aspect-square w-full touch-none overflow-hidden rounded-md border-2 bg-muted/40',
          selected ? 'border-primary' : 'border-border hover:border-muted-foreground',
        )}
      >
        {src && <ZoomedArt rig={rig} src={src} box={box} withBase />}
        {showing && <span className="absolute inset-0 rounded ring-2 ring-inset ring-primary/60" aria-hidden />}
        {ruled && (
          <span data-image-rule-badge="" aria-hidden className="absolute bottom-0 left-0 rounded-tr bg-overlay/70 p-0.5 text-white">
            <Eye className="h-2.5 w-2.5" />
          </span>
        )}
      </button>
      <ImageRuleCog
        host={rig.host}
        rows={variant.requires ?? []}
        onChange={(rows) => rig.write(`Edit Visibility Rule: ${name}`, setVariantRule(rig.entry, layer.id, index, rows))}
        className="absolute right-0.5 top-0.5"
      />
      <Tip tip="Remove Variant">
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={() => rig.write(`Remove Variant: ${name}`, removeVariant(rig.entry, layer.id, index))}
          className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-overlay/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      </Tip>
      {mismatch && (
        <Tip tip={`${mismatch.size.width} × ${mismatch.size.height}, not the picture's ${mismatch.canvas.width} × ${mismatch.canvas.height}`}>
          <span data-variant-size-warning="" className="absolute bottom-6 right-0.5 rounded-full bg-background/90 p-0.5">
            <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-label="Size differs from the picture's" />
          </span>
        </Tip>
      )}
      <Meta className="mt-0.5 block truncate" title={name}>{name}</Meta>
    </div>
  );
}

/** Choose and Import, which add images as the Layer's last Variants. */
function AddVariant({ rig, layer, onAdded }: { rig: Rig; layer: MediaLayer; onAdded: (mediaId: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const mounted = useMountedRef();
  const { promptImagesBatch, dialog } = useDownscalePrompt();
  const linked = useMemo(() => new Set(layer.variants.map((v) => v.mediaId)), [layer.variants]);
  // An import waits on the downscale prompt, so it writes onto the rig as it is then, not as it was at the click.
  const latest = useRef(rig);
  latest.current = rig;
  const add = (label: string, ids: string[], added?: MediaList) => {
    const now = latest.current;
    const next = addVariants(now.entry, layer.id, ids);
    if (next === now.entry && !added) return;
    now.write(label, next, added);
    if (next.layers.find((l) => l.id === layer.id)?.variants.some((v) => v.mediaId === ids[0])) onAdded(ids[0]);
  };
  const take = async (files: File[]) => {
    const read = await Promise.all(files.filter((f) => f.type.startsWith('image/')).map(readMediaFile));
    if (!read.length) return;
    const cap = IMAGE_CAPS.entity;
    const mode = await promptImagesBatch(read.map((f) => f.data), cap);
    const placed = await Promise.all(read.map(async (f) => ({ ...f, data: (await applyImageOptimize(f.data, mode, cap)) ?? f.data })));
    if (!mounted.current) return;
    const before = latest.current.list ?? {};
    let list = before;
    const ids: string[] = [];
    for (const f of placed) {
      const next = placeGalleryFile(list, { data: f.data, name: mediaNameFromFile(f.name) }, 'image', layer.name);
      list = next.list;
      ids.push(next.id);
    }
    add(`Import Variants: ${layer.name}`, ids, addedEntries(before, list));
  };
  const picked = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length) void trackWork(take(files).catch((error: unknown) => toastError(error, { headline: "Couldn't import the images" })));
  };
  return (
    <div className="flex w-28 shrink-0 flex-col gap-1.5" data-add-variant="">
      {dialog}
      <input ref={input} type="file" multiple accept="image/*" aria-label="Variant Images" className="hidden" onChange={picked} />
      <MediaChooseButton list={rig.list} linkedIds={linked} onPick={(entry) => add(`Add Variant: ${entry.name}`, [entry.id])} />
      <Button type="button" variant="outline" onClick={() => input.current?.click()}>
        <Upload className="mr-2 h-4 w-4" />Import
      </Button>
    </div>
  );
}

/** The selected Variant's rule as a sentence, and its size warning. */
export function VariantSummary({ rig, layer, index }: { rig: Rig; layer: MediaLayer; index: number }) {
  const variant = layer.variants[index];
  const mismatch = variant && mismatchOf(rig, layer, variant.mediaId);
  const sizeLine = mismatch
    && `${mismatch.size.width} × ${mismatch.size.height}, not the picture's ${mismatch.canvas.width} × ${mismatch.canvas.height}. It draws stretched.`;
  // Two rows of one line each, whatever is selected, so selecting a Variant never resizes the picture above.
  return (
    <div className="space-y-0.5" data-variant-summary={variant?.mediaId ?? ''}>
      <div className={SUMMARY_ROW}>
        {variant
          ? <p className="truncate text-meta font-medium">{entryName(rig, variant.mediaId)}</p>
          : <Hint className="truncate">{layer.variants.length ? 'No Variant Selected' : 'No Variants Yet'}</Hint>}
        {sizeLine && (
          <Tip tip={sizeLine}>
            <span data-variant-size-line="" aria-label={sizeLine} className="shrink-0">
              <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden />
            </span>
          </Tip>
        )}
      </div>
      <div className={SUMMARY_ROW}>
        {!variant && <Hint className="truncate">{layer.variants.length ? 'The first Variant whose rule holds shows' : 'Choose or import an image'}</Hint>}
        {variant && (variant.requires?.length
          ? <ImageRuleSummary host={rig.host} rows={variant.requires} className="truncate" />
          : <Hint className="truncate">Always shown</Hint>)}
      </div>
    </div>
  );
}

const SUMMARY_ROW = 'flex h-5 min-w-0 items-center gap-1';

/** The Layer's name, which renames it on blur or Enter. A taken name comes back suffixed. */
export function LayerNameField({ rig, layer, className }: { rig: Rig; layer: MediaLayer; className?: string }) {
  const [draft, setDraft] = useState(layer.name);
  const [seen, setSeen] = useState(layer.name);
  const offerCodeRename = useCodeRenameOffer();
  if (seen !== layer.name) { setSeen(layer.name); setDraft(layer.name); }
  const commit = () => {
    if (draft.trim() && draft.trim() !== layer.name) {
      const next = renameLayer(rig.entry, layer.id, draft);
      rig.write(`Rename Layer: ${draft.trim()}`, next);
      // The suffixed name the rig keeps is the one scripts follow (Q14).
      const kept = next.layers.find((l) => l.id === layer.id)?.name ?? draft.trim();
      offerCodeRename({ root: 'layers', oldName: layer.name, newName: kept, otherNames: [], mediaId: rig.entry.id });
    }
    setDraft(layer.name);
  };
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
        if (e.key === 'Escape') setDraft(layer.name);
      }}
      aria-label="Layer Name"
      className={className}
    />
  );
}

/** The Layer's opacity. It previews while dragging and writes one History Step on release. */
export function OpacityField({ rig, layer }: { rig: Rig; layer: MediaLayer }) {
  const stored = layer.opacity ?? 1;
  const value = draftOpacity(rig, layer.id) ?? stored;
  const set = (next: number | null) => rig.setDraft(next === null ? null : { layerId: layer.id, opacity: next });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>Opacity</Label>
        <Meta className="tabular-nums">{Math.round(value * 100)}%</Meta>
      </div>
      <Slider
        aria-label="Opacity"
        value={[Math.round(value * 100)]}
        min={0}
        max={100}
        step={1}
        onValueChange={([v]) => set(v / 100)}
        onValueCommit={([v]) => {
          set(null);
          if (v / 100 !== stored) rig.write(`Set Opacity: ${layer.name}`, setLayerOpacity(rig.entry, layer.id, v / 100));
        }}
      />
    </div>
  );
}

/** The Layer's tint. It multiplies the Layer's pixels and keeps their alpha; Clear Tint removes it. */
export function TintField({ rig, layer }: { rig: Rig; layer: MediaLayer }) {
  const tint = normalizeTint(layer.tint);
  return (
    <div className="space-y-1.5">
      <Label>Tint</Label>
      <div className="flex items-center gap-2">
        <ColorPicker
          value={tint ?? '#ffffff'}
          aria-label="Tint"
          onChange={(hex) => { if (hex !== (tint ?? '#ffffff')) rig.write(`Set Tint: ${layer.name}`, setLayerTint(rig.entry, layer.id, hex)); }}
        />
        {tint && (
          <Button type="button" variant="outline" size="sm" onClick={() => rig.write(`Clear Tint: ${layer.name}`, setLayerTint(rig.entry, layer.id, null))}>
            Clear Tint
          </Button>
        )}
      </div>
    </div>
  );
}

const BLEND_LABELS: Record<LayerBlend, string> = { normal: 'Normal', multiply: 'Multiply', screen: 'Screen', add: 'Add' };

const BLEND_INFO = `- **Normal** draws the Layer over the Layers below it.
- **Multiply** darkens the Layers below it. White leaves them as they are, and black makes them black. Use it for shadows and shading.
- **Screen** lightens the Layers below it. Black leaves them as they are, and white makes them white. Use it for soft light and haze.
- **Add** adds its colors to the Layers below it, so it brightens the most. Black leaves them as they are. Use it for glows, sparks and light.

A mode acts on the Layers below it inside this picture only, never on the page behind it.`;

/** The Layer's blend mode over the Layers below it. */
export function BlendField({ rig, layer }: { rig: Rig; layer: MediaLayer }) {
  const value = layer.blend ?? 'normal';
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">Blend Mode <HintInfo>{BLEND_INFO}</HintInfo></Label>
      <Select value={value} onValueChange={(next) => rig.write(`Set Blend Mode: ${layer.name}`, setLayerBlend(rig.entry, layer.id, next as LayerBlend))}>
        <SelectTrigger className="h-8" aria-label="Blend Mode"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(BLEND_LABELS) as LayerBlend[]).map((mode) => <SelectItem key={mode} value={mode}>{BLEND_LABELS[mode]}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Delete Layer. History takes it back. */
export function DeleteLayerButton({ rig, layer }: { rig: Rig; layer: MediaLayer }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => rig.write(`Delete Layer: ${layer.name}`, removeLayer(rig.entry, layer.id))}>
      <Trash2 className="mr-1 h-4 w-4" />Delete Layer
    </Button>
  );
}

const LAYER_TRANSITION_COPY = {
  mode: { label: 'Transition', hint: 'Sets how this Layer changes when it shows another Variant' },
  modes: { none: 'None', dissolve: 'Dissolve', jelly: 'Jelly' },
  reducedMotion: "Jelly plays as Dissolve while your system's reduced-motion setting is on",
  jelly: {
    durationMs: { label: 'Duration', hint: 'Sets how long the bounce takes' },
    squash: { label: 'Squash', hint: 'Sets how far the picture squashes before the new Variant shows' },
    overshoot: { label: 'Overshoot', hint: 'Sets how far the picture stretches past full height' },
    settle: { label: 'Settle Count', hint: 'Sets how many times the picture bounces before it rests' },
  },
  dissolveDuration: { label: 'Duration', hint: 'Sets how long the new Variant takes to fade in' },
  play: { label: 'Play', hint: "Show this Layer's next Variant in the preview, with its transition" },
} as const satisfies TransitionCopy;

/** The Layer's transition: the Mascot's modes and tuning, and Play. A slider writes when its drag ends. */
export function TransitionField({ rig, layer }: { rig: Rig; layer: MediaLayer }) {
  const stored = layerTransition(layer);
  const [draft, setDraft] = useState<MascotTransition | null>(null);
  const write = (next: MascotTransition) => {
    setDraft(null);
    if (!sameTransition(next, stored)) rig.write(`Set Transition: ${layer.name}`, setLayerTransition(rig.entry, layer.id, next));
  };
  return (
    <div data-layer-transition={layer.id}>
      <TransitionControls
        transition={draft ?? stored}
        copy={LAYER_TRANSITION_COPY}
        idPrefix={`layer-${layer.id}`}
        readOnly={false}
        onTransition={(next, group) => (group ? setDraft(next) : write(next))}
        onCommit={write}
        onPlay={rig.playNext ?? (() => {})}
        playDisabled={!rig.playNext}
      />
    </div>
  );
}
