import { LOCATION_RULE_HOST } from '@/components/editor/ImageRuleCog';
import { IMAGE_CAPS } from '@/lib/imageOptim';
import { useCallback, useState } from 'react';
import { locationLinks } from '@/lib/mediaGallery';
import { useLinkedGallery } from '@/lib/useLinkedGallery';
import { labelPlaceholders } from '@/lib/placementLetters';
import { useEditorMode } from '@/lib/editorMode';
import type { GalleryLink, GameLocation, Placeholder } from '@/types';
import ImageTagsField, { type GalleryFrameProps } from './ImageTagsField';
import { WeatherMaskButton, WeatherMaskTint } from './WeatherMaskButton';

/** Location galleries take Layered Images. */
const LAYERED_SLOTS = { layered: true };

/** A location's gallery with its tags and generate controls, as the location panel and the Media tab show it. In
 *  Advanced mode each slot's frame carries its Weather Mask button. */
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
  const { advanced } = useEditorMode();
  // One switch for the frame, so the tint stays on while the author steps between slots.
  const [maskShown, setMaskShown] = useState(false);
  const slotButton = advanced
    ? (i: number) => (
      <WeatherMaskButton
        images={gallery.images}
        index={i}
        onImagesChange={gallery.onImagesChange}
        pictures={gallery.pictures}
        subject={subject}
        shown={maskShown}
        onShownChange={setMaskShown}
      />
    )
    : undefined;
  const slotOverlay = advanced && maskShown
    ? (i: number) => <WeatherMaskTint image={gallery.images[i]} pictures={gallery.pictures} />
    : undefined;
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
      slotButton={slotButton}
      slotOverlay={slotOverlay}
      {...frame}
    />
  );
}
