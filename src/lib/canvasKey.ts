import type { RoutineView } from '@/lib/canvasRoutine';
import type { PickMark } from '@/lib/entityPicking';

/** The things a canvas view can draw that the key explains, in the order the key lists them. */
const ORDER = [
  'stay', 'wander', 'patrol', 'free', 'mixed', 'dayBar', 'start', 'chance', 'stop', 'reach', 'here',
  'entityLocation', 'knownIn', 'canBeHere', 'knownNearby',
] as const;
export type KeyEntryId = typeof ORDER[number];

const inOrder = (ids: ReadonlySet<KeyEntryId>) => ORDER.filter((id) => ids.has(id));

/** What the Routine view draws right now. */
export function routineKeyEntries(view: RoutineView): KeyEntryId[] {
  const ids = new Set<KeyEntryId>();
  for (const mark of view.marks.values()) {
    if (mark.kind === 'reach') ids.add('reach');
    if (mark.kind === 'here') ids.add('here');
    if (mark.kind !== 'routine') continue;
    if (mark.begin) ids.add('start');
    if (mark.tone) ids.add(mark.tone);
    for (const span of mark.spans ?? []) ids.add(span.tone);
    if (mark.spans?.length) ids.add('dayBar');
    if (!mark.tone && new Set(mark.spans?.map((s) => s.tone)).size > 1) ids.add('mixed');
    if (mark.badge) ids.add(mark.tone === 'patrol' ? 'stop' : 'chance');
  }
  return inOrder(ids);
}

/** What the Known In and custom-persona views draw right now. */
export function pickKeyEntries(marks: ReadonlyMap<string, PickMark>): KeyEntryId[] {
  const ids = new Set<KeyEntryId>();
  for (const mark of marks.values()) {
    if (mark.kind === 'member') ids.add('entityLocation');
    if (mark.kind === 'routine') ids.add('canBeHere');
    if (mark.kind === 'nearby') ids.add('knownNearby');
    if (mark.pick) ids.add('knownIn');
  }
  return inOrder(ids);
}
