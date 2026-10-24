import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EditorDndContext, StableSortableContext } from '@/components/dnd/EditorDndContext';

const NO_MODIFIERS: never[] = [];
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Eye, Plus, Star, TriangleAlert } from "lucide-react";
import { ImageRuleCog, ImageRuleSummary, useHasRuleSource, type RuleHost } from '@/components/editor/ImageRuleCog';
import AiGenerateButton from "@/components/AiGenerateButton";
import TagField from "@/components/prompt/TagField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUpload } from '../lib/UtilityComponents';
import { fileToDataUrl } from '@/lib/imageDrop';
import { followReorder } from '@/lib/imageGalleryOrder';
import { withImageRule } from '@/lib/entityImages';
import { useStableIds } from '@/lib/useStableIds';
import { useImageDropTarget } from '@/lib/useImageDropTarget';
import { RemoteImg } from '@/lib/useRemoteImage';
import { ImageConvertOverlay } from '@/components/ImageConvertOverlay';
import { cn } from '@/lib/utils';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { applyImageOptimize } from '@/lib/imageOptim';
import { GenerateImageButton } from '../components/GenerateImageButton';
import type { ImageCap } from '../lib/imageOptim';
import type { ImageSubjectKind } from '@/lib/imagePrompt';
import { useEditorMode } from '@/lib/editorMode';
import type { GalleryImage, Placeholder, TraitRequirementRow } from '@/types';
import { Tip } from '@/components/ui/tooltip';
import { fieldFrame } from '@/lib/historyField';

interface ImageWidgetProps {
  /** Field label above the upload — "Background Image" for locations, "Image" for entities. */
  label: string;
  /** The Authoring Tour's `data-tour-anchor` for the widget, when a step points at it. */
  tourAnchor?: string;
  /** The pictures this subject carries, in order; slot 0 is the primary. */
  images: GalleryImage[];
  onImagesChange: (next: GalleryImage[]) => void;
  /** How many pictures may be held. One (the default) renders as a plain single upload with no gallery chrome.
   *  Pass Infinity for an unbounded gallery. */
  slots?: number;
  /** Stable id for the file input (must be unique per rendered subject). */
  imageId: string;
  cap: ImageCap;
  /** The subject's description feeds the AI tag/prompt generators. Its name deliberately does not — a name
   *  comes back as a tag no image model knows; an author who wants one types it into the tags. */
  description?: string;
  kind: ImageSubjectKind;
  /** The subject's name for a generated image's file name on the image server; never sent to the model. */
  fileSubject?: string;
  tags?: string;
  onTagsChange: (value: string) => void;
  /** The world's (or the standalone item's) placeholders, so a tag can be one. None simply means no chip
   *  is ever drawn — the field is the same either way. */
  placeholders?: Placeholder[];
  /** The entity or location whose tags these are — see `ownerId` on `PlaceholderField`. */
  ownerId?: string;
  /** Whose images carry Visibility rules. Set, each tile gets a cog, a badge and a summary where a rule source
   *  exists. Keep the object stable across renders. */
  ruleHost?: RuleHost;
  /** The framed slot, for a host that shows the framed image's details. Unset, the gallery keeps its own. */
  framed?: number;
  onFramedChange?: (index: number) => void;
  /** False hides the strip's rule cog and the framed rule's summary, for a host that edits the rule itself. */
  ruleCog?: boolean;
}

/** The inputs a host passes to control the gallery's frame and cog. */
export type GalleryFrameProps = Pick<ImageWidgetProps, 'framed' | 'onFramedChange' | 'ruleCog'>;

const WidgetContext = createContext<ImageWidgetProps | null>(null);

const useImageWidget = () => {
  const props = useContext(WidgetContext);
  if (!props) throw new Error('ImageGallery and ImageTags must be rendered inside an ImageWidget.');
  return props;
};

/**
 * Holds the subject one image widget acts on, so its two pieces can sit in different boxes of a layout and
 * still write the same record. A host that wants them together uses `ImageTagsField` instead.
 */
export const ImageWidget = ({ children, ...props }: ImageWidgetProps & { children?: ReactNode }) => (
  <WidgetContext.Provider value={props}>{children}</WidgetContext.Provider>
);

/** The big frame the gallery shows its picture in. A character is drawn portrait, a place landscape — the
 *  same split the image generator already uses when it picks dimensions. */
const FRAME_CLASS = {
  portrait: 'aspect-[3/4] w-full rounded-md',
  landscape: 'aspect-video w-full rounded-md',
};

/** The width cap lives on the wrapper, not the frame, so the batch overlay anchored to it covers exactly the
 *  picture rather than the whole column. */
const FRAME_WIDTH = { portrait: 'mx-auto max-w-[300px]', landscape: 'mx-auto max-w-[400px]' };

/** One image's Visibility rule as a tile edits it. */
interface TileRule {
  host: RuleHost;
  rows: TraitRequirementRow[];
  onChange: (rows: TraitRequirementRow[]) => void;
}

/** One picture in the strip. Click frames it; drag reorders it — position 0 is what stands in wherever a
 *  single picture is shown, so dragging to the front is the whole promote gesture. A cog on hover sets the
 *  picture's Visibility rule, and a badge marks one that has a rule. The cog sits beside the tile's button,
 *  not inside it, and the button alone drags. */
const ImageTile = ({ id, url, index, framed, onSelect, ruled, rule }: {
  id: string;
  url: string;
  index: number;
  framed: boolean;
  onSelect: () => void;
  /** Whether the image has a rule, badged even where the cog is hidden. */
  ruled: boolean;
  rule?: TileRule;
}) => {
  const { setNodeRef, setActivatorNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({ id });
  const primary = index === 0;
  const name = primary ? 'Primary image' : `Image ${index + 1}`;
  return (
    <div
      ref={setNodeRef}
      // Translate, not Transform: the latter bakes in dnd-kit's slot-fit scale and resizes the dragged tile.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('group relative h-14 w-14 shrink-0', isDragging && 'opacity-50')}
    >
      {/* The tip explains the tile; the short spoken name stays on the button. */}
      <Tip
        tip={primary
          ? 'Primary. Shown wherever one image is needed. Drag to reorder.'
          : `Image ${index + 1}. Drag to reorder.`}
        labelsChild={false}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          onClick={onSelect}
          aria-label={ruled ? `${name}, has a Visibility rule` : name}
          aria-pressed={framed}
          className={cn(
            'relative h-full w-full overflow-hidden rounded-md border-2 touch-none',
            framed ? 'border-primary' : 'border-border hover:border-muted-foreground',
          )}
        >
          <RemoteImg src={url} alt="" className="h-full w-full object-cover" />
          {primary && (
            <span className="absolute bottom-0 right-0 rounded-tl bg-overlay/70 p-0.5 text-white">
              <Star className="h-2.5 w-2.5 fill-current" />
            </span>
          )}
          {ruled && (
            <span data-image-rule-badge="" aria-hidden className="absolute bottom-0 left-0 rounded-tr bg-overlay/70 p-0.5 text-white">
              <Eye className="h-2.5 w-2.5" />
            </span>
          )}
        </button>
      </Tip>
      {rule && <ImageRuleCog {...rule} className="absolute right-0.5 top-0.5" />}
    </div>
  );
};

/** The strip's trailing tile: press it to add, or drop onto it. A label on the open slot's file input, so
 *  one press opens the picker. */
const AddTile = ({ htmlFor, selected, onSelect, onUrl, onFiles }: {
  htmlFor: string;
  selected: boolean;
  onSelect: () => void;
  onUrl: (url: string) => void;
  onFiles: (files: File[]) => void;
}) => {
  // Targeting this tile frames the slot it fills, so the picture doesn't convert on top of whichever one
  // happened to be on show — and the frame is already on the new picture when it lands.
  const { dragOver, dropProps } = useImageDropTarget({ enabled: true, onUrl, onFiles, onTargeted: onSelect });
  return (
    <Label
      htmlFor={htmlFor}
      className="cursor-pointer"
      {...dropProps}
      onClick={onSelect}
      title="Add an Image"
      aria-label="Add an Image"
    >
      <span
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 border-dashed',
          dragOver || selected ? 'border-primary' : 'border-border hover:border-muted-foreground',
        )}
      >
        <Plus className="h-5 w-5 text-muted-foreground" />
      </span>
    </Label>
  );
};

/** `list` with slot `index` showing `data` under the slot's own rule; an empty `data` drops the slot and its rule. */
function withSlotData(list: readonly GalleryImage[], index: number, data: string): GalleryImage[] {
  const next: (GalleryImage | undefined)[] = [...list];
  next[index] = data ? { ...list[index], data } : undefined;
  return next.filter((img): img is GalleryImage => !!img);
}

/**
 * The picture half of the widget: the image-upload → embedded-prompt confirmation → generate-image stack
 * shared by the Location and Entity editors. Owns the `pendingPrompt` handshake: an uploaded image's
 * embedded SD prompt is held until the user confirms using it as the Image Tags (which replaces the current
 * tags).
 *
 * With more than one slot it authors a gallery: one framed picture with a strip of tiles beneath it, the
 * last tile adding. Clicking a tile frames it; dragging reorders, which is also how the stand-in picture is
 * chosen, since that is simply the first. Tag generation acts on the subject as a whole rather than on any one
 * slot; a generated picture fills a free slot, and asks which one it replaces when there is none.
 *
 * `tagsSlot` is the line between the picture strip and the Generate button. A host that keeps the tags under
 * the picture passes `ImageTags` there; a host that places them elsewhere passes nothing and draws the piece
 * itself. It is a named slot rather than `children` so that it cannot be confused with `ImageWidget`'s, which
 * takes the host's whole layout.
 */
export const ImageGallery = ({ tagsSlot }: { tagsSlot?: ReactNode }) => {
  const {
    label, images, onImagesChange, slots = 1, imageId, cap, description, kind, fileSubject, tags, onTagsChange, tourAnchor, ruleHost,
    framed, onFramedChange, ruleCog = true,
  } = useImageWidget();
  const ruleSourced = useHasRuleSource();
  // SD prompt pulled from an uploaded image, pending the user's OK to use it as Image Tags.
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  // A generated picture with nowhere free to go, held while the user picks the slot it replaces.
  const [pendingGenerated, setPendingGenerated] = useState<string | null>(null);
  const [overwriteSlot, setOverwriteSlot] = useState(0);
  // Answers the generate dialog's accept: it stays open on its preview until this settles, so a cancelled
  // pick comes back to the picture rather than throwing it away.
  const settlePlacement = useRef<((placed: boolean) => void) | null>(null);
  // Booru tags are Advanced-only; so is the offer to adopt an uploaded image's embedded prompt as them.
  const { advanced } = useEditorMode();
  // The batch consent prompt for a multi-file drop. Each ImageUpload still owns the single-file one.
  const { promptImagesBatch, dialog: batchDialog } = useDownscalePrompt();

  // Filled slots, plus a trailing empty one to upload into while there is room.
  const shownImages = images.slice(0, slots);
  const shown = shownImages.map((img) => img.data);
  const rows = shown.length < slots ? [...shown, ''] : shown;
  // One slot renders as the plain uploader it always was; several earn the frame-and-strip pane.
  const gallery = slots > 1;
  // A character is drawn portrait, a place landscape — the same split the image generator uses for its dimensions.
  const shape = kind === 'character' ? 'portrait' : 'landscape';

  // The batch of dropped pictures being re-encoded, covering the frame while it runs.
  const [batch, setBatch] = useState<{ thumb: string; done: number; total: number } | null>(null);

  // Which slot the big frame is showing. Stays in range as pictures are added and removed — a removed last
  // picture would otherwise leave the frame pointing past the end and showing nothing at all.
  const [ownSelected, setOwnSelected] = useState(0);
  const selected = framed ?? ownSelected;
  const setSelected = (i: number) => { setOwnSelected(i); onFramedChange?.(i); };
  const showing = Math.min(selected, rows.length - 1);
  const setShowing = (i: number) => setSelected(Math.max(0, i));

  /** The file input inside each slot's uploader is keyed off this, and the add tile points a label at it. */
  const slotId = (i: number) => (i === 0 ? imageId : `${imageId}-${i}`);

  /** The slot a drop or a generated picture lands in: the trailing empty one, or none once the gallery is full. */
  const openSlot = rows.findIndex((url) => !url);

  /** Write one slot; an emptied slot drops out rather than leaving a hole for the next one to fall into. */
  const setSlot = (index: number, value: string) => onImagesChange(withSlotData(shownImages, index, value));

  /** Write one slot's Visibility rule; an emptied rule drops the field. */
  const setRule = (index: number, requires: TraitRequirementRow[]) => onImagesChange(withImageRule(shownImages, index, requires));
  const rulable = gallery && !!ruleHost;
  const tileRule = (i: number): TileRule | undefined => (rulable && ruleSourced && ruleCog
    ? { host: ruleHost, rows: shownImages[i].requires ?? [], onChange: (rows) => setRule(i, rows) }
    : undefined);
  const framedRule = rulable && ruleSourced && ruleCog ? shownImages[showing]?.requires : undefined;
  const tileRuled = (i: number) => rulable && ruleSourced && !!shownImages[i].requires?.length;
  // Only an entity's primary stands in outside play, where no rule reads.
  const coverRuled = rulable && ruleHost.kind === 'entity' && !!shownImages[0]?.requires?.length;

  /** Take a generated picture. It fills the open slot where there is one, and otherwise asks which picture it
   *  replaces, resolving false if the author decides it replaces none of them. */
  const placeGenerated = (url: string) => {
    if (openSlot !== -1) {
      setSlot(openSlot, url);
      setShowing(openSlot);
      return true;
    }
    // Start on the framed picture: the one being looked at is the one the author means to replace.
    setOverwriteSlot(showing);
    setPendingGenerated(url);
    return new Promise<boolean>((resolve) => { settlePlacement.current = resolve; });
  };

  /** Settle the pick, writing the slot only when one was confirmed. */
  const closeOverwrite = (confirmed: boolean) => {
    if (confirmed && pendingGenerated) {
      setSlot(overwriteSlot, pendingGenerated);
      setShowing(overwriteSlot);
    }
    setPendingGenerated(null);
    settlePlacement.current?.(confirmed);
    settlePlacement.current = null;
  };

  /** Several pictures dropped at once: they fill this slot and the ones after it, with a single consent
   *  prompt for the batch — a five-file drop raising five modals would be a worse gesture than five clicks.
   *  Files past the slot count are not taken. */
  const takeFiles = async (index: number, files: File[]) => {
    const accepted = files.slice(0, slots - index);
    if (!accepted.length) return;
    const urls = await Promise.all(accepted.map(fileToDataUrl));
    const mode = await promptImagesBatch(urls, cap);
    let stored = urls;
    if (mode !== 'off') {
      // One at a time, so "3 of 5" counts something real. They share one worker anyway, so running them
      // together would only make the bar jump from nothing to done.
      stored = [];
      // Shown from the files themselves; the data URLs they encode to are far too large to hand an <img>.
      const thumbs = accepted.map((f) => URL.createObjectURL(f));
      try {
        for (const [k, url] of urls.entries()) {
          setBatch({ thumb: thumbs[k], done: k, total: urls.length });
          stored.push((await applyImageOptimize(url, mode, cap)) ?? url);
        }
      } finally {
        setBatch(null);
        thumbs.forEach(URL.revokeObjectURL);
      }
    }
    onImagesChange(stored.reduce((next, url, k) => withSlotData(next, index + k, url), shownImages));
  };

  // The pane behind the framed picture. A framed picture refuses drops itself, so without this a drag over
  // the gallery matched nothing at all — no highlight anywhere, and the dragged thumbnail hanging over a
  // picture it was never going to replace. Bringing the open slot into the frame on the way in shows where
  // the drop is actually going; the slot then handles the drag itself, and stops it reaching here again.
  const pane = useImageDropTarget({
    enabled: gallery && openSlot !== -1 && !batch,
    onUrl: (url) => setSlot(openSlot, url),
    onFiles: (files) => void takeFiles(openSlot, files),
    onTargeted: () => setShowing(openSlot),
  });
  const paneProps = gallery ? pane.dropProps : {};

  // Ids that follow the picture, not the position. Keyed by position, React rewrites each tile's contents
  // instead of moving any node, so on drop the dragged tile snapped back before the new order appeared.
  // The picture itself can't be the id: it is a data URL megabytes long, and two copies of one picture
  // would collide into a single id.
  const tileIds = useStableIds(shown);
  /** Reordering is the whole promote gesture: slot 0 is what stands in wherever one picture is shown, and
   *  the order is the order the game shows them in. */
  const handleReorder = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = tileIds.indexOf(String(active.id));
    const to = tileIds.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onImagesChange(arrayMove(shownImages, from, to));
    // Follow the picture, not the position — otherwise dragging the framed one leaves the frame behind.
    setSelected(followReorder(showing, from, to));
  };

  return (
    <div className="space-y-2" data-tour-anchor={tourAnchor}>
      {batchDialog}
      <Label>{label}</Label>
      {/* Every slot is rendered and only the shown one is visible, rather than mounting the selected slot
          alone: the add tile is a label pointing at the empty slot's file input, which has to exist for the
          click to reach it, and a remounting uploader would lose a half-typed URL on every tile press. */}
      {/* The pane rings itself on the very first dragover, which is the one that swaps the frame — the slot
          it swapped to only learns about the drag on the next event, ~a third of a second later. The wrapper
          is the frame's own box, so the ring lands in the same place either way. */}
      <div
        className={cn('relative rounded-md', gallery && FRAME_WIDTH[shape], pane.dragOver && 'ring-2 ring-primary')}
        {...paneProps}
      >
      {/* Keyed by the image, not the position. Keyed by position, a reorder hands each slot a different
          value instead of moving it — and an uploader's resolved src lags its value by a render, so the
          newly framed slot showed the previous image for a frame before swapping. */}
      {rows.map((url, i) => (
        <div key={url ? tileIds[i] : 'empty-slot'} className={cn('space-y-1', gallery && i !== showing && 'hidden')}>
          <ImageUpload
            onChange={(value) => setSlot(i, value)}
            id={slotId(i)}
            value={url}
            cap={cap}
            // The gallery gives the picture a frame worth looking at; a single slot keeps its compact box.
            previewClassName={gallery ? FRAME_CLASS[shape] : undefined}
            // Only the primary offers its embedded prompt as the tags: the tags describe the subject, and a
            // later slot overwriting them would undo the choice made for the picture that represents it.
            onPromptExtracted={i === 0 && advanced ? setPendingPrompt : undefined}
            // Only a gallery can take several at once; a single-slot subject keeps the first file.
            onFiles={gallery ? (files) => void takeFiles(i, files) : undefined}
          />
        </div>
      ))}
      {batch && <ImageConvertOverlay thumb={batch.thumb} done={batch.done} total={batch.total} />}
      </div>

      {gallery && (
        // Frozen while a batch converts: the slots the pictures are landing in are still being written, so
        // reframing or reordering mid-run would act on a list about to change under it.
        <div className={cn('flex flex-wrap items-center gap-2', batch && 'pointer-events-none opacity-50')}>
          {/* No modifiers and no auto-scroll, matching KeywordChips: this strip sits inside the entity
              editor's ScrollArea, where dnd-kit's auto-scroll chases the dragged item into empty space and
              an empty collision result flips the sort gap every frame. */}
          <EditorDndContext modifiers={NO_MODIFIERS} autoScroll={false} onDragEnd={handleReorder}>
            {/* rectSortingStrategy (2D), not a single-row one: the strip wraps once there are enough. */}
            <StableSortableContext items={tileIds} strategy={rectSortingStrategy}>
              {shown.map((url, i) => (
                <ImageTile
                  key={tileIds[i]}
                  id={tileIds[i]}
                  url={url}
                  index={i}
                  framed={i === showing}
                  onSelect={() => setShowing(i)}
                  ruled={tileRuled(i)}
                  rule={tileRule(i)}
                />
              ))}
            </StableSortableContext>
          </EditorDndContext>
          {/* Outside the sortable set: dropping a picture onto "add" would mean nothing. */}
          {openSlot !== -1 && (
            <AddTile
              htmlFor={`image-upload-${slotId(openSlot)}`}
              selected={openSlot === showing}
              onSelect={() => setShowing(openSlot)}
              onUrl={(dropped) => setSlot(openSlot, dropped)}
              onFiles={(files) => void takeFiles(openSlot, files)}
            />
          )}
        </div>
      )}
      {ruleHost && framedRule?.length ? <ImageRuleSummary host={ruleHost} rows={framedRule} /> : null}
      {coverRuled && (
        <p data-image-rule-cover-warning="" className="flex items-start gap-1 text-helper text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          The primary image ignores its rule outside play
        </p>
      )}
      <ConfirmDialog
        open={pendingPrompt !== null}
        onOpenChange={(o) => { if (!o) setPendingPrompt(null); }}
        title="Use the image's prompt?"
        description="This image has an embedded AI prompt. Use it as the Image Tags? This replaces the current tags."
        onConfirm={() => { if (pendingPrompt) onTagsChange(pendingPrompt); setPendingPrompt(null); }}
        onCancel={() => setPendingPrompt(null)}
      />
      {tagsSlot}
      <GenerateImageButton
        subject={{ description: description || '', kind, name: fileSubject }}
        cap={cap}
        onChange={placeGenerated}
        tags={tags ?? ''}
        onTagsChange={onTagsChange}
      />
      <ReplaceImageDialog
        open={pendingGenerated !== null}
        images={shown}
        slot={overwriteSlot}
        onSlotChange={setOverwriteSlot}
        idPrefix={imageId}
        onClose={closeOverwrite}
      />
    </div>
  );
};

/** Asks which held image a generated one takes the place of. `onClose(true)` replaces the picked slot. */
export function ReplaceImageDialog({ open, images, slot, onSlotChange, idPrefix, onClose }: {
  open: boolean;
  images: string[];
  slot: number;
  onSlotChange: (slot: number) => void;
  idPrefix: string;
  onClose: (replace: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(false); }}>
      <DialogContent surface="imageReplace" className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Replace which image?</DialogTitle>
          <DialogDescription>
            There is no free slot for the generated image. Choose the one it takes the place of.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup value={String(slot)} onValueChange={(v) => onSlotChange(Number(v))}>
          {images.map((url, i) => (
            <Label
              key={i}
              htmlFor={`${idPrefix}-overwrite-${i}`}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:border-muted-foreground"
            >
              <RadioGroupItem value={String(i)} id={`${idPrefix}-overwrite-${i}`} />
              <RemoteImg src={url} alt="" className="h-12 w-12 rounded object-cover" />
              <span>{i === 0 ? 'Primary' : `Image ${i + 1}`}</span>
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onClose(false)}>Cancel</Button>
          <Button type="button" onClick={() => onClose(true)}>Replace</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The tags half of the widget: the booru Image Tags line with its AI tag writer. Advanced only, as the tags
 * themselves are. It reads the same subject the gallery does, so an adopted embedded prompt and generated
 * tags land here wherever the host draws it.
 */
export const ImageTags = () => {
  const { tags, onTagsChange, placeholders = [], ownerId, description, kind } = useImageWidget();
  const { advanced } = useEditorMode();
  if (!advanced) return null;
  return (
    <div {...fieldFrame('imageTags')}>
      <TagField
        label="Image Tags"
        value={tags || ''}
        onChange={onTagsChange}
        placeholders={placeholders}
        ownerId={ownerId}
        placeholder="booru tags, comma separated"
        aside={<AiGenerateButton mode="tags" kind={kind} source={description} onChange={onTagsChange} />}
      />
    </div>
  );
};

/** The whole widget in one box: the gallery with its tags between the picture strip and the Generate button. */
const ImageTagsField = (props: ImageWidgetProps) => (
  <ImageWidget {...props}>
    <ImageGallery tagsSlot={<ImageTags />} />
  </ImageWidget>
);

export default ImageTagsField;
