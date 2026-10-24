import { LOCATION_RULE_HOST } from '@/components/editor/ImageRuleCog';
import { IMAGE_CAPS } from '@/lib/imageOptim';
import { locationImages } from '@/lib/locationImages';
import { labelPlaceholders } from '@/lib/placementLetters';
import type { GameLocation, Placeholder } from '@/types';
import ImageTagsField, { type GalleryFrameProps } from './ImageTagsField';

/** A location's gallery with its tags and generate controls, as the location panel and the Media tab show it. */
export function LocationImageField({ location, onChange, placeholders, imageId = `location-image-${location.id}`, tourAnchor, frame }: {
  location: GameLocation;
  onChange: <K extends 'images' | 'imageTags'>(field: K, value: NonNullable<GameLocation[K]>) => void;
  placeholders: Placeholder[];
  /** The file inputs' id, unique per rendered widget. */
  imageId?: string;
  tourAnchor?: string;
  /** A host that shows the framed image's details controls the frame. */
  frame?: GalleryFrameProps;
}) {
  return (
    <ImageTagsField
      label="Background Image"
      tourAnchor={tourAnchor}
      images={locationImages(location)}
      onImagesChange={(list) => onChange('images', list)}
      slots={Infinity}
      imageId={imageId}
      cap={IMAGE_CAPS.background}
      description={location.aiDescription || location.playerDescription}
      kind="location"
      fileSubject={labelPlaceholders(location.name, placeholders)}
      tags={location.imageTags}
      onTagsChange={(t) => onChange('imageTags', t)}
      placeholders={placeholders}
      ruleHost={LOCATION_RULE_HOST}
      {...frame}
    />
  );
}
