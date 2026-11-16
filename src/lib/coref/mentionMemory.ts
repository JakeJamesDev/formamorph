// What the Mention Reading gives In Scene and memory (Q20, Q21, Q53, Q54): participants it adds, and the
// bracketed narration only the digest and diary passes read.

import type { Entity } from '@/types';
import type { StrangerLabels } from '@/lib/locationContext';
import { escapeRegExp } from '@/lib/utils';
import { sameCharacterName } from '@/lib/entityMatch';
import {
  clusterCandidates, collectCandidateEvidence, mergeCandidateEvidence,
  type CandidateEvidence, type CandidateExclusions, type ClusterCandidates,
} from '@/lib/characterCandidates';
import { entitiesInProse, type MentionReading } from './mentionReading';
import { narrationHash, turnMentionReading, type MentionReadingMap } from './mentionReadings';

/** Names of the cast entities a reading links in the prose, outside quoted speech. */
export function readingParticipants(
  narration: string, reading: MentionReading | null | undefined, entities: readonly Pick<Entity, 'id' | 'name'>[],
): string[] {
  if (!reading) return [];
  const byId = new Map(entities.map((e) => [e.id, e.name]));
  return entitiesInProse(narration, reading).flatMap((id) => byId.get(id) ?? []);
}

/** One stored turn, as `ReadingNames` reads the turns before another. */
export interface StoredTurn {
  turnId: string;
  narration: string;
}

/** A stored turn's extra participants from its reading; empty when there is none. `prior` is the turns before
 *  it, oldest first. */
export interface ReadingNames {
  (turnId: string, narration: string, prior?: readonly StoredTurn[]): readonly string[];
  /** The name each pooled spelling counts under once the turn is read (Q73). */
  spellings?(turnId: string, narration: string, prior: readonly StoredTurn[]): ReadonlyMap<string, string>;
}

/**
 * The extra participants of each stored turn, or undefined when the feature is off. With `discovery`, a turn's
 * clusters also name the characters they qualify (Q73), judged against `prior` like a live turn, with the
 * spellings earlier turns' clusters linked. `discovery` holds the world's own names only: a pool's name must
 * not change once it is discovered or deleted, and the discover pass blocks those names itself.
 */
export function readingNamesFor(
  enabled: boolean, readings: MentionReadingMap, entities: readonly Pick<Entity, 'id' | 'name'>[],
  discovery?: CandidateExclusions,
): ReadingNames | undefined {
  if (!enabled) return undefined;
  const participants = (turnId: string, narration: string) =>
    readingParticipants(narration, turnMentionReading(readings, turnId, narration), entities);
  if (!discovery) return participants;
  const passes = new WeakMap<readonly StoredTurn[], DiscoveryPass>();
  const judged = (turnId: string, narration: string, prior: readonly StoredTurn[]) => {
    let pass = passes.get(prior);
    if (!pass) passes.set(prior, pass = discoveryPass(readings, discovery));
    return pass.at(prior, { turnId, narration });
  };
  const names: ReadingNames = (turnId, narration, prior = []) => {
    const linked = participants(turnId, narration);
    const found = judged(turnId, narration, prior).found.names;
    return [...linked, ...found.filter((name) => !linked.some((known) => sameCharacterName(known, name)))];
  };
  names.spellings = (turnId, narration, prior) => judged(turnId, narration, prior).links;
  return names;
}

/** One judged turn: what its clusters found, and every spelling link up to and including it. */
interface JudgedTurn {
  key: string;
  found: ClusterCandidates;
  links: ReadonlyMap<string, string>;
}

/** Q73 discovery over one walk of the history, oldest first: each turn is judged once, with the tally and the
 *  spelling links of the turns before it. A walk passes one `prior` list and appends each turn after reading it. */
interface DiscoveryPass {
  at(prior: readonly StoredTurn[], turn: StoredTurn): JudgedTurn;
}

function discoveryPass(readings: MentionReadingMap, exclusions: CandidateExclusions): DiscoveryPass {
  const judged: JudgedTurn[] = [];
  const links = new Map<string, string>();
  const tally = new Map<string, CandidateEvidence>();
  let tallied = 0;
  const keyOf = (turn: StoredTurn) => `${turn.turnId}:${narrationHash(turn.narration)}`;
  const judge = (prior: readonly StoredTurn[], turn: StoredTurn): JudgedTurn => {
    const i = judged.length;
    const clusters = turnMentionReading(readings, turn.turnId, turn.narration) ? readings[turn.turnId].clusters : undefined;
    const before = () => {
      for (; tallied < i; tallied++) mergeCandidateEvidence(tally, collectCandidateEvidence(prior[tallied].narration));
      return tally;
    };
    const found = clusters?.length
      ? clusterCandidates(turn.narration, clusters, exclusions, before, links)
      : { names: [], links: new Map<string, string>() };
    for (const [spelling, name] of found.links) if (!links.has(spelling)) links.set(spelling, name);
    const entry = { key: keyOf(turn), found, links: found.links.size ? new Map(links) : judged.at(-1)?.links ?? new Map<string, string>() };
    judged.push(entry);
    return entry;
  };
  return {
    at(prior, turn) {
      while (judged.length < prior.length) judge(prior, prior[judged.length]);
      const entry = judged[prior.length];
      if (!entry) return judge(prior, turn);
      // A list read out of walk order gets its own pass.
      return entry.key === keyOf(turn) ? entry : discoveryPass(readings, exclusions).at(prior, turn);
    },
  };
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
