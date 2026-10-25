import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/typography';
import PlaceholderText from '@/components/prompt/PlaceholderText';
import { ImageRuleEditor, LOCATION_RULE_HOST, useEntityRuleHost } from '@/components/editor/ImageRuleCog';
import { useGameData } from '@/contexts/GameDataContext';
import { formatMediaBytes, mediaParentKey, totalBytes, type MediaItem, type MediaParent } from '@/lib/mediaIndex';
import { mediaParentSpec } from '@/lib/mediaParents';
import ModelStorageService from '@/services/ModelStorageService';
import type { Entity, MediaAsset, Placeholder, TraitRequirementRow } from '@/types';
import { EntityImageWidget } from './EntityFields';
import { ImageGallery, ImageTags } from './ImageTagsField';
import { LocationImageField } from './LocationImageField';
import { MapBackgroundField } from './MapBackgroundField';
import { useMapBackground } from './useMapBackground';
import { MediaActionRow } from './MediaActionRow';
import { GoToButton, MediaFacts } from './MediaPanels';
import { useMediaItemActions } from './useMediaItemActions';

/** A library Avatar's name, read once the panel shows an entity that picks one. */
function useLibraryAvatarName(id: string | undefined): string | undefined {
  const [read, setRead] = useState<{ id: string; name?: string }>();
  useEffect(() => {
    if (!id) return;
    // A later id or an unmount drops this read.
    let current = true;
    ModelStorageService.getModelMetadata()
      .then((models) => { if (current) setRead({ id, name: models.find((m) => m.id === id)?.name }); })
      .catch(() => { /* An unreadable library leaves the name out. */ });
    return () => { current = false; };
  }, [id]);
  return read && read.id === id ? read.name : undefined;
}

/** The Avatar an entity picks: a world Avatar links to its card; a library Avatar shows its name. */
function PickedAvatar({ entity, avatar, onSelect }: {
  entity: Entity;
  avatar?: MediaItem;
  onSelect: (id: string) => void;
}) {
  const pick = entity.vrmPick;
  const libraryName = useLibraryAvatarName(pick?.kind === 'library' ? pick.id : undefined);
  const shown = avatar
    ? <Button variant="link" size="sm" className="h-auto p-0 text-meta" onClick={() => onSelect(avatar.id)}>{avatar.slot}</Button>
    : libraryName;
  if (!shown) return null;
  return <Meta className="flex items-center gap-1">Avatar: {shown}</Meta>;
}

/**
 * One entity's, location's or the Map Background's images: the gallery frames one, and the framed image's size, actions and
 * Visibility rule editor sit below it. `framed` past the last image is the add tile's empty slot.
 */
export function MediaImagePanel({ parent, images, framed, onFrame, avatar, placeholders, onGoTo, onSelect }: {
  parent: MediaParent;
  /** The parent's images in gallery order. */
  images: MediaItem[];
  framed: number;
  onFrame: (index: number) => void;
  /** The world Avatar the entity picks. */
  avatar?: MediaItem;
  placeholders: Placeholder[];
  onGoTo: (parent: MediaParent) => void;
  onSelect: (id: string) => void;
}) {
  const { entities, editEntity, locations, updateLocation, worldOverview, updateWorldOverview } = useGameData();
  const map = useMapBackground({ worldOverview, updateWorldOverview, locations });
  const isMap = parent.kind === 'map';
  const { replace, remove, setRules } = useMediaItemActions();
  const entity = parent.kind === 'entity' ? entities.find((e) => e.id === parent.id) : undefined;
  const location = parent.kind === 'location' ? locations.find((l) => l.id === parent.id) : undefined;
  const item = images[framed];

  const editField = (field: string, value: unknown) => {
    if (entity) editEntity(entity.id, (e) => ({ ...e, [field]: value }));
  };
  const setRule = (rows: TraitRequirementRow[]) => { if (item) setRules(item, rows); };
  const entityHost = useEntityRuleHost(entity?.id);
  const hostKind = mediaParentSpec(parent.kind).ruleHost;
  const ruleHost = hostKind === 'location' ? LOCATION_RULE_HOST : hostKind === 'entity' ? entityHost : undefined;
  const removeFramed = (target: MediaItem) => {
    // The frame stays on the same position, clamped. Ids are positional, so the id holds before and after.
    const left = images.length - 1;
    if (target.galleryIndex !== undefined && left > 0) onSelect(images[Math.min(target.galleryIndex, left - 1)].id);
    void remove(target);
  };

  return (
    <div className="space-y-4" data-media-panel={item?.id ?? ''} data-media-image-panel={mediaParentKey(parent)}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="min-w-0 truncate text-title font-semibold"><PlaceholderText text={parent.name} placeholders={placeholders} /></h2>
          <Meta className="tabular-nums">
            {images.length} {images.length === 1 ? 'image' : 'images'} · {formatMediaBytes(totalBytes(images))}
          </Meta>
          <span className="ml-auto"><GoToButton parent={parent} placeholders={placeholders} onGoTo={onGoTo} /></span>
        </div>
        {entity && <PickedAvatar entity={entity} avatar={avatar} onSelect={onSelect} />}
      </div>

      {entity && (
        <EntityImageWidget
          value={entity}
          onChange={editField}
          placeholders={placeholders}
          ownerId={entity.id}
          imageId={`media-entity-image-${entity.id}`}
          frame={{ framed, onFramedChange: onFrame, ruleCog: false }}
        >
          <ImageGallery tagsSlot={<ImageTags />} />
        </EntityImageWidget>
      )}
      {location && (
        <LocationImageField
          location={location}
          onChange={(field, value) => updateLocation({ ...location, [field]: value })}
          placeholders={placeholders}
          imageId={`media-location-image-${location.id}`}
          frame={{ framed, onFramedChange: onFrame, ruleCog: false }}
        />
      )}

      {isMap && (
        <MapBackgroundField
          overview={worldOverview}
          onImagesChange={(list) => void map.setImages(list)}
          placeholders={placeholders}
          frame={{ framed, onFramedChange: onFrame, ruleCog: false }}
        />
      )}

      {item && (
        <div className="space-y-3" data-media-framed={item.id}>
          <MediaFacts item={item}>
            <span className="font-medium text-foreground">{item.slot}</span>
            <span aria-hidden>·</span>
          </MediaFacts>
          <MediaActionRow
            item={item}
            placeholders={placeholders}
            onReplace={(media: MediaAsset) => void replace(item, media)}
            onRemove={() => removeFramed(item)}
          />
          {ruleHost && item.galleryIndex !== undefined && <ImageRuleEditor host={ruleHost} rows={item.rules ?? []} onChange={setRule} />}
        </div>
      )}
    </div>
  );
}
