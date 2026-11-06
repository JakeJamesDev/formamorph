import { usePersistentState, boolCodec, type Codec } from './usePersistentState';
import { DEFAULT_GAME_LEFT_COLLAPSED, DEFAULT_GAME_RIGHT_COLLAPSED, DEFAULT_GAME_STORY_WIDTH } from '@/contexts/settingsDefaults';

// How this device lays out the game on desktop; device storage only, never the save or the world.
const PREFIX = 'FORMAMORPH_gamePanel';

/** The left panel shows as its rail. */
export const useGameLeftCollapsed = () =>
  usePersistentState<boolean>(`${PREFIX}LeftCollapsed`, DEFAULT_GAME_LEFT_COLLAPSED, boolCodec);

/** The right panel shows as its rail. */
export const useGameRightCollapsed = () =>
  usePersistentState<boolean>(`${PREFIX}RightCollapsed`, DEFAULT_GAME_RIGHT_COLLAPSED, boolCodec);

/**
 * `reading` keeps the story at its reading width, centered. `full` fills the space between the sides and, beside
 * the right rail, starts below the header's buttons. `fullHeight` fills it too but keeps its height, stopping
 * short of those buttons.
 */
export type StoryWidth = 'reading' | 'full' | 'fullHeight';

const storyWidthCodec: Codec<StoryWidth> = {
  parse: (raw) => {
    if (raw !== 'reading' && raw !== 'full' && raw !== 'fullHeight') throw new Error('not a story width');
    return raw;
  },
  serialize: (value) => value,
};

export const useGameStoryWidth = () =>
  usePersistentState<StoryWidth>(`${PREFIX}StoryWidth`, DEFAULT_GAME_STORY_WIDTH, storyWidthCodec);
