import type { Entity, GameLocation } from "@/types";

/**
 * Serialize the current location (and the entities present in it) into the plain-text block the AI
 * prompts inject for `<LOCATION JSON DATA>`. Blank fields are skipped so empty values don't confuse
 * smaller models, and media/editor-only fields are never dumped.
 *
 * `preferSummary` makes the location and its entities emit their short `aiSummary` (falling back to the
 * full `aiDescription` when no summary is authored) — used by the lightweight precall planning request.
 */
export function buildLocationContext(
  location: (GameLocation & { entity?: string[] }) | null,
  entities: Entity[],
  opts: { preferSummary?: boolean } = {},
): string {
  if (!location) return "";

  const { preferSummary = false } = opts;
  const pickDescription = (summary?: string, description?: string) =>
    preferSummary ? summary?.trim() || description : description;

  const {
    backgroundImage,
    ambientSound,
    id,
    playerDescription,
    aiDescription,
    aiSummary,
    isStarting, // editor-only new-game seeding flag; irrelevant to the AI
    entity,
    entities: locationEntities,
    ...otherProps
  } = location;

  // Start with name and description (skip a blank description so it doesn't print "undefined")
  let output = `name: ${location.name}\n`;
  const locationDescription = pickDescription(aiSummary, aiDescription);
  if (locationDescription && locationDescription.trim() !== "") {
    output += `description: ${locationDescription}\n`;
  }

  // Add other location properties, skipping `name` (emitted above) and blanks so empty fields
  // don't confuse smaller models. Mirrors the entity loop below.
  Object.entries(otherProps).forEach(([key, value]) => {
    if (value === undefined || value === null || key === "name") return;
    if (typeof value === "string" && value.trim() === "") return;
    output += `${key}: ${value}\n`;
  });

  // Add entities last
  const entityList = locationEntities || entity || [];
  if (entityList.length > 0) {
    output += "entities:\n";
    entityList.forEach((entityId: string) => {
      const entityItem = entities.find((f) => f.id === entityId);
      if (entityItem) {
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
        output += `  - name: ${entityItem.name}\n`;
        const entityDescription = pickDescription(aiSummary, aiDescription);
        if (entityDescription && entityDescription.trim() !== "") {
          output += `    description: ${entityDescription}\n`;
        }
        // Add other entity properties, skipping blanks (e.g. an unset type) so empty
        // fields don't pad the prompt and confuse smaller models.
        Object.entries(entityProps).forEach(([key, value]) => {
          if (value === undefined || value === null || key === "name") return;
          if (typeof value === "string" && value.trim() === "") return;
          output += `    ${key}: ${value}\n`;
        });
      }
    });
  }

  return output;
}
