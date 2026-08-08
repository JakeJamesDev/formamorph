import { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import AiGenerateButton from "@/components/AiGenerateButton";
import TagHistoryButtons from "@/components/TagHistoryButtons";
import { useTagHistory } from "@/lib/useTagHistory";
import TagChipField from "@/components/prompt/TagChipField";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUpload } from '../lib/UtilityComponents';
import { isRemoteImage } from '@/lib/imageBytes';
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

/**
 * The image-upload → embedded-prompt confirmation → booru Image Tags → generate-image stack shared by the
 * Location and Entity editors. Owns the `pendingPrompt` handshake: an uploaded image's embedded SD prompt is
 * held until the user confirms using it as the Image Tags (which replaces the current tags).
 *
 * With more than one slot it authors a gallery: filled slots plus one empty one to add to, each extra
 * carrying the control that promotes it to primary. Tag generation and image generation always act on the
 * primary — they describe the subject, not one picture of it.
 */
const ImageTagsField = ({ label, images, onImagesChange, slots = 1, embeddedLimit = slots, imageId, cap, description, kind, tags, onTagsChange, placeholders = [] }: ImageTagsFieldProps) => {
  // SD prompt pulled from an uploaded image, pending the user's OK to use it as Image Tags.
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  // Booru tags are Advanced-only; so is the offer to adopt an uploaded image's embedded prompt as them.
  const { advanced } = useEditorMode();
  // The tag inputs are plain controlled fields with no history of their own, so it lives here — stepped by
  // tag, with a generation (or an adopted embedded prompt) as one step.
  const tagHistory = useTagHistory(tags ?? '', onTagsChange);

  // Filled slots, plus a trailing empty one to upload into while there is room.
  const shown = images.slice(0, slots);
  const rows = shown.length < slots ? [...shown, ''] : shown;

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

  /** Swap a slot into the primary position, which is what makes it the entity's one-picture stand-in. */
  const makePrimary = (index: number) => {
    const next = [...shown];
    [next[0], next[index]] = [next[index], next[0]];
    onImagesChange(next.filter(Boolean));
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {rows.map((url, i) => (
        <div key={i} className="space-y-1">
          <ImageUpload
            onChange={(value) => setSlot(i, value)}
            id={i === 0 ? imageId : `${imageId}-${i}`}
            value={url}
            cap={cap}
            // Spent allowance closes the file picker on empty slots; the URL box stays, so a gallery can
            // still grow with links. A filled slot ignores this — it is changed by removing it first.
            allowUpload={canEmbed}
            uploadBlockedNote={`${embeddedLimit} uploaded picture${embeddedLimit === 1 ? '' : 's'} is the limit — add more as links instead.`}
            // Only the primary offers its embedded prompt as the tags: the tags describe the subject, and a
            // later slot overwriting them would undo the choice made for the picture that represents it.
            onPromptExtracted={i === 0 && advanced ? setPendingPrompt : undefined}
          />
          {slots > 1 && url && (
            <div className="flex items-center gap-2">
              {i === 0 ? (
                <span className="text-xs text-muted-foreground">Primary — shown wherever one picture fits.</span>
              ) : (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => makePrimary(i)}>
                  <Star className="mr-1 h-3 w-3" />
                  Make Primary
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
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
