import { usePersistentState, type Codec } from './usePersistentState';
import { DEFAULT_TRAVEL_VIEW } from '@/contexts/settingsDefaults';

/**
 * How one player likes to travel. The player's own preference rather than anything about the world — it
 * never reaches a save — kept beside the app's other per-user settings the way the canvas prefs are.
 */

/** The Change Location dialog's two views, as they are stored. */
export type TravelView = 'list' | 'map';

/** A view retired from the dialog would leave stored names behind; an unrecognized one is refused and the
 *  default stands. */
const travelViewCodec: Codec<TravelView> = {
  parse: (raw) => {
    if (raw !== 'list' && raw !== 'map') throw new Error('not a travel view');
    return raw;
  },
  serialize: (value) => value,
};

/** Which view the Change Location dialog opens on: whichever one was used last. */
export const useTravelView = () =>
  usePersistentState<TravelView>('FORMAMORPH_travelView', DEFAULT_TRAVEL_VIEW, travelViewCodec);
