// Visibility rules in play: which of an entity's, a location's or the Map Background's gallery images the story shows right now.

import type { Base64Data, Entity, GalleryImage, GalleryLink, Item, ItemInstance, LayeredMediaEntry, LayerSettings, MediaList, RequirementOwner, TraitRequirement, TraitRequirementRow, WorldOverview } from '@/types';
import { galleryLinks } from './entityImages';
import { drawableLayered, pictureKey, resolveLayered, type Picture } from './layeredImages';
import { resolveGalleryImage } from './mediaList';
import type { LocationImageBearing } from './locationImages';
import { mapImages } from './mapBackground';
import { mapConditions } from './requirementRows';
import { globalItems, ruleStates, type GateInput, type RowState } from './traitGates';
import type { PictureOverride } from './mediaOverrides';

/** One image visible in play, with its slot in the authored gallery. */
export interface VisibleImage {
  slot: number;
  data: Base64Data;
}

/** The images whose rule is empty or has a row that holds, read through `statesOf`, with their slots. */
const visibleBy = (images: readonly GalleryImage[], statesOf: (rows: TraitRequirementRow[]) => RowState[]): VisibleImage[] =>
  images.flatMap((img, slot) =>
    (!img.requires?.length || statesOf(img.requires).some((row) => row.holds) ? [{ slot, data: img.data }] : []));

/** One picture visible in play, with its slot in the authored gallery. */
export interface VisiblePicture {
  slot: number;
  data: Picture;
}

/** A gallery slot that can show: an image's data or a Layered Image, with the link's rule. */
type GallerySlot = { requires?: TraitRequirementRow[] } & ({ data: Base64Data } | { layered: LayeredMediaEntry });

/** The gallery's slots that can show, in author order. A link naming no image or drawable Layered Image drops. */
const gallerySlots = (links: readonly GalleryLink[], media: MediaList | undefined): GallerySlot[] =>
  links.flatMap((link): GallerySlot[] => {
    const layered = drawableLayered(link, media);
    if (layered) return [{ layered, ...(link.requires?.length ? { requires: link.requires } : {}) }];
    const image = resolveGalleryImage(link, media);
    return image ? [image] : [];
  });

/** The slots of `links` that show, in author order, with their pictures: a Layered Image resolves through the same
 *  reader as its link's rule, so an ownerless Condition reads that bearer (Q7). */
const visiblePictures = (
  links: readonly GalleryLink[], media: MediaList | undefined, statesOf: (rows: TraitRequirementRow[]) => RowState[], layers: LayerSettings | undefined,
): VisiblePicture[] =>
  gallerySlots(links, media).flatMap((slot, i): VisiblePicture[] => {
    if (slot.requires?.length && !statesOf(slot.requires).some((row) => row.holds)) return [];
    const data = 'layered' in slot ? resolveLayered(slot.layered, media, { statesOf }, layers?.[slot.layered.id]) : slot.data;
    return data ? [{ slot: i, data }] : [];
  });

/** The slot an override's picture takes among the shown ones. */
export const OVERRIDE_SLOT = -1;

/** The gallery's pictures with a script's override first, an image or a Layered Image, and any rule-visible copy of
 *  it dropped (Q51). Script Layer settings beat the rules (Q10). */
function withPictureOverride(
  links: readonly GalleryLink[], media: MediaList | undefined, statesOf: (rows: TraitRequirementRow[]) => RowState[], override: PictureOverride | undefined,
): VisiblePicture[] {
  const visible = visiblePictures(links, media, statesOf, override?.layers);
  const entry = override?.id ? media?.[override.id] : undefined;
  const data = entry?.kind === 'image' ? entry.data
    : entry?.kind === 'layered' ? resolveLayered(entry, media, { statesOf }, override?.layers?.[entry.id]) : undefined;
  if (!data) return visible;
  const key = pictureKey(data);
  return [{ slot: OVERRIDE_SLOT, data }, ...visible.filter((shown) => pictureKey(shown.data) !== key)];
}

/**
 * The entity's pictures visible in play, in author order, so the first is the primary. A slot with no rule is
 * visible; one with a rule is visible while any row holds, and an unresolved Condition never holds (Q12). A
 * Layered Image resolves for the entity, so its ownerless Conditions read it (Q7). A script's override shows
 * first (Q51).
 */
export function visibleImages(entity: Pick<Entity, 'id' | 'images'>, input: GateInput, media: MediaList | undefined, override?: PictureOverride): VisiblePicture[] {
  return withPictureOverride(galleryLinks(entity), media, (rows) => ruleStates(input, entity.id, rows), override);
}

/**
 * A location rule's rows as the gate module reads them: a Condition with no owner names the played persona
 * (Q48). One on a global target stays owner-less, so it reads global scope and its text names no owner.
 */
const PERSONA: RequirementOwner = { kind: 'you' };

function locationRuleRows(input: GateInput, rows: readonly TraitRequirementRow[]): TraitRequirementRow[] {
  const global = globalItems(input);
  const isGlobal = (req: TraitRequirement & { id: string }) =>
    (req.kind === 'stat' ? !!input.stats?.global[req.id] : (req.kind === 'trait' ? global.traits : global.groups).has(req.id));
  return mapConditions(rows, (req): TraitRequirement =>
    ((req.kind === 'trait' || req.kind === 'group' || req.kind === 'stat') && req.owner === undefined && !isGlobal(req)
      ? { ...req, owner: PERSONA } : req));
}

/** Each row's state of a location image's rule. A location owns nothing, so global scope hosts it. */
export const locationRuleStates = (input: GateInput, rows: readonly TraitRequirementRow[]) =>
  ruleStates(input, null, locationRuleRows(input, rows));

/** The owner an Item Instance's rule reads for a Condition with no owner (Q67); none while it lies at a location. */
const instanceOwner = (where: ItemInstance['where']): RequirementOwner | null =>
  (where.kind === 'you' ? PERSONA : where.kind === 'entity' ? { kind: 'entity', id: where.id } : null);

/**
 * Each row's state of an item image's rule, for one Item Instance. A Condition with no owner reads the instance's
 * owner, and never holds while the instance lies at a location, Not included (Q67, Q91). An item has no owner of
 * its own, so global scope hosts the rule.
 */
export function itemRuleStates(input: GateInput, instance: Pick<ItemInstance, 'where'>, rows: readonly TraitRequirementRow[]): RowState[] {
  const owner = instanceOwner(instance.where);
  const ownerless = (req: TraitRequirement) => req.kind !== 'playingAs' && req.kind !== 'time' && req.kind !== 'weather' && req.kind !== 'opening' && req.owner === undefined;
  const states = ruleStates(input, null, mapConditions(rows, (req): TraitRequirement =>
    (owner && ownerless(req) ? { ...req, owner } as TraitRequirement : req)));
  if (owner) return states;
  return states.map((row, i) => {
    const conditions = row.conditions.map((c, j) => (ownerless(rows[i].all[j]) ? { ...c, holds: false } : c));
    return { holds: conditions.every((c) => c.holds), conditions };
  });
}

/** The item's first picture visible for one Item Instance in play, or undefined when none shows. A Layered Image's
 *  ownerless Conditions read the instance's owner (Q7). The instance's override wins (Q49). */
export const visibleItemImage = (
  item: Pick<Item, 'images'>, instance: Pick<ItemInstance, 'where'>, input: GateInput, media: MediaList | undefined, override?: PictureOverride,
): Picture | undefined =>
  withPictureOverride(galleryLinks(item), media, (rows) => itemRuleStates(input, instance, rows), override)[0]?.data;

/** The links a location's gallery stores, the pre-gallery background included. */
const locationLinks = (location: LocationImageBearing): GalleryLink[] =>
  galleryLinks(Array.isArray(location.images) ? { images: location.images } : { image: location.backgroundImage ?? undefined });

/** The location's pictures visible in play, in author order, after a script's override. An unresolved Condition never
 *  holds. A Layered Image's ownerless Conditions read the persona (Q7). */
export const visibleLocationImages = (location: LocationImageBearing, input: GateInput, media: MediaList | undefined, override?: PictureOverride): VisiblePicture[] =>
  withPictureOverride(locationLinks(location), media, (rows) => locationRuleStates(input, rows), override);

/** The entry id of the first rule-visible link to an image or a drawable Layered Image in `links`, or undefined (Q52). */
const firstVisibleLink = (links: readonly GalleryLink[], media: MediaList | undefined, statesOf: (rows: TraitRequirementRow[]) => RowState[]): string | undefined =>
  links.flatMap((link) => ('mediaId' in link && (media?.[link.mediaId]?.kind === 'image' || !!drawableLayered(link, media))
    && (!link.requires?.length || statesOf(link.requires).some((row) => row.holds)) ? [link.mediaId] : []))[0];

/** The entry the entity's rules show with no override, as a script's `image` reads it. */
export const ruleImageId = (entity: Pick<Entity, 'id' | 'images'>, input: GateInput, media: MediaList | undefined): string | undefined =>
  firstVisibleLink(galleryLinks(entity), media, (rows) => ruleStates(input, entity.id, rows));

/** The entry the location's rules show with no override. */
export const locationRuleImageId = (location: LocationImageBearing, input: GateInput, media: MediaList | undefined): string | undefined =>
  firstVisibleLink(Array.isArray(location.images) ? galleryLinks({ images: location.images }) : [], media, (rows) => locationRuleStates(input, rows));

/** The entry the item's rules show for one Item Instance with no override. */
export const itemRuleImageId = (item: Pick<Item, 'images'>, instance: Pick<ItemInstance, 'where'>, input: GateInput, media: MediaList | undefined): string | undefined =>
  firstVisibleLink(galleryLinks(item), media, (rows) => itemRuleStates(input, instance, rows));

/** The Map Background's images visible in play, in author order. Its rows read as a location's do (Q74). */
export const visibleMapImages = (overview: Pick<WorldOverview, 'mapBackground' | 'mediaList'>, input: GateInput): VisibleImage[] =>
  visibleBy(mapImages(overview), (rows) => locationRuleStates(input, rows));
