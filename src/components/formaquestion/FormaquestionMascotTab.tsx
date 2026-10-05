import { useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent } from '@dnd-kit/core';
import { Info, Move, Play, Plus, Redo2, Undo2, X } from 'lucide-react';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { PresetNameDialog } from '@/components/modals/PresetNameDialog';
import { PanelShell } from '@/components/PanelShell';
import { PresetHeader } from '@/components/presetHeader/PresetHeader';
import { ReadOnlyNotice } from '@/components/prompt/ReadOnlyNotice';
import { OptionSwitcher, Row, Section, ValueSlider } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tip } from '@/components/ui/tooltip';
import { Hint, Meta } from '@/components/ui/typography';
import { ImageUpload } from '@/lib/UtilityComponents';
import { historyShortcut } from '@/lib/canvasHistory';
import { downloadBlob } from '@/lib/downloadBlob';
import { targetAttribute } from '@/lib/surface/surfaceTargets';
import { filesFrom } from '@/lib/importFiles';
import { toastError } from '@/lib/linkToast';
import { presetHeaderActions, type PresetHeaderAction } from '@/lib/presetHeaderActions';
import { useElementSize } from '@/lib/useElementSize';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useMorphFullscreen } from '@/lib/useMorphFullscreen';
import { useMountedRef } from '@/lib/useMountedRef';
import { randomUUID } from '@/lib/uuid';
import type { HelpSettings } from '@/lib/formaquestion/helpSettings';
import { cn } from '@/lib/utils';
import {
  MASCOT_LAYER_KINDS, MASCOT_PICK_NAMES, composeMascot, mascotPickWarnings, type MascotImageRef, type MascotLayer,
  type MascotLayerKind, type MascotMask, type MascotPickName, type MascotPickWarning, type MascotRig,
} from '@/lib/formaquestion/mascot';
import {
  DISSOLVE_RANGES, JELLY_RANGES, MASCOT_TRANSITION_MODES, type JellyTuning, type MascotTransition, type MascotTransitionMode, type TuningRange,
} from '@/lib/formaquestion/mascotTransition';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import {
  MASK_GRIPS, cropFrame, fitMask, gripKeyDelta, headSizeWithin, isMaskGrip, maskFromDrag, moveMaskGrip, sizeWithin,
  type MascotPoint, type MascotSize, type MaskGrip,
} from '@/lib/formaquestion/mascotMask';
import { HEAD_HEIGHT } from '@/lib/formaquestion/windowBox';
import { addMascotImage } from '@/lib/formaquestion/mascotImageStore';
import { mascotCardName } from '@/lib/formaquestion/mascotCard';
import { DEFAULT_MASCOT_ID, DEFAULT_MASCOT_NAME } from '@/lib/formaquestion/mascotPresets';
import { MASCOT_CARD_FILE_NAME, exportMascotCard, readMascotCard, storeMascotCard } from '@/lib/formaquestion/mascotCardFile';
import {
  addMascotLayer, addMascotOverlays, mascotImageIds, mascotImageRefs, mascotPickOptions, moveMascotLayer, moveMascotOverlay,
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
import { dropMascotImages, type MascotDraftControl } from './useMascotDraft';

/** Tailwind's `lg`: from here the tab is two columns that scroll alone. */
const WIDE_QUERY = '(min-width: 1024px)';
/** Docked, the preview keeps a fixed column; in full screen it takes a third of the width. */
const COLUMNS_DOCKED = 'grid-cols-[22rem_minmax(0,1fr)]';
const COLUMNS_FULL_SCREEN = 'grid-cols-[minmax(0,1fr)_minmax(0,2fr)]';
const PREVIEW_HEIGHT = 240;
/** The Head View's slot and the gap before it: the mascot takes the rest of the preview row. */
const HEAD_SLOT_WIDTH = 128;
const PREVIEW_ROW_GAP = 12;
/** The least room the mascot gets, so a very narrow row overflows instead of drawing it at nothing. */
const MIN_PREVIEW_WIDTH = 64;
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
function MaskBox({ mask, base, dragging, readOnly, onNudge }: {
  mask: MascotMask;
  base: MascotSize;
  dragging: boolean;
  /** Draws the box alone, with no handles. */
  readOnly: boolean;
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
      className={`group absolute rounded-sm border-2 border-dashed border-primary ${readOnly ? '' : 'cursor-move'}`}
      style={{
        left: `${(mask.x / base.width) * 100}%`,
        top: `${(mask.y / base.height) * 100}%`,
        width: `${(mask.width / base.width) * 100}%`,
        height: `${(mask.height / base.height) * 100}%`,
      }}
    >
      {/* First, so the edge handles stack over it on a small box. */}
      {!readOnly && <button
        type="button"
        aria-label={MASCOT_COPY.mask.move}
        {...{ [GRIP_ATTR]: 'move' }}
        onKeyDown={keyDown('move')}
        className={`${GRIP_BASE} ${GRIP_FADE} left-1/2 top-1/2 grid h-6 w-6 cursor-move place-items-center rounded-full text-primary`}
      >
        <Move aria-hidden className="h-3.5 w-3.5" />
      </button>}
      {!readOnly && MASK_GRIPS.map((grip) => (
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

function SortableOverlay({ index, image, urlOf, selected, readOnly, onSelect, onRemove }: {
  index: number;
  readOnly: boolean;
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
      gripProps={readOnly ? undefined : { ...attributes, ...listeners }}
      grip={!readOnly}
      selected={selected}
      onSelect={onSelect}
      selectionLabel={MASCOT_COPY.showOverlay(index + 1)}
      icon={<Thumb url={urlOf(image)} />}
      label={image.kind === 'bundled' ? image.name : MASCOT_COPY.storedOverlay}
      meta={image.kind === 'bundled' ? MASCOT_COPY.bundledOverlay : undefined}
      actions={readOnly ? [] : [{ icon: <X className="h-4 w-4" />, title: MASCOT_COPY.removeOverlay, onClick: onRemove }]}
    />
  );
}

/** The expanded body of a layer row: its name, its kind, and its overlays in draw order. */
function LayerBody({ layer, urlOf, readOnly, selectedOverlay, onSelectOverlay, onPatch, onAddFiles, onRemoveOverlay, onMoveOverlay }: {
  layer: MascotLayer;
  readOnly: boolean;
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
        <Input id={nameId} value={layer.name} readOnly={readOnly} onChange={(event) => onPatch({ name: event.target.value })} />
      </div>
      <OptionSwitcher value={layer.kind} onChange={(kind) => onPatch({ kind })} options={KIND_OPTIONS} ariaLabel={`Kind of ${layer.name}`} disabled={readOnly} />
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
                    readOnly={readOnly}
                    onSelect={() => onSelectOverlay(index)}
                    onRemove={() => onRemoveOverlay(index)}
                  />
                ))}
              </EditorRowList>
            </StableSortableContext>
          </EditorDndContext>
        )}
        {!readOnly && <ImageUpload id={`fq-mascot-overlay-${layer.id}`} onChange={() => undefined} onFile={(file) => onAddFiles([file])} onFiles={onAddFiles} />}
      </div>
    </div>
  );
}

function SortableLayer({ layer, expanded, selected, urlOf, readOnly, onSelect, onToggle, onSelectOverlay, onPatch, onRemove, children }: {
  layer: MascotLayer;
  readOnly: boolean;
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
        gripProps={readOnly ? undefined : { ...attributes, ...listeners }}
        grip={!readOnly}
        selected={selected}
        onSelect={onSelect}
        selectionLabel={`Expand ${layer.name}`}
        lead="chevron"
        collapsed={!expanded}
        onToggleCollapse={onToggle}
        attached={expanded}
        checkbox={{ checked: layer.enabled, onChange: (enabled) => onPatch({ enabled }), ariaLabel: `Enable ${layer.name}`, disabled: readOnly }}
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
        actions={readOnly ? [] : [{ icon: <X className="h-4 w-4" />, title: MASCOT_COPY.removeLayer, onClick: onRemove }]}
      />
      {expanded && children}
    </div>
  );
}

/** The Select value of an empty pick slot. Radix keeps the empty string for "no value". */
const NO_LAYER = 'none';

/** One pick slot: the enabled layers of its kind. A slot that names any other layer shows that layer's name, unlisted. */
function PickSelect({ rig, pick, slot, disabled, onPick }: {
  rig: MascotRig;
  disabled: boolean;
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
    <Select disabled={disabled} value={layerId === null ? NO_LAYER : listed ? layerId : ''} onValueChange={(value) => onPick(value === NO_LAYER ? null : value)}>
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
function TuningRow({ id, copy, range, value, format, disabled, onChange }: {
  id: string;
  disabled: boolean;
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
        disabled={disabled}
        onChange={onChange}
        valueClassName="w-14 shrink-0 whitespace-nowrap"
      />
    </WidgetRow>
  );
}

/** The transition's mode with Play, and the chosen mode's tuning. */
function TransitionControls({ transition, readOnly, onTransition, onPlay }: {
  transition: MascotTransition;
  readOnly: boolean;
  /** `group` joins a slider drag's edits into one undo step. */
  onTransition: (next: MascotTransition, group?: string) => void;
  onPlay: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const copy = MASCOT_COPY.transition;
  const setJelly = (key: keyof JellyTuning) => (value: number) => onTransition({ ...transition, jelly: { ...transition.jelly, [key]: value } }, `jelly-${key}`);
  return (
    <div className="grid gap-2">
      <WidgetLabel copy={copy.mode} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <OptionSwitcher ariaLabel={copy.mode.label} value={transition.mode} options={MODE_OPTIONS} onChange={(mode) => onTransition({ ...transition, mode })} disabled={readOnly} />
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
          disabled={readOnly}
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
          disabled={readOnly}
          onChange={(durationMs) => onTransition({ ...transition, dissolve: { durationMs } }, 'dissolve-duration')}
        />
      )}
    </div>
  );
}

/** One icon-only action of the footer. */
function RowAction({ copy, onClick, disabled, children }: {
  copy: { label: string; tip: string };
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tip tip={copy.tip}>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={copy.label} disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </Tip>
  );
}

/**
 * The Mascot tab of Formaquestion Settings: the preset header and the editor of the selected mascot's draft.
 * Player images go to the mascot image store; the draft drops them at Save or Cancel. With the Mascot off,
 * the tab keeps every row mounted and disabled under a status line that links to the switch on General.
 * Full screen lifts the whole tab, footer included.
 */
export function MascotTab({ settings, control, onOpenGeneral }: {
  settings: HelpSettings;
  control: MascotDraftControl;
  /** Opens the General tab, where the Mascot switch lives. */
  onOpenGeneral: () => void;
}) {
  const off = !settings.mascot;
  const { rig } = control.draft;
  const { readOnly, mascot: selected } = control;
  const mounted = useMountedRef();
  const wide = useMediaQuery(WIDE_QUERY);
  /** What the preview shows. The expanded layer is the selected one. */
  const [selection, setSelection] = useState<MascotSelection | null>(null);
  // A switch to another mascot clears the selection; a prompt the player answers with Cancel keeps it.
  const [selectionFor, setSelectionFor] = useState(control.draft.mascotId);
  if (selectionFor !== control.draft.mascotId) {
    setSelectionFor(control.draft.mascotId);
    setSelection(null);
  }
  const [base, setBase] = useState<MascotSize | null>(null);
  /** The box a Mask drag gives while it runs. The rig takes it on release. */
  const [draftMask, setDraftMask] = useState<MascotMask | null>(null);
  const [maskDragging, setMaskDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const cardInput = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const morph = useMorphFullscreen(panelRef);
  /** The last Play: its run, whether it went to the Thinking look, and the selection it played over. */
  const [play, setPlay] = useState<Omit<MascotReplay, 'transition'> & { thinking: boolean; over: MascotSelection | null } | null>(null);
  const refs = mascotImageRefs(rig);
  const urlOf = useMascotImageUrls(refs);

  const edit = control.edit;
  // The draft at the moment of a call, for a Mask drag or nudge that reads before it edits.
  const latest = useRef(rig);
  latest.current = rig;

  const uploadImages = async (files: readonly File[], apply: (current: MascotRig, refs: MascotImageRef[]) => MascotRig) => {
    const started = control.generation.current;
    setError(null);
    try {
      const ids = await Promise.all(files.map(addMascotImage));
      // Closed, canceled or switched mid-save: nothing will reference these.
      if (!mounted.current || control.generation.current !== started) return dropMascotImages(ids);
      // The upload belongs to this draft even when `apply` finds its target gone, so Save or Cancel drops it.
      control.adopt(ids);
      edit((current) => apply(current, ids.map((id) => ({ kind: 'stored', id }))));
    } catch (cause: unknown) {
      console.error('Could not save a mascot image:', cause);
      if (mounted.current) setError(MASCOT_COPY.saveFailed);
    }
  };

  const exportCard = async () => {
    try {
      downloadBlob(await exportMascotCard(selected.name, latest.current), MASCOT_CARD_FILE_NAME);
    } catch (cause: unknown) {
      toastError(cause, MASCOT_COPY.card.exportFailed);
    }
  };

  /** Stores the card's images, then adds the mascot and selects it. */
  const importCard = async (file: File) => {
    const started = control.generation.current;
    try {
      const card = await readMascotCard(file);
      const next = await storeMascotCard(card);
      // Closed, switched or imported again mid-store: nothing will reference these.
      if (!mounted.current || control.generation.current !== started) return dropMascotImages(mascotImageIds(next));
      control.add(mascotCardName(card, file.name), next);
    } catch (cause: unknown) {
      toastError(cause, MASCOT_COPY.card.importFailed);
    }
  };

  /** A picked card imports once a dirty draft is saved or discarded. */
  const pickCard = (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = filesFrom(event);
    if (file) control.guard(() => void importCard(file));
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
  // A typed run in a layer's name is one step per layer.
  const patchLayer = (id: string) => (patch: MascotLayerPatch) =>
    edit((current) => updateMascotLayer(current, id, patch), 'name' in patch ? `layer-name-${id}` : undefined);

  const [rowRef, row] = useElementSize();
  // An unmeasured row (zero width) draws at the full height.
  const roomForMascot = row.width > 0 ? Math.max(MIN_PREVIEW_WIDTH, row.width - HEAD_SLOT_WIDTH - PREVIEW_ROW_GAP) : Infinity;
  const fitted = base && sizeWithin(base, PREVIEW_HEIGHT, roomForMascot);
  const previewSize = fitted && { w: Math.round(fitted.w), h: fitted.h };
  const mask = base && fitMask(draftMask ?? rig.mask, base);
  const maskDrag = usePointerDrag<MaskPress>({
    start: (event) => {
      if (event.button !== 0 || !base || readOnly) return null;
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
  /** An arrow key on a focused handle, applied at once. */
  const nudgeMask = (grip: MaskGrip, delta: MascotPoint) => {
    if (!base) return;
    const from = fitMask(latest.current.mask, base);
    const next = moveMaskGrip(from, grip, delta, base);
    if (!sameMask(next, from)) edit((current) => ({ ...current, mask: next }), 'mask-nudge');
  };

  const handleLayerDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) edit((current) => moveMascotLayer(current, String(active.id), String(over.id)));
  };

  /** Ctrl+Z undoes and Ctrl+Shift+Z or Ctrl+Y redoes, from anywhere in this tab. */
  const shortcut = (event: KeyboardEvent<HTMLDivElement>) => {
    const asked = historyShortcut(event);
    // A dialog's keys bubble up the React tree from its portal; only keys from this tab's own elements count.
    if (!asked || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    event.preventDefault();
    if (asked === 'redo') control.redo();
    else control.undo();
  };

  const copy = MASCOT_COPY.preset;
  const tips: Partial<Record<PresetHeaderAction['key'], string>> = copy.tips;
  const presetActions = presetHeaderActions(readOnly, {
    duplicate: control.duplicate,
    rename: () => setRenaming(true),
    import: () => cardInput.current?.click(),
    export: () => void exportCard(),
    fullscreen: { active: morph.contentInOverlay, toggle: morph.toggle },
    reset: () => { setSelection(null); control.reset(); },
    delete: { run: control.remove, title: copy.deleteTitle, description: copy.deleteBody(selected.name) },
  }).map((action) => ({ ...action, tip: tips[action.key] }));
  const previewWidget = (
    <section
      aria-label={MASCOT_COPY.preview.label}
      data-fq-mascot-preview=""
      className="grid gap-3 rounded-md border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <WidgetLabel copy={{ label: MASCOT_COPY.preview.label, hint: MASCOT_COPY.preview.info }} />
        <Meta className="min-w-0 truncate">{caption}</Meta>
      </div>
      {/* One row at any width: the mascot gives up height before the Head View gives up its place. */}
      <div ref={rowRef} data-fq-preview-row="" className="flex items-end justify-center" style={{ minHeight: PREVIEW_HEIGHT, columnGap: PREVIEW_ROW_GAP }}>
        <div {...maskDrag} {...targetAttribute('formaquestionSettings.mascot', 'mask')} data-fq-mask-target="" className={`relative shrink-0 touch-none select-none ${readOnly ? '' : 'cursor-crosshair'}`}>
          <MascotPiece
            images={preview}
            hold={refs}
            replay={play ? { id: play.id, from: play.from, transition: rig.transition } : undefined}
            size={base && previewSize}
            onBase={setBase}
          />
          {base && mask && <MaskBox mask={mask} base={base} dragging={maskDragging} readOnly={readOnly} onNudge={nudgeMask} />}
        </div>
        {/* A fixed slot, so the head resizing under a Mask drag never slides the mascot under the pointer. */}
        <figure className="grid shrink-0 justify-items-center gap-1" style={{ width: HEAD_SLOT_WIDTH }}>
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
        readOnly={readOnly}
        onTransition={(transition, group) => edit((current) => ({ ...current, transition }), group)}
        onPlay={playNext}
      />
    </section>
  );
  const controlsColumn = (
    <div data-fq-mascot-controls="" className="grid content-start gap-6 py-4">
      {readOnly && <ReadOnlyNotice reason={copy.readOnly(selected.name)} onRequestEdit={control.duplicate} />}
      <Section title="Mascot">
        <Row top htmlFor="fq-mascot-voice" {...MASCOT_COPY.voice}>
          <Textarea
            id="fq-mascot-voice"
            rows={3}
            value={rig.voice}
            readOnly={readOnly}
            onChange={(event) => { const voice = event.target.value; edit((current) => ({ ...current, voice }), 'voice'); }}
          />
        </Row>
      </Section>
      {/* Base Image and Layers drop the label column, so a layer row has the whole column for its name. */}
      <Section title={MASCOT_COPY.base.label} hint={MASCOT_COPY.base.hint}>
        {readOnly ? <Meta>{MASCOT_COPY.bundledOverlay}</Meta> : (
          <ImageUpload
            id="fq-mascot-base"
            // The bundled base leaves the slot empty, so a click or a drop uploads yours.
            value={rig.base.kind === 'stored' ? urlOf(rig.base) : null}
            onFile={(file) => void uploadImages([file], (current, [ref]) => setMascotBase(current, ref))}
            onChange={(value) => { if (value === '') edit(removeMascotBase); }}
          />
        )}
      </Section>
      <Section title={MASCOT_COPY.layers.label} hint={MASCOT_COPY.layers.hint}>
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
                      readOnly={readOnly}
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
                        readOnly={readOnly}
                        selectedOverlay={own?.overlay ?? null}
                        onSelectOverlay={pickOverlay}
                        onPatch={patchLayer(layer.id)}
                        onAddFiles={(files) => void uploadImages(files, (current, refs) => addMascotOverlays(current, layer.id, refs))}
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
          {!readOnly && (
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
          )}
          {error && <p className="text-helper text-destructive">{error}</p>}
        </div>
      </Section>
      <Section title="Rig">
        {MASCOT_PICK_NAMES.map((pick) => (
          <Row key={pick} {...MASCOT_COPY.picks[pick]}>
            <div className="flex gap-2">
              {MASCOT_LAYER_KINDS.map((slot) => (
                <PickSelect
                  key={slot}
                  rig={rig}
                  pick={pick}
                  slot={slot}
                  disabled={readOnly}
                  onPick={(layerId) => edit((current) => setMascotPick(current, pick, slot, layerId))}
                />
              ))}
            </div>
          </Row>
        ))}
        {warnings.length > 0 && <Row><PickWarnings rig={rig} warnings={warnings} /></Row>}
      </Section>
    </div>
  );

  return (
    // The morph source: the window grows out of the whole tab, and its contents move into the window.
    <div ref={panelRef} className="flex min-h-0 flex-1 flex-col pt-4">
      <PanelShell morph={morph} sourceRef={panelRef} title={MASCOT_COPY.title} showTitle={false}>
      {/* Moves with the contents, so the shortcut's own-element check holds inside the window too.
          Focus leaving a control closes the step a typed run or key nudge opened. */}
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={shortcut} onBlur={control.closeStep}>
      <fieldset disabled={off} className="m-0 min-w-0 flex-shrink-0 border-0 p-0">
      <PresetHeader
        label={copy.label}
        actions={presetActions}
        testId="mascot-preset-row"
        select={(
          <Select value={selected.id} onValueChange={control.select}>
            <SelectTrigger aria-label={copy.label} className="min-w-0 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEFAULT_MASCOT_ID}>{DEFAULT_MASCOT_NAME}</SelectItem>
              {control.store.mascots.map((mascot) => <SelectItem key={mascot.id} value={mascot.id}>{mascot.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />
      <input
        ref={cardInput}
        type="file"
        accept=".webp,image/webp"
        className="hidden"
        data-testid="mascot-card-input"
        onChange={pickCard}
      />
      </fieldset>
      <p className="flex-shrink-0 pt-1 text-helper text-muted-foreground">{copy.hint}</p>
      {/* The off line takes the columns' place; the rows stay mounted and disabled. Always mounted, so a screen reader announces it. */}
      <div role="status" data-testid="mascot-off-status" className={cn('flex items-center justify-center px-6 text-center', off && 'min-h-0 flex-1')}>
        {off && (
          <p className="text-helper text-muted-foreground">
            {MASCOT_COPY.off.before}
            <Button variant="link" className="h-auto p-0 text-helper" onClick={onOpenGeneral}>{MASCOT_COPY.off.link}</Button>
            {MASCOT_COPY.off.after}
          </p>
        )}
      </div>
      {/* A class, not the `hidden` attribute: the flex utility overrides `[hidden]`. */}
      <fieldset disabled={off} className={cn('m-0 flex min-h-0 min-w-0 flex-1 flex-col border-0 p-0', off && 'hidden')}>
      {/* From lg each column scrolls alone, so the preview stays in view; under it one scroller holds both. */}
      {wide ? (
        <div data-fq-mascot-columns="" className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-6 ${morph.contentInOverlay ? COLUMNS_FULL_SCREEN : COLUMNS_DOCKED}`}>
          <ScrollArea landingRoom type="auto" className="min-h-0" viewportProps={{ 'data-fq-scroll': 'mascot-preview' }}>
            <div className="py-4">{previewWidget}</div>
          </ScrollArea>
          <ScrollArea type="auto" className="min-h-0" viewportProps={{ 'data-fq-scroll': 'mascot-controls' }}>
            {controlsColumn}
          </ScrollArea>
        </div>
      ) : (
        <ScrollArea landingRoom type="auto" className="min-h-0 flex-1" viewportProps={{ 'data-fq-scroll': 'mascot-tab' }}>
          <div className="pt-4">{previewWidget}</div>
          {controlsColumn}
        </ScrollArea>
      )}
      </fieldset>
      <fieldset disabled={off} className="m-0 flex min-w-0 flex-shrink-0 items-center justify-end gap-2 border-0 border-t border-border p-0 py-3" data-testid="mascot-footer">
        <div className="mr-auto flex gap-1">
          <RowAction copy={MASCOT_COPY.footer.undo} disabled={!control.canUndo} onClick={control.undo}>
            <Undo2 className="h-4 w-4" aria-hidden />
          </RowAction>
          <RowAction copy={MASCOT_COPY.footer.redo} disabled={!control.canRedo} onClick={control.redo}>
            <Redo2 className="h-4 w-4" aria-hidden />
          </RowAction>
        </div>
        <Button variant="outline" disabled={!control.dirty} onClick={() => { setSelection(null); control.cancel(); }}>{MASCOT_COPY.footer.cancel}</Button>
        <Button disabled={!control.dirty} onClick={control.save}>{MASCOT_COPY.footer.save}</Button>
      </fieldset>
      <PresetNameDialog
        open={renaming}
        mode="rename"
        initialName={selected.name}
        onOpenChange={setRenaming}
        onSubmit={control.rename}
      />
      </div>
      </PanelShell>
    </div>
  );
}
