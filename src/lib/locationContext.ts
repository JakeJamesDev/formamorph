import type { Connection, Entity, GameLocation, PlayerStat } from "@/types";
import { statContextRuns, statPlacementOf, type ContextFormat, type StatPieces } from "./statContext";
import { indentRuns, joinRuns, mark, runs, textOf, type MarkedRun, type MarkedText, type TextOrigin } from "./markedText";
import { entityIdsAt, entityIdsAtAny, knownHere, knownInOf } from "./entityPresence";
import type { RelationshipLines } from "./entityRelationships";
import { effectiveDestinations, type LocationLink } from "./locationGraph";
import { buildTraitContext, traitsInContextOrder } from "./traitTree";
import { NONE_PLACEHOLDER } from "./promptFallbacks";
import { decodeChipKey, decodeVariant, tokenVariant, variableForToken } from "./promptVariables";
import { fromMarked, memoLookup, type ValueLookup } from "./promptValues";
import { xmlEscape } from "./utils";

/** The location a builder is scoped to, or none at all (no world, or nowhere resolved yet). */
type MaybeLocation = GameLocation | null;

/** Section-style shape a context builder renders in (mirrors the chip format axis). */

const pickDescription = (preferSummary: boolean, summary?: string, description?: string) =>
  preferSummary ? summary?.trim() || description : description;

/** The field key for the text `pickDescription` chose: `summary` when an authored summary won, else `description`. */
const descriptionKey = (preferSummary: boolean, summary?: string) =>
  (preferSummary && summary?.trim() ? "summary" : "description");

/** Which authored text a location or entity reaches the AI as. `none` means the item lists as a bare name. */
export type ContextDelivery = 'full' | 'summary' | 'none';

/** How one item's description arrives in a *list* (a roster or a location list) under `preferSummary` — the
 *  classification of the choice `pickDescription` makes, so a surface reporting summary-vs-full can never
 *  disagree with what was rendered. `summary` only where a summary was actually authored; a blank one falls
 *  through to full. Not the current-location block, which also falls back to the legacy `description`. */
export function contextDelivery(
  item: { aiSummary?: string; aiDescription?: string },
  preferSummary: boolean,
): ContextDelivery {
  const text = pickDescription(preferSummary, item.aiSummary, item.aiDescription);
  if (!text || text.trim() === '') return 'none';
  return preferSummary && item.aiSummary?.trim() ? 'summary' : 'full';
}

// The extra fields — beyond name and description, which are handled explicitly — that each builder feeds the
// AI. An ALLOWLIST, not a denylist: everything else on a location/entity (media, ids, editor-only flags,
// image tags, placeholder defs) is excluded by default, so a newly added world field can never silently leak
// into the prompt. To surface a new field to the AI, add it here.
const AI_LOCATION_FIELDS: readonly (keyof GameLocation)[] = [];
const AI_ENTITY_FIELDS: readonly (keyof Entity)[] = ['type'];

/** Append an item's allow-listed fields as `key: value` lines, skipping blanks so empty fields don't pad the
 *  prompt or print "undefined". `field` shapes each line (plain or markdown, per the caller). */
function appendAllowedFields<T>(
  item: T,
  keys: readonly (keyof T)[],
  field: (key: string, value: string | number | boolean) => string,
): string {
  let out = '';
  for (const key of keys) {
    const value = item[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    out += field(String(key), value as unknown as string | number | boolean);
  }
  return out;
}

/** Emit a one-line-per-location list (`name: summary` / `- **name:** summary`) — the shared body of the
 *  sublocations / destinations / reachable builders, which differ only in which locations they pass. */
function buildLocationList(
  items: GameLocation[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean; hints?: Map<string, string> } = {},
): string {
  const { preferSummary = false, format = "simple", nameOnly = false, hints } = opts;
  // Names alone, for a chip used mid-sentence. Format is deliberately ignored: a bare list has no
  // headings or fields to decorate, so all three styles would render identically anyway.
  if (nameOnly) return items.map((i) => i.name).join(", ");
  let output = "";
  for (const item of items) {
    const desc = pickDescription(preferSummary, item.aiSummary, item.aiDescription);
    const hasDesc = !!desc && desc.trim() !== "";
    const hint = hints?.get(item.id)?.trim();
    if (format === "xml") {
      let inner = `  <name>${xmlEscape(item.name)}</name>\n`;
      const key = descriptionKey(preferSummary, item.aiSummary);
      if (hasDesc) inner += `  <${key}>${xmlEscape(desc!)}</${key}>\n`;
      if (hint) inner += `  <via>${xmlEscape(hint)}</via>\n`;
      output += `<location>\n${inner}</location>\n`;
      continue;
    }
    const suffix = hint ? ` — via ${hint}` : "";
    if (format === "markdown") output += hasDesc ? `- **${item.name}:** ${desc}${suffix}\n` : `- **${item.name}**${suffix}\n`;
    else output += hasDesc ? `${item.name}: ${desc}${suffix}\n` : `${item.name}${suffix}\n`;
  }
  return output;
}

/**
 * Serialize the current location into the plain-text block the AI prompts inject for
 * `<LOCATION>`. Blank fields are skipped so empty values don't confuse smaller models, and
 * media/editor-only fields are never dumped. Entities are emitted separately by `buildEntityContext`.
 *
 * `preferSummary` makes the location emit its short `aiSummary` (falling back to the full
 * `aiDescription` when no summary is authored) — used by the lightweight precall planning request.
 *
 * `format` mirrors the Default/Simple presets: `'simple'` is plain `key: value` lines; `'markdown'` is a
 * bold-key bullet per field (`- **key:** value`) a small model sections more cleanly; `'xml'` is a `<key>`
 * child tag per field (the wrapping section tag stands in for a `<location>` element).
 */
export function buildLocationContext(
  location: MaybeLocation,
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!location) return NONE_PLACEHOLDER;

  const { preferSummary = false, format = "simple", nameOnly = false } = opts;
  if (nameOnly) return location.name;
  const field = (key: string, value: string | number | boolean) =>
    format === "xml" ? `<${key}>${xmlEscape(String(value))}</${key}>\n`
    : format === "markdown" ? `- **${key}:** ${value}\n`
    : `${key}: ${value}\n`;

  // Name, then description. The legacy `description` is a last resort: migration never folds it, so a
  // pre-audience-split world may carry only that. Used only when no authored AI text exists, emitted once
  // under the same key.
  let output = field("name", location.name);
  const locationDescription = pickDescription(preferSummary, location.aiSummary, location.aiDescription) || location.description;
  if (locationDescription && locationDescription.trim() !== "") {
    output += field(descriptionKey(preferSummary, location.aiSummary), locationDescription);
  }
  output += appendAllowedFields(location, AI_LOCATION_FIELDS, field);
  return output;
}

/** Entity id → the ids of its owned traits in force. Absent entity ⇒ none. */
export type OwnedTraitsInForce = Readonly<Record<string, readonly string[]>>;

/** Entity id → the stats it owns that are switched on, at their current values. Absent entity ⇒ none. */
export type OwnedStatsInForce = Readonly<Record<string, readonly PlayerStat[]>>;

/** Which kinds an entity must own, at least one, to stay in a roster. */
export type OnlyWith = { stats?: boolean; traits?: boolean };

/** How a roster renders: the chip content and format, each entity's owned traits in force, and the owned
 *  stats to list under it. Absent `ownedStats` lists none. `onlyWith` filters on what the scene owns, so it
 *  counts `ownedTraits` and `ownedStats` whether or not the roster lists them. */
export type RosterOpts = {
  preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean; ownedTraits?: OwnedTraitsInForce; ownedStats?: OwnedStatsInForce;
  onlyWith?: OnlyWith;
  /** Leave owned traits out. */
  noTraits?: boolean;
  /** Leave owned stats out. */
  noStats?: boolean;
  /** The pieces an owned stat line carries; all three when absent. */
  statPieces?: StatPieces;
  /** The relationship sentences each entity's block prints. None when absent. */
  relationshipLines?: RelationshipLines;
};

/** The known roster's options: `excludeIds` drops whom a higher scope lists; `pulledIds` join it through a relationship. */
export type KnownRosterOpts = RosterOpts & { excludeIds?: readonly string[]; pulledIds?: readonly string[] };

const ALL_STAT_PIECES: StatPieces = { values: true, status: true, meaning: true };

/** Whether `opts` filters the roster at all. */
export const hasOnlyWith = (opts: Pick<RosterOpts, "onlyWith">): boolean => !!(opts.onlyWith?.stats || opts.onlyWith?.traits);

/** Whether an entity owns a picked kind in force: an entry in `ownedStats` for Stats, in `ownedTraits` for
 *  Traits. True for every entity when no filter is on. */
export function passesOnlyWith(entityId: string, opts: Pick<RosterOpts, "onlyWith" | "ownedTraits" | "ownedStats">): boolean {
  if (!hasOnlyWith(opts)) return true;
  const { onlyWith, ownedTraits, ownedStats } = opts;
  return !!((onlyWith?.stats && ownedStats?.[entityId]?.length) || (onlyWith?.traits && ownedTraits?.[entityId]?.length));
}

/** An entity's owned stats as roster field lines, nested as its traits are and under its stat groups, or ''
 *  when it holds none. `pieces` picks the parts of each stat line. */
export function ownedStatLines(
  entity: Entity, stats: readonly PlayerStat[], format: ContextFormat, pieces: StatPieces = ALL_STAT_PIECES,
): string {
  return textOf(ownedStatRuns(entity, stats, format, pieces));
}

/** {@link ownedStatLines} as runs marked as stats lines. */
function ownedStatRuns(
  entity: Entity, stats: readonly PlayerStat[], format: ContextFormat, pieces: StatPieces = ALL_STAT_PIECES,
): MarkedRun[] {
  if (!stats.length) return [];
  const block = indentRuns(statContextRuns([...stats], pieces, format, statPlacementOf(entity)), "    ");
  if (format === "xml") return mark(["stats"], "  <stats>\n", block, "\n  </stats>\n");
  return mark(["stats"], `${format === "markdown" ? "  - **stats:**" : "  stats:"}\n`, block, "\n");
}

/** An entity's owned traits in force as roster field lines marked as traits lines, or none when none is. */
function ownedTraitRuns(
  entity: Entity,
  ids: readonly string[],
  preferSummary: boolean,
  format: ContextFormat,
  field: (key: string, value: string) => string,
): MarkedRun[] {
  const traits = entity.traits ?? [];
  const groups = entity.traitGroups ?? [];
  const inForce = traitsInContextOrder(ids, traits, groups);
  if (!inForce.length) return [];
  if (preferSummary) return mark(["traits"], field("traits", inForce.map((t) => t.name).join(", ")));
  const block = indentRuns(runs(buildTraitContext(ids, traits, groups, format)), "    ");
  if (format === "xml") return mark(["traits"], "  <traits>\n", block, "\n  </traits>\n");
  return mark(["traits"], `${format === "markdown" ? "  - **traits:**" : "  traits:"}\n`, block, "\n");
}

/** The placeholder a roster that lists no one renders, marked as Only With's while a filter is on. */
export const emptyRosterRuns = (opts: Pick<RosterOpts, "onlyWith">): MarkedRun[] =>
  mark(hasOnlyWith(opts) ? ["ownsStats", "ownsTraits"] : [], NONE_PLACEHOLDER);

/** The Only With picks an entity passes, as the origins its block carries. */
export function ownedKinds(entityId: string, opts: Pick<RosterOpts, "ownedTraits" | "ownedStats">): TextOrigin[] {
  return [
    ...(opts.ownedStats?.[entityId]?.length ? ["ownsStats" as const] : []),
    ...(opts.ownedTraits?.[entityId]?.length ? ["ownsTraits" as const] : []),
  ];
}

/**
 * Serialize a roster of entity ids into the block the AI prompts inject for `<ENTITIES>` — a top-level
 * list, separate from the location so the model reads the cast as "characters/things that could appear
 * here" rather than all-present-and-involved. Shared by every entity scope, which differ only in which ids
 * they gather. Returns the `N/A` placeholder when the roster is empty or nothing in it resolves.
 *
 * `format` mirrors the Default/Simple presets: `'simple'` leads each entity with its bare name and plain
 * `key: value` fields indented under it; `'markdown'` makes the name a bold subject bullet with nested
 * bold-key field bullets (`- **Name**` / `  - **key:** value`); `'xml'` wraps each entity in `<entity>` with
 * a `<name>` and one `<key>` child per field.
 *
 * `ownedTraits` names each entity's owned traits in force. The full content nests them under a `traits`
 * field as the Traits chip renders them; the summary content lists their names on one `traits` line.
 */
export function renderEntityRoster(
  allIds: string[],
  entities: Entity[],
  opts: RosterOpts = {},
): string {
  return textOf(entityRosterRuns(allIds, entities, opts));
}

/** {@link renderEntityRoster} as marked runs: each entity block marked with the Only With picks it passes,
 *  and its content, traits and stats lines marked as theirs. */
export function entityRosterRuns(
  allIds: string[],
  entities: Entity[],
  opts: RosterOpts = {},
): MarkedRun[] {
  const { preferSummary = false, format = "simple", nameOnly = false, ownedTraits, ownedStats, noTraits, noStats, statPieces, relationshipLines } = opts;
  const entityIds = allIds.filter((id) => passesOnlyWith(id, opts));
  if (nameOnly) {
    const named = entityIds.flatMap((id) => {
      const name = entities.find((e) => e.id === id)?.name;
      return name ? [mark(["content", ...ownedKinds(id, opts)], name)] : [];
    });
    return named.length ? joinRuns(named, ", ") : emptyRosterRuns(opts);
  }
  const md = format === "markdown";
  const xml = format === "xml";
  const head = (name: string) => (md ? `- **${name}**\n` : `${name}\n`);
  const field = (key: string, value: string | number | boolean) =>
    xml ? `  <${key}>${xmlEscape(String(value))}</${key}>\n`
    : md ? `  - **${key}:** ${value}\n`
    : `  ${key}: ${value}\n`;
  if (entityIds.length === 0) return emptyRosterRuns(opts);

  const output: MarkedRun[] = [];
  entityIds.forEach((entityId: string) => {
    const entityItem = entities.find((f) => f.id === entityId);
    if (!entityItem) return;
    const entityDescription = pickDescription(preferSummary, entityItem.aiSummary, entityItem.aiDescription);
    const hasDesc = !!entityDescription && entityDescription.trim() !== "";
    const descKey = descriptionKey(preferSummary, entityItem.aiSummary);
    // Aliases render explicitly (not via the scalar allowlist): joined, and under a spaced label the
    // small models read naturally — except in xml, where a tag name can't contain spaces.
    const aliases = (entityItem.aliases ?? []).map((a) => a.trim()).filter(Boolean);
    const aliasLine = aliases.length
      ? field(xml ? "aliases" : "also known as", aliases.join(", "))
      : "";
    const pronouns = entityItem.pronouns?.trim();
    const pronounLine = pronouns ? field("pronouns", pronouns) : "";
    const ownedLines = runs(
      noTraits ? "" : ownedTraitRuns(entityItem, ownedTraits?.[entityItem.id] ?? [], preferSummary, format, field),
      noStats ? "" : ownedStatRuns(entityItem, ownedStats?.[entityItem.id] ?? [], format, statPieces),
    );
    const fields = runs(
      aliasLine,
      pronounLine,
      hasDesc ? mark(["content"], field(descKey, entityDescription!)) : "",
      appendAllowedFields(entityItem, AI_ENTITY_FIELDS, field),
      (relationshipLines?.[entityItem.id] ?? []).map((line) => field("relationship", line)).join(""),
      ownedLines,
    );
    const block = xml
      ? runs("<entity>\n", field("name", entityItem.name), fields, "</entity>\n")
      : runs(head(entityItem.name), fields);
    output.push(...mark(ownedKinds(entityItem.id, opts), block));
  });

  // All listed ids failed to resolve to a real entity → treat as empty.
  return output.length ? output : emptyRosterRuns(opts);
}

/**
 * Serialize the cast belonging to the current location — the `<ENTITIES>` roster. Membership is
 * entity-owned (ADR-0003), so the roster is the inversion of `entities`, in their authored order.
 * Returns the `N/A` placeholder when the location is null or nobody belongs to it. `preferSummary` and
 * `format` mirror `renderEntityRoster`.
 */
export function buildEntityContext(
  location: MaybeLocation,
  entities: Entity[],
  opts: RosterOpts = {},
): string {
  if (!location) return NONE_PLACEHOLDER;
  return renderEntityRoster(entityIdsAt(location.id, entities), entities, opts);
}

/**
 * Serialize the current location's **direct** sub-locations for the `<LOCATION|sublocations>` chip — one line per
 * child (`name: <summary>` / `- **name:** <summary>`), the summary chosen like the other builders. Returns
 * the `N/A` placeholder when the location is null or has no children. Nesting is revealed a level at a time:
 * only immediate children, not the whole descendant subtree.
 */
export function buildSublocationsContext(
  current: MaybeLocation,
  locations: GameLocation[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const kids = locations.filter((l) => (l.parentId ?? null) === current.id);
  if (kids.length === 0) return NONE_PLACEHOLDER;
  return buildLocationList(kids, opts);
}

/** The entities a roster of places they aren't present at may list: those whose Known In is Nearby. */
const nearbyKnown = (entities: Entity[]) => entities.filter((e) => knownInOf(e) === "nearby");

/** The deduped ids of the Nearby entities across the current location's direct sub-locations. */
export function sublocationEntityIds(current: MaybeLocation, locations: GameLocation[], entities: Entity[]): string[] {
  if (!current) return [];
  const kids = locations.filter((l) => (l.parentId ?? null) === current.id);
  return entityIdsAtAny(kids.map((k) => k.id), nearbyKnown(entities));
}

/**
 * Serialize the characters/things located in the current location's direct sub-locations for the
 * `<ENTITIES|sublocations>` chip. Gathers + dedupes the children's entity ids and delegates to
 * `buildEntityContext` (a synthetic location holding those ids), so the roster shaping matches the main
 * entities section. `excludeIds` drops anyone already shown in a higher-precedence roster (present here) so a
 * character never double-lists across scopes. Returns the `N/A` placeholder when nothing remains.
 */
export function buildSublocationEntitiesContext(
  current: MaybeLocation,
  locations: GameLocation[],
  entities: Entity[],
  opts: RosterOpts & { excludeIds?: string[] } = {},
): string {
  return textOf(sublocationEntityRuns(current, locations, entities, opts));
}

/** {@link buildSublocationEntitiesContext} as marked runs. */
export function sublocationEntityRuns(
  current: MaybeLocation,
  locations: GameLocation[],
  entities: Entity[],
  opts: RosterOpts & { excludeIds?: string[] } = {},
): MarkedRun[] {
  if (!current) return runs(NONE_PLACEHOLDER);
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = sublocationEntityIds(current, locations, entities).filter((id) => !exclude.has(id));
  return entityRosterRuns(ids, entities, opts);
}

/** One place the player can move to, and how the trip is made. */
export interface DestinationEntry<L extends LocationLink = GameLocation> {
  location: L;
  /** The travel hint of the Connection leg that reaches this place. Absent for implicit travel and for a
   *  hintless leg. */
  hint?: string;
  via: "implicit" | "connection";
}

/** The current location's effective destinations paired with the travel hint each one is reached by, in
 *  `lib/locationGraph` order. Exported so a surface that lists the destinations reads the same closed set the
 *  prompt block renders from — a second computation could disagree with where a player can actually go. */
export function navigableDestinationEntries<L extends LocationLink = GameLocation>(
  current: Pick<GameLocation, "id"> | null,
  locations: readonly L[],
  connections: readonly Connection[],
): DestinationEntry<L>[] {
  if (!current) return [];
  const byId = new Map(locations.map((l) => [l.id, l]));
  const entries: DestinationEntry<L>[] = [];
  for (const [id, via] of effectiveDestinations(current.id, locations, connections)) {
    const location = byId.get(id);
    if (!location) continue; // a Connection pointing at a deleted location reaches nowhere
    entries.push({
      location,
      hint: via.via === "connection" ? via.leg.hint : undefined,
      via: via.via,
    });
  }
  return entries;
}

/**
 * The places the player can move to from the current location — the **local navigable graph** under the
 * effective-navigation rule (ADR-0002): its implicit neighbors (containing location, sub-locations,
 * siblings) for every pair no Connection covers, plus the Connections leaving it. Deduped by id, current
 * excluded. This is the location router's whole world: the only candidates fed to the model and the only
 * names its reply is matched against, which is what makes a one-way link structural — the return trip is
 * never offered rather than verbally forbidden.
 */
export function navigableDestinations(
  current: MaybeLocation,
  locations: GameLocation[],
  connections: Connection[],
): GameLocation[] {
  return navigableDestinationEntries(current, locations, connections).map((e) => e.location);
}

/**
 * Serialize the current location's navigable destinations for the `<LOCATION|destinations>` chip — one line per
 * place (`name: <summary>` / `- **name:** <summary>`), the summary chosen like the other builders. A
 * Connection's travel hint trails its line as `— via <hint>`, so the model knows how the trip is made.
 * Returns `N/A` when the location is null or nothing is reachable.
 */
export function buildDestinationsContext(
  current: MaybeLocation,
  locations: GameLocation[],
  connections: Connection[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const entries = navigableDestinationEntries(current, locations, connections);
  if (entries.length === 0) return NONE_PLACEHOLDER;
  const hints = new Map(entries.filter((e) => e.hint).map((e) => [e.location.id, e.hint!]));
  return buildLocationList(entries.map((e) => e.location), { ...opts, hints });
}

/**
 * The locations reachable from the current one without going deeper: the containing location first, then its
 * siblings (the parent's other children). The parent is what makes nesting two-way — without it a sub-location
 * with no children and no siblings has nowhere to go and the player is stranded there.
 */
function reachableLocations(current: GameLocation, locations: GameLocation[]): GameLocation[] {
  const parentId = current.parentId ?? null;
  if (parentId === null) return []; // top-level → no containing region → nothing reachable
  const parent = locations.find((l) => l.id === parentId);
  const siblings = locations.filter((l) => l.id !== current.id && (l.parentId ?? null) === parentId);
  return parent ? [parent, ...siblings] : siblings; // a parentId pointing at nothing leaves just the siblings
}

/**
 * Serialize the single location that contains the current one, for the `<LOCATION|parent>` chip. Narrower
 * than `reachable` (which is the parent *plus* its other children) because a sentence naming where you are
 * usually wants only the containing place: "the kitchen, inside the Old Mill". Returns `N/A` at the top
 * level, so an affixed placement disappears rather than trailing a dangling preposition.
 */
export function buildParentLocationContext(
  current: MaybeLocation,
  locations: GameLocation[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const parentId = current.parentId ?? null;
  const parent = parentId === null ? undefined : locations.find((l) => l.id === parentId);
  return parent ? buildLocationList([parent], opts) : NONE_PLACEHOLDER;
}

/**
 * Serialize the characters who have actually taken part in the recent scene for the `<ENTITIES|inscene>`
 * chip. `names` comes from the turns' recorded participants, so it includes characters the narration
 * invented that no authored entity matches — those carry no description, so they appear only in the
 * name-only rendering. Returns `N/A` when nobody has taken part.
 */
export function buildSceneEntitiesContext(
  names: string[],
  entities: Entity[],
  opts: RosterOpts = {},
): string {
  if (names.length === 0) return NONE_PLACEHOLDER;
  // A name with no entity record owns nothing, so a filter drops it with the roster path below.
  if (opts.nameOnly && !hasOnlyWith(opts)) return names.join(', ');
  const ids = names.map((n) => entityNamed(entities, n)?.id).filter((id): id is string => !!id);
  return renderEntityRoster(ids, entities, opts);
}

/** The entity a narration name refers to, matched without case or edge spaces; none for an ad-hoc name. */
export function entityNamed(entities: Entity[], name: string): Entity | undefined {
  const wanted = name.trim().toLowerCase();
  return entities.find((e) => e.name.trim().toLowerCase() === wanted);
}

/**
 * `names` minus the defined entities that belong somewhere other than `hereIds` — the phantom-presence
 * filter for the now-line. A character the dialogue keeps naming is otherwise asserted present in a
 * scene they were never in. A name matching no defined entity is kept: ad-hoc and just-discovered
 * characters have no location membership to check against, and visitors already reach `hereIds` through
 * the discovered-entity path.
 */
export function scenePresentHere(names: string[], entities: Entity[], hereIds: string[]): string[] {
  const here = new Set(hereIds);
  return names.filter((name) => {
    const defined = entityNamed(entities, name);
    return !defined || here.has(defined.id);
  });
}

/** The deduped ids of the Nearby entities across the current location's reachable locations: the parent and
 *  siblings, or its effective destinations when it sets `nearbyUsesConnections`. */
export function reachableEntityIds(
  current: MaybeLocation, locations: GameLocation[], connections: Connection[], entities: Entity[],
): string[] {
  if (!current) return [];
  const reach = current.nearbyUsesConnections
    ? [...effectiveDestinations(current.id, locations, connections).keys()]
    : reachableLocations(current, locations).map((l) => l.id);
  return entityIdsAtAny(reach, nearbyKnown(entities));
}

/** The ids of the entities known at the current location, in cast order: one of each one's Known In picks is
 *  the location or contains it, or it is in `pulledIds`. The Custom Persona is never listed; the played persona
 *  is not in the cast play passes. */
export function knownEntityIds(current: MaybeLocation, locations: GameLocation[], entities: Entity[], pulledIds: readonly string[] = []): string[] {
  const known = new Set(current ? knownHere(current.id, locations, entities).map((row) => row.entity.id) : []);
  const pulled = new Set(pulledIds);
  return entities.flatMap((e) => (known.has(e.id) || (pulled.has(e.id) && !e.customPersona) ? [e.id] : []));
}

/**
 * Serialize the entities known at the current location but not present, for the `<ENTITIES|known>` chip. Each
 * sends its name and summary only: Full renders as Summary, and owned traits and stats are left out.
 * `pulledIds` join it through a relationship. `excludeIds` drops anyone a higher-precedence roster lists.
 * Returns `N/A` when no one remains.
 */
export function buildKnownEntitiesContext(
  current: MaybeLocation,
  locations: GameLocation[],
  entities: Entity[],
  opts: KnownRosterOpts = {},
): string {
  return textOf(knownEntityRuns(current, locations, entities, opts));
}

/** {@link buildKnownEntitiesContext} as marked runs. */
export function knownEntityRuns(
  current: MaybeLocation,
  locations: GameLocation[],
  entities: Entity[],
  opts: KnownRosterOpts = {},
): MarkedRun[] {
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = knownEntityIds(current, locations, entities, opts.pulledIds).filter((id) => !exclude.has(id));
  if (!current && !ids.length) return runs(NONE_PLACEHOLDER);
  return entityRosterRuns(ids, entities, { ...opts, preferSummary: true, noTraits: true, noStats: true });
}

/**
 * Serialize the locations reachable from the current one for the `<LOCATION|reachable>` chip — one line each
 * (`name: <summary>` / `- **name:** <summary>`), containing location first. Returns `N/A` when the location is
 * top-level (no parent).
 */
export function buildReachableLocationsContext(
  current: MaybeLocation,
  locations: GameLocation[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const reachable = reachableLocations(current, locations);
  if (reachable.length === 0) return NONE_PLACEHOLDER;
  return buildLocationList(reachable, opts);
}

/**
 * Serialize the characters/things in the current location's reachable locations for the
 * `<ENTITIES|reachable>` chip. Gathers + dedupes their entity ids (minus `excludeIds` — anyone shown in a
 * higher-precedence roster, i.e. present here or in a sub-location) and delegates to `buildEntityContext`.
 * Returns `N/A` when nothing is reachable or no entities remain.
 */
export function buildReachableEntitiesContext(
  current: MaybeLocation,
  locations: GameLocation[],
  connections: Connection[],
  entities: Entity[],
  opts: RosterOpts & { excludeIds?: string[] } = {},
): string {
  return textOf(reachableEntityRuns(current, locations, connections, entities, opts));
}

/** {@link buildReachableEntitiesContext} as marked runs. */
export function reachableEntityRuns(
  current: MaybeLocation,
  locations: GameLocation[],
  connections: Connection[],
  entities: Entity[],
  opts: RosterOpts & { excludeIds?: string[] } = {},
): MarkedRun[] {
  if (!current) return runs(NONE_PLACEHOLDER);
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = reachableEntityIds(current, locations, connections, entities).filter((id) => !exclude.has(id));
  return entityRosterRuns(ids, entities, opts);
}

/** The axes a scoped context chip carries, as the builders take them. `noStats` is the stored stats-off pick;
 *  `statsOn` is the stored stats-on pick, which the scopes that default to no stats read. */
export type ContextOpts = {
  preferSummary?: boolean; nameOnly?: boolean; format?: ContextFormat; noStats?: boolean; statsOn?: boolean;
  onlyWith?: OnlyWith; noTraits?: boolean; statPieces?: StatPieces;
};

// What each registry option means to the builders. The ids come from the registry; only their meaning is
// spelled here, and an option with no meaning throws so the render guard fails before a prompt renders a
// raw token.
const CONTENT_OPTS: Record<string, ContextOpts> = { summary: { preferSummary: true }, name: { nameOnly: true } };
const STATS_OPTS: Record<string, ContextOpts> = { nostats: { noStats: true }, stats: { statsOn: true } };
const FORMATS: Record<string, ContextFormat> = { markdown: "markdown", xml: "xml" };

/** The builders' format for a chip's format option; the default option is the plain shape. */
export function chipFormat(optionId: string | null): ContextFormat {
  if (optionId === null) return "simple";
  const format = FORMATS[optionId];
  if (!format) throw new Error(`No builder shape for the format option "${optionId}"`);
  return format;
}

function chipContent(optionId: string | null): ContextOpts {
  if (optionId === null) return {};
  const opts = CONTENT_OPTS[optionId];
  if (!opts) throw new Error(`No builder option for the content option "${optionId}"`);
  return opts;
}

function chipStats(optionId: string | null): ContextOpts {
  if (optionId === null) return {};
  const opts = STATS_OPTS[optionId];
  if (!opts) throw new Error(`No builder option for the stats option "${optionId}"`);
  return opts;
}

/** The Only With, Include Traits and Stat Detail picks of the Entities and Persona chips. A stored id is the
 *  Only With pick on, and the Include or Stat Detail piece off. Other chips carry none of these axes. */
function chipRoster(selection: Record<string, string | null | undefined>): ContextOpts {
  const onlyWith: OnlyWith = { stats: selection.withstats != null, traits: selection.withtraits != null };
  const pieces: StatPieces = { values: selection.range == null, status: selection.descriptor == null, meaning: selection.description == null };
  return {
    ...(onlyWith.stats || onlyWith.traits ? { onlyWith } : {}),
    ...(selection.traits != null ? { noTraits: true } : {}),
    ...(pieces.values && pieces.status && pieces.meaning ? {} : { statPieces: pieces }),
  };
}

/** The builder options one concrete scoped chip token encodes, read through the same tables as the lookup. */
export function scopedChipOpts(token: string): ContextOpts {
  const variable = variableForToken(token);
  if (!variable) throw new Error(`No chip is registered for ${token}`);
  return scopedOpts(decodeVariant(variable, tokenVariant(token)));
}

/** One chip as a lookup: a key the chip at `base` spells renders from its decoded axes on first read; `build`
 *  returns undefined for a selection it does not serve. */
export function chipFamilyValues(
  base: string,
  build: (selection: Record<string, string | null>) => string | undefined,
): ValueLookup {
  return memoLookup(chipFamily(base, build));
}

/** {@link chipFamilyValues} over a builder that reports origins: the lookup's `marked` holds its runs. */
export function chipFamilyRuns(
  base: string,
  build: (selection: Record<string, string | null>) => MarkedText | undefined,
): ValueLookup {
  return fromMarked(chipFamily(base, build));
}

function chipFamily<T>(base: string, build: (selection: Record<string, string | null>) => T | undefined): (key: string) => T | undefined {
  const variable = variableForToken(base);
  if (!variable) throw new Error(`No chip is registered for ${base}`);
  return (key) => {
    const decoded = decodeChipKey(key);
    return decoded?.variable === variable ? build(decoded.selection) : undefined;
  };
}

/** The builder options a scoped chip's decoded axes pick. */
function scopedOpts(selection: Record<string, string | null>): ContextOpts {
  const { content, stats, format } = selection;
  return { ...chipContent(content ?? null), ...chipStats(stats ?? null), ...chipRoster(selection), format: chipFormat(format ?? null) };
}

/**
 * One scoped chip family as a lookup: a key of `base` renders through its scope's builder with the content,
 * stats, roster options and format its axes pick. The scopes are the caller's, since a builder can serve a
 * subset; a key in any other scope has no value.
 */
export function scopedChipValues(
  base: string,
  scopes: Record<string, (opts: ContextOpts) => string>,
): ValueLookup {
  return chipFamilyValues(base, (selection) => scopeBuilder(scopes, selection.scope)?.(scopedOpts(selection)));
}

/** {@link scopedChipValues} over builders that report origins. */
export function scopedChipRuns(
  base: string,
  scopes: Record<string, (opts: ContextOpts) => MarkedText>,
): ValueLookup {
  return chipFamilyRuns(base, (selection) => scopeBuilder(scopes, selection.scope)?.(scopedOpts(selection)));
}

function scopeBuilder<T>(scopes: Record<string, T>, scope: string | null | undefined): T | undefined {
  const id = scope ?? "";
  return Object.hasOwn(scopes, id) ? scopes[id] : undefined;
}
