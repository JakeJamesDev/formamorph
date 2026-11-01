import { boolCodec, usePersistentState } from './usePersistentState';
import { DEFAULT_BODY_LAYOUT_SNAP } from '@/contexts/settingsDefaults';

/** Snap to Others in the Body Layout editor. One author's working preference, so it never reaches a world export. */
export const useBodyLayoutSnap = () =>
  usePersistentState<boolean>('FORMAMORPH_bodyLayoutSnap', DEFAULT_BODY_LAYOUT_SNAP, boolCodec);
