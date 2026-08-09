import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Star } from "lucide-react";
import AiGenerateButton from "@/components/AiGenerateButton";
import TagHistoryButtons from "@/components/TagHistoryButtons";
import { useTagHistory } from "@/lib/useTagHistory";
import TagChipField from "@/components/prompt/TagChipField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUpload } from '../lib/UtilityComponents';
import { isRemoteImage } from '@/lib/imageBytes';
import { fileToDataUrl } from '@/lib/imageDrop';
import { useImageDropTarget } from '@/lib/useImageDropTarget';
import { RemoteImg } from '@/lib/useRemoteImage';
import { cn } from '@/lib/utils';
import { useDownscalePrompt } from '@/lib/useDownscalePrompt';
import { applyImageOptimize } from '@/lib/imageOptim';
import { GenerateImageButton } from '../components/GenerateImageButton';
import type { ImageCap } from '../lib/imageOptim';
import type { ImageSubjectKind } from '@/lib/imagePrompt';
import { useEditorMode } from '@/lib/editorMode';
import type { Placeholder } from '@/types';

interface ImageTagsFieldProps {
  /** Field label above the upload — "Background Image" for locations, "Image" for entities. */
  label: string;
  /** The pictures this subject carries, in order; slot 0 is the primary. */
  images: string[];
  onImagesChange: (next: string[]) => void;
  /** How many pictures may be held. One (the default) renders as a plain single upload with no gallery chrome.
   *  Pass Infinity for a gallery bounded only by `embeddedLimit`. */
  slots?: number;
  /** How many of those may carry their own bytes. Defaults to `slots`, i.e. no separate allowance for links. */
  embeddedLimit?: number;
  /** Stable id for the file input (must be unique per rendered subject). */
  imageId: string;
  cap: ImageCap;
  /** The subject's description feeds the AI tag/prompt generators. Its name deliberately does not — a name
   *  comes back as a tag no image model knows; an author who wants one types it into the tags. */
  description?: string;
  kind: ImageSubjectKind;
  tags?: string;
  onTagsChange: (value: string) => void;
  /** The world's (or the standalone item's) placeholders, so a tag can be one. None simply means no chip
   *  is ever drawn — the field is the same either way. */
  placeholders?: Placeholder[];
}

/** The big frame the gallery shows its picture in. A character is drawn portrait, a place landscape — the
 *  same split the image generator already uses when it picks dimensions. */
const FRAME_CLASS = {
  portrait: 'relative mx-auto aspect-[3/4] w-full max-w-[300px] rounded-md',
  landscape: 'relative mx-auto aspect-video w-full max-w-[400px] rounded-md',
};

/** The strip's trailing tile: press it to add, or drop onto it. A label when the file picker is available,
 *  so one press opens it; a plain button once the upload allowance is spent, where it only reveals the URL
 *  box in the frame above. */
const AddTile = ({ htmlFor, selected, onSelect, onUrl, onFiles, allowFiles }: {
  htmlFor?: string;
  selected: boolean;
  onSelect: () => void;
  onUrl: (url: string) => void;
  onFiles: (files: File[]) => void;
  allowFiles: boolean;
}) => {
  const { dragOver, dropProps } = useImageDropTarget({ enabled: true, allowFiles, onUrl, onFiles });
  const body = (
    <span
      className={cn(
        'flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 border-dashed',
        dragOver || selected ? 'border-primary' : 'border-border hover:border-muted-foreground',
      )}
    >
      <Plus className="h-5 w-5 text-muted-foreground" />
    </span>
  );
  const shared = { ...dropProps, onClick: onSelect, title: 'Add a picture', 'aria-label': 'Add a picture' };
  return htmlFor
    ? <Label htmlFor={htmlFor} className="cursor-pointer" {...shared}>{body}</Label>
    : <button type="button" {...shared}>{body}</button>;
};

/**
 * The image-upload → embedded-prompt confirmation → booru Image Tags → generate-image stack shared by the
 * Location and Entity editors. Owns the `pendingPrompt` handshake: an uploaded image's embedded SD prompt is
 * held until the user confirms using it as the Image Tags (which replaces the current tags).
 *
 * With more than one slot it authors a gallery: one framed picture with a strip of tiles beneath it, the
 * last tile adding. Selecting a tile only changes which picture is framed; promoting one to primary is its
 * own press. Tag generation and image generation always act on the primary — they describe the subject, not
 * one picture of it.
 */
const ImageTagsField = ({ label, images, onImagesChange, slots = 1, embeddedLimit = slots, imageId, cap, description, kind, tags, onTagsChange, placeholders = [] }: ImageTagsFieldProps) => {
  // SD prompt pulled from an uploaded image, pending the user's OK to use it as Image Tags.
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  // Booru tags are Advanced-only; so is the offer to adopt an uploaded image's embedded prompt as them.
  const { advanced } = useEditorMode();
  // The tag inputs are plain controlled fields with no history of their own, so it lives here — stepped by
  // tag, with a generation (or an adopted embedded prompt) as one step.
  const tagHistory = useTagHistory(tags ?? '', onTagsChange);
  // The batch consent prompt for a multi-file drop. Each ImageUpload still owns the single-file one.
  const { promptImagesBatch, dialog: batchDialog } = useDownscalePrompt();

  // Filled slots, plus a trailing empty one to upload into while there is room.
  const shown = images.slice(0, slots);
  const rows = shown.length < slots ? [...shown, ''] : shown;
  // One slot renders as the plain uploader it always was; several earn the frame-and-strip pane.
  const gallery = slots > 1;

  // Which slot the big frame is showing. Stays in range as pictures are added and removed — a removed last
  // picture would otherwise leave the frame pointing past the end and showing nothing at all.
  const [selected, setSelected] = useState(0);
  const showing = Math.min(selected, rows.length - 1);
  const setShowing = (i: number) => setSelected(Math.max(0, i));

  /** The file input inside each slot's uploader is keyed off this, and the add tile points a label at it. */
  const slotId = (i: number) => (i === 0 ? imageId : `${imageId}-${i}`);

  // Only pictures carrying their own bytes count against the allowance; links are free to the payload.
  const embedded = shown.filter((url) => url && !isRemoteImage(url)).length;
  const canEmbed = embedded < embeddedLimit;
  // Generating writes over the primary, so it only adds bytes when that slot isn't already carrying some.
  const canGenerate = canEmbed || !!(shown[0] && !isRemoteImage(shown[0]));

  /** Write one slot; an emptied slot drops out rather than leaving a hole for the next one to fall into. */
  const setSlot = (index: number, value: string) => {
    const next = [...shown];
    next[index] = value;
    onImagesChange(next.filter(Boolean));
  };

  /** Several pictures dropped at once: they fill this slot and the ones after it, with a single consent
   *  prompt for the batch — a five-file drop raising five modals would be a worse gesture than five clicks.
   *  Files past the slot count or the embedded allowance are simply not taken. */
  const takeFiles = async (index: number, files: File[]) => {
    const room = Math.min(slots - index, embeddedLimit - embedded);
    const accepted = files.slice(0, Math.max(0, room));
    if (!accepted.length) return;
    const urls = await Promise.all(accepted.map(fileToDataUrl));
    const mode = await promptImagesBatch(urls, cap);
    const stored = await Promise.all(urls.map(async (url) => (await applyImageOptimize(url, mode, cap)) ?? url));
    const next = [...shown];
    stored.forEach((url, k) => { next[index + k] = url; });
    onImagesChange(next.filter(Boolean));
  };

  /** Swap a slot into the primary position, which is what makes it the entity's one-picture stand-in. */
  const makePrimary = (index: number) => {
    const next = [...shown];
    [next[0], next[index]] = [next[index], next[0]];
    onImagesChange(next.filter(Boolean));
  };

  return (
    <div className="space-y-2">
      {batchDialog}
      <Label>{label}</Label>
      {/* Every slot is rendered and only the shown one is visible, rather than mounting the selected slot
          alone: the add tile is a label pointing at the empty slot's file input, which has to exist for the
          click to reach it, and a remounting uploader would lose a half-typed URL on every tile press. */}
      {rows.map((url, i) => (
        <div key={i} className={cn('space-y-1', gallery && i !== showing && 'hidden')}>
          <ImageUpload
            onChange={(value) => setSlot(i, value)}
            id={slotId(i)}
            value={url}
            cap={cap}
            // The gallery gives the picture a frame worth looking at; a single slot keeps its compact box.
            previewClassName={gallery ? FRAME_CLASS[kind === 'character' ? 'portrait' : 'landscape'] : undefined}
            // Spent allowance closes the file picker on empty slots; the URL box stays, so a gallery can
            // still grow with links. A filled slot ignores this — it is changed by removing it first.
            allowUpload={canEmbed}
            uploadBlockedNote={`${embeddedLimit} uploaded picture${embeddedLimit === 1 ? '' : 's'} is the limit — add more as links instead.`}
            // Only the primary offers its embedded prompt as the tags: the tags describe the subject, and a
            // later slot overwriting them would undo the choice made for the picture that represents it.
            onPromptExtracted={i === 0 && advanced ? setPendingPrompt : undefined}
            // Only a gallery can take several at once; a single-slot subject keeps the first file.
            onFiles={gallery ? (files) => void takeFiles(i, files) : undefined}
          />
        </div>
      ))}

      {gallery && (
        <>
          {/* One tile per slot, the last being the one to add into. Selecting a tile only changes which
              picture is on show — promoting one is the separate, deliberate press below. */}
          <div className="flex flex-wrap items-center gap-2">
            {rows.map((url, i) => (url ? (
              <button
                key={i}
                type="button"
                onClick={() => setShowing(i)}
                title={i === 0 ? 'Primary picture' : `Picture ${i + 1}`}
                aria-label={i === 0 ? 'Primary picture' : `Picture ${i + 1}`}
                aria-pressed={i === showing}
                className={cn(
                  'relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2',
                  i === showing ? 'border-primary' : 'border-border hover:border-muted-foreground',
                )}
              >
                <RemoteImg src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-0 right-0 rounded-tl bg-overlay/70 p-0.5 text-white">
                    <Star className="h-2.5 w-2.5 fill-current" />
                  </span>
                )}
              </button>
            ) : (
              <AddTile
                key={i}
                htmlFor={canEmbed ? `image-upload-${slotId(i)}` : undefined}
                selected={i === showing}
                onSelect={() => setShowing(i)}
                onUrl={(dropped) => setSlot(i, dropped)}
                onFiles={(files) => void takeFiles(i, files)}
                allowFiles={canEmbed}
              />
            )))}
          </div>

          {/* Only for the picture being shown: promoting whichever tile is under the cursor would make the
              star a hover-target race, and this is the one action that reorders stored data. */}
          {rows[showing] && (
            showing === 0 ? (
              <span className="text-xs text-muted-foreground">Primary — shown wherever one picture fits.</span>
            ) : (
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => makePrimary(showing)}>
                <Star className="mr-1 h-3 w-3" />
                Make Primary
              </Button>
            )
          )}
        </>
      )}
      <ConfirmDialog
        open={pendingPrompt !== null}
        onOpenChange={(o) => { if (!o) setPendingPrompt(null); }}
        title="Use the image's prompt?"
        description="This image has an embedded AI prompt. Use it as the Image Tags? This replaces the current tags."
        onConfirm={() => { if (pendingPrompt) onTagsChange(pendingPrompt); setPendingPrompt(null); }}
        onCancel={() => setPendingPrompt(null)}
      />
      {advanced && (
      <>
      <div className="flex items-center justify-between">
        <Label className="leading-none">Image Tags</Label>
        <div className="flex items-center gap-1">
          <AiGenerateButton mode="tags" kind={kind} source={description} onChange={onTagsChange} />
          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
          <TagHistoryButtons history={tagHistory} />
        </div>
      </div>
      <TagChipField
        value={tags || ''}
        onChange={onTagsChange}
        placeholders={placeholders}
        placeholder="booru tags, comma separated"
        ariaLabel="Image Tags"
      />
      </>
      )}
      {/* A generated picture lands in the primary slot as bytes, so it answers to the same allowance. */}
      {canGenerate && (
        <GenerateImageButton
          subject={{ description: description || '', kind }}
          cap={cap}
          onChange={(value) => setSlot(0, value)}
          tags={tags ?? ''}
          onTagsChange={onTagsChange}
        />
      )}
    </div>
  );
};

export default ImageTagsField;
