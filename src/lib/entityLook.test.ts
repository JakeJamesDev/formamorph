import { describe, expect, it } from 'vitest';
import type { Entity, PortableLayered, Stat, TraitRequirementRow } from '@/types';
import { entityPicture } from './entityLook';
import { isLayeredPicture } from './layeredImages';
import { toLibraryItem } from './librarySources';

const BODY = 'data:image/png;base64,Qk9EWQ==';
const SMILE = 'data:image/png;base64,U01JTEU=';
const FROWN = 'data:image/png;base64,RlJPV04=';
const CHEERFUL: TraitRequirementRow[] = [{ all: [{ kind: 'stat', id: 'mood', operator: '>', value: 5, unit: 'raw' }] }];

const rig: PortableLayered = {
  name: 'Face Rig',
  layers: [
    { id: 'l-body', name: 'Body', variants: [{ data: BODY }] },
    { id: 'l-face', name: 'Face', variants: [{ data: SMILE, requires: CHEERFUL }, { data: FROWN }] },
  ],
};
const mood = (value: number): Stat => ({ id: 'mood', name: 'Mood', min: 0, max: 10, value } as Stat);
const wren = (start: number): Entity => ({ id: 'e-wren', name: 'Wren', stats: [mood(start)], images: [{ layered: rig }] });
const layersOf = (entity: Entity) => {
  const picture = entityPicture(entity);
  return isLayeredPicture(picture) ? picture.layers.map((l) => l.data) : picture;
};

describe("an entity's picture outside play", () => {
  it("shows each Layer's Variant under the entity's starting values", () => {
    expect(layersOf(wren(8))).toEqual([BODY, SMILE]);
    expect(layersOf(wren(2))).toEqual([BODY, FROWN]);
  });

  it('reads the same once saved to the library', () => {
    expect(layersOf(toLibraryItem(wren(2), []))).toEqual([BODY, FROWN]);
  });

  it('is undefined with no entity', () => {
    expect(entityPicture(undefined)).toBeUndefined();
  });
});
