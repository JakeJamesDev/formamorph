// The Art Harness's pure parts: which images a run makes, the provider request for each, the id-keyed write
// into the world file, and the contact sheet's layout. The CLI does the I/O around them.

import type { Entity, GalleryImage, GameLocation, World } from '@/types';
import { buildImageRequest, type ImageSettings } from '@/lib/imageGen';
import type { ImageGenParams, ImageProviderId } from '@/lib/imageGen/types';
import { entityImages } from '@/lib/entityImages';
import { locationImages } from '@/lib/locationImages';
import { firstMapFrame, mapImages, withMapImages } from '@/lib/mapBackground';
import { allPlaceholders } from '@/lib/placeholderHomes';
import { decodePlaceholderToken, placeholderChipLine } from '@/lib/placeholders';

/** The effort's art model at its Invoke defaults, every field pinned so no `VITE_DEFAULT_*` value leaks in. */
export const ART_PRESET: ImageSettings = {
  imageProvider: 'invokeai',
  imageEndpoint: '',
  imageApiToken: '',
  imageModel: 'Illustrious Nova Kemono XL 8.0',
  imagePositivePrompt: '',
  imageNegativePrompt: 'lowres, bad anatomy, worst quality, low quality, watermark, text',
  imageSteps: 35,
  imageCfg: 4,
  imageSampler: 'euler_a',
  imageAdetailer: false,
  imageWorkflow: '',
  imageInvokeEncoder: '',
  imageInvokeVae: '',
  imageInvokeBoard: '',
  activeImageEndpointPresetName: 'Art Harness',
};

/** One size per kind across a world: the app's SDXL buckets. Map images take the landscape size. */
const SIZES = {
  landscape: { width: 1216, height: 832 },
  portrait: { width: 832, height: 1216 },
} as const;

export type ItemKind = 'location' | 'entity' | 'map';

/** One image the run makes, and the gallery slot it lands in. */
export interface PlannedImage {
  kind: ItemKind;
  /** The location or entity id; `map` for the Map Background. */
  id: string;
  name: string;
  slot: number;
  /** `missing` fills an empty gallery, `redo` replaces a slot, `variant` appends one. */
  mode: 'missing' | 'redo' | 'variant';
  /** The subject's own tags: its `imageTags`, plus a variant's extra tags. */
  subject: string;
  width: number;
  height: number;
}

/** An item the run was asked for but cannot make, with the reason. */
export interface SkippedItem {
  ref: string;
  reason: string;
}

export interface PlanOptions {
  /** Make slot 0 for every location and entity with no image. Default unless a redo or variant is asked. */
  missing?: boolean;
  /** `Name`, `Name#2`, an id, or `map`, `map#1`. */
  redo?: string[];
  /** A named item and the tags its new slot adds. */
  variants?: { ref: string; extra: string }[];
  /** The map's tags. Makes slot 0 when the world has no Map Background; needed by any map redo or variant. */
  mapTags?: string;
}

export interface Plan {
  images: PlannedImage[];
  skipped: SkippedItem[];
}

/** The id the Map Background answers to in a ref. */
const MAP_ID = 'map';

/** One labeled image, for the contact sheet. */
export interface SheetImage {
  label: string;
  data: string;
}

const sizeOf = (kind: ItemKind) => (kind === 'entity' ? SIZES.portrait : SIZES.landscape);

/** A gallery-bearing item of the world, for ref lookup. */
interface Target {
  kind: ItemKind;
  id: string;
  name: string;
  tags: string;
  slots: number;
}

const targetsOf = (world: World, mapTags: string): Target[] => [
  ...(world.locations ?? []).map((l) => ({
    kind: 'location' as const, id: l.id, name: l.name, tags: l.imageTags?.trim() ?? '', slots: locationImages(l).length,
  })),
  ...(world.entities ?? []).map((e) => ({
    kind: 'entity' as const, id: e.id, name: e.name, tags: e.imageTags?.trim() ?? '', slots: entityImages(e).length,
  })),
  { kind: 'map', id: MAP_ID, name: 'Map', tags: mapTags, slots: mapImages(world.worldOverview).length },
];

const noTags = (kind: ItemKind) => (kind === 'map' ? 'a map image needs map tags' : 'it has no imageTags');

/** Split `Name#2` into its name and slot; a bare name means slot 0. */
function parseRef(ref: string): { name: string; slot: number } {
  const match = /^(.*?)#(\d+)$/.exec(ref.trim());
  return match ? { name: match[1].trim(), slot: Number(match[2]) } : { name: ref.trim(), slot: 0 };
}

/** Resolve a name or id to one item: an exact id first, then a case-insensitive name that only one item has. */
function resolve(targets: Target[], name: string): Target | string {
  const byId = targets.find((t) => t.id === name);
  if (byId) return byId;
  const lower = name.toLowerCase();
  const byName = targets.filter((t) => t.name.toLowerCase() === lower);
  if (byName.length === 1) return byName[0];
  return byName.length ? `${byName.length} items share this name; use an id` : 'no location, entity or map has this name or id';
}

/** Every image a run makes, in order, with each slot resolved against the world as it stands. */
export function planImages(world: World, options: PlanOptions): Plan {
  const mapTags = options.mapTags?.trim() ?? '';
  const targets = targetsOf(world, mapTags);
  const images: PlannedImage[] = [];
  const skipped: SkippedItem[] = [];
  // Slots this plan already appends to, so two variants of one item land in two new slots.
  const appended = new Map<string, number>();
  const taken = new Set<string>();

  const add = (target: Target, slot: number, mode: PlannedImage['mode'], subject: string, ref: string) => {
    const key = `${target.kind}:${target.id}#${slot}`;
    if (taken.has(key)) { skipped.push({ ref, reason: `slot ${slot} is already in this run` }); return; }
    if (!subject) { skipped.push({ ref, reason: noTags(target.kind) }); return; }
    taken.add(key);
    images.push({ kind: target.kind, id: target.id, name: target.name, slot, mode, subject, ...sizeOf(target.kind) });
  };

  const asked = options.redo?.length || options.variants?.length;
  if (options.missing ?? !asked) {
    for (const target of targets) {
      if (target.kind !== 'map' && target.slots === 0) add(target, 0, 'missing', target.tags, target.name);
    }
  }
  const map = targets.find((t) => t.kind === 'map');
  if (map && mapTags && map.slots === 0) add(map, 0, 'missing', mapTags, 'map');

  for (const ref of options.redo ?? []) {
    const { name, slot } = parseRef(ref);
    const target = resolve(targets, name);
    if (typeof target === 'string') { skipped.push({ ref, reason: target }); continue; }
    // A redo of slot 0 on an empty gallery fills it, so a named list can also make first images.
    if (slot >= Math.max(target.slots, 1)) { skipped.push({ ref, reason: `it has no slot ${slot}` }); continue; }
    add(target, slot, target.slots ? 'redo' : 'missing', target.tags, ref);
  }

  for (const { ref, extra } of options.variants ?? []) {
    if (/#\d+$/.test(ref.trim())) { skipped.push({ ref, reason: 'a variant names an item, not a slot' }); continue; }
    const target = resolve(targets, ref.trim());
    if (typeof target === 'string') { skipped.push({ ref, reason: target }); continue; }
    if (!extra.trim()) { skipped.push({ ref, reason: 'a variant needs extra tags' }); continue; }
    if (!target.tags) { skipped.push({ ref, reason: noTags(target.kind) }); continue; }
    // A variant follows every image the item has, counting a first image this run makes.
    const key = `${target.kind}:${target.id}`;
    const slot = appended.get(key) ?? (target.slots || (taken.has(`${key}#0`) ? 1 : 0));
    if (slot === 0) { skipped.push({ ref, reason: 'a variant needs a first image; make slot 0 first' }); continue; }
    appended.set(key, slot + 1);
    add(target, slot, 'variant', `${target.tags}, ${extra.trim()}`, ref);
  }
  return { images, skipped };
}

/** The pinned negative with a run's extra negative tags after it. */
export const negativePrompt = (extra = '') =>
  [ART_PRESET.imageNegativePrompt, extra.trim().replace(/^,+|,+$/g, '').trim()].filter(Boolean).join(', ');

/** The provider call for one image: the art-direction line as the positive prefix, the subject's tags after it.
 *  `faceFix` turns on the provider's Face Fix pass for the run. */
export function imageRequest(world: World, image: PlannedImage, style: string, seed: number, negative = '', faceFix = false):
{ provider: ImageProviderId; params: ImageGenParams } {
  const preset = { ...ART_PRESET, imagePositivePrompt: style, imageNegativePrompt: negativePrompt(negative), imageAdetailer: faceFix };
  const { provider, params } = buildImageRequest(preset, {
    prompt: image.subject,
    width: image.width,
    height: image.height,
    seed,
    file: { world: world.worldOverview?.name || 'world', subject: image.name },
  });
  return { provider, params };
}

/** A logged request with the Face Fix pass on, its seed and prompt unchanged. */
export const withFaceFix = <T extends { params: ImageGenParams }>(job: T): T => ({ ...job, params: { ...job.params, adetailer: true } });

/** Put `data` in `images` at `slot`: a replace keeps the slot's Visibility rule, `slot === length` appends. */
function placeInGallery(images: GalleryImage[], slot: number, data: string, where: string): GalleryImage[] {
  if (slot > images.length) throw new Error(`${where} has ${images.length} images, so slot ${slot} cannot be written`);
  const next = [...images];
  next[slot] = { ...next[slot], data };
  return next;
}

/** One finished image for the world write. */
export interface WrittenImage {
  kind: ItemKind;
  id: string;
  slot: number;
  data: string;
}

/** The text the way every bundled world is stored: two-space JSON with one trailing newline. */
const stored = (world: unknown) => `${JSON.stringify(world, null, 2)}\n`;

/** True when re-serializing `worldText` gives back the same bytes, so a write moves nothing else. */
export const isStoredForm = (worldText: string): boolean => stored(JSON.parse(worldText)) === worldText;

/**
 * The world file's text with `image` in place. The file is parsed, the one gallery is changed, and the rest
 * is re-serialized in the stored form, so a file in that form keeps every other byte.
 */
export function writeImage(worldText: string, image: WrittenImage): string {
  const world = JSON.parse(worldText) as World;
  if (image.kind === 'map') {
    const overview = world.worldOverview;
    const images = placeInGallery(mapImages(overview), image.slot, image.data, 'The Map Background');
    const { width, height } = SIZES.landscape;
    world.worldOverview = {
      ...overview,
      mapBackground: withMapImages(overview.mapBackground, images, firstMapFrame(world.locations ?? [], width / height)),
    };
  } else {
    const list: (GameLocation | Entity)[] = (image.kind === 'location' ? world.locations : world.entities) ?? [];
    const item = list.find((i) => i.id === image.id);
    if (!item) throw new Error(`No ${image.kind} has the id ${image.id}`);
    const gallery = image.kind === 'location' ? locationImages(item as GameLocation) : entityImages(item as Entity);
    item.images = placeInGallery(gallery, image.slot, image.data, item.name);
  }
  return stored(world);
}

/** The label a sheet cell and a redo ref share. */
export const imageLabel = (name: string, slot: number) => `${name}#${slot}`;

/** Each placeholder's name by id, for {@link displayName}. */
export const placeholderNames = (world: World): ReadonlyMap<string, string> =>
  new Map(allPlaceholders(world).map((ph) => [ph.id, ph.name]));

/** An item's name as the reviewer reads it: each chip shows its own label, else its placeholder's name. */
export function displayName(names: ReadonlyMap<string, string>, name: string): string {
  return placeholderChipLine(name, (token) => {
    const decoded = decodePlaceholderToken(token);
    return decoded?.label || (decoded && names.get(decoded.id)) || token;
  });
}

export interface SheetInput {
  label: string;
  width: number;
  height: number;
}

export interface SheetCell {
  label: string;
  /** The image's drawn rectangle, fitted inside its box at its own aspect. */
  image: { x: number; y: number; width: number; height: number };
  /** The label's baseline origin. */
  labelX: number;
  labelY: number;
}

export interface SheetLayout {
  width: number;
  height: number;
  cells: SheetCell[];
}

export const SHEET = { box: 320, label: 28, gap: 12, maxColumns: 6 } as const;

/** A grid of equal boxes, each image fitted inside its box with its label beneath. */
export function sheetLayout(inputs: SheetInput[]): SheetLayout {
  const { box, label, gap, maxColumns } = SHEET;
  const columns = Math.max(1, Math.min(maxColumns, Math.ceil(Math.sqrt(inputs.length))));
  const rows = Math.ceil(inputs.length / columns);
  const cellHeight = box + label;
  const cells = inputs.map((input, index) => {
    const left = gap + (index % columns) * (box + gap);
    const top = gap + Math.floor(index / columns) * (cellHeight + gap);
    const scale = Math.min(box / input.width, box / input.height);
    const width = Math.round(input.width * scale);
    const height = Math.round(input.height * scale);
    return {
      label: input.label,
      image: { x: left + Math.round((box - width) / 2), y: top + Math.round((box - height) / 2), width, height },
      labelX: left,
      labelY: top + box + label - 8,
    };
  });
  return { width: gap + columns * (box + gap), height: gap + rows * (cellHeight + gap), cells };
}
