/**
 * The Authoring Tour's step registry: the one place a step is defined.
 *
 * A step points at one field through its `data-tour-anchor`, completes on the authored world, and fills its
 * example through the same setter the field's panel uses, so a Use Example edit is an ordinary edit.
 */
import type { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';
import type { LocationPanelTab } from '@/views/locationPanelTabs';
import type { EntityPanelTab } from '@/views/entityPanelTabs';
import type {
  Connection, DictionaryEntry, Entity, GameLocation, Stat, WorldOverview, World,
} from '@/types';
import { hasValue } from '@/lib/editorMode';
import {
  entityRootCount, newEntity, newLocation, newStat, withDefaultDescriptors,
} from '@/lib/blankWorld';
import { blankDictionaryEntry } from '@/lib/dictionaryTree';
import { parseKeywords } from '@/lib/dictionaryUtils';
import { defaultStatUpdatesPrompt, defaultSystemPrompt } from '@/components/game/GamePrompts';
import { statsChipIn } from '@/lib/testBench/aiContext';
import { withEntityLocations } from '@/lib/entityPresence';
import { createConnection, withHint } from '@/lib/connectionEditing';
import { randomUUID } from '@/lib/uuid';
import { EDITOR_MODE_TUTORIAL_ID, markTutorialSeen } from '@/lib/tutorials';
import type { InPlaySpec } from './inPlay';

/** The world as the editor holds it while the tour reads it. */
export type TourWorld = Omit<World, 'id' | 'version'>;

/** The items the tour creates and then follows by id. */
export type TourItem = 'location' | 'secondLocation' | 'entity' | 'stat' | 'trait' | 'entry';

/** The ids of the items this world's tour created. */
export type TourItems = Partial<Record<TourItem, string>>;

/** The ids of every item of a kind, in the world's own order. */
const ITEM_IDS: Record<TourItem, (world: TourWorld) => string[]> = {
  location: (world) => (world.locations ?? []).map((l) => l.id),
  secondLocation: (world) => (world.locations ?? []).map((l) => l.id),
  entity: (world) => (world.entities ?? []).map((e) => e.id),
  stat: (world) => (world.stats ?? []).map((s) => s.id),
  trait: (world) => (world.traits ?? []).map((t) => t.id),
  entry: (world) => (world.dictionaries ?? []).flatMap((b) => b.entries.map((e) => e.id)),
};

export const TOUR_ITEM_KINDS = Object.keys(ITEM_IDS) as TourItem[];

export function tourItemIds(world: TourWorld, item: TourItem): string[] {
  return ITEM_IDS[item](world);
}

/** The tour item's id while the world still holds it. */
export function liveTourItem(world: TourWorld, items: TourItems, item: TourItem): string | null {
  const id = items[item];
  return id && tourItemIds(world, item).includes(id) ? id : null;
}

/** The editor setters a step's example writes through. */
export interface TourEditApi {
  updateWorldOverview: (updates: Partial<WorldOverview>) => void;
  addLocation: (location: GameLocation) => void;
  updateLocation: (location: GameLocation) => void;
  addConnection: (connection: Connection) => void;
  updateConnection: (connection: Connection) => void;
  addEntity: (entity: Entity) => void;
  updateEntity: (entity: Entity) => void;
  /** Gives the stat its default descriptors, as the world does for every added stat. */
  addStat: (stat: Omit<Stat, 'descriptors'>) => void;
  updateStat: (stat: Stat) => void;
  addDictionaryEntry: (bookId: string, entry: DictionaryEntry) => void;
  updateDictionaryEntry: (entry: DictionaryEntry) => void;
}

export interface TourStep {
  id: string;
  /** Null for a step that points at the editor's header, which shows on every tab. */
  tab: (typeof WORLD_EDITOR_TABS)[number]['value'] | null;
  /** The `data-tour-anchor` value on the field's wrapper. */
  anchor: string;
  /** The tour item the step acts on, or null for a world-level field. */
  item: TourItem | null;
  /** The item panel's tab that holds the field, when it is not the panel's first tab. */
  panelTab?: LocationPanelTab | EntityPanelTab;
  title: string;
  body: string;
  isComplete: (world: TourWorld, items: TourItems) => boolean;
  /**
   * Makes the step's item the way its Add button does, and returns its id. Only an add step has it: the step
   * completes once a new item exists, and the tour's dev route replays it.
   */
  add?: (api: TourEditApi, world: TourWorld) => string;
  /** Fills the field with the example world's text through its panel's own setter. */
  useExample?: (api: TourEditApi, world: TourWorld, items: TourItems) => void;
  /** Runs each time the step becomes current. */
  onReach?: () => void;
  /** What In Play shows for this step. */
  inPlay: InPlaySpec;
}

/** The In Play slice of a step that points at no field, such as an ending step. */
export const NO_IN_PLAY: InPlaySpec = { sees: 'none', readers: [] };

/** An add step, pointing at its list's Add button. */
function addStep(
  fields: Omit<TourStep, 'anchor' | 'isComplete' | 'inPlay' | 'item'> & { item: TourItem; anchor?: string },
): TourStep {
  return {
    anchor: 'list-add',
    isComplete: (world, items) => liveTourItem(world, items, fields.item) !== null,
    inPlay: NO_IN_PLAY,
    ...fields,
  };
}

/** Adds a location the way the Locations tab's Add button does. */
function addLocationItem(api: TourEditApi): string {
  const id = randomUUID();
  api.addLocation(newLocation(id));
  return id;
}

type LocationItem = 'location' | 'secondLocation';

const tourLocation = (world: TourWorld, items: TourItems, item: LocationItem) =>
  (world.locations ?? []).find((l) => l.id === items[item]);

function patchLocation(
  api: TourEditApi, world: TourWorld, items: TourItems, item: LocationItem, patch: Partial<GameLocation>,
) {
  const location = tourLocation(world, items, item);
  if (location) api.updateLocation({ ...location, ...patch });
}

/** Adds an entity the way the Entities tab's Add button does. */
function addEntityItem(api: TourEditApi, world: TourWorld): string {
  const id = randomUUID();
  api.addEntity(newEntity(id, entityRootCount(world)));
  return id;
}

export const tourEntity = (world: TourWorld, items: TourItems) =>
  (world.entities ?? []).find((e) => e.id === items.entity);

function patchEntity(api: TourEditApi, world: TourWorld, items: TourItems, patch: Partial<Entity>) {
  const entity = tourEntity(world, items);
  if (entity) api.updateEntity({ ...entity, ...patch });
}

/** The tour locations the tour entity is in, the first location first. */
export function tourEntityPlaces(world: TourWorld, items: TourItems): string[] {
  const at = new Set(tourEntity(world, items)?.locations ?? []);
  return (['location', 'secondLocation'] as const)
    .map((item) => liveTourItem(world, items, item))
    .filter((id): id is string => !!id && at.has(id));
}

/** Adds a stat the way the Stats tab's Add button does. */
function addStatItem(api: TourEditApi): string {
  const id = randomUUID();
  api.addStat(newStat(id));
  return id;
}

export const tourStat = (world: TourWorld, items: TourItems) =>
  (world.stats ?? []).find((s) => s.id === items.stat);

function patchStat(api: TourEditApi, world: TourWorld, items: TourItems, patch: Partial<Stat>) {
  const stat = tourStat(world, items);
  if (stat) api.updateStat({ ...stat, ...patch });
}

/** Adds an entry the way the top book's Add entry button does. The editor always holds at least one book. */
function addEntryItem(api: TourEditApi, world: TourWorld): string {
  const entry = blankDictionaryEntry();
  const book = world.dictionaries?.[0];
  if (book) api.addDictionaryEntry(book.id, entry);
  return entry.id;
}

/** The dictionary entry the tour created, in whichever book it now sits. */
export function tourEntry(world: TourWorld, items: TourItems): DictionaryEntry | undefined {
  if (!items.entry) return undefined;
  for (const book of world.dictionaries ?? []) {
    const entry = book.entries.find((e) => e.id === items.entry);
    if (entry) return entry;
  }
  return undefined;
}

function patchEntry(api: TourEditApi, world: TourWorld, items: TourItems, patch: Partial<DictionaryEntry>) {
  const entry = tourEntry(world, items);
  if (entry) api.updateDictionaryEntry({ ...entry, ...patch });
}

/** The Stats chip a shipped prompt places, so In Play reads a stat the way that prompt does. */
function shippedStatsChip(template: string): string {
  const chip = statsChipIn(template);
  if (!chip) throw new Error('A shipped prompt places no Stats chip');
  return chip;
}

/** The Connection between the two tour locations, in either direction. */
function tourConnection(world: TourWorld, items: TourItems): Connection | undefined {
  const { location, secondLocation } = items;
  if (!location || !secondLocation) return undefined;
  return (world.connections ?? []).find((c) => (c.from === location && c.to === secondLocation)
    || (c.from === secondLocation && c.to === location));
}

/** The steps that close the tour. They stay after every tab step. */
const ENDING_STEPS: readonly TourStep[] = [
  {
    id: 'editor-mode',
    tab: null,
    anchor: 'editor-mode',
    item: null,
    title: 'More Fields in Advanced',
    body: 'Advanced mode shows more fields for each part of your world. Switch to it any time after the tour.',
    isComplete: () => true,
    // This step explains the switch, so the switch's own one-time note has nothing left to say.
    onReach: () => markTutorialSeen(EDITOR_MODE_TUTORIAL_ID),
    inPlay: NO_IN_PLAY,
  },
  {
    id: 'play',
    tab: null,
    anchor: 'test-bench',
    item: null,
    title: 'Play Your World',
    body: 'Press the Play button to try what you built. Use the Test Bench here any time to check your world for problems.',
    isComplete: () => true,
    inPlay: NO_IN_PLAY,
  },
];

const WORLD_NAME_EXAMPLE = 'Brinewell';
const WORLD_AI_DESCRIPTION_EXAMPLE = 'Brinewell is a quiet fishing village on a cold northern coast. At its heart lies '
  + 'the Tidewell, a stone spring that fills with seawater at high tide. Anyone who bathes in it slowly takes on '
  + 'traits of the sea: webbed fingers, gill lines, a scatter of scales. The villagers treat the change as ordinary '
  + 'and a little sacred. Outsiders find it unsettling. Keep the tone warm and curious, never horror.';
const TIDEWELL = {
  name: 'The Tidewell',
  playerDescription: 'A ring of worn stone around a pool that rises and falls with the sea.',
  aiDescription: 'A round stone basin in the village square. Seawater floods in through a carved channel at high '
    + 'tide and drains away at low tide. Bathers feel a tingling warmth that lingers for hours. Shells and sea '
    + 'glass line the rim as offerings.',
};
const SALT_LANTERN = {
  name: 'The Salt Lantern',
  playerDescription: 'The village inn, warm and smelling of peat smoke and fried fish.',
  aiDescription: 'A two-story inn on the harbor. The common room has a peat fire, long scarred tables, and a window '
    + 'that looks out on the Tidewell. Fishers gather here at dusk to trade gossip and tall tales.',
};
const TRAVEL_HINT_EXAMPLE = 'down the lane past the net sheds';
const MAREN = {
  name: 'Maren',
  pronouns: 'she/her',
  playerDescription: 'The keeper of the Tidewell, with a warm laugh and faint silver scales along her jaw.',
  aiDescription: 'Maren tends the Tidewell and has bathed in it every week for twenty years. Silver scales now trace '
    + 'her jaw and forearms, and her fingers are lightly webbed. She is kind, nosy and fiercely protective of '
    + 'newcomers. She secretly fears the spring\'s pull on her is growing stronger.',
};

const SEA_CHANGE = {
  name: 'Sea Change',
  min: 0,
  max: 100,
  value: 0,
  description: 'How far the Tidewell has reshaped your body. At 0 you are fully human. At 100 you belong to the '
    + 'sea. Raise it when the player bathes in the Tidewell or drinks its water.',
};

const OVERVIEW_STEPS: readonly TourStep[] = [
  {
    id: 'world-name',
    tab: 'overview',
    anchor: 'world-name',
    item: null,
    title: 'World Name',
    body: 'Type the name players see in their library',
    isComplete: (world) => hasValue(world.worldOverview.name.trim()),
    useExample: (api) => api.updateWorldOverview({ name: WORLD_NAME_EXAMPLE }),
    inPlay: { sees: 'libraryCard', readers: [{ prompt: 'Narration Prompt', reads: 'never' }] },
  },
  {
    id: 'world-ai-description',
    tab: 'overview',
    anchor: 'world-ai-description',
    item: null,
    title: 'AI-Facing Description',
    body: 'Tell the AI what your world is like. The AI reads this every turn, and players never see it.',
    isComplete: (world) => hasValue((world.worldOverview.systemPrompt ?? '').trim()),
    useExample: (api) => api.updateWorldOverview({ systemPrompt: WORLD_AI_DESCRIPTION_EXAMPLE }),
    inPlay: {
      sees: 'never',
      readers: [{
        prompt: 'Narration Prompt', reads: 'world', authorText: (world) => world.worldOverview.systemPrompt ?? '',
      }],
    },
  },
];

const LOCATION_STEPS: readonly TourStep[] = [
  addStep({
    id: 'add-location',
    tab: 'locations',
    item: 'location',
    title: 'Add a Location',
    body: 'Press the + button to add your first location',
    add: addLocationItem,
  }),
  {
    id: 'location-name',
    tab: 'locations',
    anchor: 'location-name',
    item: 'location',
    title: 'Location Name',
    body: 'Name the place. Players see the name while they’re here, and the AI reads it.',
    isComplete: (world, items) => hasValue((tourLocation(world, items, 'location')?.name ?? '').trim()),
    useExample: (api, world, items) => patchLocation(api, world, items, 'location', { name: TIDEWELL.name }),
    inPlay: {
      sees: 'locationTab',
      readers: [{
        prompt: 'Narration Prompt', reads: 'location',
        authorText: (world, items) => tourLocation(world, items, 'location')?.name ?? '',
      }],
    },
  },
  {
    id: 'location-player-description',
    tab: 'locations',
    anchor: 'location-player-description',
    item: 'location',
    title: 'Player-Facing Description',
    body: 'Describe what players see here. The AI never reads this field.',
    isComplete: (world, items) => hasValue((tourLocation(world, items, 'location')?.playerDescription ?? '').trim()),
    useExample: (api, world, items) => patchLocation(api, world, items, 'location', {
      playerDescription: TIDEWELL.playerDescription,
    }),
    inPlay: { sees: 'locationTab', readers: [{ prompt: 'Narration Prompt', reads: 'never' }] },
  },
  {
    id: 'location-ai-description',
    tab: 'locations',
    anchor: 'location-ai-description',
    item: 'location',
    title: 'AI-Facing Description',
    body: 'Tell the AI what this place is like. The AI builds every scene here from it, and players never see it.',
    isComplete: (world, items) => hasValue((tourLocation(world, items, 'location')?.aiDescription ?? '').trim()),
    useExample: (api, world, items) => patchLocation(api, world, items, 'location', {
      aiDescription: TIDEWELL.aiDescription,
    }),
    inPlay: {
      sees: 'never',
      readers: [{
        prompt: 'Narration Prompt', reads: 'location',
        authorText: (world, items) => tourLocation(world, items, 'location')?.aiDescription ?? '',
      }],
    },
  },
  {
    id: 'location-starting',
    tab: 'locations',
    anchor: 'location-starting',
    item: 'location',
    title: 'Starting Location',
    body: 'Check the box so a new game starts here',
    isComplete: (world, items) => !!tourLocation(world, items, 'location')?.isStarting,
    useExample: (api, world, items) => patchLocation(api, world, items, 'location', { isStarting: true }),
    inPlay: { sees: 'startsHere', readers: [] },
  },
  addStep({
    id: 'add-second-location',
    tab: 'locations',
    item: 'secondLocation',
    title: 'Add a Second Location',
    body: 'Press the + button again to add a place to travel to',
    add: addLocationItem,
    useExample: (api, world, items) => patchLocation(api, world, items, 'secondLocation', SALT_LANTERN),
  }),
  {
    id: 'location-connection',
    tab: 'locations',
    anchor: 'location-connections',
    item: 'secondLocation',
    panelTab: 'presence',
    title: 'Connection',
    body: 'Connect this place to your first one so players can travel between them. A Travel Hint tells the AI how the trip goes.',
    isComplete: (world, items) => !!tourConnection(world, items),
    useExample: (api, world, items) => {
      const existing = tourConnection(world, items);
      if (existing) api.updateConnection(withHint(existing, TRAVEL_HINT_EXAMPLE));
      else if (items.location && items.secondLocation) {
        api.addConnection(withHint(createConnection(items.secondLocation, items.location), TRAVEL_HINT_EXAMPLE));
      }
    },
    inPlay: {
      sees: 'locationTab',
      readers: [{
        prompt: 'Location Change Prompt', reads: 'destinations',
        authorText: (world, items) => tourConnection(world, items)?.aiHint ?? '',
      }],
    },
  },
];

const ENTITY_STEPS: readonly TourStep[] = [
  addStep({
    id: 'add-entity',
    tab: 'entities',
    item: 'entity',
    title: 'Add an Entity',
    body: 'Press the + button to add a character for players to meet',
    add: addEntityItem,
  }),
  {
    id: 'entity-name',
    tab: 'entities',
    anchor: 'entity-name',
    item: 'entity',
    panelTab: 'profile',
    title: 'Entity Name',
    body: 'Name the character. Players see the name in their entity list, and the AI reads it.',
    isComplete: (world, items) => hasValue((tourEntity(world, items)?.name ?? '').trim()),
    useExample: (api, world, items) => patchEntity(api, world, items, { name: MAREN.name }),
    inPlay: {
      sees: 'entityRowAndCard',
      scene: 'entity',
      readers: [{
        prompt: 'Narration Prompt', reads: 'entities', authorText: (world, items) => tourEntity(world, items)?.name ?? '',
      }],
    },
  },
  {
    id: 'entity-pronouns',
    tab: 'entities',
    anchor: 'entity-pronouns',
    item: 'entity',
    panelTab: 'profile',
    title: 'Pronouns',
    body: 'Tell the AI how to refer to this character. Players never see this field.',
    isComplete: (world, items) => hasValue((tourEntity(world, items)?.pronouns ?? '').trim()),
    useExample: (api, world, items) => patchEntity(api, world, items, { pronouns: MAREN.pronouns }),
    inPlay: {
      sees: 'never',
      scene: 'entity',
      readers: [{
        prompt: 'Narration Prompt', reads: 'entities',
        authorText: (world, items) => tourEntity(world, items)?.pronouns ?? '',
      }],
    },
  },
  {
    id: 'entity-player-description',
    tab: 'entities',
    anchor: 'entity-player-description',
    item: 'entity',
    panelTab: 'descriptions',
    title: 'Player-Facing Description',
    body: 'Describe what players see when they open this character. The AI never reads this field.',
    isComplete: (world, items) => hasValue((tourEntity(world, items)?.playerDescription ?? '').trim()),
    useExample: (api, world, items) => patchEntity(api, world, items, {
      playerDescription: MAREN.playerDescription,
    }),
    inPlay: { sees: 'entityCard', readers: [{ prompt: 'Narration Prompt', reads: 'never' }] },
  },
  {
    id: 'entity-ai-description',
    tab: 'entities',
    anchor: 'entity-ai-description',
    item: 'entity',
    panelTab: 'descriptions',
    title: 'AI-Facing Description',
    body: 'Tell the AI who this character is, secrets and motives included. Players never see it.',
    isComplete: (world, items) => hasValue((tourEntity(world, items)?.aiDescription ?? '').trim()),
    useExample: (api, world, items) => patchEntity(api, world, items, { aiDescription: MAREN.aiDescription }),
    inPlay: {
      sees: 'never',
      scene: 'entity',
      readers: [{
        prompt: 'Narration Prompt', reads: 'entities',
        authorText: (world, items) => tourEntity(world, items)?.aiDescription ?? '',
      }],
    },
  },
  {
    id: 'entity-locations',
    tab: 'entities',
    anchor: 'entity-locations',
    item: 'entity',
    panelTab: 'profile',
    title: 'Locations',
    body: 'Place the character in one of your locations. The AI reads an entity only where it is.',
    isComplete: (world, items) => tourEntityPlaces(world, items).length > 0,
    useExample: (api, world, items) => {
      const entity = tourEntity(world, items);
      const place = liveTourItem(world, items, 'location');
      if (entity && place) api.updateEntity(withEntityLocations(entity, [...(entity.locations ?? []), place]));
    },
    inPlay: {
      sees: 'entityRow',
      scene: 'entity',
      readers: [{
        prompt: 'Narration Prompt', reads: 'entities', authorText: (world, items) => tourEntity(world, items)?.name ?? '',
      }],
    },
  },
];

const NARRATION_STATS_CHIP = shippedStatsChip(defaultSystemPrompt);
const STAT_UPDATES_STATS_CHIP = shippedStatsChip(defaultStatUpdatesPrompt);

const STAT_STEPS: readonly TourStep[] = [
  addStep({
    id: 'add-stat',
    tab: 'stats',
    item: 'stat',
    title: 'Add a Stat',
    body: 'Press the + button to add a stat the story can change',
    add: addStatItem,
  }),
  {
    id: 'stat-name',
    tab: 'stats',
    anchor: 'stat-name',
    item: 'stat',
    title: 'Stat Name',
    body: 'Name the stat. Min, Max and Initial Value set its range and where it starts. Players see the name and '
      + 'the number, and narration never reads the number.',
    isComplete: (world, items) => hasValue((tourStat(world, items)?.name ?? '').trim()),
    useExample: (api, world, items) => patchStat(api, world, items, {
      name: SEA_CHANGE.name, min: SEA_CHANGE.min, max: SEA_CHANGE.max, value: SEA_CHANGE.value,
    }),
    inPlay: {
      sees: 'statRow',
      readers: [
        {
          prompt: 'Narration Prompt', reads: 'statsChip', chip: NARRATION_STATS_CHIP,
          authorText: (world, items) => tourStat(world, items)?.name ?? '',
        },
        {
          prompt: 'Stat Updates Prompt', reads: 'statsChip', chip: STAT_UPDATES_STATS_CHIP,
          authorText: (world, items) => tourStat(world, items)?.name ?? '',
        },
      ],
    },
  },
  {
    id: 'stat-description',
    tab: 'stats',
    anchor: 'stat-description',
    item: 'stat',
    title: 'Description',
    body: 'Tell the AI what this stat measures and what changes it. The Stat Updates prompt uses it to decide how '
      + 'the value changes. Players and narration never see it.',
    isComplete: (world, items) => hasValue((tourStat(world, items)?.description ?? '').trim()),
    useExample: (api, world, items) => patchStat(api, world, items, { description: SEA_CHANGE.description }),
    inPlay: {
      sees: 'never',
      readers: [
        {
          prompt: 'Narration Prompt', reads: 'statsChip', chip: NARRATION_STATS_CHIP,
          authorText: (world, items) => tourStat(world, items)?.description ?? '',
        },
        {
          prompt: 'Stat Updates Prompt', reads: 'statsChip', chip: STAT_UPDATES_STATS_CHIP,
          authorText: (world, items) => tourStat(world, items)?.description ?? '',
        },
      ],
    },
  },
];

const DROWNED_BELL = {
  name: 'The Drowned Bell',
  key: ['bell', 'drowned bell'],
  value: 'A bronze bell that sank in the harbor long ago. Villagers say it rings beneath the water on the night '
    + 'before someone changes completely.',
};

const DICTIONARY_STEPS: readonly TourStep[] = [
  addStep({
    id: 'add-dictionary-entry',
    tab: 'dictionary',
    anchor: 'dictionary-add-entry',
    item: 'entry',
    title: 'Add a Dictionary Entry',
    body: 'Press the Add entry button on your dictionary to add an entry',
    add: addEntryItem,
  }),
  {
    id: 'dictionary-name-keywords',
    tab: 'dictionary',
    anchor: 'dictionary-name',
    item: 'entry',
    title: 'Name and Trigger Keywords',
    body: 'Name the entry, then add the words that bring it up. The AI reads the entry only when a message has one.',
    isComplete: (world, items) => {
      const entry = tourEntry(world, items);
      return !!entry && hasValue((entry.name ?? '').trim()) && parseKeywords(entry).length > 0;
    },
    useExample: (api, world, items) => patchEntry(api, world, items, { name: DROWNED_BELL.name, key: DROWNED_BELL.key }),
    inPlay: {
      sees: 'neverDictionary',
      readers: [{ prompt: 'Narration Prompt', reads: 'testLine', authorText: (world, items) => tourEntry(world, items)?.name ?? '' }],
    },
  },
  {
    id: 'dictionary-value',
    tab: 'dictionary',
    anchor: 'dictionary-value',
    item: 'entry',
    title: 'Value',
    body: 'Write what the AI learns when a message has a keyword. Change the test line in the In Play pane to try it.',
    isComplete: (world, items) => hasValue((tourEntry(world, items)?.value ?? '').trim()),
    useExample: (api, world, items) => patchEntry(api, world, items, { value: DROWNED_BELL.value }),
    inPlay: {
      sees: 'neverDictionary',
      readers: [{ prompt: 'Narration Prompt', reads: 'testLine', authorText: (world, items) => tourEntry(world, items)?.value ?? '' }],
    },
  },
];

export const TOUR_STEPS: readonly TourStep[] = [
  ...OVERVIEW_STEPS, ...LOCATION_STEPS, ...ENTITY_STEPS, ...STAT_STEPS, ...DICTIONARY_STEPS, ...ENDING_STEPS,
];

/** The step with this id, or the first step for an id the registry no longer has. */
export function tourStepIndex(id: string | undefined): number {
  const at = TOUR_STEPS.findIndex((s) => s.id === id);
  return at < 0 ? 0 : at;
}

/** The add step that makes a tour item. */
export function addStepIndex(item: TourItem): number {
  return TOUR_STEPS.findIndex((s) => s.add && s.item === item);
}

/**
 * The world and tour items an author leaves who took every step before `index` with its Add and its Use
 * Example. The tour's dev route opens a mid-tour step this way.
 */
export function replayTourSteps(world: TourWorld, index: number): { world: TourWorld; items: TourItems } {
  let draft = world;
  const items: TourItems = {};
  const replace = <T extends { id: string }>(list: T[] | undefined, next: T) =>
    (list ?? []).map((x) => (x.id === next.id ? next : x));
  const api: TourEditApi = {
    updateWorldOverview: (updates) => { draft = { ...draft, worldOverview: { ...draft.worldOverview, ...updates } }; },
    addLocation: (location) => { draft = { ...draft, locations: [...(draft.locations ?? []), location] }; },
    updateLocation: (location) => { draft = { ...draft, locations: replace(draft.locations, location) }; },
    addConnection: (connection) => { draft = { ...draft, connections: [...(draft.connections ?? []), connection] }; },
    updateConnection: (connection) => { draft = { ...draft, connections: replace(draft.connections, connection) }; },
    addEntity: (entity) => { draft = { ...draft, entities: [...(draft.entities ?? []), entity] }; },
    updateEntity: (entity) => { draft = { ...draft, entities: replace(draft.entities, entity) }; },
    addStat: (stat) => { draft = { ...draft, stats: [...(draft.stats ?? []), withDefaultDescriptors(stat)] }; },
    updateStat: (stat) => { draft = { ...draft, stats: replace(draft.stats, stat) }; },
    addDictionaryEntry: (bookId, entry) => {
      draft = { ...draft, dictionaries: (draft.dictionaries ?? []).map((b) => (b.id === bookId ? { ...b, entries: [...b.entries, entry] } : b)) };
    },
    updateDictionaryEntry: (entry) => {
      draft = { ...draft, dictionaries: (draft.dictionaries ?? []).map((b) => ({ ...b, entries: replace(b.entries, entry) })) };
    },
  };
  for (const step of TOUR_STEPS.slice(0, index)) {
    if (step.add && step.item) items[step.item] = step.add(api, draft);
    step.useExample?.(api, draft, items);
  }
  return { world: draft, items };
}
