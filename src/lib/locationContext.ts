import type { Entity, GameLocation } from "@/types";
import { NONE_PLACEHOLDER } from "./promptFallbacks";

type LocationWithEntities = (GameLocation & { entity?: string[] }) | null;

const pickDescription = (preferSummary: boolean, summary?: string, description?: string) =>
  preferSummary ? summary?.trim() || description : description;

/**
 * Serialize the current location into the plain-text block the AI prompts inject for
 * `<LOCATION>`. Blank fields are skipped so empty values don't confuse smaller models, and
 * media/editor-only fields are never dumped. Entities are emitted separately by `buildEntityContext`.
 *
 * `preferSummary` makes the location emit its short `aiSummary` (falling back to the full
 * `aiDescription` when no summary is authored) — used by the lightweight precall planning request.
 *
 * `format` mirrors the Default/Simple presets: `'simple'` is plain `key: value` lines; `'markdown'` is a
 * bold-key bullet per field (`- **key:** value`) a small model sections more cleanly.
 */
export function buildLocationContext(
  location: LocationWithEntities,
  opts: { preferSummary?: boolean; format?: "simple" | "markdown" } = {},
): string {
  if (!location) return NONE_PLACEHOLDER;

  const { preferSummary = false, format = "simple" } = opts;
  const field = (key: string, value: string | number | boolean) =>
    format === "markdown" ? `- **${key}:** ${value}\n` : `${key}: ${value}\n`;
  const {
    backgroundImage,
    ambientSound,
    id,
    playerDescription,
    aiDescription,
    aiSummary,
    isStarting, // editor-only new-game seeding flag; irrelevant to the AI
    parentId, // editor-only sub-location nesting; not part of the AI feed
    entity, // entity ids — emitted by buildEntityContext, not here
    entities, // entity ids — emitted by buildEntityContext, not here
    ...otherProps
  } = location;

  // Start with name and description (skip a blank description so it doesn't print "undefined")
  let output = field("name", location.name);
  const locationDescription = pickDescription(preferSummary, aiSummary, aiDescription);
  if (locationDescription && locationDescription.trim() !== "") {
    output += field("description", locationDescription);
  }

  // Add other location properties, skipping `name` (emitted above) and blanks so empty fields
  // don't confuse smaller models.
  Object.entries(otherProps).forEach(([key, value]) => {
    if (value === undefined || value === null || key === "name") return;
    if (typeof value === "string" && value.trim() === "") return;
    output += field(key, value as string | number | boolean);
  });

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
 * bold-key field bullets (`- **Name**` / `  - **key:** value`).
 */
export function buildEntityContext(
  location: LocationWithEntities,
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: "simple" | "markdown" } = {},
): string {
  if (!location) return NONE_PLACEHOLDER;

  const { preferSummary = false, format = "simple" } = opts;
  const md = format === "markdown";
  const head = (name: string) => (md ? `- **${name}**\n` : `${name}\n`);
  const field = (key: string, value: string | number | boolean) =>
    md ? `  - **${key}:** ${value}\n` : `  ${key}: ${value}\n`;
  const entityList = location.entities || location.entity || [];
  if (entityList.length === 0) return NONE_PLACEHOLDER;

  let output = "";
  entityList.forEach((entityId: string) => {
    const entityItem = entities.find((f) => f.id === entityId);
    if (!entityItem) return;
    const {
      id,
      image,
      sound,
      model,
      playerDescription,
      aiDescription,
      aiSummary,
      ...entityProps
    } = entityItem;
    output += head(entityItem.name);
    const entityDescription = pickDescription(preferSummary, aiSummary, aiDescription);
    if (entityDescription && entityDescription.trim() !== "") {
      output += field("description", entityDescription);
    }
    // Add other entity properties, skipping blanks (e.g. an unset type) so empty fields don't pad
    // the prompt and confuse smaller models.
    Object.entries(entityProps).forEach(([key, value]) => {
      if (value === undefined || value === null || key === "name") return;
      if (typeof value === "string" && value.trim() === "") return;
      output += field(key, value as string | number | boolean);
    });
  });

  // All listed ids failed to resolve to a real entity → treat as empty.
  return output || NONE_PLACEHOLDER;
}

/**
 * Serialize the current location's **direct** sub-locations for the `<SUBLOCATIONS>` chip — one line per
 * child (`name: <summary>` / `- **name:** <summary>`), the summary chosen like the other builders. Returns
 * the `N/A` placeholder when the location is null or has no children. Nesting is revealed a level at a time:
 * only immediate children, not the whole descendant subtree.
 */
export function buildSublocationsContext(
  current: LocationWithEntities,
  locations: GameLocation[],
  opts: { preferSummary?: boolean; format?: "simple" | "markdown" } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const kids = locations.filter((l) => (l.parentId ?? null) === current.id);
  if (kids.length === 0) return NONE_PLACEHOLDER;

  const { preferSummary = false, format = "simple" } = opts;
  const md = format === "markdown";
  let output = "";
  for (const kid of kids) {
    const desc = pickDescription(preferSummary, kid.aiSummary, kid.aiDescription);
    const hasDesc = !!desc && desc.trim() !== "";
    if (md) output += hasDesc ? `- **${kid.name}:** ${desc}\n` : `- **${kid.name}**\n`;
    else output += hasDesc ? `${kid.name}: ${desc}\n` : `${kid.name}\n`;
  }
  return output;
}

/**
 * Serialize the characters/things located in the current location's direct sub-locations for the
 * `<SUBLOCATION ENTITIES>` chip. Gathers + dedupes the children's entity ids and delegates to
 * `buildEntityContext` (a synthetic location holding those ids), so the roster shaping matches the main
 * entities section. Returns the `N/A` placeholder when there are no children or no entities among them.
 */
export function buildSublocationEntitiesContext(
  current: LocationWithEntities,
  locations: GameLocation[],
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: "simple" | "markdown" } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const kids = locations.filter((l) => (l.parentId ?? null) === current.id);
  const ids = [...new Set(kids.flatMap((k) => k.entities ?? []))];
  if (ids.length === 0) return NONE_PLACEHOLDER;
  return buildEntityContext({ id: current.id, name: current.name, entities: ids }, entities, opts);
}

/** The current location's reachable **siblings** — other children of the same non-null parent. */
function reachableSiblings(current: GameLocation, locations: GameLocation[]): GameLocation[] {
  const parent = current.parentId ?? null;
  if (parent === null) return []; // top-level → no containing region → nothing reachable
  return locations.filter((l) => l.id !== current.id && (l.parentId ?? null) === parent);
}

/**
 * Serialize the sibling locations reachable from the current one (same parent) for the
 * `<REACHABLE LOCATIONS>` chip — one line per sibling (`name: <summary>` / `- **name:** <summary>`).
 * Returns `N/A` when the location is top-level (no parent) or has no siblings.
 */
export function buildReachableLocationsContext(
  current: LocationWithEntities,
  locations: GameLocation[],
  opts: { preferSummary?: boolean; format?: "simple" | "markdown" } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const sibs = reachableSiblings(current, locations);
  if (sibs.length === 0) return NONE_PLACEHOLDER;

  const { preferSummary = false, format = "simple" } = opts;
  const md = format === "markdown";
  let output = "";
  for (const sib of sibs) {
    const desc = pickDescription(preferSummary, sib.aiSummary, sib.aiDescription);
    const hasDesc = !!desc && desc.trim() !== "";
    if (md) output += hasDesc ? `- **${sib.name}:** ${desc}\n` : `- **${sib.name}**\n`;
    else output += hasDesc ? `${sib.name}: ${desc}\n` : `${sib.name}\n`;
  }
  return output;
}

/**
 * Serialize the characters/things in the current location's reachable siblings for the
 * `<REACHABLE ENTITIES>` chip. Gathers + dedupes the siblings' entity ids (minus `excludeIds`, e.g. those
 * already present at the current location after a visit) and delegates to `buildEntityContext`.
 * Returns `N/A` when there are no siblings or no remaining entities.
 */
export function buildReachableEntitiesContext(
  current: LocationWithEntities,
  locations: GameLocation[],
  entities: Entity[],
  opts: { preferSummary?: boolean; format?: "simple" | "markdown"; excludeIds?: string[] } = {},
): string {
  if (!current) return NONE_PLACEHOLDER;
  const sibs = reachableSiblings(current, locations);
  const exclude = new Set(opts.excludeIds ?? []);
  const ids = [...new Set(sibs.flatMap((s) => s.entities ?? []))].filter((id) => !exclude.has(id));
  if (ids.length === 0) return NONE_PLACEHOLDER;
  return buildEntityContext({ id: current.id, name: current.name, entities: ids }, entities, opts);
}
