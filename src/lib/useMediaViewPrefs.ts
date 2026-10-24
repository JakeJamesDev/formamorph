import { boolCodec, usePersistentState, type Codec } from './usePersistentState';
import type { MediaGrouping } from './mediaIndex';

const groupingCodec: Codec<MediaGrouping> = {
  parse: (raw) => {
    if (raw !== 'parent' && raw !== 'type') throw new Error('unknown grouping');
    return raw;
  },
  serialize: (value) => value,
};

/** The Media tab's grouping and size sort, kept per device. They are view state and never reach the world. */
export function useMediaViewPrefs() {
  const [grouping, setGrouping] = usePersistentState<MediaGrouping>('fm-media-grouping', 'parent', groupingCodec);
  const [largestFirst, setLargestFirst] = usePersistentState<boolean>('fm-media-largest-first', false, boolCodec);
  return { grouping, setGrouping, largestFirst, setLargestFirst };
}
