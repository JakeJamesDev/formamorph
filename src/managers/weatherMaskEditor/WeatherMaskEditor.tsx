import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Brush, Contrast, Eraser, PaintBucket, Redo2, Trash2, Undo2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PictureImg } from '@/components/PictureImg';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, dialogFullHeight, dialogSafeArea } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { WeatherPreview, useNaturalRatio } from '@/components/game/WeatherBackground';
import { ALLOWED_KINDS, WEATHER_LABELS } from '@/lib/weather';
import type { AllowedWeatherKind } from '@/types';
import { FlashTip, Tip } from '@/components/ui/tooltip';
import { Meta } from '@/components/ui/typography';
import { fitWithin } from '@/lib/imageBytes';
import { isLayeredPicture, type Picture } from '@/lib/layeredImages';
import { toastError } from '@/lib/linkToast';
import {
  MaskStrokePainter, applyMaskOp, canRedoMask, canUndoMask, newMaskDocument, redoMask, replayMask, undoMask, unionRect,
  type MaskDocument, type MaskOp, type MaskRect, type MaskTool,
} from '@/lib/maskDocument';
import { RemoteImg } from '@/lib/useRemoteImage';
import { useIsMobile } from '@/lib/useIsMobile';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useMountedRef } from '@/lib/useMountedRef';
import { cn } from '@/lib/utils';
import { MASK_CAP } from '@/lib/weatherMask';
import { drawTint, encodeMaskRaster, previewMaskPng, readMaskRaster } from './maskCanvas';
import {
  FIT_VIEW, MAX_SIZE, MIN_SIZE, boxToMask, panBy, screenSize, stepSize, viewTransform, wheelDelta, wheelZoom, zoomAt, type MaskView,
} from './maskView';

/** Below this width the floating groups would overlap, so the controls stack as on touch. */
const STACKED_BELOW = 1024;
/** How long a slider's value tip stays after its last change. */
const VALUE_TIP_MS = 1000;

// scroll-guard: allow horizontal: one row of tool buttons on the narrowest phones
const TOOL_ROW_SCROLL = 'overflow-x-auto';

/** Floating groups rest faded and come back on hover or keyboard focus. */
const FADE = 'opacity-25 transition-opacity duration-200 hover:opacity-100 has-[:focus-visible]:opacity-100';
/** Every control hides and takes no input while a stroke is in progress. */
const hiddenWhile = (painting: boolean): CSSProperties | undefined =>
  (painting ? { opacity: 0, visibility: 'hidden', pointerEvents: 'none' } : undefined);

/** Whether a key at `target` belongs to a field: text entry, or an open select list. */
const inField = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"], [role="listbox"]');

type SliderName = 'size' | 'softness';

/** One picture the mask can show under: the label names it in the switch. */
export interface PictureChoice { key: string; label: string; picture: Picture }

/**
 * The full-window Weather Mask brush editor. `pictures` are the images that link the mask: one shows under it, and
 * with several the card switches between them. With none it opens over a plain surface at the mask's size, so
 * `mask` is then required. `mask` is the stored mask it opens on, or none for a new one. Save hands back the mask as
 * a PNG at the size it opened with, capped like uploads.
 */
export function WeatherMaskEditor({ open, pictures, mask, sharedCount, onSave, onClose }: {
  open: boolean;
  pictures: readonly PictureChoice[];
  mask?: string;
  /** How many images link the mask; two or more names the count. */
  sharedCount: number;
  onSave: (data: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {open && <EditorBody pictures={pictures} mask={mask} sharedCount={sharedCount} onSave={onSave} onClose={onClose} />}
    </Dialog>
  );
}

interface Loaded { width: number; height: number; base: Uint8ClampedArray }

function EditorBody({ pictures, mask, sharedCount, onSave, onClose }: {
  pictures: readonly PictureChoice[]; mask?: string; sharedCount: number; onSave: (data: string) => void; onClose: () => void;
}) {
  const [chosen, setChosen] = useState(0);
  const index = Math.min(chosen, pictures.length - 1);
  const current: PictureChoice | undefined = pictures[index];
  const picture = current?.picture;
  // Touch has no hover to bring faded controls back, so a touch screen stacks them at any width.
  const touch = useMediaQuery('(pointer: coarse)');
  const stacked = useIsMobile(STACKED_BELOW) || touch;
  const mounted = useMountedRef();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [doc, setDoc] = useState<MaskDocument | null>(null);
  const [tool, setTool] = useState<MaskTool>('brush');
  const [size, setSize] = useState(100);
  const [softness, setSoftness] = useState(0.25);
  const [view, setView] = useState<MaskView>(FIT_VIEW);
  const [valueTip, setValueTip] = useState<{ slider: SliderName; count: number } | null>(null);
  const valueTipTimer = useRef(0);
  const [showMask, setShowMask] = useState(true);
  const [painting, setPainting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [weather, setWeather] = useState<AllowedWeatherKind>('rain');
  const [previewMask, setPreviewMask] = useState<string | undefined>();
  const calm = useMediaQuery('(prefers-reduced-motion: reduce)');
  const raster = useRef<Uint8ClampedArray | null>(null);
  const tint = useRef<HTMLCanvasElement | null>(null);
  const ring = useRef<HTMLDivElement | null>(null);
  const painter = useRef<MaskStrokePainter | null>(null);
  const dirty = useRef<MaskRect | null>(null);
  const frame = useRef(0);

  const paintLayer = useRef<HTMLDivElement | null>(null);
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => () => { cancelAnimationFrame(frame.current); window.clearTimeout(valueTipTimer.current); }, []);

  /** Shows `slider`'s value tip, and hides it once the value rests. */
  const showValue = (slider: SliderName) => {
    setValueTip((t) => ({ slider, count: (t?.count ?? 0) + 1 }));
    window.clearTimeout(valueTipTimer.current);
    valueTipTimer.current = window.setTimeout(() => { if (mounted.current) setValueTip(null); }, VALUE_TIP_MS);
  };
  const changeSize = (next: number) => { setSize(next); showValue('size'); };
  const changeSoftness = (next: number) => { setSoftness(next / 100); showValue('softness'); };

  // The paint layer is the fit box; its width sizes the ring.
  useEffect(() => {
    const el = paintLayer.current;
    if (!el) return;
    const measure = () => setBoxWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded]);

  /** The picture's size is known: the mask's size follows, and a stored mask stretches to it. */
  const measured = async (naturalWidth: number, naturalHeight: number) => {
    if (loaded || !naturalWidth || !naturalHeight) return;
    const { w, h } = fitWithin(naturalWidth, naturalHeight, MASK_CAP.maxDim);
    try {
      const base = mask ? await readMaskRaster(mask, w, h) : new Uint8ClampedArray(w * h);
      if (!mounted.current) return;
      raster.current = base.slice();
      setPreviewMask(previewMaskPng(base, w, h));
      setLoaded({ width: w, height: h, base });
      setDoc(newMaskDocument(w, h));
    } catch (e: unknown) {
      toastError(e, { headline: "Couldn't open the Weather Mask" });
      if (mounted.current) onClose();
    }
  };

  // The tint canvas mounts with the loaded size; draw the whole raster once it does.
  const tintRef = useCallback((canvas: HTMLCanvasElement | null) => {
    tint.current = canvas;
    if (canvas && raster.current) drawTint(canvas, raster.current);
  }, []);

  /** Every redraw also hands the weather preview the mask as it stands. */
  const redraw = (rect?: MaskRect | null) => {
    if (!raster.current) return;
    if (tint.current) drawTint(tint.current, raster.current, rect);
    if (loaded) setPreviewMask(previewMaskPng(raster.current, loaded.width, loaded.height));
  };

  /** Moves the document to `next` and redraws the replay over the base. */
  const commit = (next: MaskDocument) => {
    if (!loaded) return;
    raster.current = replayMask(next, loaded.base);
    setDoc(next);
    redraw();
  };
  const apply = (op: MaskOp) => { if (doc) commit(applyMaskOp(doc, op)); };
  const undo = () => { if (doc && canUndoMask(doc)) commit(undoMask(doc)); };
  const redo = () => { if (doc && canRedoMask(doc)) commit(redoMask(doc)); };

  /** The box point under a client point, in fractions of the box. */
  const toBox = (clientX: number, clientY: number) => {
    const r = paintLayer.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return null;
    return { u: (clientX - r.left) / r.width, v: (clientY - r.top) / r.height };
  };
  const toMask = (e: PointerEvent<HTMLElement>) => {
    const { u, v } = toBox(e.clientX, e.clientY) ?? { u: 0, v: 0 };
    return boxToMask(view, u, v, loaded?.width ?? 0, loaded?.height ?? 0);
  };
  const moveRing = (e: PointerEvent<HTMLElement>) => {
    const el = ring.current;
    if (!el) return;
    if (e.pointerType === 'touch') { el.style.display = 'none'; return; }
    const r = e.currentTarget.getBoundingClientRect();
    el.style.display = 'block';
    el.style.left = `${e.clientX - r.left}px`;
    el.style.top = `${e.clientY - r.top}px`;
  };
  const ringSize = loaded ? screenSize(view, size, boxWidth, loaded.width) : 0;
  const paintFrame = () => {
    frame.current = 0;
    redraw(dirty.current);
    dirty.current = null;
  };
  const paintTo = (rect: MaskRect | null) => {
    if (!rect) return;
    dirty.current = unionRect(dirty.current, rect);
    if (!frame.current) frame.current = requestAnimationFrame(paintFrame);
  };

  // One stroke at a time: a second finger neither starts a stroke nor feeds the one in progress.
  const strokePointer = useRef<number | null>(null);
  // A middle-button drag pans from the client point it last moved to.
  const pan = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 && e.pointerType === 'mouse') {
      e.preventDefault();
      if (painter.current || pan.current) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      pan.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    if (!loaded || !raster.current || e.button !== 0 || painter.current || pan.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    strokePointer.current = e.pointerId;
    painter.current = new MaskStrokePainter(raster.current, loaded.width, loaded.height, tool, size, softness);
    setPainting(true);
    paintTo(painter.current.extend(toMask(e)));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    moveRing(e);
    const panning = pan.current;
    if (panning && e.pointerId === panning.pointer) {
      const r = e.currentTarget.getBoundingClientRect();
      if (r.width && r.height) setView((v) => panBy(v, (e.clientX - panning.x) / r.width, (e.clientY - panning.y) / r.height));
      pan.current = { ...panning, x: e.clientX, y: e.clientY };
      return;
    }
    if (painter.current && e.pointerId === strokePointer.current) paintTo(painter.current.extend(toMask(e)));
  };
  const endStroke = (e: PointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointer === e.pointerId) { pan.current = null; return; }
    const stroke = painter.current;
    if (!stroke || e.pointerId !== strokePointer.current) return;
    painter.current = null;
    strokePointer.current = null;
    setPainting(false);
    // The raster already holds the stroke; the document records it for undo.
    setDoc((d) => (d ? applyMaskOp(d, stroke.op()) : d));
  };

  // Wheel: zoom toward the pointer over the picture; with Ctrl, the brush size anywhere, never the browser's zoom.
  const onWheel = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    onWheel.current = (e: WheelEvent) => {
      const delta = wheelDelta(e.deltaY, e.deltaMode);
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (painting || !loaded || !delta || inField(document.activeElement)) return;
        changeSize(stepSize(size, delta));
        return;
      }
      const at = toBox(e.clientX, e.clientY);
      if (painting || !loaded || !at || !(e.target instanceof Node) || !paintLayer.current?.contains(e.target)) return;
      e.preventDefault();
      setView((v) => zoomAt(v, wheelZoom(v.zoom, delta), at.u, at.v));
    };
  });
  // On the window, so Ctrl + wheel over a portaled select list still never zooms the page.
  useEffect(() => {
    const listen = (e: WheelEvent) => onWheel.current(e);
    window.addEventListener('wheel', listen, { passive: false });
    return () => window.removeEventListener('wheel', listen);
  }, []);

  const edited = !!doc && canUndoMask(doc);
  const requestCancel = () => { if (edited) setConfirming(true); else onClose(); };
  const save = () => {
    if (!loaded || !raster.current) return;
    try {
      onSave(encodeMaskRaster(raster.current, loaded.width, loaded.height));
    } catch (e: unknown) {
      toastError(e, { headline: "Couldn't save the Weather Mask" });
    }
  };

  // Capture, so B, E and 0 reach the tools before a focused, closed select types ahead with them.
  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (painting || !loaded || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || inField(e.target)) return;
    const key = e.key.toLowerCase();
    if (key === 'b') setTool('brush');
    else if (key === 'e') setTool('eraser');
    else if (key === '0') setView(FIT_VIEW);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (painting || !(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) undo();
    else if ((key === 'z' && e.shiftKey) || key === 'y') redo();
    else return;
    e.preventDefault();
  };

  const ready = !!loaded;
  const zoomPercent = Math.round(view.zoom * 100);
  const tools = (
    <div className="flex w-max items-center gap-1" data-mask-tools="">
      <ToolButton label="Brush" tip="Brush (B)" active={tool === 'brush'} disabled={!ready} onClick={() => setTool('brush')}><Brush /></ToolButton>
      <ToolButton label="Eraser" tip="Eraser (E)" active={tool === 'eraser'} disabled={!ready} onClick={() => setTool('eraser')}><Eraser /></ToolButton>
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolButton label="Fill" tip="Shows the weather everywhere" disabled={!ready} onClick={() => apply({ kind: 'fill' })}><PaintBucket /></ToolButton>
      <ToolButton label="Clear" tip="Hides the weather everywhere" disabled={!ready} onClick={() => apply({ kind: 'clear' })}><Trash2 /></ToolButton>
      <ToolButton label="Invert" tip="Swaps where the weather shows and where it's hidden" disabled={!ready} onClick={() => apply({ kind: 'invert' })}><Contrast /></ToolButton>
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolButton label="Undo" disabled={!doc || !canUndoMask(doc)} onClick={undo}><Undo2 /></ToolButton>
      <ToolButton label="Redo" disabled={!doc || !canRedoMask(doc)} onClick={redo}><Redo2 /></ToolButton>
      {!touch && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <Tip tip="Fit (0)">
            <Button
              type="button" size="sm" variant="ghost" aria-label={`Fit, ${zoomPercent}%`} disabled={!ready}
              onClick={() => setView(FIT_VIEW)} className="w-16 tabular-nums" data-mask-fit=""
            >
              {zoomPercent}%
            </Button>
          </Tip>
        </>
      )}
    </div>
  );
  const softEdge = Math.round(softness * 100);
  const sliders = (
    <div className={cn('flex gap-4', stacked ? 'flex-col' : 'items-center')}>
      <LabeledSlider
        label="Size" value={size} min={MIN_SIZE} max={MAX_SIZE} step={1} onChange={changeSize} stacked={stacked}
        valueTip={`${size} px`} tipCycle={valueTip?.slider === 'size' ? valueTip.count : 0}
      />
      <LabeledSlider
        label="Soft Edge" value={softEdge} min={0} max={100} step={1} onChange={changeSoftness} stacked={stacked}
        valueTip={`${softEdge}%`} tipCycle={valueTip?.slider === 'softness' ? valueTip.count : 0}
      />
    </div>
  );
  const actions = (
    <>
      <Button type="button" variant="outline" onClick={requestCancel}>Cancel</Button>
      <Button type="button" disabled={!edited} onClick={save}>Save</Button>
    </>
  );

  // The picture sets the box's shape; with none, the mask is the shape. A switch to a picture of another shape
  // reshapes the box and keeps the raster, which stretches over it as play stretches the mask.
  const canvasSrc = picture ? (isLayeredPicture(picture) ? picture.canvas : picture) : mask;
  const naturalRatio = useNaturalRatio(loaded && picture ? canvasSrc : undefined);
  const boxRatio = naturalRatio ?? (loaded ? loaded.width / loaded.height : 1);
  const weatherPicker = (
    <Select value={weather} onValueChange={(v) => setWeather(ALLOWED_KINDS.find((k) => k === v) ?? weather)}>
      <SelectTrigger aria-label="Weather Preview" className="h-8 w-full" data-mask-weather="">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALLOWED_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{WEATHER_LABELS[kind]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const switcher = pictures.length >= 2 && (
    <Select value={String(index)} onValueChange={(v) => setChosen(Number(v))}>
      <SelectTrigger aria-label="Picture" className="h-8 w-full" data-mask-pictures="">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pictures.map((p, i) => <SelectItem key={p.key} value={String(i)}>{p.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const card = (
    <div className="flex w-full max-w-60 flex-col items-start gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => setShowMask((s) => !s)} aria-pressed={!showMask}>
        {showMask ? 'Hide Mask' : 'Show Mask'}
      </Button>
      {switcher}
      {weatherPicker}
      {sharedCount >= 2 && <Meta data-mask-shared={sharedCount}>Shared by {sharedCount} images. Saving changes all of them.</Meta>}
    </div>
  );
  const scene = (
    <div className="relative flex min-h-0 flex-1 items-center justify-center [container-type:size]" data-mask-scene="">
      {!loaded && canvasSrc && (
        <RemoteImg
          src={canvasSrc} alt="" className="invisible absolute h-px w-px"
          onLoad={(e) => void measured(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          onError={() => {
            if (!mounted.current) return;
            toastError(new Error("The picture didn't load"), { headline: "Couldn't open the Weather Mask" });
            onClose();
          }}
        />
      )}
      {loaded && (
        <div
          // Isolated, so the paint layer's z-index stays under the floating controls.
          className="relative isolate overflow-hidden"
          style={{ aspectRatio: `${boxRatio}`, width: `min(100cqw, 100cqh * ${boxRatio})` }}
          data-mask-box=""
        >
          {/* The picture, its weather and the tint zoom together; the paint layer above stays the fit box. */}
          <div className="absolute inset-0 isolate origin-top-left" style={{ transform: viewTransform(view) }} data-mask-view={zoomPercent}>
            {picture
              ? <PictureImg src={picture} alt="" crop center contain className="absolute inset-0 h-full w-full select-none object-fill" draggable={false} />
              : <div className="absolute inset-0 bg-muted" data-mask-plain="" />}
            {previewMask && <WeatherPreview kind={weather} mode={calm ? 'calm' : 'full'} plain={!picture} mask={previewMask} />}
            <canvas
              ref={tintRef} width={loaded.width} height={loaded.height}
              className={cn('pointer-events-none absolute inset-0 z-[2] h-full w-full', !showMask && 'invisible')}
              data-mask-tint=""
            />
          </div>
          <div
            ref={paintLayer}
            className="absolute inset-0 z-[3] cursor-none touch-none"
            onPointerDown={onPointerDown}
            // The middle button pans here, never starts the browser's autoscroll.
            onMouseDown={(e) => { if (e.button === 1) e.preventDefault(); }}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onLostPointerCapture={endStroke}
            onPointerLeave={() => { if (ring.current) ring.current.style.display = 'none'; }}
            data-mask-paint=""
          >
            <div
              ref={ring}
              className="pointer-events-none absolute left-0 top-0 hidden -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
              style={{ width: ringSize, height: ringSize }}
              data-mask-ring=""
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <DialogContent
        surface="weatherMaskEditor"
        placement="own"
        hideClose
        unanimated
        onEscapeKeyDown={(e) => { e.preventDefault(); if (!painting) requestCancel(); }}
        onKeyDownCapture={onKeyDownCapture}
        onKeyDown={onKeyDown}
        className={cn(
          'inset-x-0 left-0 flex w-full max-w-none translate-x-0 flex-col gap-0 rounded-none border-0 bg-black p-0 shadow-none sm:rounded-none',
          dialogFullHeight,
          stacked && dialogSafeArea,
        )}
        data-mask-editor={stacked ? 'stacked' : 'floating'}
      >
        <DialogTitle className="sr-only">Weather Mask</DialogTitle>
        <DialogDescription className="sr-only">Paint where the weather shows over this image.</DialogDescription>
        {stacked
          ? (
            <>
              <div className="flex justify-between gap-2 bg-card p-2" style={hiddenWhile(painting)} data-mask-group="actions">{actions}</div>
              {scene}
              <div className="space-y-3 border-t bg-card p-3" style={hiddenWhile(painting)} data-mask-group="panel">
                <div className={TOOL_ROW_SCROLL}>{tools}</div>
                {sliders}
                {card}
              </div>
            </>
          )
          : (
            <>
              {scene}
              {/* The tools sit apart from Save and Cancel, so neither covers the other at any desktop width. */}
              <Group name="tools" painting={painting} className="bottom-4 left-1/2 -translate-x-1/2 gap-3 rounded-full px-3 py-1.5">
                {tools}
                <div className="h-6 w-px bg-border" />
                {sliders}
              </Group>
              <Group name="card" painting={painting} className="left-4 top-4 rounded-lg p-2">{card}</Group>
              <div
                className={cn('absolute right-[calc(1rem+var(--window-buttons-width,0px))] top-4 flex gap-2', FADE)}
                style={hiddenWhile(painting)}
                data-mask-group="actions"
              >
                {actions}
              </div>
            </>
          )}
      </DialogContent>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Discard Changes?"
        description="You'll lose what you painted on this Weather Mask."
        confirmLabel="Discard"
        destructive
        onConfirm={() => { setConfirming(false); onClose(); }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

/** A floating control group over the picture. */
function Group({ name, painting, className, children }: { name: string; painting: boolean; className: string; children: ReactNode }) {
  return (
    <div
      className={cn('absolute flex items-center border bg-card/90 shadow-lg backdrop-blur', FADE, className)}
      style={hiddenWhile(painting)}
      data-mask-group={name}
    >
      {children}
    </div>
  );
}

function ToolButton({ label, tip, active, disabled, onClick, children }: {
  label: string; tip?: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
  return (
    <Tip tip={tip ?? label}>
      <Button
        type="button" size="icon" variant={active ? 'default' : 'ghost'} aria-label={label}
        aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}
        className="[&_svg]:h-4 [&_svg]:w-4"
      >
        {children}
      </Button>
    </Tip>
  );
}

/** A slider whose `valueTip` shows over its thumb while `tipCycle` counts changes, and hides at 0. */
function LabeledSlider({ label, value, min, max, step, onChange, stacked, valueTip, tipCycle }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; stacked: boolean;
  valueTip: string; tipCycle: number;
}) {
  const root = useRef<HTMLSpanElement | null>(null);
  const thumb = useRef<Element | null>(null);
  useEffect(() => { thumb.current = root.current?.querySelector('[role="slider"]') ?? null; }, []);
  return (
    <div className={cn('flex items-center gap-2 text-label', stacked ? 'w-full' : 'w-40')}>
      <span className={cn('shrink-0', stacked && 'w-20')}>{label}</span>
      <Slider
        ref={root} aria-label={label} aria-valuetext={valueTip} min={min} max={max} step={step} value={[value]}
        onValueChange={([v]) => onChange(v)} data-mask-slider={label}
      />
      <FlashTip anchor={thumb} tip={valueTip} open={tipCycle > 0} cycle={tipCycle} />
    </div>
  );
}
