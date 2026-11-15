// What the Mention Reading gives In Scene and memory (Q20, Q21, Q53, Q54): participants it adds, and the
// bracketed narration only the digest and diary passes read.

import type { Entity } from '@/types';
import type { StrangerLabels } from '@/lib/locationContext';
import { escapeRegExp } from '@/lib/utils';
import { entitiesInProse, type MentionReading } from './mentionReading';
import { turnMentionReading, type MentionReadingMap } from './mentionReadings';

/** Names of the cast entities a reading links in the prose, outside quoted speech. */
export function readingParticipants(
  narration: string, reading: MentionReading | null | undefined, entities: readonly Pick<Entity, 'id' | 'name'>[],
): string[] {
  if (!reading) return [];
  const byId = new Map(entities.map((e) => [e.id, e.name]));
  return entitiesInProse(narration, reading).flatMap((id) => byId.get(id) ?? []);
}

/** A stored turn's extra participants from its reading; empty when there is none. */
export type ReadingNames = (turnId: string, narration: string) => readonly string[];

/** The extra participants of each stored turn, or undefined when the feature is off. */
export function readingNamesFor(
  enabled: boolean, readings: MentionReadingMap, entities: readonly Pick<Entity, 'id' | 'name'>[],
): ReadingNames | undefined {
  if (!enabled) return undefined;
  return (turnId, narration) => readingParticipants(narration, turnMentionReading(readings, turnId, narration), entities);
}

/** The narration a memory pass reads, and the scrub for that pass's reply. */
export interface MemoryNarration {
  text: string;
  /** The reply without the bracket tags the view added. */
  scrub(reply: string): string;
}

const wordIn = (text: string, word: string) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(text);

/**
 * The narration with each linked mention followed by its entity's bracketed name: "she [Mira] left".
 * `nameFor` gives the name the player knows (Q54), or undefined for no bracket. A mention that already
 * holds the name gets none. Null when nothing was bracketed.
 */
export function bracketedNarration(
  narration: string, reading: MentionReading, nameFor: (entityId: string) => string | undefined,
): MemoryNarration | null {
  const tags = new Set<string>();
  let out = '';
  let at = 0;
  let lastEnd = -1;
  for (const m of [...reading.mentions].sort((a, b) => a.end - b.end || a.start - b.start)) {
    if (!m.entityId || m.end > narration.length || m.end === lastEnd) continue;
    const name = nameFor(m.entityId)?.trim();
    if (!name || wordIn(narration.slice(m.start, m.end), name.replace(/^(?:a|an|the)\s+/i, ''))) continue;
    out += `${narration.slice(at, m.end)} [${name}]`;
    at = lastEnd = m.end;
    tags.add(name);
  }
  if (!tags.size) return null;
  const tagRe = new RegExp(`[ \\t]*\\[(?:${[...tags].map(escapeRegExp).join('|')})\\]`, 'g');
  return { text: out + narration.slice(at), scrub: (reply) => reply.replace(tagRe, '') };
}

/** The name the player knows each entity by (Q54): the true name once met or when it hides none, else the
 *  stranger label from `strangersInPlay`, else none. */
export function knownNameFor(
  entities: readonly Entity[], isMet: (entity: Entity) => boolean, labels: StrangerLabels,
): (entityId: string) => string | undefined {
  const byId = new Map(entities.map((e) => [e.id, e]));
  return (entityId) => {
    const entity = byId.get(entityId);
    if (!entity) return undefined;
    if (entity.strangerName === undefined || isMet(entity)) return entity.name;
    return labels[entityId];
  };
}

/** A stored turn's bracket view; null when it has no reading or nothing to bracket. */
export type MemoryNarrationFor = (turnId: string, narration: string) => MemoryNarration | null;

/** The bracket view of each stored turn, or undefined when the feature is off. */
export function memoryNarrationFor(
  enabled: boolean, readings: MentionReadingMap, nameFor: (entityId: string) => string | undefined,
): MemoryNarrationFor | undefined {
  if (!enabled) return undefined;
  return (turnId, narration) => {
    const reading = turnMentionReading(readings, turnId, narration);
    return reading ? bracketedNarration(narration, reading, nameFor) : null;
  };
}
