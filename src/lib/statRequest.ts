import type { PlayerStat } from '@/types';
import type { StatPlacement } from './statContext';
import { stripMarkdown } from './stripMarkdown';
import { statChipPartValues } from './chipValues/chipValues';
import type { ChipScene } from './chipValues/chipScene';
import { maxKeyOf, statKeys } from './statKeys';
import type { ValueLookup } from './promptValues';
import { applyAiMaxChanges, applyAiStatChanges, parseStatUpdates } from './statChanges';
import { randomUUID } from './uuid';
import { scopeKey, type OwnerId } from './scope';
import type { ResponseSchema, ResponseSchemaNode } from './aiRequest/responseSchema';

const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const symbolKey = (name: string) => nameKey(name).replace(/\p{Variation_Selector}|[^\p{L}\p{N}\p{M}]/gu, '');

/** The heading every played entity's stats sit under, and their key in a schema reply. */
export const PLAYER_STAT_HEADING = 'Player Character';

/** The heading the global stats sit under, and their key in a schema reply. */
export const GLOBAL_STATS_HEADING = 'Global Stats';

export interface StatRequestTarget {
  id: string;
  name: string;
  plainName: string;
  /** The entity that owns the stat; null for a global stat. */
  ownerId: OwnerId;
  /** The owner's key in a schema reply. */
  ownerKey: string;
  /** The stat's key under its owner in a schema reply, holding its change: its plain name, numbered when
   *  the owner already uses that key. */
  key: string;
  /** The key beside it that holds the change to its maximum. */
  maxKey: string;
}

export interface StatRequestSnapshot {
  id: string;
  /** The played entities' targets first, then the global stats', then each entity owner's. */
  targets: StatRequestTarget[];
  /** The Stats chip over the global stats alone, for both passes. */
  context: ValueLookup;
  /** Each entity owner's key, in order. The text pass skips them. */
  entityKeys: string[];
  /** Every entity present this turn, stat-less ones included: the stat pass's In Scene. */
  inSceneIds: string[];
  /** The request takes the text pass, because its endpoint refused the schema. */
  textPass?: boolean;
}

/** An entity whose stats join the global stats in one request. */
export interface StatRequestOwner {
  id: string;
  /** Its heading in the request; a clash takes a numbered key. */
  name: string;
  /** Its live stats, names resolved. */
  stats: readonly PlayerStat[];
  /** Where its stats sit, group text resolved. Flat when absent. */
  placement?: StatPlacement;
}

export interface StatUpdateDiagnostic {
  name: string;
  /** `textPass` marks a reply the text pass wrote; it skips none of the played or global stats. `skipped` names an
   *  entity owner the text pass left out. */
  reason: 'ambiguous' | 'unknown' | 'invalid' | 'disabled' | 'missing' | 'textPass' | 'skipped';
}

export interface ResolvedStatUpdate {
  /** The entity whose stat this moves, null for a global stat; with `id`, the stat's address. */
  ownerId: OwnerId;
  id: string;
  name: string;
  value: number;
  max: number;
}

export interface StatResponse {
  requestId: string;
  updates: ResolvedStatUpdate[];
  diagnostics: StatUpdateDiagnostic[];
}

/** Unique owner keys, in order, after the keys already `taken`: a plain name, or its first free numbered form. */
function ownerKeys(names: readonly string[], taken: Set<string>): string[] {
  return names.map((name) => {
    const base = stripMarkdown(name).trim() || 'Character';
    let key = base;
    for (let n = 2; taken.has(key); n++) key = `${base} (${n})`;
    taken.add(key);
    return key;
  });
}

/** One owner's stats and the owner key they sit under in a schema reply. */
type OwnerPart = Pick<StatRequestOwner, 'stats' | 'placement'> & { id: OwnerId; ownerKey: string };

/** Each part's targets and its stats named by their keys, unique across the parts, in part order. */
function keyedParts(parts: readonly OwnerPart[]) {
  const plainNames = parts.flatMap((part) => part.stats.map(({ name }) => stripMarkdown(name).trim()));
  const keys = statKeys(plainNames);
  let at = 0;
  return parts.map((part) => {
    const start = at;
    at += part.stats.length;
    const targets: StatRequestTarget[] = part.stats.map(({ id, name }, i) => ({
      id, name, plainName: plainNames[start + i], ownerId: part.id, ownerKey: part.ownerKey, key: keys[start + i],
      maxKey: maxKeyOf(keys[start + i]),
    }));
    // The chip names each stat by its key, so a numbered key is the name the reply sees.
    const keyed = part.stats.map((stat, i) => ({ ...stat, name: keys[start + i] }));
    return { ownerKey: part.ownerKey, targets, stats: keyed, placement: part.placement };
  });
}

/** Capture the names and identities this stat request exposes, with plain names in every Stats chip. `stats`
 *  are the global stats, keyed Global Stats; `persona` and `played`, any other entity
 *  the player plays as, are keyed Player Character. Each of `entities` takes its own owner key. `inSceneIds`
 *  names every entity present this turn. */
export function createStatRequest(
  stats: readonly PlayerStat[],
  { textPass = false, entities = [], persona, played = [], placement, inSceneIds = [] }: {
    textPass?: boolean; entities?: readonly StatRequestOwner[]; persona?: StatRequestOwner;
    played?: readonly StatRequestOwner[]; placement?: StatPlacement; inSceneIds?: readonly string[];
  } = {},
): StatRequestSnapshot {
  const global: OwnerPart = { id: null, stats, placement, ownerKey: GLOBAL_STATS_HEADING };
  const own = [...(persona ? [persona] : []), ...played].map((owner) => ({ ...owner, ownerKey: PLAYER_STAT_HEADING }));
  // Stat keys run global, persona, played, as the narration's chips number a played stat.
  const [globalPart, ...personaParts] = keyedParts([global, ...own]);
  const owners = entities.filter((owner) => owner.stats.length);
  const keys = ownerKeys(owners.map((owner) => owner.name), new Set([PLAYER_STAT_HEADING, GLOBAL_STATS_HEADING]));
  const sections = owners.flatMap((owner, i) => keyedParts([{ ...owner, ownerKey: keys[i] }]));
  return {
    id: randomUUID(),
    targets: [...personaParts, globalPart, ...sections].flatMap((part) => part.targets),
    context: statChipPartValues([globalPart]),
    entityKeys: keys,
    inSceneIds: [...inSceneIds],
    ...(textPass && { textPass }),
  };
}

/** `scene` with each stat the request keys named by its key: the world's, each played entity's and each owned
 *  by an entity. Each entity owner reads as its owner key, and In Scene holds the request's present entities.
 *  The stat pass renders its chips from this scene. A stat the request does not hold keeps its name, and
 *  `scene` itself is left as it was. */
export function keyedScene(scene: ChipScene, snapshot: StatRequestSnapshot): ChipScene {
  if (!snapshot.targets.length) return scene;
  const keys = new Map(snapshot.targets.map((target) => [targetKey(target.ownerId, target.id), target.key]));
  const keyed = (ownerId: OwnerId, stats: readonly PlayerStat[]): PlayerStat[] => stats.map((stat) => {
    const key = keys.get(targetKey(ownerId, stat.id));
    return key === undefined || key === stat.name ? stat : { ...stat, name: key };
  });
  const entityKeys = new Set(snapshot.entityKeys);
  const entityOwnerKeys = new Map(snapshot.targets.filter((t) => entityKeys.has(t.ownerKey)).map((t) => [t.ownerId, t.ownerKey]));
  return {
    ...scene,
    entities: scene.entities.map((entity) => {
      const key = entityOwnerKeys.get(entity.id);
      return key === undefined || key === entity.name ? entity : { ...entity, name: key };
    }),
    inSceneIds: snapshot.inSceneIds,
    inSceneNames: [],
    stats: keyed(null, scene.stats),
    playedStats: scene.playedStats?.map((part) => ({ ...part, stats: keyed(part.ownerId, part.stats) })),
    ownedStats: scene.ownedStats && Object.fromEntries(
      Object.entries(scene.ownedStats).map(([ownerId, stats]) => [ownerId, keyed(ownerId, stats)]),
    ),
  };
}

/** One stat's address: its scope, then its id. */
const targetKey = (ownerId: OwnerId, statId: string) => `${scopeKey(ownerId)}/${statId}`;

/** The played and global targets, with no entity owner's: what the text pass asks about. */
export function textPassTargets(snapshot: StatRequestSnapshot): StatRequestTarget[] {
  const entityKeys = new Set(snapshot.entityKeys);
  return snapshot.targets.filter((target) => !entityKeys.has(target.ownerKey));
}

const integerNode = (): ResponseSchemaNode => ({ type: 'integer' });

const fixedObject = (properties: Record<string, ResponseSchemaNode>): ResponseSchemaNode =>
  ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });

/** The fixed reply shape: every owner, and under it every stat's change beside its max change, all
 *  required. A bare signed number per key keeps the sign the model writes. */
export function statRequestSchema(snapshot: StatRequestSnapshot): ResponseSchema {
  const owners = new Map<string, Record<string, ResponseSchemaNode>>();
  for (const target of snapshot.targets) {
    const stats = owners.get(target.ownerKey) ?? {};
    stats[target.key] = integerNode();
    stats[target.maxKey] = integerNode();
    owners.set(target.ownerKey, stats);
  }
  return {
    name: 'stat_changes',
    schema: fixedObject(Object.fromEntries([...owners].map(([key, stats]) => [key, fixedObject(stats)]))),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A reply's JSON object; `undefined` when the reply is not JSON-shaped, `null` when it is but won't parse. */
function jsonReply(raw: string): Record<string, unknown> | null | undefined {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!text.startsWith('{')) return undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const whole = (n: unknown): number | null => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null);

/** Read a schema reply by the owner, stat and max keys the request sent. */
function readSchemaReply(reply: Record<string, unknown>, snapshot: StatRequestSnapshot): StatResponse {
  const updates = new Map<StatRequestTarget, ResolvedStatUpdate>();
  const diagnostics: StatUpdateDiagnostic[] = [];
  for (const [ownerKey, stats] of Object.entries(reply)) {
    const owned = snapshot.targets.filter((target) => target.ownerKey === ownerKey);
    if (!owned.length || !isRecord(stats)) {
      diagnostics.push({ name: ownerKey, reason: owned.length ? 'invalid' : 'unknown' });
      continue;
    }
    for (const [key, entry] of Object.entries(stats)) {
      const target = owned.find((candidate) => candidate.key === key || candidate.maxKey === key);
      const amount = whole(entry);
      if (!target || amount === null) {
        diagnostics.push({ name: key, reason: target ? 'invalid' : 'unknown' });
        continue;
      }
      const update = updates.get(target) ?? { ownerId: target.ownerId, id: target.id, name: target.name, value: 0, max: 0 };
      if (key === target.key) update.value += amount;
      else update.max += amount;
      updates.set(target, update);
    }
  }
  return { requestId: snapshot.id, updates: [...updates.values()].filter((u) => u.value || u.max), diagnostics };
}

/** Match replies against the request's names before later pins can rename their stats. A schema reply reads
 *  by key; any other reply is the text pass's lines. */
export function readStatResponse(raw: string, snapshot: StatRequestSnapshot): StatResponse {
  const reply = jsonReply(raw);
  if (reply) return readSchemaReply(reply, snapshot);
  if (reply === null) return { requestId: snapshot.id, updates: [], diagnostics: [{ name: raw.trim(), reason: 'invalid' }] };
  const updates = new Map<string, ResolvedStatUpdate>();
  // A refused schema, or a server that ignored one, leaves the text pass's lines; an empty reply is one too.
  const diagnostics: StatUpdateDiagnostic[] = [
    { name: '', reason: 'textPass' }, ...snapshot.entityKeys.map((name) => ({ name, reason: 'skipped' as const })),
  ];
  const targets = textPassTargets(snapshot);
  for (const line of raw.split('\n').filter((text) => text.trim())) {
    const plain = stripMarkdown(line);
    const separator = plain.lastIndexOf(':');
    const name = plain.slice(0, separator).trim();
    const { values, maxes } = parseStatUpdates(`stat:${plain.slice(separator + 1)}`);
    if (separator < 0 || !name || (values.stat === undefined && maxes.stat === undefined)) {
      diagnostics.push({ name: line.trim(), reason: 'invalid' });
      continue;
    }
    const rawName = line.slice(0, line.lastIndexOf(':')).trim().replace(/^[-*+]\s+/, '');
    let matches = nameKey(rawName) !== nameKey(name)
      ? targets.filter((target) => nameKey(target.name) === nameKey(rawName)) : [];
    const byKey = targets.filter((target) => nameKey(target.key) === nameKey(name));
    if (!matches.length && byKey.length === 1) matches = byKey;
    if (!matches.length) matches = targets.filter((target) => nameKey(target.plainName) === nameKey(name));
    if (!matches.length && symbolKey(name)) {
      matches = targets.filter((target) => symbolKey(target.plainName) === symbolKey(name));
    }
    if (matches.length !== 1) {
      diagnostics.push({ name, reason: matches.length ? 'ambiguous' : 'unknown' });
      continue;
    }
    const target = matches[0];
    const key = targetKey(target.ownerId, target.id);
    const update = updates.get(key) ?? { ownerId: target.ownerId, id: target.id, name: target.name, value: 0, max: 0 };
    update.value += values.stat ?? 0;
    update.max += maxes.stat ?? 0;
    updates.set(key, update);
  }
  return { requestId: snapshot.id, updates: [...updates.values()], diagnostics };
}

/** Apply `ownerId`'s updates to that owner's `stats`, caps before values, by identity, preserving authored
 *  text and enforcing the owner's live set. The response's own diagnostics come back with the owner's. */
export function applyStatResponse(
  stats: PlayerStat[],
  response: StatResponse,
  enabledIds: ReadonlySet<string>,
  ownerId: OwnerId = null,
): { stats: PlayerStat[]; diagnostics: StatUpdateDiagnostic[] } {
  const owned = response.updates.filter((update) => update.ownerId === ownerId);
  const byId = new Map(owned.map((update) => [update.id, update]));
  const presentIds = new Set(stats.map((stat) => stat.id));
  const diagnostics = [...response.diagnostics];
  for (const update of owned) {
    if (!presentIds.has(update.id)) diagnostics.push({ name: update.name, reason: 'missing' });
    else if (!enabledIds.has(update.id)) diagnostics.push({ name: update.name, reason: 'disabled' });
  }
  return {
    stats: stats.map((stat) => {
      const update = byId.get(stat.id);
      if (!update || !enabledIds.has(stat.id)) return stat;
      const key = stat.name.toLowerCase();
      const capped = applyAiMaxChanges([stat], { [key]: update.max });
      return applyAiStatChanges(capped, { [key]: update.value })[0];
    }),
    diagnostics,
  };
}

/** The history's change map: the global stats alone, by name; request identities stay transient. */
export function statResponseChanges(response: StatResponse): Record<string, number>[] {
  return response.updates.filter((update) => update.ownerId === null && update.value !== 0)
    .map((update) => ({ [update.name.toLowerCase()]: update.value }));
}
