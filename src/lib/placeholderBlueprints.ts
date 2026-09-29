// The Placeholders tab's Blueprints group: a system folder at the root whose shared placeholders are
// blueprints, read per bearer through copies (see lib/blueprints) and never as World placeholders. A chip or
// pin naming a blueprint belongs in blueprint-side text only: a world trait or group, a blueprint's values,
// a copy's values. A move across the group's edge that would strand one on the wrong side is refused.

import { entityTexts } from './entityTexts';
import { openingTexts } from './openings';
import { overviewTexts } from './overviewTexts';
import { isDescendantPlaceholderGroup, placeholderGroupOf } from './placeholderGroups';
import { allPlaceholders, placeholderHomeIndex, type PlaceholderHomesWorld } from './placeholderHomes';
import { directChipTargets } from './placeholders';
import type {
  Dictionary, GameLocation, Placeholder, PlaceholderGroup, PlaceholderPin, Stat, StatUpdate, Trait, TraitGroup,
  WorldOverview,
} from '@/types';

/** The world a blueprint move reads: every list a chip or a pin can sit in. */
export interface BlueprintUseWorld extends PlaceholderHomesWorld {
  traits?: Trait[];
  traitGroups?: TraitGroup[];
  locations?: GameLocation[];
  stats?: Stat[];
  statUpdates?: StatUpdate[];
  dictionaries?: Dictionary[];
  worldOverview?: WorldOverview | null;
}

/** The world's Blueprints group, when the author added one. */
export const blueprintsPlaceholderGroup = (groups: readonly PlaceholderGroup[]): PlaceholderGroup | undefined =>
  groups.find((g) => g.system === 'blueprints');

/** The shared placeholders in the Blueprints group or any folder below it. */
export function blueprintIds(world: PlaceholderHomesWorld): Set<string> {
  const groups = world.placeholderGroups ?? [];
  const root = blueprintsPlaceholderGroup(groups);
  if (!root) return new Set();
  return new Set((world.placeholders ?? []).flatMap((p) => {
    const groupId = placeholderGroupOf(groups, p);
    return groupId !== null && isDescendantPlaceholderGroup(groups, root.id, groupId) ? [p.id] : [];
  }));
}

/** The world's blueprints: its shared placeholders in the Blueprints group or any folder below it. */
export function worldBlueprints(world: PlaceholderHomesWorld): Placeholder[] {
  const ids = blueprintIds(world);
  return (world.placeholders ?? []).filter((p) => ids.has(p.id));
}

/** The top-level placeholder `p` sits under, walking its owners through `byId`. */
export function rootPlaceholder(p: Placeholder, byId: ReadonlyMap<string, Placeholder>): Placeholder {
  const seen = new Set<string>();
  let at = p;
  while (at.ownerId && !seen.has(at.id)) {
    seen.add(at.id);
    const up = byId.get(at.ownerId);
    if (!up) break;
    at = up;
  }
  return at;
}

/** How the tree and the notices name a copy. */
export const copyName = (ownerName: string, blueprintName: string): string => `${ownerName}.${blueprintName}`;

/** What names a placeholder, as a refusal lists it. */
export interface BlueprintUse {
  kind: 'trait' | 'blueprint' | 'copy' | 'entity' | 'location' | 'stat' | 'stat-update' | 'entry' | 'overview' | 'placeholder';
  name: string;
}

/** A refused move: the placeholders it would carry across the group's edge, and what ties them to their
 *  side. `out`: blueprint-side text uses them, or their values `reach` blueprints that stay. `into`:
 *  world-side text uses them. */
export interface BlueprintRefusal {
  reason: 'out' | 'into';
  names: string[];
  uses: BlueprintUse[];
  reaches?: string[];
}

/** One record whose text or pins can name a placeholder. `root` is the top-level placeholder a value
 *  source belongs to, so the values of a moving placeholder move with it. */
interface UseSource {
  use: BlueprintUse;
  blueprintSide: boolean;
  root?: string;
  ids: Set<string>;
}

const named = (texts: readonly (string | undefined)[], pins: readonly (PlaceholderPin | undefined)[] = [], also: readonly string[] = []): Set<string> => {
  const ids = directChipTargets(texts.filter((t): t is string => !!t));
  for (const pin of pins) if (pin) ids.add(pin.placeholderId);
  for (const id of also) ids.add(id);
  return ids;
};

const traitTexts = (t: Trait | TraitGroup) => [t.name, t.playerDescription, t.aiDescription];

/** Every record that can name a placeholder, each on its side of the Blueprints edge. */
function sourcesOfUse(world: BlueprintUseWorld, blueprints: ReadonlySet<string>): UseSource[] {
  const out: UseSource[] = [];
  const add = (kind: BlueprintUse['kind'], name: string, blueprintSide: boolean, ids: Set<string>, root?: string) => {
    if (ids.size) out.push({ use: { kind, name }, blueprintSide, ids, ...(root ? { root } : {}) });
  };
  const worldTraitNames = new Map((world.traits ?? []).map((t) => [t.id, t.name]));
  for (const t of world.traits ?? []) add('trait', t.name, true, named(traitTexts(t), t.placeholderPins));
  for (const g of world.traitGroups ?? []) add('trait', g.name, true, named(traitTexts(g)));
  for (const e of world.entities ?? []) {
    add('entity', e.name, false, named(entityTexts(e)));
    const own = (name: string) => `${e.name}'s ${name}`;
    for (const t of e.traits ?? []) add('trait', own(t.name), false, named(traitTexts(t), t.placeholderPins));
    for (const g of e.traitGroups ?? []) add('trait', own(g.name), false, named(traitTexts(g)));
    // A link's pins are the original's, overridden for one bearer.
    for (const link of e.traitLinks ?? []) {
      for (const [traitId, fields] of Object.entries(link.overrides ?? {})) {
        const pins = fields.placeholderPins?.value;
        if (pins) add('trait', own(worldTraitNames.get(traitId) ?? link.originalName), true, named([], pins));
      }
    }
  }
  for (const l of world.locations ?? []) {
    add('location', l.name, false, named([l.name, l.playerDescription, l.aiDescription, l.aiSummary, l.description, l.imageTags, ...openingTexts(l)], l.placeholderPins));
  }
  for (const s of world.stats ?? []) {
    const bands = s.descriptors ?? [];
    add('stat', s.name, false, named([s.name, s.description, ...bands.map((d) => d.description)], bands.flatMap((d) => d.placeholderPins ?? [])));
  }
  for (const u of world.statUpdates ?? []) add('stat-update', u.name, false, named([u.prompt]));
  for (const entry of (world.dictionaries ?? []).flatMap((b) => b.entries ?? [])) {
    add('entry', entry.name || entry.key?.[0] || '', false, named([entry.name, ...(entry.key ?? []), ...(entry.secondaryKeys ?? []), entry.value]));
  }
  const ov = world.worldOverview;
  if (ov) add('overview', ov.name || 'Overview', false, named([...overviewTexts(ov), ov.description]));

  const all = allPlaceholders(world);
  const byId = new Map(all.map((p) => [p.id, p]));
  const ownerName = new Map<string, string>();
  const homes = placeholderHomeIndex(world);
  const ownerNames = new Map([...(world.entities ?? []), ...(world.dictionaries ?? [])].map((o) => [o.id, o.name]));
  for (const p of all) {
    const home = homes.get(p.id);
    if (home && home.kind !== 'world') ownerName.set(p.id, ownerNames.get(home.ownerId) ?? '');
  }
  for (const p of all) {
    const root = rootPlaceholder(p, byId);
    const blueprint = byId.get(root.blueprintId ?? '');
    const kind = blueprints.has(root.id) ? 'blueprint' : root.blueprintId ? 'copy' : 'placeholder';
    const name = kind === 'copy' ? copyName(ownerName.get(root.id) ?? '', blueprint?.name ?? root.name) : root === p ? p.name : `${root.name} › ${p.name}`;
    const ids = named(p.values.map((v) => v.text), p.values.flatMap((v) => v.pins ?? []), p === root && p.blueprintId ? [p.blueprintId] : []);
    add(kind, name, kind !== 'placeholder', ids, root.id);
  }
  return out;
}

/** Each use once, in source order. */
const distinct = (uses: BlueprintUse[]): BlueprintUse[] => {
  const seen = new Set<string>();
  return uses.filter((u) => {
    const key = `${u.kind}\u0000${u.name}`;
    return !seen.has(key) && !!seen.add(key);
  });
};

/**
 * Why the lists in `after` may not replace `before`, or null when they may. A placeholder that leaves the
 * Blueprints group (moved, nested, sent to an owner, or its folder or the group removed) must not be used
 * by blueprint-side text, and its own values must not name a blueprint that stays. A placeholder that joins
 * must not be named by world-side text. Sources that move with it are its own.
 */
export function blueprintMoveRefusal(before: BlueprintUseWorld, after: PlaceholderHomesWorld): BlueprintRefusal | null {
  const was = blueprintIds(before);
  const now = blueprintIds({ ...before, ...after });
  const leaving = new Set([...was].filter((id) => !now.has(id)));
  const joining = new Set([...now].filter((id) => !was.has(id)));
  if (!leaving.size && !joining.size) return null;
  const sources = sourcesOfUse(before, was);
  const nameOf = (ids: ReadonlySet<string>) => (before.placeholders ?? []).filter((p) => ids.has(p.id)).map((p) => p.name);
  const hits = (source: UseSource, ids: ReadonlySet<string>) => [...ids].some((id) => source.ids.has(id));
  const moving = (source: UseSource, ids: ReadonlySet<string>) => !!source.root && ids.has(source.root);

  if (leaving.size) {
    const uses = sources.filter((s) => s.blueprintSide && !moving(s, leaving) && hits(s, leaving)).map((s) => s.use);
    const staying = new Set([...was].filter((id) => !leaving.has(id)));
    const reached = new Set(sources.filter((s) => moving(s, leaving)).flatMap((s) => [...s.ids].filter((id) => staying.has(id))));
    if (uses.length || reached.size) {
      return { reason: 'out', names: nameOf(leaving), uses: distinct(uses), ...(reached.size ? { reaches: nameOf(reached) } : {}) };
    }
  }
  if (joining.size) {
    const uses = sources.filter((s) => !s.blueprintSide && !moving(s, joining) && hits(s, joining)).map((s) => s.use);
    if (uses.length) return { reason: 'into', names: nameOf(joining), uses: distinct(uses) };
  }
  return null;
}
