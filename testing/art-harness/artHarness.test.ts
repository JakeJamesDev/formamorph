import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Entity, GameLocation, TraitRequirementRow, World } from '@/types';
import { entityImages } from '@/lib/entityImages';
import { locationImages } from '@/lib/locationImages';
import { firstMapFrame } from '@/lib/mapBackground';
import {
  ART_PRESET, SHEET, displayName, imageRequest, placeholderNames, isStoredForm, planImages, sheetLayout, withFaceFix, writeImage, type PlannedImage, type SheetCell,
} from './artHarness';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const droneText = readFileSync(path.join(ROOT, 'src/defaultworlds/drone.json'), 'utf8');

const STYLE = 'flat color, muted palette, quiet mood';

const location = (id: string, name: string, extra: Partial<GameLocation> = {}): GameLocation =>
  ({ id, name, imageTags: `${name.toLowerCase()} tags`, ...extra }) as GameLocation;
const entity = (id: string, name: string, extra: Partial<Entity> = {}): Entity =>
  ({ id, name, imageTags: `${name.toLowerCase()} tags`, ...extra }) as Entity;

/** Gate has art, Mill has none, Cellar has no tags; Ada has two images, Bram none. */
const world = (): World => ({
  worldOverview: { name: 'Test World' },
  locations: [
    location('loc-gate', 'Gate', { images: [{ data: 'data:image/webp;base64,R0FURQ==' }] }),
    location('loc-mill', 'Mill'),
    location('loc-cellar', 'Cellar', { imageTags: '' }),
  ],
  entities: [
    entity('ent-ada', 'Ada', { images: [{ data: 'data:image/webp;base64,QURBMA==' }, { data: 'data:image/webp;base64,QURBMQ==' }] }),
    entity('ent-bram', 'Bram'),
  ],
} as unknown as World);

const refs = (images: PlannedImage[]) => images.map((i) => `${i.name}#${i.slot}:${i.mode}`);

describe('imageRequest', () => {
  const plan = planImages(world(), { redo: ['Mill', 'Bram'], mapTags: 'world map, parchment' }).images;
  const byName = (name: string) => plan.find((i) => i.name === name)!;

  it('draws a location as the landscape size with the art-direction line before its tags', () => {
    const { provider, params } = imageRequest(world(), byName('Mill'), STYLE, 1234);
    expect(provider).toBe('invokeai');
    expect([params.width, params.height]).toEqual([1216, 832]);
    expect(params.prompt).toBe(`${STYLE}, mill tags`);
    expect(params.seed).toBe(1234);
  });

  it('draws an entity as the portrait size', () => {
    const { params } = imageRequest(world(), byName('Bram'), STYLE, 7);
    expect([params.width, params.height]).toEqual([832, 1216]);
    expect(params.prompt).toBe(`${STYLE}, bram tags`);
  });

  it('draws the map as the landscape size from the map tags', () => {
    const { params } = imageRequest(world(), byName('Map'), STYLE, 7);
    expect([params.width, params.height]).toEqual([1216, 832]);
    expect(params.prompt).toBe(`${STYLE}, world map, parchment`);
  });

  it('sends the Q21 model at its Invoke defaults, with the face pass off and the pinned negative', () => {
    const { params } = imageRequest(world(), byName('Mill'), `${STYLE},`, 7);
    expect(params).toMatchObject({
      model: 'Illustrious Nova Kemono XL 8.0', sampler: 'euler_a', steps: 35, cfg: 4, adetailer: false,
      negativePrompt: ART_PRESET.imageNegativePrompt,
    });
    // A trailing comma on the line does not double up.
    expect(params.prompt).toBe(`${STYLE}, mill tags`);
  });

  it('appends a run\'s extra negative tags after the pinned negative', () => {
    const { params } = imageRequest(world(), byName('Bram'), STYLE, 7, ' treads, legs, ');
    expect(params.negativePrompt).toBe(`${ART_PRESET.imageNegativePrompt}, treads, legs`);
    expect(params.prompt).toBe(`${STYLE}, bram tags`);
  });

  it('turns the Face Fix pass on only for a run that asks for it', () => {
    expect(imageRequest(world(), byName('Bram'), STYLE, 7, '', true).params.adetailer).toBe(true);
    expect(imageRequest(world(), byName('Bram'), STYLE, 7, '').params.adetailer).toBe(false);
  });

  it('adds the Face Fix pass to a logged request and keeps its seed and prompt', () => {
    const logged = { slot: 0, ...imageRequest(world(), byName('Bram'), STYLE, 7, ' legs ') };
    expect(withFaceFix(logged)).toEqual({ ...logged, params: { ...logged.params, adetailer: true } });
  });
});

describe('displayName', () => {
  const drone = JSON.parse(droneText) as World;

  it('shows a name chip as its placeholder\'s name, and a plain name as is', () => {
    const chipped = drone.entities!.find((e) => e.name.startsWith('{{ph:'))!;
    const names = placeholderNames(drone);
    expect(displayName(names, chipped.name)).toBe('Designation');
    expect(displayName(names, 'Tamsin')).toBe('Tamsin');
  });
});

describe('planImages', () => {
  it('makes slot 0 for every tagged item with no image by default, and names the untagged one', () => {
    const plan = planImages(world(), {});
    expect(refs(plan.images)).toEqual(['Mill#0:missing', 'Bram#0:missing']);
    expect(plan.skipped).toEqual([{ ref: 'Cellar', reason: 'it has no imageTags' }]);
  });

  it('redoes only the named slots when a list is given, by name, slot, id or map', () => {
    const plan = planImages(world(), { redo: ['gate', 'Ada#1', 'ent-bram'], mapTags: 'old map' });
    expect(refs(plan.images)).toEqual(['Map#0:missing', 'Gate#0:redo', 'Ada#1:redo', 'Bram#0:missing']);
  });

  it('adds the missing items to a redo list when asked', () => {
    const plan = planImages(world(), { missing: true, redo: ['Ada'] });
    expect(refs(plan.images)).toEqual(['Mill#0:missing', 'Bram#0:missing', 'Ada#0:redo']);
  });

  it('refuses a slot the item does not have, an unknown name and a shared name', () => {
    const shared = world();
    shared.entities.push(entity('ent-mill', 'Mill'));
    const plan = planImages(shared, { redo: ['Ada#2', 'Nobody', 'Mill', 'Gate#1'] });
    expect(plan.images).toEqual([]);
    expect(plan.skipped.map((s) => s.ref)).toEqual(['Ada#2', 'Nobody', 'Mill', 'Gate#1']);
    expect(plan.skipped[2].reason).toMatch(/use an id/);
  });

  it('does not plan the same slot twice', () => {
    const plan = planImages(world(), { missing: true, redo: ['Mill'] });
    expect(refs(plan.images)).toEqual(['Mill#0:missing', 'Bram#0:missing']);
    expect(plan.skipped).toContainEqual({ ref: 'Mill', reason: 'slot 0 is already in this run' });
  });

  it('appends a variant after every image the item has, with its extra tags after the subject', () => {
    const plan = planImages(world(), { variants: [{ ref: 'Ada', extra: 'at night' }, { ref: 'Ada', extra: ' wounded ' }] });
    expect(refs(plan.images)).toEqual(['Ada#2:variant', 'Ada#3:variant']);
    expect(plan.images.map((i) => i.subject)).toEqual(['ada tags, at night', 'ada tags, wounded']);
  });

  it('puts a variant after a first image the same run makes, and refuses one with no first image', () => {
    expect(refs(planImages(world(), { missing: true, variants: [{ ref: 'Mill', extra: 'burning' }] }).images))
      .toEqual(['Mill#0:missing', 'Bram#0:missing', 'Mill#1:variant']);
    const alone = planImages(world(), { variants: [{ ref: 'Mill', extra: 'burning' }] });
    expect(alone.images).toEqual([]);
    expect(alone.skipped[0].reason).toMatch(/first image/);
  });

  it('needs map tags for any map image', () => {
    const plan = planImages(world(), { redo: ['map'] });
    expect(plan.images).toEqual([]);
    expect(plan.skipped).toEqual([{ ref: 'map', reason: 'a map image needs map tags' }]);
  });

  it('makes the first map image alongside the missing items', () => {
    expect(refs(planImages(world(), { mapTags: 'old map' }).images)).toEqual(['Mill#0:missing', 'Bram#0:missing', 'Map#0:missing']);
  });

  it('refuses a variant that names a slot', () => {
    const plan = planImages(world(), { variants: [{ ref: 'Ada#1', extra: 'at night' }] });
    expect(plan.images).toEqual([]);
    expect(plan.skipped).toEqual([{ ref: 'Ada#1', reason: 'a variant names an item, not a slot' }]);
  });
});

describe('writeImage', () => {
  const drone = JSON.parse(droneText) as World;
  const pictured = drone.entities.find((e) => entityImages(e).length > 0)!;
  // The Drone file with its first location's art removed, in the stored form, so a gallery is empty.
  const bare = drone.locations[0];
  const bareText = `${JSON.stringify({ ...drone, locations: drone.locations.map((l) => (l === bare ? { ...l, images: undefined } : l)) }, null, 2)}\n`;
  const NEW = 'data:image/webp;base64,TkVX';

  it('rewrites an unchanged image as the same bytes, so the format round-trips exactly', () => {
    const same = writeImage(droneText, { kind: 'entity', id: pictured.id, slot: 0, data: entityImages(pictured)[0].data });
    expect(same).toBe(droneText);
  });

  it('changes one line of the file: the data of the slot it writes', () => {
    const before = droneText.split('\n');
    const after = writeImage(droneText, { kind: 'entity', id: pictured.id, slot: 0, data: NEW }).split('\n');
    expect(after).toHaveLength(before.length);
    const changed = after.flatMap((line, i) => (line === before[i] ? [] : [[before[i], line]]));
    // A slot with a rule after its data keeps the trailing comma.
    const ending = before.find((line) => line.includes(entityImages(pictured)[0].data))!.endsWith(',') ? ',' : '';
    expect(changed).toEqual([[`${' '.repeat(10)}"data": "${entityImages(pictured)[0].data}"${ending}`, `${' '.repeat(10)}"data": "${NEW}"${ending}`]]);
  });

  it('tells a file in the stored form from one a write would reformat', () => {
    expect(isStoredForm(droneText)).toBe(true);
    expect(isStoredForm(droneText.replace(/\n/g, '\r\n'))).toBe(false);
    expect(isStoredForm(JSON.stringify(JSON.parse(droneText)))).toBe(false);
  });

  it('keeps a replaced slot\'s rule and appends a slot at the end of the gallery', () => {
    const rule: TraitRequirementRow[] = [{ all: [{ kind: 'trait', id: 'trait-wounded' }] }];
    const base = world();
    base.entities[0].images![1] = { data: 'data:image/webp;base64,QURBMQ==', requires: rule };
    let text = writeImage(JSON.stringify(base), { kind: 'entity', id: 'ent-ada', slot: 1, data: NEW });
    text = writeImage(text, { kind: 'entity', id: 'ent-ada', slot: 2, data: NEW });
    const ada = (JSON.parse(text) as World).entities[0];
    expect(ada.images).toEqual([{ data: 'data:image/webp;base64,QURBMA==' }, { data: NEW, requires: rule }, { data: NEW }]);
  });

  it('gives a location with no art its first image', () => {
    expect(locationImages((JSON.parse(bareText) as World).locations[0])).toEqual([]);
    const text = writeImage(bareText, { kind: 'location', id: bare.id, slot: 0, data: NEW });
    const after = (JSON.parse(text) as World).locations.find((l) => l.id === bare.id)!;
    expect(after.images).toEqual([{ data: NEW }]);
  });

  it('refuses a slot past the end of the gallery and an unknown id', () => {
    expect(() => writeImage(bareText, { kind: 'location', id: bare.id, slot: 1, data: NEW })).toThrow(/slot 1/);
    expect(() => writeImage(droneText, { kind: 'entity', id: 'nobody', slot: 0, data: NEW })).toThrow(/nobody/);
  });

  it('starts a Map Background over the locations at full opacity, then keeps its frame for later slots', () => {
    const first = writeImage(droneText, { kind: 'map', id: 'map', slot: 0, data: NEW });
    const background = (JSON.parse(first) as World).worldOverview.mapBackground!;
    expect(background).toEqual({ images: [{ data: NEW }], frame: firstMapFrame(drone.locations, 1216 / 832), opacity: 1 });

    const moved = JSON.parse(first) as World;
    moved.worldOverview.mapBackground!.frame = { x: 1, y: 2, width: 3, height: 4 };
    moved.worldOverview.mapBackground!.opacity = 0.4;
    const second = writeImage(JSON.stringify(moved), { kind: 'map', id: 'map', slot: 1, data: 'data:image/webp;base64,Mg==' });
    expect((JSON.parse(second) as World).worldOverview.mapBackground).toEqual({
      images: [{ data: NEW }, { data: 'data:image/webp;base64,Mg==' }], frame: { x: 1, y: 2, width: 3, height: 4 }, opacity: 0.4,
    });
  });
});

describe('sheetLayout', () => {
  const inputs = [
    { label: 'Gate#0', width: 1216, height: 832 },
    { label: 'Ada#0', width: 832, height: 1216 },
    { label: 'Ada#1', width: 832, height: 1216 },
    { label: 'Map#0', width: 1216, height: 832 },
    { label: 'Bram#0', width: 832, height: 1216 },
  ];
  const layout = sheetLayout(inputs);

  it('labels every image in input order', () => {
    expect(layout.cells.map((c) => c.label)).toEqual(inputs.map((i) => i.label));
  });

  it('fits each image in its box at its own aspect, inside the sheet, with its label beneath it', () => {
    layout.cells.forEach((cell, i) => {
      const { x, y, width, height } = cell.image;
      expect(Math.max(width, height)).toBe(SHEET.box);
      expect(width / height).toBeCloseTo(inputs[i].width / inputs[i].height, 2);
      expect(x + width).toBeLessThanOrEqual(layout.width);
      expect(cell.labelY).toBeLessThanOrEqual(layout.height);
      expect(cell.labelY).toBeGreaterThan(y + height);
    });
  });

  it('puts no image over another image or over another cell\'s label', () => {
    const inside = (px: number, py: number, r: SheetCell['image']) => px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height;
    for (const [i, a] of layout.cells.entries()) {
      for (const [j, b] of layout.cells.entries()) {
        if (i === j) continue;
        const overlaps = a.image.x < b.image.x + b.image.width && b.image.x < a.image.x + a.image.width
          && a.image.y < b.image.y + b.image.height && b.image.y < a.image.y + a.image.height;
        expect(overlaps).toBe(false);
        expect(inside(b.labelX, b.labelY, a.image)).toBe(false);
      }
    }
  });

  it('lays five images out as three columns and two rows', () => {
    expect(new Set(layout.cells.map((c) => c.labelX)).size).toBe(3);
    expect(new Set(layout.cells.map((c) => c.labelY)).size).toBe(2);
  });
});
