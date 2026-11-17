import { LOCATION_RULE_HOST } from '@/components/editor/ImageRuleCog';
import { IMAGE_CAPS } from '@/lib/imageSlots';
import { galleryLinks } from '@/lib/entityImages';
import { galleryView, type GalleryMedia } from '@/lib/mediaGallery';
import type { GalleryImage, Placeholder, WorldOverview } from '@/types';
import { ImageGallery, ImageWidget, type GalleryFrameProps } from './ImageTagsField';

/** The Map Background's gallery as the Media tab and the canvas card show it. Its rules read as a location's do (Q74). */
export function MapBackgroundField({ overview, onImagesChange, placeholders, frame, imageId = 'media-map-background' }: {
  overview: Pick<WorldOverview, 'mapBackground' | 'mediaList' | 'description' | 'name'>;
  onImagesChange: (images: GalleryImage[]) => void;
  placeholders: Placeholder[];
  frame?: GalleryFrameProps;
  imageId?: string;
}) {
  const view = galleryView(galleryLinks({ images: overview.mapBackground?.images }), overview.mediaList);
  const media: GalleryMedia | undefined = overview.mediaList ? { list: overview.mediaList, links: view.links } : undefined;
  return (
    <ImageWidget
      label="Map Background"
      images={view.images}
      media={media}
      onImagesChange={onImagesChange}
      slots={Infinity}
      imageId={imageId}
      cap={IMAGE_CAPS.map}
      description={overview.description}
      kind="world"
      fileSubject={overview.name}
      onTagsChange={() => {}}
      placeholders={placeholders}
      ruleHost={LOCATION_RULE_HOST}
      {...frame}
    >
      <ImageGallery />
    </ImageWidget>
  );
}
