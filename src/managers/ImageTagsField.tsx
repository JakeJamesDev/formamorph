import { useState } from 'react';
import { Label } from "@/components/ui/label";
import AiFieldToolbar from "@/components/AiFieldToolbar";
import { TagAutocomplete } from "@/components/TagAutocomplete";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUpload } from '../lib/UtilityComponents';
import { GenerateImageButton } from '../components/GenerateImageButton';
import type { ImageCap } from '../lib/imageOptim';
import type { ImageSubjectKind } from '@/lib/imagePrompt';

interface ImageTagsFieldProps {
  /** Field label above the upload — "Background Image" for locations, "Image" for entities. */
  label: string;
  image?: string;
  onImageChange: (value: string) => void;
  /** Stable id for the file input (must be unique per rendered subject). */
  imageId: string;
  cap: ImageCap;
  /** Subject name + description feed the AI tag/prompt generators. */
  name?: string;
  description?: string;
  kind: ImageSubjectKind;
  tags?: string;
  onTagsChange: (value: string) => void;
}

/**
 * The image-upload → embedded-prompt confirmation → booru Image Tags → generate-image stack shared by the
 * Location and Entity editors. Owns the `pendingPrompt` handshake: an uploaded image's embedded SD prompt is
 * held until the user confirms using it as the Image Tags (which replaces the current tags).
 */
const ImageTagsField = ({ label, image, onImageChange, imageId, cap, name, description, kind, tags, onTagsChange }: ImageTagsFieldProps) => {
  // SD prompt pulled from an uploaded image, pending the user's OK to use it as Image Tags.
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ImageUpload
        onChange={onImageChange}
        id={imageId}
        value={image}
        cap={cap}
        onPromptExtracted={setPendingPrompt}
      />
      <ConfirmDialog
        open={pendingPrompt !== null}
        onOpenChange={(o) => { if (!o) setPendingPrompt(null); }}
        title="Use the image's prompt?"
        description="This image has an embedded AI prompt. Use it as the Image Tags? This replaces the current tags."
        onConfirm={() => { if (pendingPrompt) onTagsChange(pendingPrompt); setPendingPrompt(null); }}
        onCancel={() => setPendingPrompt(null)}
      />
      <div className="flex items-center justify-between">
        <Label>Image Tags</Label>
        <AiFieldToolbar
          mode="tags"
          name={name}
          kind={kind}
          source={description}
          value={tags}
          onChange={onTagsChange}
        />
      </div>
      <TagAutocomplete
        value={tags || ''}
        onChange={onTagsChange}
        placeholder="booru tags, comma separated"
      />
      <GenerateImageButton
        subject={{ name: name || '', description: description || '', kind }}
        cap={cap}
        onChange={onImageChange}
        tags={tags ?? ''}
        onTagsChange={onTagsChange}
      />
    </div>
  );
};

export default ImageTagsField;
