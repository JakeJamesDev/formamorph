/**
 * The Authoring Tour's step registry: the one place a step is defined.
 *
 * A step points at one field through its `data-tour-anchor`, completes on the authored world, and fills its
 * example through the same setter the field's panel uses, so a Use Example edit is an ordinary edit.
 */
import type { WORLD_EDITOR_TABS } from '@/views/worldEditorTabs';
import type { WorldOverview, World } from '@/types';
import { hasValue } from '@/lib/editorMode';
import type { InPlaySpec } from './inPlay';

/** The world as the editor holds it while the tour reads it. */
export type TourWorld = Omit<World, 'id' | 'version'>;

/** The items the tour creates and then follows by id. */
export type TourItem = 'location' | 'secondLocation' | 'entity' | 'stat' | 'trait' | 'entry';

/** The ids of the items this world's tour created. */
export type TourItems = Partial<Record<TourItem, string>>;

/** The editor setters a step's example writes through. */
export interface TourEditApi {
  updateWorldOverview: (updates: Partial<WorldOverview>) => void;
}

export interface TourStep {
  id: string;
  tab: (typeof WORLD_EDITOR_TABS)[number]['value'];
  /** The `data-tour-anchor` value on the field's wrapper. */
  anchor: string;
  /** The tour item the step acts on, or null for a world-level field. */
  item: TourItem | null;
  title: string;
  body: string;
  isComplete: (world: TourWorld, items: TourItems) => boolean;
  /** The example world's value for this field. */
  example: string;
  /** Writes a value into the field through its panel's own setter. */
  write: (api: TourEditApi, value: string, items: TourItems) => void;
  /** What In Play shows for this step. */
  inPlay: InPlaySpec;
}

/** The In Play slice of a step that points at no field, such as an ending step. */
export const NO_IN_PLAY: InPlaySpec = { sees: 'none', readers: [] };

const WORLD_NAME_EXAMPLE = 'Brinewell';
const WORLD_AI_DESCRIPTION_EXAMPLE = 'Brinewell is a quiet fishing village on a cold northern coast. At its heart lies '
  + 'the Tidewell, a stone spring that fills with seawater at high tide. Anyone who bathes in it slowly takes on '
  + 'traits of the sea: webbed fingers, gill lines, a scatter of scales. The villagers treat the change as ordinary '
  + 'and a little sacred. Outsiders find it unsettling. Keep the tone warm and curious, never horror.';

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'world-name',
    tab: 'overview',
    anchor: 'world-name',
    item: null,
    title: 'World Name',
    body: 'Type the name players see in their library',
    isComplete: (world) => hasValue(world.worldOverview.name.trim()),
    example: WORLD_NAME_EXAMPLE,
    write: (api, name) => api.updateWorldOverview({ name }),
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
    example: WORLD_AI_DESCRIPTION_EXAMPLE,
    write: (api, systemPrompt) => api.updateWorldOverview({ systemPrompt }),
    inPlay: {
      sees: 'never',
      readers: [{
        prompt: 'Narration Prompt', reads: 'world', authorText: (world) => world.worldOverview.systemPrompt ?? '',
      }],
    },
  },
];

/** The step with this id, or the first step for an id the registry no longer has. */
export function tourStepIndex(id: string | undefined): number {
  const at = TOUR_STEPS.findIndex((s) => s.id === id);
  return at < 0 ? 0 : at;
}
