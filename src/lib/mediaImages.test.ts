import { describe, it, expect } from 'vitest';
import type { Body, Item, MediaList, TraitRequirementRow, World, WorldOverview } from '@/types';
import { migrateWorld } from './version';
import { coverData } from './mediaImages';
import { galleryLinks } from './entityImages';
import { entityImages } from './entityImages';
import { visibleItemImage, visibleMapImages } from './imageVisibility';
import { rewriteMapImages } from './mapBackground';
import { parseBackdrop } from './bodyLayout';
import { writeMediaSlot, type MediaEditor } from './mediaParents';
import { buildMediaIndex } from './mediaIndex';
import { mediaUsage } from './mediaUsage';
import type { GateInput, GateStatSet } from './traitGates';
import { scoped } from './scope';

const WOUNDED: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'wounded' }] }];
const ABC = 'data:image/png;base64,QUJD';
const XYZ = 'data:image/png;base64,WFla';
const PQR = 'data:image/png;base64,UFFS';
const COVER = 'data:image/png;base64,Q09W';
const MAP = 'data:image/png;base64,TUFQ';
const BACKDROP = 'data:image/png;base64,QkFD';
const DICT = 'data:image/png;base64,RElD';

const rawWorld = () => ({
  worldOverview: { name: 'W', thumbnail: COVER, mapBackground: { images: [{ data: MAP }, { data: XYZ, requires: WOUNDED }], frame: { x: 0, y: 0, width: 10, height: 10 }, opacity: 1 } },
  entities: [{ id: 'wren', name: 'Wren', images: [{ data: ABC }] }],
  locations: [],
  items: [{ id: 'lamp', name: 'Lamp', images: [{ data: ABC }, { data: PQR, requires: WOUNDED }] }],
  bodies: [{ id: 'imp', name: 'Imp', entries: [], backdrop: { kind: 'image', image: { data: BACKDROP }, opacity: 0.5 }, aspect: 1 }],
  dictionaries: [{ id: 'lore', name: 'Lore', entries: [], thumbnail: DICT }],
});

const world = (): World => migrateWorld(rawWorld() as unknown as World);
const listOf = (w: World): MediaList => w.worldOverview.mediaList ?? {};
const names = (w: World) => Object.values(listOf(w)).map((e) => e.name).sort();
const idOf = (link: unknown) => (link as { mediaId: string }).mediaId;

describe('migrateOtherImagesToMediaList', () => {
  it('moves item, map, backdrop and cover pictures into the list as links', () => {
    const w = world();
    expect(w.items![0].images!.every((l) => 'mediaId' in l)).toBe(true);
    expect(w.worldOverview.mapBackground!.images.every((l) => 'mediaId' in l)).toBe(true);
    const backdrop = (w.bodies![0].backdrop as { image: unknown }).image;
    expect(backdrop).toHaveProperty('mediaId');
    expect(w.worldOverview.thumbnail).toHaveProperty('mediaId');
  });

  it('names the entries by their subject: item, body, Map, Cover (Q42)', () => {
    expect(names(world())).toEqual(['Cover 1', 'Imp 1', 'Lamp 1', 'Map 1', 'Map 2', 'Wren 1']);
  });

  it('is idempotent: a second pass changes nothing', () => {
    const once = world();
    const twice = migrateWorld(structuredClone(once));
    expect(twice).toEqual(once);
  });

  it('links an item and an entity that use the same picture to one entry', () => {
    const w = world();
    expect(idOf(w.items![0].images![0])).toBe(idOf(w.entities[0].images![0]));
    expect(Object.values(listOf(w)).filter((e) => e.data === ABC)).toHaveLength(1);
  });

  it('keeps the Visibility rule on each item and map link (Q11)', () => {
    const w = world();
    expect(entityImages(w.items![0], listOf(w)).map((i) => i.requires)).toEqual([undefined, WOUNDED]);
    expect(w.worldOverview.mapBackground!.images.map((l) => l.requires)).toEqual([undefined, WOUNDED]);
  });

  it('keeps a body backdrop opacity and a dictionary cover embedded', () => {
    const w = world();
    expect((w.bodies![0].backdrop as { opacity: number }).opacity).toBe(0.5);
    expect(w.dictionaries[0].thumbnail).toBe(DICT);
    expect(Object.values(listOf(w)).some((e) => e.data === DICT)).toBe(false);
  });

  it('reads the same pictures through the resolver as before', () => {
    const w = world();
    expect(coverData(w.worldOverview)).toBe(COVER);
    expect(entityImages(w.items![0], listOf(w)).map((i) => i.data)).toEqual([ABC, PQR]);
  });

  it('takes a world with a linked (http) cover into the list as a linked entry', () => {
    const raw = rawWorld();
    raw.worldOverview.thumbnail = 'https://host/cover.png';
    const w = migrateWorld(raw as unknown as World);
    expect(coverData(w.worldOverview)).toBe('https://host/cover.png');
  });

  it('leaves a world with no cover alone', () => {
    const raw = rawWorld();
    raw.worldOverview.thumbnail = '' as never;
    expect(migrateWorld(raw as unknown as World).worldOverview.thumbnail).toBe('');
  });
});

describe('readers resolve links', () => {
  const input = (active: string[]): GateInput => ({
    global: { traits: [{ id: 'wounded', name: 'wounded', statChanges: [] }], groups: [] },
    owners: [],
    active: scoped(active),
    stats: scoped<GateStatSet>({}, {}),
    entities: [],
    persona: { source: 'none' },
  });

  it('coverData reads empty for a link the list lacks', () => {
    expect(coverData({ thumbnail: { mediaId: 'gone' }, mediaList: {} } as Pick<WorldOverview, 'thumbnail' | 'mediaList'>)).toBeUndefined();
  });

  it('play shows an item picture and the map through the list', () => {
    const w = world();
    const [plain, ruled] = (w.items![0] as Item).images!;
    // The wounded picture comes first, so it shows only while the trait is on.
    const lamp = { images: [{ ...ruled, requires: WOUNDED }, plain] };
    const where = { where: { kind: 'you' } } as never;
    expect(visibleItemImage(lamp, where, input([]), listOf(w))).toBe(ABC);
    expect(visibleItemImage(lamp, where, input(['wounded']), listOf(w))).toBe(PQR);
    const map = { mapBackground: w.worldOverview.mapBackground, mediaList: listOf(w) };
    expect(visibleMapImages(map, input([])).map((v) => v.data)).toEqual([MAP]);
    expect(visibleMapImages(map, input(['wounded'])).map((v) => v.data)).toEqual([MAP, XYZ]);
  });

  it('a body backdrop link survives parsing', () => {
    const w = world();
    const parsed = parseBackdrop(w.bodies![0].backdrop);
    expect(parsed).toMatchObject({ kind: 'image', image: { mediaId: idOf((w.bodies![0].backdrop as { image: unknown }).image) } });
  });

  it('a map rewrite keeps its links rather than embedding them', async () => {
    const w = world();
    const out = await rewriteMapImages(w.worldOverview, async (data) => `${data}!`);
    expect(out.mapBackground!.images.every((l) => 'mediaId' in l)).toBe(true);
  });

  it('the Media tab carries the entry id of each linked picture', () => {
    const w = world();
    const items = buildMediaIndex({ ...w, items: w.items } as never);
    const cover = items.find((i) => i.key === 'thumbnail' && i.parent.kind === 'world');
    const backdrop = items.find((i) => i.key === 'backdrop');
    expect(cover?.mediaId).toBeTruthy();
    expect(backdrop?.mediaId).toBeTruthy();
    expect(items.filter((i) => i.parent.kind === 'map').every((i) => i.mediaId)).toBe(true);
  });

  it('usage lists the cover, the item and the backdrop for a shared entry', () => {
    const w = world();
    const uses = mediaUsage(w as never);
    const coverId = idOf(w.worldOverview.thumbnail);
    expect(uses.get(coverId)).toHaveLength(1);
    expect(uses.get(idOf(w.items![0].images![0]))).toHaveLength(2);
  });
});

/** An editor over one mutable world, so a slot write runs against the real parent table. */
function editorOver(initial: World) {
  let w = initial;
  const editor: MediaEditor = {
    overview: (patch) => { w = { ...w, worldOverview: { ...w.worldOverview, ...patch(w.worldOverview) } }; },
    entity: () => {},
    location: () => {},
    dictionary: () => {},
    body: (id, edit) => { w = { ...w, bodies: w.bodies!.map((b) => (b.id === id ? edit(b) : b)) }; },
    item: (id, edit) => { w = { ...w, items: w.items!.map((i) => (i.id === id ? edit(i) : i)) }; },
    read: {
      entity: () => undefined, location: () => undefined,
      body: (id) => w.bodies?.find((b) => b.id === id), item: (id) => w.items?.find((i) => i.id === id),
      overview: () => w.worldOverview, mediaList: () => w.worldOverview.mediaList, subject: (name) => name,
    },
    addMedia: (entries) => { w = { ...w, worldOverview: { ...w.worldOverview, mediaList: { ...w.worldOverview.mediaList, ...entries } } }; },
  };
  return { editor, get: () => w };
}

describe('writing a slot places the file into the list', () => {
  const NEW = 'data:image/png;base64,TkVX';

  it('names the backdrop of an unnamed Body "Body", as migration does', () => {
    const raw = rawWorld();
    raw.bodies[0].name = '';
    const migrated = migrateWorld(raw as unknown as World);
    expect(listOf(migrated)[idOf((migrated.bodies![0].backdrop as { image: unknown }).image)].name).toBe('Body 1');

    const { editor, get } = editorOver(migrated);
    writeMediaSlot(editor, { parent: { kind: 'body', id: 'imp', name: 'Unnamed Body' }, key: 'backdrop' }, { data: NEW });
    const written = get().bodies![0].backdrop as { image: { mediaId: string } };
    expect(listOf(get())[written.image.mediaId].name).toBe('Body 2');
  });

  it('a replaced cover is a new entry named by its file, and the cover links it', () => {
    const { editor, get } = editorOver(world());
    writeMediaSlot(editor, { parent: { kind: 'world', id: 'world', name: 'World' }, key: 'thumbnail' }, { data: NEW, name: 'sunrise.png' });
    const w = get();
    expect(listOf(w)[idOf(w.worldOverview.thumbnail)]).toMatchObject({ name: 'sunrise', data: NEW });
  });

  it('a new backdrop links its entry, keeping the opacity', () => {
    const { editor, get } = editorOver(world());
    writeMediaSlot(editor, { parent: { kind: 'body', id: 'imp', name: 'Imp' }, key: 'backdrop' }, { data: NEW, name: 'imp.png' });
    const backdrop = get().bodies![0].backdrop as { image: { mediaId: string }; opacity: number };
    expect(listOf(get())[backdrop.image.mediaId].name).toBe('imp');
    expect(backdrop.opacity).toBe(0.5);
  });

  it('a new item picture links, and a picture the world already holds is reused', () => {
    const { editor, get } = editorOver(world());
    const parent = { kind: 'item' as const, id: 'lamp', name: 'Lamp' };
    const before = Object.keys(listOf(get())).length;
    writeMediaSlot(editor, { parent, key: 'image:0', galleryIndex: 0 }, { data: XYZ });
    // XYZ is the map's second picture: no new entry.
    expect(Object.keys(listOf(get())).length).toBe(before);
    const first = get().items![0].images![0];
    expect(idOf(first)).toBe(idOf(get().worldOverview.mapBackground!.images[1]));
  });

  it('a new map picture links as a named entry', () => {
    const { editor, get } = editorOver(world());
    writeMediaSlot(editor, { parent: { kind: 'map', id: 'map', name: 'Map Background' }, key: 'image:0', galleryIndex: 0 }, { data: NEW, name: 'coast.png' });
    const link = get().worldOverview.mapBackground!.images[0];
    expect(listOf(get())[idOf(link)]).toMatchObject({ data: NEW, name: 'coast' });
    expect(galleryLinks(get().worldOverview.mapBackground as never).length).toBe(2);
  });

  it('clearing a backdrop falls back to the humanoid outline and keeps the entry', () => {
    const { editor, get } = editorOver(world());
    const before = Object.keys(listOf(get())).length;
    writeMediaSlot(editor, { parent: { kind: 'body', id: 'imp', name: 'Imp' }, key: 'backdrop' }, null);
    expect((get().bodies![0] as Body).backdrop.kind).toBe('humanoid');
    expect(Object.keys(listOf(get())).length).toBe(before);
  });

  it('a world with no list keeps a written cover embedded (Q26)', () => {
    const bare = { ...world(), worldOverview: { ...world().worldOverview, thumbnail: '', mediaList: undefined } } as World;
    const { editor, get } = editorOver(bare);
    writeMediaSlot(editor, { parent: { kind: 'world', id: 'world', name: 'World' }, key: 'thumbnail' }, { data: NEW });
    expect(get().worldOverview.thumbnail).toBe(NEW);
  });
});
