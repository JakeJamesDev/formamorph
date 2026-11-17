import { useGameDataOptional } from '@/contexts/GameDataContext';
import type { MediaList } from '@/types';

/** The open world's Media List, which gallery links resolve through; none outside a world. */
export const useMediaList = (): MediaList | undefined => useGameDataOptional()?.worldOverview.mediaList;
