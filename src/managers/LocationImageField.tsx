import { IMAGE_CAPS } from '@/lib/imageOptim';
import { labelPlaceholders } from '@/lib/placementLetters';
import type { GameLocation, Placeholder } from '@/types';
import ImageTagsField from './ImageTagsField';

/** A location's background image with its tags and generate controls, as the location panel and the Media tab show it. */
export function LocationImageField({ location, onChange, placeholders, imageId = `location-image-${location.id}`, tourAnchor }: {
  location: GameLocation;
  onChange: (field: 'backgroundImage' | 'imageTags', value: string) => void;
  placeholders: Placeholder[];
  /** The file inputs' id, unique per rendered widget. */
  imageId?: string;
  tourAnchor?: string;
}) {
  return (
    <ImageTagsField
      label="Background Image"
      tourAnchor={tourAnchor}
      images={location.backgroundImage ? [{ data: location.backgroundImage }] : []}
      onImagesChange={(list) => onChange('backgroundImage', list[0]?.data ?? '')}
      imageId={imageId}
      cap={IMAGE_CAPS.background}
      description={location.aiDescription || location.playerDescription}
      kind="location"
      fileSubject={labelPlaceholders(location.name, placeholders)}
      tags={location.imageTags}
      onTagsChange={(t) => onChange('imageTags', t)}
      placeholders={placeholders}
    />
  );
}
