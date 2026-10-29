// Visibility rules in play: which of an entity's, a location's or the Map Background's gallery images the story shows right now.

import type { Base64Data, Entity, GalleryImage, Item, ItemCopy, RequirementOwner, TraitRequirement, TraitRequirementRow, WorldOverview } from '@/types';
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

/** The owner an Item Copy's rule reads for a Condition with no owner (Q67); none while it lies at a location. */
const copyOwner = (where: ItemCopy['where']): RequirementOwner | null =>
  (where.kind === 'you' ? PERSONA : where.kind === 'entity' ? { kind: 'entity', id: where.id } : null);

/**
 * Each row's state of an item image's rule, for one Item Copy. A Condition with no owner reads the copy's
 * owner, and never holds while the copy lies at a location, Not included (Q67, Q91). An item has no owner of
 * its own, so global scope hosts the rule.
 */
export function itemRuleStates(input: GateInput, copy: Pick<ItemCopy, 'where'>, rows: readonly TraitRequirementRow[]): RowState[] {
  const owner = copyOwner(copy.where);
  const ownerless = (req: TraitRequirement) => req.kind !== 'playingAs' && req.kind !== 'time' && req.owner === undefined;
  const states = ruleStates(input, null, mapConditions(rows, (req): TraitRequirement =>
    (owner && ownerless(req) ? { ...req, owner } as TraitRequirement : req)));
  if (owner) return states;
  return states.map((row, i) => {
    const conditions = row.conditions.map((c, j) => (ownerless(rows[i].all[j]) ? { ...c, holds: false } : c));
    return { holds: conditions.every((c) => c.holds), conditions };
  });
}

/** The item's first image visible for one Item Copy in play, or undefined when none shows. */
export const visibleItemImage = (item: Pick<Item, 'images'>, copy: Pick<ItemCopy, 'where'>, input: GateInput): Base64Data | undefined =>
  visibleBy(item.images ?? [], (rows) => itemRuleStates(input, copy, rows))[0]?.data;

/** The location's images visible in play, in author order. An unresolved Condition never holds. */
export const visibleLocationImages = (location: LocationImageBearing, input: GateInput): VisibleImage[] =>
  visibleBy(locationImages(location), (rows) => locationRuleStates(input, rows));

/** The Map Background's images visible in play, in author order. Its rows read as a location's do (Q74). */
export const visibleMapImages = (overview: Pick<WorldOverview, 'mapBackground'>, input: GateInput): VisibleImage[] =>
  visibleBy(mapImages(overview), (rows) => locationRuleStates(input, rows));
