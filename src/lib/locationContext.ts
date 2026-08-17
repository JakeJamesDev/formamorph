import type { Connection, Entity, GameLocation } from "@/types";
import { entityIdsAt, entityIdsAtAny } from "./entityPresence";
import { effectiveDestinations } from "./locationGraph";
import { NONE_PLACEHOLDER } from "./promptFallbacks";
import { xmlEscape } from "./utils";

/** The location a builder is scoped to, or none at all (no world, or nowhere resolved yet). */
type MaybeLocation = GameLocation | null;

/** Section-style shape a context builder renders in (mirrors the chip format axis). */
type ContextFormat = "simple" | "markdown" | "xml";

const pickDescription = (preferSummary: boolean, summary?: string, description?: string) =>
  preferSummary ? summary?.trim() || description : description;

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
      if (hasDesc) inner += `  <description>${xmlEscape(desc!)}</description>\n`;
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
    output += field("description", locationDescription);
  }
  output += appendAllowedFields(location, AI_LOCATION_FIELDS, field);
  return output;
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
 */
export function renderEntityRoster(
  entityIds: string[],
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  const { preferSummary = false, format = "simple", nameOnly = false } = opts;
  if (nameOnly) {
    const names = entityIds
      .map((id) => entities.find((e) => e.id === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(", ") : NONE_PLACEHOLDER;
  }
  const md = format === "markdown";
  const xml = format === "xml";
  const head = (name: string) => (md ? `- **${name}**\n` : `${name}\n`);
  const field = (key: string, value: string | number | boolean) =>
    xml ? `  <${key}>${xmlEscape(String(value))}</${key}>\n`
    : md ? `  - **${key}:** ${value}\n`
    : `  ${key}: ${value}\n`;
  if (entityIds.length === 0) return NONE_PLACEHOLDER;

  let output = "";
  entityIds.forEach((entityId: string) => {
    const entityItem = entities.find((f) => f.id === entityId);
    if (!entityItem) return;
    const entityDescription = pickDescription(preferSummary, entityItem.aiSummary, entityItem.aiDescription);
    const hasDesc = !!entityDescription && entityDescription.trim() !== "";
    // Aliases render explicitly (not via the scalar allowlist): joined, and under a spaced label the
    // small models read naturally — except in xml, where a tag name can't contain spaces.
    const aliases = (entityItem.aliases ?? []).map((a) => a.trim()).filter(Boolean);
    const aliasLine = aliases.length
      ? field(xml ? "aliases" : "also known as", aliases.join(", "))
      : "";
    if (xml) {
      let inner = field("name", entityItem.name);
      inner += aliasLine;
      if (hasDesc) inner += field("description", entityDescription!);
      inner += appendAllowedFields(entityItem, AI_ENTITY_FIELDS, field);
      output += `<entity>\n${inner}</entity>\n`;
      return;
    }
    output += head(entityItem.name);
    output += aliasLine;
    if (hasDesc) output += field("description", entityDescription!);
    output += appendAllowedFields(entityItem, AI_ENTITY_FIELDS, field);
  });

  // All listed ids failed to resolve to a real entity → treat as empty.
  return output || NONE_PLACEHOLDER;
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
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
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

/** The deduped entity ids across the current location's direct sub-locations. */
export function sublocationEntityIds(current: MaybeLocation, locations: GameLocation[], entities: Entity[]): string[] {
  if (!current) return [];
  const kids = locations.filter((l) => (l.parentId ?? null) === current.id);
  return entityIdsAtAny(kids.map((k) => k.id), entities);
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
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean; excludeIds?: string[] } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = sublocationEntityIds(current, locations, entities).filter((id) => !exclude.has(id));
  return renderEntityRoster(ids, entities, opts);
}

/** One place the player can move to, and how the trip is made. */
export interface DestinationEntry {
  location: GameLocation;
  /** A Connection's authored travel hint. Absent for implicit travel and for hintless Connections. */
  hint?: string;
  via: "implicit" | "connection";
}

/** The current location's effective destinations paired with the travel hint each one is reached by, in
 *  `lib/locationGraph` order. Exported so a surface that lists the destinations reads the same closed set the
 *  prompt block renders from — a second computation could disagree with where a player can actually go. */
export function navigableDestinationEntries(
  current: MaybeLocation,
  locations: GameLocation[],
  connections: Connection[],
): DestinationEntry[] {
  if (!current) return [];
  const byId = new Map(locations.map((l) => [l.id, l]));
  const entries: DestinationEntry[] = [];
  for (const [id, via] of effectiveDestinations(current.id, locations, connections)) {
    const location = byId.get(id);
    if (!location) continue; // a Connection pointing at a deleted location reaches nowhere
    entries.push({
      location,
      hint: via.via === "connection" ? via.connection.aiHint : undefined,
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
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (names.length === 0) return NONE_PLACEHOLDER;
  if (opts.nameOnly) return names.join(', ');
  const ids = names
    .map((n) => entities.find((e) => e.name.trim().toLowerCase() === n.trim().toLowerCase())?.id)
    .filter((id): id is string => !!id);
  return renderEntityRoster(ids, entities, opts);
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
    const defined = entities.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase());
    return !defined || here.has(defined.id);
  });
}

/** The deduped entity ids across the current location's reachable locations (parent + siblings). */
export function reachableEntityIds(current: MaybeLocation, locations: GameLocation[], entities: Entity[]): string[] {
  if (!current) return [];
  return entityIdsAtAny(reachableLocations(current, locations).map((l) => l.id), entities);
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
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean; excludeIds?: string[] } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = reachableEntityIds(current, locations, entities).filter((id) => !exclude.has(id));
  return renderEntityRoster(ids, entities, opts);
}

/** The axes a scoped context chip carries, as the builders take them. */
export type ContextOpts = { preferSummary?: boolean; nameOnly?: boolean; format?: ContextFormat };

/**
 * Every concrete token one scoped chip family produces — scope × content (full/summary/name) × format —
 * mapped to its built value. The id order (scope.content.format) mirrors the chip's own axis order, so the
 * tokens match what `encodeVariant` emits.
 *
 * Shared so the live game and the world editor's preview enumerate the same set: a variant only one of them
 * generates renders as a raw `<TOKEN>` wherever it was missed.
 */
export function expandScopedTokens(
  base: string,
  scopes: Record<string, (opts: ContextOpts) => string>,
): Record<string, string> {
  const formats: { id: string; format: ContextFormat }[] = [
    { id: "", format: "simple" },
    { id: "markdown", format: "markdown" },
    { id: "xml", format: "xml" },
  ];
  const contents: { id: string; opts: ContextOpts }[] = [
    { id: "", opts: {} },
    { id: "summary", opts: { preferSummary: true } },
    { id: "name", opts: { nameOnly: true } },
  ];
  const values: Record<string, string> = {};
  for (const [scope, build] of Object.entries(scopes)) {
    for (const { id: contentId, opts: contentOpts } of contents) {
      for (const { id: fmtId, format } of formats) {
        const id = [scope, contentId, fmtId].filter(Boolean).join(".");
        values[id ? `${base.slice(0, -1)}|${id}>` : base] = build({ ...contentOpts, format });
      }
    }
  }
  return values;
}
