import type { Entity, EntityRelationship } from '@/types';

/** The target id that reads as whoever the player plays. */
export const YOU_TARGET = 'you';

/** What a relationship row names its You target, and a target the world lacks. */
export const PERSONA_TARGET_LABEL = 'Persona';
export const UNKNOWN_TARGET_LABEL = 'Unknown Entity';

/** Whether the entity plays only when picked: a persona-only Persona, or the Custom Persona entity. Its You
 *  row would read as itself whenever it plays, so it never renders. */
export const playsOnlyWhenPicked = (entity: Entity) => !!entity.customPersona || (!!entity.persona && !!entity.personaOnly);

/**
 * The relationship ends in play: the player first, as `persona` holding every played entity's rows, then each
 * other entity. A You target and a played target read as the player. An unplayed persona-only entity or Custom
 * Persona entity drops, with each row that touches it, and so does a row that reads as its own owner. Of two rows
 * to one target, the one that names the target beats a You row. No persona: every You row drops.
 */
export function relationshipCast(entities: readonly Entity[], persona: Entity | null, played: readonly Entity[] = []): Entity[] {
  const playerIds = new Set([...(persona ? [persona.id] : []), ...played.map((e) => e.id)]);
  const others = entities.filter((e) => !playerIds.has(e.id) && !playsOnlyWhenPicked(e));
  const ids = new Set([...(persona ? [persona.id] : []), ...others.map((e) => e.id)]);
  const asEnd = (targetId: string) => (targetId === YOU_TARGET || playerIds.has(targetId) ? persona?.id : targetId);
  const withEnds = (owner: Entity, held: readonly Entity[]): Entity => {
    const rows = new Map<string, { row: EntityRelationship; you: boolean }>();
    for (const row of held.flatMap((e) => e.relationships ?? [])) {
      const targetId = asEnd(row.targetId);
      if (!targetId || !ids.has(targetId) || targetId === owner.id) continue;
      const you = row.targetId === YOU_TARGET;
      const kept = rows.get(targetId);
      if (!kept || (kept.you && !you)) rows.set(targetId, { row: { ...row, targetId }, you });
    }
    return withRelationships(owner, [...rows.values()].map(({ row }) => row));
  };
  const player = persona && withEnds(persona, [persona, ...played.filter((e) => e.id !== persona.id)]);
  return [...(player ? [player] : []), ...others.map((e) => withEnds(e, [e]))];
}

/** Entity id → the relationship sentences its roster block prints. Absent entity ⇒ none. */
export type RelationshipLines = Readonly<Record<string, readonly string[]>>;

/**
 * Where each relationship prints over one roster chain, as "<target> is <owner>'s <label>": on the owner's
 * block when `listed` holds the owner, else on the target's block when it holds the target, else nowhere. So a
 * sentence prints once across the chain. A sentence that touches `personaId` prints on its block alone. Both ends
 * must be in `entities`, and a blank label prints nothing. Of two rows that mirror each other, only the one held
 * earlier in `entities` prints, so the persona's wins in a `relationshipCast`.
 */
export function relationshipLines(entities: readonly Entity[], listed: readonly string[], personaId?: string): RelationshipLines {
  if (!entities.some((e) => e.relationships?.length)) return {};
  const byId = new Map(entities.map((e) => [e.id, e]));
  const order = new Map(entities.map((e, i) => [e.id, i]));
  const rows = entities.flatMap((owner) => (owner.relationships ?? []).flatMap(({ targetId, label }) => {
    const target = byId.get(targetId);
    const role = label.trim();
    return target && role ? [{ owner, target, role }] : [];
  }));
  const pair = (from: Entity, to: Entity) => `${from.id}\0${to.id}`;
  const held = new Set(rows.map(({ owner, target }) => pair(owner, target)));
  const yields = (owner: Entity, target: Entity) => held.has(pair(target, owner)) && order.get(target.id)! < order.get(owner.id)!;
  const shown = new Set(listed);
  const lines: Record<string, string[]> = {};
  for (const { owner, target, role } of rows) {
    if (yields(owner, target)) continue;
    const printsOn = personaId !== undefined && (owner.id === personaId || target.id === personaId) ? personaId
      : shown.has(owner.id) ? owner.id : shown.has(target.id) ? target.id : null;
    if (printsOn) (lines[printsOn] ??= []).push(`${target.name} is ${owner.name}'s ${role}`);
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
