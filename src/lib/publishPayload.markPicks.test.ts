import { describe, it, expect, vi } from 'vitest';
import { worldPublishPayload } from './publishPayload';
import { buildPublishBody } from './publishBody';
import { worldMarkPicks } from './markPicks';
import type { Entity, EntityGroup, GalleryLink, LayeredMediaEntry, MediaLayer, MediaList, Stat, StatRequirement, TraitRequirementRow, World } from '@/types';

// The real picker, wrapped so one test can make it throw.
vi.mock('./markPicks', async (importOriginal) => {
  const real = await importOriginal<typeof import('./markPicks')>();
  return { ...real, worldMarkPicks: vi.fn(real.worldMarkPicks) };
});

// Fixtures carry only the fields the picker reads.
const health = (value: number): Stat =>
  ({ id: 'health', name: 'Health', type: 'number', description: '', min: 0, max: 100, value, regen: 0, descriptors: [] } as unknown as Stat);
const below = (value: number): TraitRequirementRow[] =>
  [{ all: [{ kind: 'stat', id: 'health', operator: '<', value, unit: 'raw' } satisfies StatRequirement] }];

const image = (id: string) => ({ id, name: id, kind: 'image' as const, data: `data:${id}` });
const layer = (id: string, variants: MediaLayer['variants']): MediaLayer => ({ id, name: id, variants });

/** A Body base Layer that shows Hurt below 50 Health else Calm, under a Hat overlay. */
const RIG: LayeredMediaEntry = {
  id: 'rig', name: 'Rig', kind: 'layered', layers: [
    layer('empty', []),
    layer('body', [{ mediaId: 'hurt', requires: below(50) }, { mediaId: 'calm' }]),
    layer('hat', [{ mediaId: 'hat' }]),
  ],
};
/** A Layered Image carried inside the gallery slot rather than linked from the Media List. */
const EMBEDDED_RIG = { name: 'Inline Rig', layers: [{ id: 'body', name: 'body', variants: [{ data: 'data:inline' }] }] };
const MEDIA: MediaList = { ...Object.fromEntries(['a', 'b', 'hurt', 'calm', 'hat'].map((id) => [id, image(id)])), rig: RIG };

const entity = (id: string, images: GalleryLink[], hp = 80, extra: Partial<Entity> = {}): Entity =>
  ({ id, name: id, images, stats: [health(hp)], ...extra } as unknown as Entity);
const world = (entities: Entity[], entityGroups: EntityGroup[] = []): World => ({
  worldOverview: { name: 'Sedge Landing', mediaList: MEDIA }, entities, entityGroups, traits: [], stats: [],
} as unknown as World);

const picks = (w: World) => worldPublishPayload(w).markPicks;

describe('a world publish’s mark picks', () => {
  it('skips a slot whose rule fails at the start and sends the first slot that holds', () => {
    const ash = entity('ash', [{ mediaId: 'a', requires: below(50) }, { mediaId: 'b' }], 80);
    expect(picks(world([ash]))).toEqual([{ entityId: 'ash', mediaId: 'b' }]);
    expect(picks(world([{ ...ash, stats: [health(20)] }]))).toEqual([{ entityId: 'ash', mediaId: 'a' }]);
  });

  it('sends a Layered Image’s base Layer start Variant, never an overlay’s, and follows its rules', () => {
    expect(picks(world([entity('ash', [{ mediaId: 'rig' }], 80)]))).toEqual([{ entityId: 'ash', mediaId: 'calm' }]);
    expect(picks(world([entity('ash', [{ mediaId: 'rig' }], 20)]))).toEqual([{ entityId: 'ash', mediaId: 'hurt' }]);
  });

  it('sends none for a Layered Image whose base Layer shows nothing at the start', () => {
    const hidden: LayeredMediaEntry = { ...RIG, layers: [layer('body', [{ mediaId: 'hurt', requires: below(50) }]), layer('hat', [{ mediaId: 'hat' }])] };
    const w = world([entity('ash', [{ mediaId: 'rig' }], 80)]);
    expect(picks({ ...w, worldOverview: { ...w.worldOverview, mediaList: { ...MEDIA, rig: hidden } } })).toEqual([]);
  });

  it('follows World Editor order and sends none for an entity that draws nothing or embeds its picture', () => {
    const groups: EntityGroup[] = [{ id: 'cast', name: 'Cast', parentId: null, order: 0 } as EntityGroup];
    const w = world([
      entity('loner', [{ mediaId: 'a' }], 80, { order: 1 } as Partial<Entity>),
      entity('blank', [{ mediaId: 'missing' }], 80, { order: 2 } as Partial<Entity>),
      entity('embedded', [{ data: 'data:inline' }, { mediaId: 'b' }], 80, { order: 3 } as Partial<Entity>),
      entity('embeddedRig', [{ layered: EMBEDDED_RIG }, { mediaId: 'b' }], 80, { order: 4 } as Partial<Entity>),
      entity('lead', [{ mediaId: 'b' }], 80, { groupId: 'cast', order: 0 } as Partial<Entity>),
    ], groups);
    expect(picks(w)).toEqual([{ entityId: 'lead', mediaId: 'b' }, { entityId: 'loner', mediaId: 'a' }]);
  });

  it('leaves the content byte-equal to the world it publishes', () => {
    const w = world([entity('ash', [{ mediaId: 'rig' }])]);
    const payload = worldPublishPayload(w);
    expect(JSON.stringify(payload.contentData)).toBe(JSON.stringify({ ...w, worldOverview: { ...w.worldOverview, tags: [] } }));
  });

  it('still publishes, with no picks, when working them out throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(worldMarkPicks).mockImplementationOnce(() => { throw new Error('boom'); });
    const payload = worldPublishPayload(world([entity('ash', [{ mediaId: 'rig' }])]));
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
    expect(payload.kind).toBe('world');
    expect(payload).not.toHaveProperty('markPicks');
  });

  it('rides in the request body beside the content', async () => {
    const payload = worldPublishPayload(world([entity('ash', [{ mediaId: 'a' }])]));
    const sent = JSON.parse(await buildPublishBody(payload, null).body.text());
    expect(sent.markPicks).toEqual([{ entityId: 'ash', mediaId: 'a' }]);
    expect(sent.contentData).toEqual(JSON.parse(JSON.stringify(payload.contentData)));
  });
});
