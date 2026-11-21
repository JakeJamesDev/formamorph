import { LOCATION_RULE_HOST } from '@/components/editor/ImageRuleCog';
import { IMAGE_CAPS } from '@/lib/imageOptim';
import { useCallback } from 'react';
import { locationLinks } from '@/lib/mediaGallery';
import { useLinkedGallery } from '@/lib/useLinkedGallery';
import { labelPlaceholders } from '@/lib/placementLetters';
import type { GalleryLink, GameLocation, Placeholder } from '@/types';
import ImageTagsField, { type GalleryFrameProps } from './ImageTagsField';

/** Location galleries take Layered Images. */
const LAYERED_SLOTS = { layered: true };

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
  const subject = labelPlaceholders(location.name, placeholders);
  const write = useCallback((links: GalleryLink[]) => onChange('images', links), [onChange]);
  const gallery = useLinkedGallery(locationLinks(location), write, subject, LAYERED_SLOTS);
  return (
    <ImageTagsField
      label="Background Image"
      tourAnchor={tourAnchor}
      images={gallery.images}
      onImagesChange={gallery.onImagesChange}
      media={gallery.media}
      pictures={gallery.pictures}
      slots={Infinity}
      imageId={imageId}
      cap={IMAGE_CAPS.background}
      description={location.aiDescription || location.playerDescription}
      kind="location"
      fileSubject={subject}
      tags={location.imageTags}
      onTagsChange={(t) => onChange('imageTags', t)}
      placeholders={placeholders}
      ruleHost={LOCATION_RULE_HOST}
      {...frame}
    />
  );
}
