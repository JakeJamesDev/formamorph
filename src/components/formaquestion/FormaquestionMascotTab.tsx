import { useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent } from '@dnd-kit/core';
import { Info, Move, Play, Plus, RotateCcw, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { CheckRow, OptionSwitcher, Row, Section, ValueSlider } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { ImageUpload } from '@/lib/UtilityComponents';
import { ActionIcon } from '@/lib/actionIcons';
import { downloadBlob } from '@/lib/downloadBlob';
import { filesFrom } from '@/lib/importFiles';
import { toastError } from '@/lib/linkToast';
import { randomUUID } from '@/lib/uuid';
import { useMountedRef } from '@/lib/useMountedRef';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import {
  DEFAULT_MASCOT_RIG, MASCOT_LAYER_KINDS, MASCOT_PICK_NAMES, composeMascot, mascotPickWarnings, type MascotImageRef, type MascotLayer,
  type MascotLayerKind, type MascotMask, type MascotPickName, type MascotPickWarning, type MascotRig,
} from '@/lib/formaquestion/mascot';
import {
  DISSOLVE_RANGES, JELLY_RANGES, MASCOT_TRANSITION_MODES, type JellyTuning, type MascotTransition, type MascotTransitionMode, type TuningRange,
} from '@/lib/formaquestion/mascotTransition';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import {
  MASK_GRIPS, cropFrame, fitMask, gripKeyDelta, headSizeWithin, isMaskGrip, maskFromDrag, moveMaskGrip, type MascotPoint, type MascotSize, type MaskGrip,
} from '@/lib/formaquestion/mascotMask';
import { HEAD_HEIGHT } from '@/lib/formaquestion/windowBox';
import { addMascotImage, clearMascotImages, deleteMascotImage } from '@/lib/formaquestion/mascotImageStore';
import type { MascotCardData } from '@/lib/formaquestion/mascotCard';
import { MASCOT_CARD_FILE_NAME, exportMascotCard, readMascotCard, storeMascotCard } from '@/lib/formaquestion/mascotCardFile';
import {
  addMascotLayer, addMascotOverlays, mascotImageIds, mascotImageRefs, mascotPickOptions, moveMascotLayer, moveMascotOverlay, orphanedMascotImages,
  removeMascotBase, removeMascotLayer, removeMascotOverlay, setMascotBase, setMascotPick, updateMascotLayer, type MascotLayerPatch,
} from '@/lib/formaquestion/mascotRigEdits';
import {
  previewMascot, resolveSelection, selectLayer, selectOverlay, selectionAfterLayerRemove, selectionAfterMove, selectionAfterRemove, toggleLayer,
  type MascotSelection,
} from '@/lib/formaquestion/mascotSelection';
import { MascotPiece } from './MascotPiece';
import { MascotScaleRow } from './MascotScaleRow';
import { WidgetLabel, WidgetRow } from './WidgetRow';
import { usePointerDrag } from './usePointerDrag';
import type { MascotReplay } from './useMascotMotion';
import { useMascotImageUrls } from './useMascotImageUrls';
import { MASCOT_COPY } from './formaquestionSettingsTabs';

const PREVIEW_HEIGHT = 240;
/** The widest Head View preview: the 128px slot less its frame's padding and border. */
const PREVIEW_HEAD_WIDTH = 118;

/** A Mask drag: a new box drawn from outside the Mask, or a handle moved from the Mask it started on. */
type MaskPress =
  | { grip: null; from: MascotPoint; latest: MascotMask | null; rect: DOMRect }
  | { grip: MaskGrip; from: MascotPoint; start: MascotMask; latest: MascotMask; rect: DOMRect };

const sameMask = (a: MascotMask, b: MascotMask) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

const GRIP_ATTR = 'data-fq-mask-grip';

/** The handle under a press, read from its element; null off the Mask. */
function gripAt(target: EventTarget): MaskGrip | null {
  const name = target instanceof Element ? target.closest(`[${GRIP_ATTR}]`)?.getAttribute(GRIP_ATTR) : null;
  return name && isMaskGrip(name) ? name : null;
}

/** Each handle's place on the box and its resize cursor. */
const GRIP_PLACES: { readonly [G in Exclude<MaskGrip, 'move'>]: string } = {
  nw: 'left-0 top-0 cursor-nwse-resize',
  n: 'left-1/2 top-0 cursor-ns-resize',
  ne: 'left-full top-0 cursor-nesw-resize',
  e: 'left-full top-1/2 cursor-ew-resize',
  se: 'left-full top-full cursor-nwse-resize',
  s: 'left-1/2 top-full cursor-ns-resize',
  sw: 'left-0 top-full cursor-nesw-resize',
  w: 'left-0 top-1/2 cursor-ew-resize',
};

/** Faint until the box is hovered, keyboard-focused or dragged; full on a coarse pointer; the fade itself only with motion allowed. */
const GRIP_FADE = 'opacity-30 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 group-data-[dragging]:opacity-100 '
  + '[@media(pointer:coarse)]:opacity-100 motion-safe:transition-opacity';

const GRIP_BASE = 'absolute -translate-x-1/2 -translate-y-1/2 border-2 border-primary bg-background focus-visible:outline-none '
  + 'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

/** A wider press area around an edge handle. */
const GRIP_HIT = "before:absolute before:-inset-2 before:content-['']";

/** The Mask on the preview: the dashed box, which moves from anywhere inside, with eight edge handles and a center grip. */
function MaskBox({ mask, base, dragging, onNudge }: {
  mask: MascotMask;
  base: MascotSize;
  dragging: boolean;
  onNudge: (grip: MaskGrip, delta: MascotPoint) => void;
}) {
  const keyDown = (grip: MaskGrip) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta = gripKeyDelta(grip, event.key, event.shiftKey);
    if (!delta) return;
    event.preventDefault();
    onNudge(grip, delta);
  };
  return (
    <div
      role="group"
      aria-label={MASCOT_COPY.mask.label}
      data-fq-mask-box=""
      {...{ [GRIP_ATTR]: 'move' }}
      data-dragging={dragging ? '' : undefined}
      className="group absolute cursor-move rounded-sm border-2 border-dashed border-primary"
      style={{
        left: `${(mask.x / base.width) * 100}%`,
        top: `${(mask.y / base.height) * 100}%`,
        width: `${(mask.width / base.width) * 100}%`,
        height: `${(mask.height / base.height) * 100}%`,
      }}
    >
      {/* First, so the edge handles stack over it on a small box. */}
      <button
        type="button"
        aria-label={MASCOT_COPY.mask.move}
        {...{ [GRIP_ATTR]: 'move' }}
        onKeyDown={keyDown('move')}
        className={`${GRIP_BASE} ${GRIP_FADE} left-1/2 top-1/2 grid h-6 w-6 cursor-move place-items-center rounded-full text-primary`}
      >
        <Move aria-hidden className="h-3.5 w-3.5" />
      </button>
      {MASK_GRIPS.map((grip) => (
        <button
          key={grip}
          type="button"
          aria-label={MASCOT_COPY.mask.grips[grip]}
          {...{ [GRIP_ATTR]: grip }}
          onKeyDown={keyDown(grip)}
          className={`${GRIP_BASE} ${GRIP_FADE} ${GRIP_HIT} ${GRIP_PLACES[grip]} h-3 w-3 rounded-sm`}
        />
      ))}
    </div>
  );
}

const basePoint = (event: { clientX: number; clientY: number }, rect: DOMRect, base: MascotSize): MascotPoint => ({
  x: ((event.clientX - rect.left) / rect.width) * base.width,
  y: ((event.clientY - rect.top) / rect.height) * base.height,
});

const KIND_OPTIONS: readonly { value: MascotLayerKind; label: string }[] = [
  { value: 'expression', label: MASCOT_COPY.kind.expression },
  { value: 'state', label: MASCOT_COPY.kind.state },
];

type UrlOf = (ref: MascotImageRef) => string | null;

/** A sortable row's drag style: a translate, never a scale, dimmed while it drags. */
const dragStyle = ({ transform, transition, isDragging }: Pick<ReturnType<typeof useSortable>, 'transform' | 'transition' | 'isDragging'>) =>
  ({ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 1 : undefined });

/** An overlay's place in its layer, as a sortable id. The same image can sit in a layer twice. */
const overlayId = (index: number): string => String(index);

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="inline-block h-8 w-8 shrink-0 overflow-hidden rounded-sm border border-border bg-muted/40">
      {url && <img src={url} alt="" draggable={false} className="h-full w-full object-contain" />}
    </span>
  );
}

function SortableOverlay({ index, image, urlOf, selected, onSelect, onRemove }: {
  index: number;
  image: MascotImageRef;
  urlOf: UrlOf;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: overlayId(index) });
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={dragStyle(drag)}
      gripProps={{ ...attributes, ...listeners }}
      selected={selected}
      onSelect={onSelect}
      selectionLabel={MASCOT_COPY.showOverlay(index + 1)}
      icon={<Thumb url={urlOf(image)} />}
      label={image.kind === 'bundled' ? image.name : MASCOT_COPY.storedOverlay}
      meta={image.kind === 'bundled' ? MASCOT_COPY.bundledOverlay : undefined}
      actions={[{ icon: <X className="h-4 w-4" />, title: MASCOT_COPY.removeOverlay, onClick: onRemove }]}
    />
  );
}

/** The expanded body of a layer row: its name, its kind, and its overlays in draw order. */
function LayerBody({ layer, urlOf, selectedOverlay, onSelectOverlay, onPatch, onAddFiles, onRemoveOverlay, onMoveOverlay }: {
  layer: MascotLayer;
  urlOf: UrlOf;
  selectedOverlay: number | null;
  onSelectOverlay: (index: number) => void;
  onPatch: (patch: MascotLayerPatch) => void;
  onAddFiles: (files: File[]) => void;
  onRemoveOverlay: (index: number) => void;
  onMoveOverlay: (from: number, to: number) => void;
}) {
  const nameId = `fq-mascot-layer-${layer.id}`;
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onMoveOverlay(Number(active.id), Number(over.id));
  };
  return (
    <div className="grid gap-3 rounded-b-md border border-t-0 border-border p-3">
      <div className="grid gap-1">
        <Label htmlFor={nameId}>{MASCOT_COPY.layerName}</Label>
        <Input id={nameId} value={layer.name} onChange={(event) => onPatch({ name: event.target.value })} />
      </div>
      <OptionSwitcher value={layer.kind} onChange={(kind) => onPatch({ kind })} options={KIND_OPTIONS} ariaLabel={`Kind of ${layer.name}`} />
      <div className="grid gap-1">
        <span className="text-label">{MASCOT_COPY.overlays}</span>
        {layer.images.length > 0 && (
          <EditorDndContext onDragEnd={handleDragEnd}>
            <StableSortableContext items={layer.images.map((_, index) => overlayId(index))} strategy={verticalListSortingStrategy}>
              <EditorRowList className="min-w-0">
                {layer.images.map((image, index) => (
                  <SortableOverlay
                    key={overlayId(index)}
                    index={index}
                    image={image}
                    urlOf={urlOf}
                    selected={selectedOverlay === index}
                    onSelect={() => onSelectOverlay(index)}
                    onRemove={() => onRemoveOverlay(index)}
                  />
                ))}
              </EditorRowList>
            </StableSortableContext>
          </EditorDndContext>
        )}
        <ImageUpload id={`fq-mascot-overlay-${layer.id}`} onChange={() => undefined} onFile={(file) => onAddFiles([file])} onFiles={onAddFiles} />
      </div>
    </div>
  );
}

function SortableLayer({ layer, expanded, selected, urlOf, onSelect, onToggle, onSelectOverlay, onPatch, onRemove, children }: {
  layer: MascotLayer;
  expanded: boolean;
  /** The layer itself is selected, not one of its overlays. */
  selected: boolean;
  urlOf: UrlOf;
  onSelect: () => void;
  onToggle: () => void;
  onSelectOverlay: (index: number) => void;
  onPatch: (patch: MascotLayerPatch) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: layer.id });
  return (
    // The node wraps the row and its body, so an expanded layer moves as one piece.
    <div
      ref={setNodeRef}
      data-mascot-layer={layer.id}
      style={dragStyle(drag)}
    >
      <EditorRow
        gripProps={{ ...attributes, ...listeners }}
        selected={selected}
        onSelect={onSelect}
        selectionLabel={`Expand ${layer.name}`}
        lead="chevron"
        collapsed={!expanded}
        onToggleCollapse={onToggle}
        attached={expanded}
        checkbox={{ checked: layer.enabled, onChange: (enabled) => onPatch({ enabled }), ariaLabel: `Enable ${layer.name}` }}
        label={layer.name}
        meta={
          <span className="flex items-center gap-2">
            {MASCOT_COPY.kind[layer.kind]}
            <span className="flex gap-0.5">
              {layer.images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={MASCOT_COPY.showLayerOverlay(layer.name, index + 1)}
                  onClick={(event) => { event.stopPropagation(); onSelectOverlay(index); }}
                  className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <Thumb url={urlOf(image)} />
                </button>
              ))}
            </span>
          </span>
        }
        actions={[{ icon: <X className="h-4 w-4" />, title: MASCOT_COPY.removeLayer, onClick: onRemove }]}
      />
      {expanded && children}
    </div>
  );
}

/** The Select value of an empty pick slot. Radix keeps the empty string for "no value". */
const NO_LAYER = 'none';

/** One pick slot: the enabled layers of its kind. A slot that names any other layer shows that layer's name, unlisted. */
function PickSelect({ rig, pick, slot, onPick }: {
  rig: MascotRig;
  pick: MascotPickName;
  slot: MascotLayerKind;
  onPick: (layerId: string | null) => void;
}) {
  const layerId = rig.picks[pick][slot];
  const options = mascotPickOptions(rig, slot);
  const listed = layerId === null || options.some((row) => row.id === layerId);
  const kept = rig.layers.find((row) => row.id === layerId);
  return (
    // An unlisted layer selects nothing, so the placeholder shows its name.
    <Select value={layerId === null ? NO_LAYER : listed ? layerId : ''} onValueChange={(value) => onPick(value === NO_LAYER ? null : value)}>
      <SelectTrigger aria-label={`${MASCOT_COPY.picks[pick].label} ${MASCOT_COPY.kind[slot]}`} className="min-w-0 flex-1">
        <SelectValue placeholder={kept?.name ?? MASCOT_COPY.missingLayer} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_LAYER}>{MASCOT_COPY.noLayer}</SelectItem>
        {options.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Names each pick slot that draws nothing, with the layer it keeps. */
function PickWarnings({ rig, warnings }: { rig: MascotRig; warnings: readonly MascotPickWarning[] }) {
  const nameOf = (id: string) => rig.layers.find((row) => row.id === id)?.name ?? MASCOT_COPY.missingLayer;
  return (
    <div data-fq-pick-warning="" className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 px-2 py-1.5 text-helper">
      <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div>
        <p>{MASCOT_COPY.pickWarning}</p>
        <ul className="list-disc pl-4">
          {warnings.map(({ pick, slot, layerId }) => (
            <li key={`${pick}-${slot}`}>{`${MASCOT_COPY.picks[pick].label} ${MASCOT_COPY.kind[slot]}: ${nameOf(layerId)}`}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const MODE_OPTIONS: readonly { value: MascotTransitionMode; label: string }[] =
  MASCOT_TRANSITION_MODES.map((mode) => ({ value: mode, label: MASCOT_COPY.transition.modes[mode] }));

const ms = (value: number) => `${value} ms`;
const percent = (value: number) => `${Math.round(value * 100)}%`;

const JELLY_FORMATS: { readonly [K in keyof JellyTuning]: (value: number) => string } = {
  durationMs: ms,
  squash: percent,
  overshoot: percent,
  settle: String,
};

/** One tuning slider, held to its range, on one line of the preview widget. */
function TuningRow({ id, copy, range, value, format, onChange }: {
  id: string;
  copy: { label: string; hint: string };
  range: TuningRange;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <WidgetRow id={id} copy={copy}>
      <ValueSlider
        id={id}
        ariaLabel={copy.label}
        value={value}
        min={range.min}
        max={range.max}
        step={range.step}
        format={format}
        onChange={onChange}
        valueClassName="w-14 shrink-0 whitespace-nowrap"
      />
    </WidgetRow>
  );
}

/** The transition's mode with Play, and the chosen mode's tuning. */
function TransitionControls({ transition, onTransition, onPlay }: {
  transition: MascotTransition;
  onTransition: (next: MascotTransition) => void;
  onPlay: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const copy = MASCOT_COPY.transition;
  const setJelly = (key: keyof JellyTuning) => (value: number) => onTransition({ ...transition, jelly: { ...transition.jelly, [key]: value } });
  return (
    <div className="grid gap-2">
      <WidgetLabel copy={copy.mode} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <OptionSwitcher ariaLabel={copy.mode.label} value={transition.mode} options={MODE_OPTIONS} onChange={(mode) => onTransition({ ...transition, mode })} />
        </div>
        <Tip tip={copy.play.hint} labelsChild={false}>
          <Button variant="outline" size="sm" onClick={onPlay}>
            <Play className="mr-1 h-4 w-4" />{copy.play.label}
          </Button>
        </Tip>
      </div>
      {reduced && <Hint>{copy.reducedMotion}</Hint>}
      {transition.mode === 'jelly' && (Object.keys(JELLY_RANGES) as (keyof JellyTuning)[]).map((key) => (
        <TuningRow
          key={key}
          id={`fq-mascot-jelly-${key}`}
          copy={copy.jelly[key]}
          range={JELLY_RANGES[key]}
          value={transition.jelly[key]}
          format={JELLY_FORMATS[key]}
          onChange={setJelly(key)}
        />
      ))}
      {transition.mode === 'dissolve' && (
        <TuningRow
          id="fq-mascot-dissolve-duration"
          copy={copy.dissolveDuration}
          range={DISSOLVE_RANGES.durationMs}
          value={transition.dissolve.durationMs}
          format={ms}
          onChange={(durationMs) => onTransition({ ...transition, dissolve: { durationMs } })}
        />
      )}
    </div>
  );
}

/**
 * The Mascot tab of Formaquestion Settings: the switch and the rig editor. Player images go to the mascot
 * image store; an edit that leaves an image unreferenced deletes it.
 */
export function MascotTab({ settings, onChange }: {
  settings: HelpSettings;
  onChange: (change: HelpSettingsChange) => void;
}) {
  const { rig } = settings;
  const mounted = useMountedRef();
  // The latest rig, for an edit that lands after an upload's await.
  const latest = useRef(rig);
  latest.current = rig;
  /** What the preview shows. The expanded layer is the selected one. */
  const [selection, setSelection] = useState<MascotSelection | null>(null);
  const [base, setBase] = useState<MascotSize | null>(null);
  /** The box a Mask drag gives while it runs. The rig takes it on release. */
  const [draftMask, setDraftMask] = useState<MascotMask | null>(null);
  const [maskDragging, setMaskDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  /** A card read from a picked file, waiting for the replace confirmation. */
  const [pendingCard, setPendingCard] = useState<MascotCardData | null>(null);
  const cardInput = useRef<HTMLInputElement>(null);
  /** The last Play: its run, whether it went to the Thinking look, and the selection it played over. */
  const [play, setPlay] = useState<Omit<MascotReplay, 'transition'> & { thinking: boolean; over: MascotSelection | null } | null>(null);
  // Bumped by Reset and by an applied import, so an upload or import that started before it lands nowhere.
  const generation = useRef(0);
  const refs = mascotImageRefs(rig);
  const urlOf = useMascotImageUrls(refs);

  const commit = (next: MascotRig) => {
    const orphans = orphanedMascotImages(latest.current, next);
    latest.current = next;
    onChange({ rig: next });
    for (const id of orphans) void deleteMascotImage(id).catch((cause: unknown) => console.error('Could not delete a mascot image:', cause));
  };

  const edit = (apply: (current: MascotRig) => MascotRig) => commit(apply(latest.current));

  const store = async (files: readonly File[], apply: (current: MascotRig, refs: MascotImageRef[]) => MascotRig) => {
    const started = generation.current;
    setError(null);
    try {
      const ids = await Promise.all(files.map(addMascotImage));
      // Closed or reset mid-save: nothing will reference these.
      if (!mounted.current || generation.current !== started) return void Promise.all(ids.map(deleteMascotImage)).catch(() => undefined);
      edit((current) => apply(current, ids.map((id) => ({ kind: 'stored', id }))));
    } catch (cause: unknown) {
      console.error('Could not save a mascot image:', cause);
      if (mounted.current) setError(MASCOT_COPY.saveFailed);
    }
  };

  const reset = () => {
    generation.current += 1;
    latest.current = DEFAULT_MASCOT_RIG;
    onChange({ rig: DEFAULT_MASCOT_RIG });
    setSelection(null);
    void clearMascotImages().catch((cause: unknown) => console.error('Could not clear the mascot images:', cause));
  };

  const exportCard = async () => {
    try {
      downloadBlob(await exportMascotCard(latest.current), MASCOT_CARD_FILE_NAME);
    } catch (cause: unknown) {
      toastError(cause, MASCOT_COPY.card.exportFailed);
    }
  };

  /** Reads the picked card; a whole card waits for the confirmation, a bad one is named and changes nothing. */
  const pickCard = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(event);
    if (!file) return;
    try {
      const card = await readMascotCard(file);
      if (mounted.current) setPendingCard(card);
    } catch (cause: unknown) {
      toastError(cause, MASCOT_COPY.card.importFailed);
    }
  };

  /** Stores the card's images, then replaces the rig; the old rig's images go with it. */
  const importCard = async (card: MascotCardData) => {
    const started = generation.current;
    try {
      const next = await storeMascotCard(card);
      // Closed, reset or imported again mid-store: nothing will reference these.
      if (!mounted.current || generation.current !== started) {
        return void Promise.all([...mascotImageIds(next)].map(deleteMascotImage)).catch(() => undefined);
      }
      generation.current += 1;
      setSelection(null);
      commit(next);
    } catch (cause: unknown) {
      toastError(cause, MASCOT_COPY.card.importFailed);
    }
  };

  const warnings = mascotPickWarnings(rig);
  // Play holds the Thinking look until the next Play or a new selection.
  const thinkingShown = play?.thinking === true && play.over === selection;
  const preview = thinkingShown ? composeMascot(rig, 'thinking', null) : previewMascot(rig, selection);
  const playNext = () => setPlay((last) => {
    const toThinking = !(last?.thinking === true && last.over === selection);
    const thinking = composeMascot(latest.current, 'thinking', null);
    const chosen = previewMascot(latest.current, selection);
    return { id: (last?.id ?? 0) + 1, from: toThinking ? chosen : thinking, thinking: toThinking, over: selection };
  });
  const shown = resolveSelection(rig, selection);
  const caption = thinkingShown ? MASCOT_COPY.picks.thinking.label
    : !shown ? MASCOT_COPY.idleShown
    : shown.overlay === null ? shown.layer.name : MASCOT_COPY.overlayShown(shown.layer.name, shown.overlay + 1);
  const patchLayer = (id: string) => (patch: MascotLayerPatch) => edit((current) => updateMascotLayer(current, id, patch));

  const mask = base && fitMask(draftMask ?? rig.mask, base);
  const maskDrag = usePointerDrag<MaskPress>({
    start: (event) => {
      if (event.button !== 0 || !base) return null;
      const rect = event.currentTarget.getBoundingClientRect();
      const from = basePoint(event, rect, base);
      const grip = gripAt(event.target);
      setMaskDragging(true);
      if (grip === null) return { grip, from, latest: null, rect };
      const start = fitMask(latest.current.mask, base);
      return { grip, from, start, latest: start, rect };
    },
    move: (press, event) => {
      if (!base) return;
      const to = basePoint(event, press.rect, base);
      if (press.grip === null) press.latest = maskFromDrag(press.from, to, base);
      else press.latest = moveMaskGrip(press.start, press.grip, { x: to.x - press.from.x, y: to.y - press.from.y }, base);
      setDraftMask(press.latest);
    },
    end: (press, canceled) => {
      setDraftMask(null);
      setMaskDragging(false);
      const next = press.latest;
      if (!next || canceled || (press.grip !== null && sameMask(next, press.start))) return;
      edit((current) => ({ ...current, mask: next }));
    },
  });
  /** An arrow key on a focused handle, committed at once. */
  const nudgeMask = (grip: MaskGrip, delta: MascotPoint) => {
    if (!base) return;
    const from = fitMask(latest.current.mask, base);
    const next = moveMaskGrip(from, grip, delta, base);
    if (!sameMask(next, from)) edit((current) => ({ ...current, mask: next }));
  };

  const handleLayerDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) edit((current) => moveMascotLayer(current, String(active.id), String(over.id)));
  };

  return (
    <>
      {/* Under lg the whole tab scrolls as one; at lg each column scrolls alone, so the preview stays in view. */}
      <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:gap-6 lg:overflow-hidden">
        <div className="pt-4 lg:min-h-0 lg:overflow-y-auto lg:pb-4">
          <section
            aria-label={MASCOT_COPY.preview.label}
            data-fq-mascot-preview=""
            className="grid gap-3 rounded-md border border-border bg-muted/30 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <WidgetLabel copy={{ label: MASCOT_COPY.preview.label, hint: MASCOT_COPY.preview.info }} />
              <Meta className="min-w-0 truncate">{caption}</Meta>
            </div>
            <div className="flex flex-wrap items-end justify-center gap-3" style={{ minHeight: PREVIEW_HEIGHT }}>
              <div {...maskDrag} data-fq-mask-target="" className="relative cursor-crosshair touch-none select-none">
                <MascotPiece
                  images={preview}
                  hold={refs}
                  replay={play ? { id: play.id, from: play.from, transition: rig.transition } : undefined}
                  size={base && { w: Math.round((PREVIEW_HEIGHT * base.width) / base.height), h: PREVIEW_HEIGHT }}
                  onBase={setBase}
                />
                {base && mask && <MaskBox mask={mask} base={base} dragging={maskDragging} onNudge={nudgeMask} />}
              </div>
              {/* A fixed slot, so the head resizing under a Mask drag never slides the mascot under the pointer. */}
              <figure className="grid w-32 justify-items-center gap-1">
                <div className="flex items-end rounded-md border border-border bg-background/60 p-1" style={{ minHeight: HEAD_HEIGHT + 8 }}>
                  <MascotPiece
                    view="head"
                    images={preview}
                    hold={refs}
                    size={mask && headSizeWithin(mask, HEAD_HEIGHT, PREVIEW_HEAD_WIDTH)}
                    frame={base && mask ? cropFrame(mask, base) : undefined}
                    onBase={setBase}
                  />
                </div>
                <Meta as="figcaption">{MASCOT_COPY.headView}</Meta>
              </figure>
            </div>
            <Hint>{MASCOT_COPY.preview.hint}</Hint>
            <MascotScaleRow />
            <TransitionControls
              transition={rig.transition}
              onTransition={(transition) => edit((current) => ({ ...current, transition }))}
              onPlay={playNext}
            />
          </section>
        </div>
        <div data-fq-mascot-controls="" className="grid content-start gap-6 py-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <Section title="Mascot">
            <CheckRow htmlFor="fq-mascot" checked={settings.mascot} onChange={(mascot) => onChange({ mascot })} {...MASCOT_COPY.mascot} />
            <Row top htmlFor="fq-mascot-voice" {...MASCOT_COPY.voice}>
              <Textarea
                id="fq-mascot-voice"
                rows={3}
                value={rig.voice}
                onChange={(event) => { const voice = event.target.value; edit((current) => ({ ...current, voice })); }}
              />
            </Row>
          </Section>
          <Section title="Rig">
            <Row top {...MASCOT_COPY.base}>
              <ImageUpload
                id="fq-mascot-base"
                // The bundled base leaves the slot empty, so a click or a drop uploads yours.
                value={rig.base.kind === 'stored' ? urlOf(rig.base) : null}
                onFile={(file) => void store([file], (current, [ref]) => setMascotBase(current, ref))}
                onChange={(value) => { if (value === '') edit(removeMascotBase); }}
              />
            </Row>
            <Row top {...MASCOT_COPY.layers}>
              <div className="grid gap-2">
                <EditorDndContext onDragEnd={handleLayerDragEnd}>
                  <StableSortableContext items={rig.layers} strategy={verticalListSortingStrategy}>
                    {/* Shrinks with the narrow controls column, so a long name truncates instead of pushing Remove out. */}
                    <EditorRowList className="min-w-0">
                      {rig.layers.map((layer) => {
                        const own = shown?.layer.id === layer.id ? shown : null;
                        const pickOverlay = (index: number) => setSelection((was) => selectOverlay(was, layer.id, index));
                        return (
                          <SortableLayer
                            key={layer.id}
                            layer={layer}
                            expanded={own !== null}
                            selected={own?.overlay === null}
                            urlOf={urlOf}
                            onSelect={() => setSelection((was) => selectLayer(was, layer.id))}
                            onToggle={() => setSelection((was) => toggleLayer(was, layer.id))}
                            onSelectOverlay={pickOverlay}
                            onPatch={patchLayer(layer.id)}
                            onRemove={() => {
                              edit((current) => removeMascotLayer(current, layer.id));
                              setSelection((was) => selectionAfterLayerRemove(was, layer.id));
                            }}
                          >
                            <LayerBody
                              layer={layer}
                              urlOf={urlOf}
                              selectedOverlay={own?.overlay ?? null}
                              onSelectOverlay={pickOverlay}
                              onPatch={patchLayer(layer.id)}
                              onAddFiles={(files) => void store(files, (current, refs) => addMascotOverlays(current, layer.id, refs))}
                              onRemoveOverlay={(index) => {
                                edit((current) => removeMascotOverlay(current, layer.id, index));
                                setSelection((was) => selectionAfterRemove(was, layer.id, index));
                              }}
                              onMoveOverlay={(from, to) => {
                                edit((current) => moveMascotOverlay(current, layer.id, from, to));
                                setSelection((was) => selectionAfterMove(was, layer.id, from, to));
                              }}
                            />
                          </SortableLayer>
                        );
                      })}
                    </EditorRowList>
                  </StableSortableContext>
                </EditorDndContext>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={() => {
                    const id = randomUUID();
                    edit((current) => addMascotLayer(current, id));
                    setSelection({ layerId: id, overlay: null });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />{MASCOT_COPY.addLayer}
                </Button>
                {error && <p className="text-helper text-destructive">{error}</p>}
              </div>
            </Row>
            {MASCOT_PICK_NAMES.map((pick) => (
              <Row key={pick} {...MASCOT_COPY.picks[pick]}>
                <div className="flex gap-2">
                  {MASCOT_LAYER_KINDS.map((slot) => (
                    <PickSelect key={slot} rig={rig} pick={pick} slot={slot} onPick={(layerId) => edit((current) => setMascotPick(current, pick, slot, layerId))} />
                  ))}
                </div>
              </Row>
            ))}
            {warnings.length > 0 && <Row><PickWarnings rig={rig} warnings={warnings} /></Row>}
            <Row hint={MASCOT_COPY.card.hint}>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
                  <RotateCcw className="mr-1 h-4 w-4" />{MASCOT_COPY.reset.label}
                </Button>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => cardInput.current?.click()}>
                  <ActionIcon.import className="mr-1 h-4 w-4" aria-hidden />{MASCOT_COPY.card.import}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void exportCard()}>
                  <ActionIcon.export className="mr-1 h-4 w-4" aria-hidden />{MASCOT_COPY.card.export}
                </Button>
                <input
                  ref={cardInput}
                  type="file"
                  accept=".webp,image/webp"
                  className="hidden"
                  data-testid="mascot-card-input"
                  onChange={(event) => void pickCard(event)}
                />
              </div>
            </Row>
          </Section>
        </div>
      </div>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={MASCOT_COPY.reset.confirmTitle}
        description={MASCOT_COPY.reset.confirmBody}
        onConfirm={reset}
      />
      <ConfirmDialog
        open={pendingCard !== null}
        onOpenChange={(open) => { if (!open) setPendingCard(null); }}
        title={MASCOT_COPY.card.confirmTitle}
        description={MASCOT_COPY.card.confirmBody}
        onConfirm={() => { if (pendingCard) void importCard(pendingCard); }}
      />
    </>
  );
}
