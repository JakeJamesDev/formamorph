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
