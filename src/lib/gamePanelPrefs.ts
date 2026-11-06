import { usePersistentState, boolCodec } from './usePersistentState';
import { DEFAULT_GAME_LEFT_COLLAPSED, DEFAULT_GAME_RIGHT_COLLAPSED } from '@/contexts/settingsDefaults';

// Which game side panels this device shows as rails; device storage only, never the save or the world.
const PREFIX = 'FORMAMORPH_gamePanel';

/** The left panel shows as its rail. */
export const useGameLeftCollapsed = () =>
  usePersistentState<boolean>(`${PREFIX}LeftCollapsed`, DEFAULT_GAME_LEFT_COLLAPSED, boolCodec);

/** The right panel shows as its rail. */
export const useGameRightCollapsed = () =>
  usePersistentState<boolean>(`${PREFIX}RightCollapsed`, DEFAULT_GAME_RIGHT_COLLAPSED, boolCodec);
