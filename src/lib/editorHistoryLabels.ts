import {
  changedFields, touchedIds, type OverviewEdit, type RecordEdit, type RecordSliceName, type SliceName, type Step, type StepKey,
} from "./editorHistory";

/** The singular and plural type names a Step label uses for each slice. */
export const SLICE_TYPE_NAMES: Record<SliceName, [string, string]> = {
  worldOverview: ["World", "World"],
  stats: ["Stat", "Stats"],
  locations: ["Location", "Locations"],
  connections: ["Connection", "Connections"],
  entities: ["Entity", "Entities"],
  entityGroups: ["Entity Group", "Entity Groups"],
  traits: ["Trait", "Traits"],
  traitGroups: ["Trait Group", "Trait Groups"],
  statUpdates: ["Stat Update", "Stat Updates"],
  dictionaries: ["Dictionary", "Dictionaries"],
  placeholders: ["Placeholder", "Placeholders"],
  placeholderGroups: ["Placeholder Group", "Placeholder Groups"],
};

/** Field labels as the editor shows them. A field missing here reads as its name in title case. */
export const FIELD_LABELS: Partial<Record<SliceName | "*", Record<string, string>>> = {
  "*": {
    name: "Name",
    description: "Description",
    playerDescription: "Player Description",
    aiDescription: "AI Description",
    aiSummary: "AI Summary",
    imageTags: "Image Tags",
    placeholderPins: "Placeholder Pins",
    openings: "Openings",
  },
  worldOverview: {
    name: "World Name",
    author: "Author",
    tags: "Tags",
    thumbnail: "Thumbnail",
    bgm: "Background Music",
    systemPrompt: "System Prompt",
    use3DModel: "3D Player Avatar",
    customPlayerVRM: "Custom Player Avatar",
    readme: "Readme",
    introReadme: "Intro Readme",
    promptOverrides: "Prompt Overrides",
    openingWeights: "Opening Weights",
    openingsEnabled: "Openings",
    allowedPersonas: "Allowed Personas",
    startPersona: "Starts On",
  },
  stats: {
    type: "Type",
    min: "Min",
    max: "Max",
    starting: "Initial Value",
    regen: "Regen",
    descriptors: "Stat Descriptors",
    morphBindings: "Body Sliders",
    beforeCode: "Dynamic Value Calculation",
    code: "Dynamic Value Calculation",
  },
  locations: {
    backgroundImage: "Background Image",
    ambientSound: "Ambient Sound",
    isStarting: "Starting Location",
    canvasPosition: "Position",
  },
  statUpdates: { prompt: "Prompt", stats: "Stats" },
  placeholders: { values: "Values", weights: "Weights" },
};

const titleCase = (field: string) => field
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/^./, (first) => first.toUpperCase());

export function fieldLabel(slice: SliceName, field: string): string {
  return FIELD_LABELS[slice]?.[field] ?? FIELD_LABELS["*"]?.[field] ?? titleCase(field);
}

type NamedRecord = { id: string; name?: string; placeholders?: NamedRecord[] };

const phrase = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" ");
const withField = (text: string, slice: SliceName, field?: string) => (field ? `${text}: ${fieldLabel(slice, field)}` : text);

function overviewLabel(edit: OverviewEdit | undefined, key?: StepKey): string {
  const fields = key?.field ? [key.field] : edit ? changedFields(edit.before, edit.after) : [];
  return withField("Edit World", "worldOverview", fields.length === 1 ? fields[0] : undefined);
}

/** A placeholder by id inside an owner the Step touched, such as a Copy an entity or dictionary holds. */
function findPlaceholder(step: Step, side: "before" | "after", id: string): NamedRecord | undefined {
  for (const edit of step.edits) {
    if (edit.slice === "worldOverview") continue;
    for (const record of edit[side] as NamedRecord[]) {
      const nested = record.placeholders?.find((placeholder) => placeholder.id === id);
      if (nested) return nested;
    }
  }
  return undefined;
}

function action(was: unknown, became: unknown) {
  if (!was) return "Add";
  if (!became) return "Remove";
  return "Edit";
}

/** A Step's label: the action, the type, the record's name, and the field when the key names one. */
export function stepLabel(step: Step): string {
  if (step.label) return step.label;
  const key = step.key;
  if (key?.slice === "worldOverview") {
    return overviewLabel(step.edits.find((edit): edit is OverviewEdit => edit.slice === "worldOverview"), key);
  }
  if (key?.id) return keyedLabel(step, key.slice, key.id, key.field);
  if (step.edits.length !== 1) return "Edit World";
  const [edit] = step.edits;
  if (edit.slice === "worldOverview") return overviewLabel(edit);
  return recordEditLabel(edit);
}

function keyedLabel(step: Step, slice: RecordSliceName, id: string, field?: string): string {
  let verb = "Edit";
  let name: string | undefined;
  const edit = step.edits.find((e): e is RecordEdit => e.slice === slice);
  if (edit && (edit.beforeOrder.includes(id) || edit.afterOrder.includes(id))) {
    verb = action(edit.beforeOrder.includes(id), edit.afterOrder.includes(id));
    const records = [...edit.after, ...edit.before] as NamedRecord[];
    name = records.find((record) => record.id === id)?.name;
  } else if (slice === "placeholders") {
    // A Copy lives inside its owner's record, so the owner's edit carries it.
    const was = findPlaceholder(step, "before", id);
    const became = findPlaceholder(step, "after", id);
    if (was || became) verb = action(was, became);
    name = (became ?? was)?.name;
  }
  return withField(phrase(verb, SLICE_TYPE_NAMES[slice][0], name), slice, field);
}

function recordEditLabel(edit: RecordEdit): string {
  const [single, plural] = SLICE_TYPE_NAMES[edit.slice];
  const ids = touchedIds(edit);
  if (ids.size === 0) return `Reorder ${plural}`;
  if (ids.size > 1) return `Edit ${plural}`;
  const was = (edit.before as NamedRecord[])[0];
  const became = (edit.after as NamedRecord[])[0];
  return phrase(action(was, became), single, (became ?? was)?.name);
}
