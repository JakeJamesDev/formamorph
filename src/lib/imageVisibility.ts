// Visibility rules in play: which of an entity's, a location's or the Map Background's gallery images the story shows right now.

import type { Base64Data, Entity, GalleryImage, RequirementOwner, TraitRequirement, TraitRequirementRow, WorldOverview } from '@/types';
import { entityImages } from './entityImages';
import { locationImages, type LocationImageBearing } from './locationImages';
import { mapImages } from './mapBackground';
import { mapConditions } from './requirementRows';
import { globalItems, ruleStates, type GateInput, type RowState } from './traitGates';

/** One image visible in play, with its slot in the authored gallery. */
export interface VisibleImage {
  slot: number;
  data: Base64Data;
}

/** The images whose rule is empty or has a row that holds, read through `statesOf`, with their slots. */
const visibleBy = (images: readonly GalleryImage[], statesOf: (rows: TraitRequirementRow[]) => RowState[]): VisibleImage[] =>
  images.flatMap((img, slot) =>
    (!img.requires?.length || statesOf(img.requires).some((row) => row.holds) ? [{ slot, data: img.data }] : []));

/**
 * The entity's images visible in play, in author order, so the first is the primary. An image with no rule is
 * visible; one with a rule is visible while any row holds, and an unresolved Condition never holds (Q12).
 */
export const visibleImages = (entity: Pick<Entity, 'id' | 'images'>, input: GateInput): VisibleImage[] =>
  visibleBy(entityImages(entity), (rows) => ruleStates(input, entity.id, rows));

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

/** The location's images visible in play, in author order. An unresolved Condition never holds. */
export const visibleLocationImages = (location: LocationImageBearing, input: GateInput): VisibleImage[] =>
  visibleBy(locationImages(location), (rows) => locationRuleStates(input, rows));

/** The Map Background's images visible in play, in author order. Its rows read as a location's do (Q74). */
export const visibleMapImages = (overview: Pick<WorldOverview, 'mapBackground'>, input: GateInput): VisibleImage[] =>
  visibleBy(mapImages(overview), (rows) => locationRuleStates(input, rows));
