import type { Entity, GameLocation } from "@/types";
import { NONE_PLACEHOLDER } from "./promptFallbacks";
import { xmlEscape } from "./utils";

type LocationWithEntities = (GameLocation & { entity?: string[] }) | null;

/** Section-style shape a context builder renders in (mirrors the chip format axis). */
type ContextFormat = "simple" | "markdown" | "xml";

const pickDescription = (preferSummary: boolean, summary?: string, description?: string) =>
  preferSummary ? summary?.trim() || description : description;

// The extra fields — beyond name and description, which are handled explicitly — that each builder feeds the
// AI. An ALLOWLIST, not a denylist: everything else on a location/entity (media, ids, editor-only flags,
// image tags, placeholder defs) is excluded by default, so a newly added world field can never silently leak
// into the prompt. To surface a new field to the AI, add it here.
const AI_LOCATION_FIELDS: readonly (keyof GameLocation)[] = ['connections'];
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
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  const { preferSummary = false, format = "simple", nameOnly = false } = opts;
  // Names alone, for a chip used mid-sentence. Format is deliberately ignored: a bare list has no
  // headings or fields to decorate, so all three styles would render identically anyway.
  if (nameOnly) return items.map((i) => i.name).join(", ");
  let output = "";
  for (const item of items) {
    const desc = pickDescription(preferSummary, item.aiSummary, item.aiDescription);
    const hasDesc = !!desc && desc.trim() !== "";
    if (format === "xml") {
      let inner = `  <name>${xmlEscape(item.name)}</name>\n`;
      if (hasDesc) inner += `  <description>${xmlEscape(desc!)}</description>\n`;
      output += `<location>\n${inner}</location>\n`;
    } else if (format === "markdown") output += hasDesc ? `- **${item.name}:** ${desc}\n` : `- **${item.name}**\n`;
    else output += hasDesc ? `${item.name}: ${desc}\n` : `${item.name}\n`;
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
  location: LocationWithEntities,
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
 * Serialize the entities present at the current location into the roster the AI prompts inject for
 * `<ENTITIES>` — a top-level list, separate from the location so the model reads the cast as
 * "characters/things that could appear here" rather than all-present-and-involved. Returns "" when the
 * location is null or has no entities. `preferSummary` mirrors `buildLocationContext`.
 *
 * `format` mirrors the Default/Simple presets: `'simple'` leads each entity with its bare name and plain
 * `key: value` fields indented under it; `'markdown'` makes the name a bold subject bullet with nested
 * bold-key field bullets (`- **Name**` / `  - **key:** value`); `'xml'` wraps each entity in `<entity>` with
 * a `<name>` and one `<key>` child per field.
 */
export function buildEntityContext(
  location: LocationWithEntities,
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!location) return NONE_PLACEHOLDER;

  const { preferSummary = false, format = "simple", nameOnly = false } = opts;
  if (nameOnly) {
    const names = (location.entities || location.entity || [])
      .map((id: string) => entities.find((e) => e.id === id)?.name)
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
  const entityList = location.entities || location.entity || [];
  if (entityList.length === 0) return NONE_PLACEHOLDER;

  let output = "";
  entityList.forEach((entityId: string) => {
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
 * Serialize the current location's **direct** sub-locations for the `<LOCATION|sublocations>` chip — one line per
 * child (`name: <summary>` / `- **name:** <summary>`), the summary chosen like the other builders. Returns
 * the `N/A` placeholder when the location is null or has no children. Nesting is revealed a level at a time:
 * only immediate children, not the whole descendant subtree.
 */
export function buildSublocationsContext(
  current: LocationWithEntities,
  locations: GameLocation[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const kids = locations.filter((l) => (l.parentId ?? null) === current.id);
  if (kids.length === 0) return NONE_PLACEHOLDER;
  return buildLocationList(kids, opts);
}

/** The deduped entity ids across the current location's direct sub-locations. */
export function sublocationEntityIds(current: LocationWithEntities, locations: GameLocation[]): string[] {
  if (!current) return [];
  const kids = locations.filter((l) => (l.parentId ?? null) === current.id);
  return [...new Set(kids.flatMap((k) => k.entities ?? []))];
}

/**
 * Serialize the characters/things located in the current location's direct sub-locations for the
 * `<ENTITIES|sublocations>` chip. Gathers + dedupes the children's entity ids and delegates to
 * `buildEntityContext` (a synthetic location holding those ids), so the roster shaping matches the main
 * entities section. `excludeIds` drops anyone already shown in a higher-precedence roster (present here) so a
 * character never double-lists across scopes. Returns the `N/A` placeholder when nothing remains.
 */
export function buildSublocationEntitiesContext(
  current: LocationWithEntities,
  locations: GameLocation[],
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean; excludeIds?: string[] } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = sublocationEntityIds(current, locations).filter((id) => !exclude.has(id));
  if (ids.length === 0) return NONE_PLACEHOLDER;
  return buildEntityContext({ id: current.id, name: current.name, entities: ids }, entities, opts);
}

/**
 * The places the player can move to from the current location — the **local navigable graph**: the union of
 * its authored `connections` (resolved by name), its direct sub-locations, and its reachable locations (the
 * containing location + siblings). Deduped by id, current excluded, dangling connection names skipped. This is
 * the location router's whole world: the only candidates fed to the model and the only names its reply is
 * matched against.
 */
export function navigableDestinations(
  current: LocationWithEntities,
  locations: GameLocation[],
): GameLocation[] {
  if (!current) return [];
  const byLowerName = new Map(locations.map((l) => [l.name.toLowerCase(), l]));
  const out = new Map<string, GameLocation>();
  const add = (loc?: GameLocation) => {
    if (loc && loc.id !== current.id) out.set(loc.id, loc);
  };
  for (const name of current.connections ?? []) add(byLowerName.get(name.toLowerCase().trim()));
  for (const child of locations.filter((l) => (l.parentId ?? null) === current.id)) add(child);
  for (const loc of reachableLocations(current as GameLocation, locations)) add(loc);
  return [...out.values()];
}

/**
 * Serialize the current location's navigable destinations for the `<LOCATION|destinations>` chip — one line per
 * place (`name: <summary>` / `- **name:** <summary>`), the summary chosen like the other builders.
 * Returns `N/A` when the location is null or nothing is reachable.
 */
export function buildDestinationsContext(
  current: LocationWithEntities,
  locations: GameLocation[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const dests = navigableDestinations(current, locations);
  if (dests.length === 0) return NONE_PLACEHOLDER;
  return buildLocationList(dests, opts);
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
  current: LocationWithEntities,
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
  if (ids.length === 0) return NONE_PLACEHOLDER;
  return buildEntityContext({ id: 'scene', name: 'scene', entities: ids }, entities, opts);
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
export function reachableEntityIds(current: LocationWithEntities, locations: GameLocation[]): string[] {
  if (!current) return [];
  return [...new Set(reachableLocations(current as GameLocation, locations).flatMap((l) => l.entities ?? []))];
}

/**
 * Serialize the locations reachable from the current one for the `<LOCATION|reachable>` chip — one line each
 * (`name: <summary>` / `- **name:** <summary>`), containing location first. Returns `N/A` when the location is
 * top-level (no parent).
 */
export function buildReachableLocationsContext(
  current: LocationWithEntities,
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
  current: LocationWithEntities,
  locations: GameLocation[],
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: ContextFormat; nameOnly?: boolean; excludeIds?: string[] } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = reachableEntityIds(current, locations).filter((id) => !exclude.has(id));
  if (ids.length === 0) return NONE_PLACEHOLDER;
  return buildEntityContext({ id: current.id, name: current.name, entities: ids }, entities, opts);
}
