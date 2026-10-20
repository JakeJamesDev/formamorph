import type { Entity, EntityRelationship } from '@/types';

/** Entity id → the relationship sentences its roster block prints. Absent entity ⇒ none. */
export type RelationshipLines = Readonly<Record<string, readonly string[]>>;

/**
 * Where each relationship prints over one roster chain, as "<target> is <owner>'s <label>": on the owner's
 * block when `listed` holds the owner, else on the target's block when it holds the target, else nowhere. So a
 * sentence prints once across the chain. Both ends must be in `entities`, and a blank label prints nothing.
 */
export function relationshipLines(entities: readonly Entity[], listed: readonly string[]): RelationshipLines {
  if (!entities.some((e) => e.relationships?.length)) return {};
  const byId = new Map(entities.map((e) => [e.id, e]));
  const shown = new Set(listed);
  const lines: Record<string, string[]> = {};
  for (const owner of entities) {
    for (const { targetId, label } of owner.relationships ?? []) {
      const target = byId.get(targetId);
      const role = label.trim();
      if (!target || !role) continue;
      const printsOn = shown.has(owner.id) ? owner.id : shown.has(target.id) ? target.id : null;
      if (printsOn) (lines[printsOn] ??= []).push(`${target.name} is ${owner.name}'s ${role}`);
    }
  }
  return lines;
}

/** The other end of each relationship that touches an id in `fromIds`, held by either end, unless that end is
 *  in `fromIds` too. One hop: an id found here pulls no one further. A blank label prints no line, so it pulls
 *  no one. */
export function relatedIds(entities: readonly Entity[], fromIds: readonly string[]): Set<string> {
  const from = new Set(fromIds);
  const related = new Set<string>();
  for (const owner of entities) {
    for (const { targetId, label } of owner.relationships ?? []) {
      if (!label.trim() || from.has(owner.id) === from.has(targetId)) continue;
      related.add(from.has(owner.id) ? targetId : owner.id);
    }
  }
  return related;
}

/** `entities` with every relationship that targets `entityId` dropped, run when that entity is deleted. Returns
 *  the same array when nobody targets it. */
export function dropRelationshipsTo(entityId: string, entities: Entity[]): Entity[] {
  const targets = (e: Entity) => e.relationships?.some((r) => r.targetId === entityId);
  if (!entities.some(targets)) return entities;
  return entities.map((entity) => (
    targets(entity) ? withRelationships(entity, (entity.relationships ?? []).filter((r) => r.targetId !== entityId)) : entity
  ));
}

/** `entity` with `relationships` set, dropping the field when the list is empty. */
export function withRelationships(entity: Entity, relationships: EntityRelationship[]): Entity {
  if (relationships.length) return { ...entity, relationships };
  const { relationships: _dropped, ...rest } = entity;
  return rest;
}
