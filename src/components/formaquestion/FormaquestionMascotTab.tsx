import { useRef, useState, type ReactNode } from 'react';
import { verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragEndEvent } from '@dnd-kit/core';
import { Plus, RotateCcw, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditorRow, EditorRowList } from '@/components/EditorRow';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';
import { CheckRow, OptionSwitcher, Row, Section } from '@/components/SettingsRows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageUpload } from '@/lib/UtilityComponents';
import { randomUUID } from '@/lib/uuid';
import { useMountedRef } from '@/lib/useMountedRef';
import type { HelpSettings, HelpSettingsChange } from '@/lib/formaquestion/helpSettings';
import {
  DEFAULT_MASCOT_RIG, composeMascot, type MascotImageRef, type MascotLayer, type MascotLayerKind, type MascotMask, type MascotRig,
} from '@/lib/formaquestion/mascot';
import { cropFrame, fitMask, headSize, maskFromDrag, type MascotPoint, type MascotSize } from '@/lib/formaquestion/mascotMask';
import { HEAD_HEIGHT } from '@/lib/formaquestion/windowBox';
import { addMascotImage, clearMascotImages, deleteMascotImage } from '@/lib/formaquestion/mascotImageStore';
import {
  addMascotLayer, addMascotOverlays, mascotImageRefs, moveMascotLayer, moveMascotOverlay, orphanedMascotImages, removeMascotBase,
  removeMascotLayer, removeMascotOverlay, setMascotBase, updateMascotLayer, type MascotLayerPatch,
} from '@/lib/formaquestion/mascotRigEdits';
import { MascotPiece } from './MascotPiece';
import { usePointerDrag } from './usePointerDrag';
import { useMascotImageUrls } from './useMascotImageUrls';
import { MASCOT_COPY } from './formaquestionSettingsTabs';

const PREVIEW_HEIGHT = 240;

/** A Mask drag: where it started in base pixels, the box it gives now, and the preview's box on screen. */
interface MaskPress {
  from: MascotPoint;
  latest: MascotMask | null;
  rect: DOMRect;
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

function SortableOverlay({ index, image, urlOf, onRemove }: {
  index: number;
  image: MascotImageRef;
  urlOf: UrlOf;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, ...drag } = useSortable({ id: overlayId(index) });
  return (
    <EditorRow
      setNodeRef={setNodeRef}
      style={dragStyle(drag)}
      gripProps={{ ...attributes, ...listeners }}
      selected={false}
      onSelect={() => undefined}
      icon={<Thumb url={urlOf(image)} />}
      label={image.kind === 'bundled' ? image.name : MASCOT_COPY.storedOverlay}
      meta={image.kind === 'bundled' ? MASCOT_COPY.bundledOverlay : undefined}
      actions={[{ icon: <X className="h-4 w-4" />, title: MASCOT_COPY.removeOverlay, onClick: onRemove }]}
    />
  );
}

/** The expanded body of a layer row: its name, its kind, and its overlays in draw order. */
function LayerBody({ layer, urlOf, onPatch, onAddFiles, onRemoveOverlay, onMoveOverlay }: {
  layer: MascotLayer;
  urlOf: UrlOf;
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
              <EditorRowList>
                {layer.images.map((image, index) => (
                  <SortableOverlay key={overlayId(index)} index={index} image={image} urlOf={urlOf} onRemove={() => onRemoveOverlay(index)} />
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

function SortableLayer({ layer, expanded, urlOf, onToggle, onPatch, onRemove, children }: {
  layer: MascotLayer;
  expanded: boolean;
  urlOf: UrlOf;
  onToggle: () => void;
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
        selected={expanded}
        onSelect={onToggle}
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
            <span className="flex gap-0.5">{layer.images.map((image, index) => <Thumb key={index} url={urlOf(image)} />)}</span>
          </span>
        }
        actions={[{ icon: <X className="h-4 w-4" />, title: MASCOT_COPY.removeLayer, onClick: onRemove }]}
      />
      {expanded && children}
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [base, setBase] = useState<MascotSize | null>(null);
  /** The box a Mask drag gives while it runs. The rig takes it on release. */
  const [draftMask, setDraftMask] = useState<MascotMask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Bumped by Reset, so an upload that started before it lands nowhere.
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
    setExpanded(null);
    void clearMascotImages().catch((cause: unknown) => console.error('Could not clear the mascot images:', cause));
  };

  const shownLayer = rig.layers.find((row) => row.id === expanded);
  // An answer with no face from the AI draws the Idle look.
  const preview = shownLayer ? [rig.base, ...shownLayer.images] : composeMascot(rig, 'answering', null);
  const patchLayer = (id: string) => (patch: MascotLayerPatch) => edit((current) => updateMascotLayer(current, id, patch));

  const mask = base && fitMask(draftMask ?? rig.mask, base);
  const maskDrag = usePointerDrag<MaskPress>({
    start: (event) => {
      if (event.button !== 0 || !base) return null;
      const rect = event.currentTarget.getBoundingClientRect();
      return { from: basePoint(event, rect, base), latest: null, rect };
    },
    move: (press, event) => {
      if (!base) return;
      press.latest = maskFromDrag(press.from, basePoint(event, press.rect, base), base);
      setDraftMask(press.latest);
    },
    end: (press, canceled) => {
      setDraftMask(null);
      const next = press.latest;
      if (next && !canceled) edit((current) => ({ ...current, mask: next }));
    },
  });

  const handleLayerDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) edit((current) => moveMascotLayer(current, String(active.id), String(over.id)));
  };

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-6 py-4">
        <Section title="Mascot">
          <CheckRow htmlFor="fq-mascot" checked={settings.mascot} onChange={(mascot) => onChange({ mascot })} {...MASCOT_COPY.mascot} />
        </Section>
        <Section title="Rig">
          <Row {...MASCOT_COPY.preview}>
            <div className="flex justify-center rounded-md border border-border bg-muted/30 p-2" style={{ minHeight: PREVIEW_HEIGHT + 16 }}>
              <div {...maskDrag} data-fq-mask-target="" className="relative cursor-crosshair touch-none select-none">
                <MascotPiece
                  images={preview}
                  hold={refs}
                  size={base && { w: Math.round((PREVIEW_HEIGHT * base.width) / base.height), h: PREVIEW_HEIGHT }}
                  onBase={setBase}
                />
                {base && mask && (
                  <div
                    aria-hidden
                    data-fq-mask-box=""
                    className="pointer-events-none absolute rounded-sm border-2 border-dashed border-primary"
                    style={{
                      left: `${(mask.x / base.width) * 100}%`,
                      top: `${(mask.y / base.height) * 100}%`,
                      width: `${(mask.width / base.width) * 100}%`,
                      height: `${(mask.height / base.height) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </Row>
          <Row {...MASCOT_COPY.headView}>
            <div className="flex justify-center rounded-md border border-border bg-muted/30 p-2" style={{ minHeight: HEAD_HEIGHT + 16 }}>
              <MascotPiece
                view="head"
                images={preview}
                hold={refs}
                size={mask && headSize(mask, HEAD_HEIGHT)}
                frame={base && mask ? cropFrame(mask, base) : undefined}
                onBase={setBase}
              />
            </div>
          </Row>
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
                  <EditorRowList>
                    {rig.layers.map((layer) => (
                      <SortableLayer
                        key={layer.id}
                        layer={layer}
                        expanded={expanded === layer.id}
                        urlOf={urlOf}
                        onToggle={() => setExpanded((open) => (open === layer.id ? null : layer.id))}
                        onPatch={patchLayer(layer.id)}
                        onRemove={() => edit((current) => removeMascotLayer(current, layer.id))}
                      >
                        <LayerBody
                          layer={layer}
                          urlOf={urlOf}
                          onPatch={patchLayer(layer.id)}
                          onAddFiles={(files) => void store(files, (current, refs) => addMascotOverlays(current, layer.id, refs))}
                          onRemoveOverlay={(index) => edit((current) => removeMascotOverlay(current, layer.id, index))}
                          onMoveOverlay={(from, to) => edit((current) => moveMascotOverlay(current, layer.id, from, to))}
                        />
                      </SortableLayer>
                    ))}
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
                  setExpanded(id);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />{MASCOT_COPY.addLayer}
              </Button>
              {error && <p className="text-helper text-destructive">{error}</p>}
            </div>
          </Row>
          <Row hint={MASCOT_COPY.reset.hint}>
            <Button variant="outline" size="sm" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="mr-1 h-4 w-4" />{MASCOT_COPY.reset.label}
            </Button>
          </Row>
        </Section>
      </div>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={MASCOT_COPY.reset.confirmTitle}
        description={MASCOT_COPY.reset.confirmBody}
        onConfirm={reset}
      />
    </ScrollArea>
  );
}
