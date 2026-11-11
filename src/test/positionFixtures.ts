/** The position engine tests' cast: a yard with a barn and a field in it, and a smithy apart. */
import { PLAYER_START, type Entity } from '@/types';

export const yardLocations = [
  { id: 'yard', name: 'Yard', parentId: null, isStarting: true },
  { id: 'barn', name: 'Barn', parentId: 'yard' },
  { id: 'field', name: 'Field', parentId: 'yard' },
  { id: 'smithy', name: 'Smithy', parentId: null },
];

/** A Generic entity: one Start grazes in the field from 08:00 to 18:00 and stays in the barn otherwise; one stays in the barn. */
export const herd: Entity = {
  id: 'herd', name: 'Herd', kind: 'generic', locations: ['barn', 'field'],
  starts: [
    { id: 'grazer', place: 'barn', weight: 1, schedule: [{ id: 'graze', time: { start: 480, end: 1080 }, action: { kind: 'stay', place: 'field' } }] },
    { id: 'sleeper', place: 'barn', weight: 1, schedule: [] },
  ],
};

/** A Unique entity: its first Start keeps the smithy and drinks in the barn from 20:00 to 22:00; its second waits in the field. */
export const smith: Entity = {
  id: 'smith', name: 'Smith', kind: 'unique',
  starts: [
    { id: 'forge', place: 'smithy', weight: 1, schedule: [{ id: 'drink', time: { start: 1200, end: 1320 }, action: { kind: 'stay', place: 'barn' } }] },
    { id: 'idle', place: 'field', weight: 1, schedule: [] },
  ],
};

/** A Unique entity that begins at Player's Starting Location, Following. */
export const companion: Entity = {
  id: 'companion', name: 'Companion', kind: 'unique',
  starts: [{ id: 'beside', place: PLAYER_START, weight: 1, schedule: [], beginsFollowing: true }],
};
