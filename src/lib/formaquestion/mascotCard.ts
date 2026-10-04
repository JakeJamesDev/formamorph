/**
 * The Mascot card's data: the whole rig with every image carried in full, as the card's metadata holds it.
 * Images sit once each in a table and the rig names them by index. Parse is strict: one bad field refuses
 * the card and names that field. No DOM here; `mascotCardFile` reads and writes the image file.
 */
import { isRecord } from '@/lib/tools/toolValidation';
import {
  MASCOT_PICK_NAMES, isId, isLayerKind, parseMask, type MascotImageRef, type MascotLayer, type MascotMask, type MascotPick, type MascotPickName,
  type MascotRig,
} from './mascot';
import { MASCOT_TRANSITION_MODES, parseMascotTransition, type MascotTransition, type MascotTransitionMode } from './mascotTransition';

export const MASCOT_CARD_KIND = 'mascot' as const;
export const MASCOT_CARD_VERSION = 1;

export const NOT_A_MASCOT_CARD = "This image isn't a Formamorph mascot card.";

/** A layer whose images are indexes into the card's image table. */
export interface MascotCardLayer extends Omit<MascotLayer, 'images'> {
  readonly images: readonly number[];
}

export interface MascotCardRig extends Omit<MascotRig, 'base' | 'layers'> {
  readonly base: number;
  readonly layers: readonly MascotCardLayer[];
}

/** The card's metadata. `appVersion` is the build that wrote it, for a person reading the card; `version` gates the read. */
export interface MascotCardData {
  readonly formamorphKind: typeof MASCOT_CARD_KIND;
  readonly version: typeof MASCOT_CARD_VERSION;
  readonly appVersion: string;
  /** The mascot's name. An import without one names the mascot after the file. */
  readonly name?: string;
  /** Each distinct image once, as a base64 data URL. */
  readonly images: readonly string[];
  readonly rig: MascotCardRig;
}

/** The card of the mascot `name`. `dataOf` gives each image's pixels as a base64 data URL; equal pixels share one table entry. */
export function buildMascotCardData(name: string, rig: MascotRig, dataOf: (ref: MascotImageRef) => string, appVersion: string): MascotCardData {
  const images: string[] = [];
  const indexOf = new Map<string, number>();
  const carry = (ref: MascotImageRef): number => {
    const data = dataOf(ref);
    let index = indexOf.get(data);
    if (index === undefined) {
      index = images.push(data) - 1;
      indexOf.set(data, index);
    }
    return index;
  };
  const { base, layers, ...rest } = rig;
  return {
    formamorphKind: MASCOT_CARD_KIND,
    version: MASCOT_CARD_VERSION,
    appVersion,
    name,
    images,
    rig: { ...rest, base: carry(base), layers: layers.map((layer) => ({ ...layer, images: layer.images.map(carry) })) },
  };
}

/** The name an imported card's mascot takes before a clash is numbered: the card's, else the file's without its extension. */
export const mascotCardName = (card: MascotCardData, fileName: string): string =>
  card.name ?? (fileName.replace(/\.[^.]*$/, '').trim() || 'Mascot');

/** The rig a card gives once its images are stored: `ids[n]` is the store id of the card's image `n`. */
export function mascotRigFromCard(card: MascotCardData, ids: readonly string[]): MascotRig {
  const ref = (index: number): MascotImageRef => ({ kind: 'stored', id: ids[index] });
  const { base, layers, ...rest } = card.rig;
  return { ...rest, base: ref(base), layers: layers.map((layer) => ({ ...layer, images: layer.images.map(ref) })) };
}

const refusal = (field: string) => new Error(`This mascot card has a missing or bad field: ${field}.`);

const IMAGE_DATA = /^data:image\/[a-z0-9.+-]+;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/** True for a base64 data URL of an image, the one form the card's image table holds. */
export const isMascotCardImage = (data: string): boolean => IMAGE_DATA.test(data);

const isMode = (value: unknown): value is MascotTransitionMode => (MASCOT_TRANSITION_MODES as readonly unknown[]).includes(value);

function recordAt(parent: Record<string, unknown>, key: string, field: string): Record<string, unknown> {
  const value = parent[key];
  if (!isRecord(value)) throw refusal(field);
  return value;
}

function listAt(parent: Record<string, unknown>, key: string, field: string): unknown[] {
  const value = parent[key];
  if (!Array.isArray(value)) throw refusal(field);
  return value;
}

function readImages(raw: unknown[]): string[] {
  return raw.map((data, index) => {
    if (typeof data !== 'string' || !isMascotCardImage(data)) throw refusal(`images.${index}`);
    return data;
  });
}

function readIndex(value: unknown, count: number, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= count) throw refusal(field);
  return value as number;
}

function readLayers(raw: unknown[], count: number): MascotCardLayer[] {
  const seen = new Set<string>();
  return raw.map((entry, index) => {
    const field = `rig.layers.${index}`;
    if (!isRecord(entry)) throw refusal(field);
    const { id, name, kind, enabled } = entry;
    if (!isId(id) || seen.has(id)) throw refusal(`${field}.id`);
    seen.add(id);
    if (typeof name !== 'string') throw refusal(`${field}.name`);
    if (!isLayerKind(kind)) throw refusal(`${field}.kind`);
    if (typeof enabled !== 'boolean') throw refusal(`${field}.enabled`);
    const images = listAt(entry, 'images', `${field}.images`).map((image, at) => readIndex(image, count, `${field}.images.${at}`));
    return { id, name, kind, enabled, images };
  });
}

/** The Mask; null is the whole base. */
function readMask(value: unknown): MascotMask | null {
  if (value === null) return null;
  const mask = parseMask(value);
  if (!mask) throw refusal('rig.mask');
  return mask;
}

/** The picks. A slot may name a layer the card lacks; the tab warns about it. */
function readPicks(rig: Record<string, unknown>): { [K in MascotPickName]: MascotPick } {
  const picks = recordAt(rig, 'picks', 'rig.picks');
  const read = (name: MascotPickName): MascotPick => {
    const pick = recordAt(picks, name, `rig.picks.${name}`);
    const slot = (key: keyof MascotPick) => {
      const value = pick[key];
      if (value !== null && !isId(value)) throw refusal(`rig.picks.${name}.${key}`);
      return value;
    };
    return { expression: slot('expression'), state: slot('state') };
  };
  return Object.fromEntries(MASCOT_PICK_NAMES.map((name) => [name, read(name)])) as { [K in MascotPickName]: MascotPick };
}

/** The transition, every tuning within its range and on its step, as the settings codec holds it. */
function readTransition(rig: Record<string, unknown>): MascotTransition {
  const transition = recordAt(rig, 'transition', 'rig.transition');
  if (!isMode(transition.mode)) throw refusal('rig.transition.mode');
  const held = parseMascotTransition(transition);
  for (const mode of ['jelly', 'dissolve'] as const) {
    const stored = recordAt(transition, mode, `rig.transition.${mode}`);
    for (const [key, value] of Object.entries(held[mode])) if (stored[key] !== value) throw refusal(`rig.transition.${mode}.${key}`);
  }
  return held;
}

/** Every table image is drawn from somewhere, so an import stores nothing the rig leaves unreferenced. */
function checkImagesUsed(count: number, base: number, layers: readonly MascotCardLayer[]): void {
  const used = new Set([base, ...layers.flatMap((layer) => layer.images)]);
  for (let index = 0; index < count; index++) if (!used.has(index)) throw refusal(`images.${index}`);
}

/** Reads a card's metadata. Throws, naming the problem, on anything but a whole card of this version. */
export function parseMascotCardData(raw: unknown): MascotCardData {
  if (!isRecord(raw) || raw.formamorphKind !== MASCOT_CARD_KIND) throw new Error(NOT_A_MASCOT_CARD);
  if (raw.version !== MASCOT_CARD_VERSION) throw new Error(`This mascot card is version ${String(raw.version)}. This build reads version ${MASCOT_CARD_VERSION}.`);
  if (typeof raw.appVersion !== 'string') throw refusal('appVersion');
  if (raw.name !== undefined && typeof raw.name !== 'string') throw refusal('name');
  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name.trim() : undefined;
  const images = readImages(listAt(raw, 'images', 'images'));
  const rig = recordAt(raw, 'rig', 'rig');
  const base = readIndex(rig.base, images.length, 'rig.base');
  const layers = readLayers(listAt(rig, 'layers', 'rig.layers'), images.length);
  checkImagesUsed(images.length, base, layers);
  const mask = readMask(rig.mask);
  const picks = readPicks(rig);
  if (typeof rig.voice !== 'string') throw refusal('rig.voice');
  return {
    formamorphKind: MASCOT_CARD_KIND,
    version: MASCOT_CARD_VERSION,
    appVersion: raw.appVersion,
    ...(name !== undefined && { name }),
    images,
    rig: { base, layers, mask, picks, voice: rig.voice, transition: readTransition(rig) },
  };
}
