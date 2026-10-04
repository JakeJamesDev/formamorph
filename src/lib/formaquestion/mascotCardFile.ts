/**
 * The Mascot card as a file. Export draws the Initial look into a WebP and embeds the card data in its
 * metadata, as the entity card does. Import reads the data back, stores every image, and only then gives the
 * rig, so a failure leaves the store as it was.
 */
import { embedEntityCard, readEntityCard } from '@/lib/entityCard';
import { bytesToDataUrl, dataUrlMime, dataUrlToBuffer } from '@/lib/imageBytes';
import { APP_VERSION } from '@/lib/version';
import { composeMascot, type MascotImageRef, type MascotRig } from './mascot';
import { mascotAssetUrl } from './mascotAssets';
import {
  NOT_A_MASCOT_CARD, buildMascotCardData, isMascotCardImage, mascotRigFromCard, parseMascotCardData, type MascotCardData,
} from './mascotCard';
import { addMascotImage, deleteMascotImage, getMascotImage } from './mascotImageStore';
import { mascotImageRefs } from './mascotRigEdits';

export const MASCOT_CARD_FILE_NAME = 'mascot.webp';

/** An encoded WebP and its pixel size. */
export interface RenderedCardImage {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export interface MascotCardExportDeps {
  /** The images drawn bottom first, each stretched to the first one's size, as a WebP. */
  readonly render: (layers: readonly Blob[]) => Promise<RenderedCardImage>;
  readonly appVersion: string;
}

/** The store calls an import makes. */
export interface MascotCardStore {
  readonly add: (blob: Blob) => Promise<string>;
  readonly remove: (id: string) => Promise<void>;
}

const MISSING_IMAGE = "One of your mascot images is missing. Replace it, then export again.";
const UNREADABLE_IMAGE = "One of your mascot images isn't an image file. Replace it, then export again.";

const refKey = (ref: MascotImageRef): string => (ref.kind === 'bundled' ? `bundled:${ref.name}` : `stored:${ref.id}`);

async function readRigImage(ref: MascotImageRef): Promise<Blob> {
  if (ref.kind === 'stored') {
    const blob = await getMascotImage(ref.id);
    if (!blob) throw new Error(MISSING_IMAGE);
    return blob;
  }
  const response = await fetch(mascotAssetUrl(ref.name));
  if (!response.ok) throw new Error(MISSING_IMAGE);
  return response.blob();
}

function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(UNREADABLE_IMAGE));
    image.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

/** Draws the layers on a canvas at the first one's natural size and encodes it as a WebP. */
export async function renderMascotLayers(layers: readonly Blob[]): Promise<RenderedCardImage> {
  const images = await Promise.all(layers.map(decodeImage));
  const width = images[0]?.naturalWidth ?? 0;
  const height = images[0]?.naturalHeight ?? 0;
  if (width === 0 || height === 0) throw new Error(UNREADABLE_IMAGE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not draw the mascot card.');
  for (const image of images) context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp'));
  // A browser without a WebP encoder falls back to PNG, which has no slot for the card data.
  if (!blob || blob.type !== 'image/webp') throw new Error('Could not encode the mascot card as WebP.');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

const DEFAULT_EXPORT: MascotCardExportDeps = { render: renderMascotLayers, appVersion: APP_VERSION };

/** The card of the mascot `name`: a WebP of its Initial look carrying its name and the whole rig, every image in full. */
export async function exportMascotCard(name: string, rig: MascotRig, overrides: Partial<MascotCardExportDeps> = {}): Promise<Blob> {
  const deps = { ...DEFAULT_EXPORT, ...overrides };
  const distinct = [...new Map(mascotImageRefs(rig).map((ref) => [refKey(ref), ref])).values()];
  const blobs = new Map(await Promise.all(distinct.map(async (ref) => [refKey(ref), await readRigImage(ref)] as const)));
  const data = new Map(await Promise.all([...blobs].map(async ([key, blob]) => [key, bytesToDataUrl(new Uint8Array(await blob.arrayBuffer()), blob.type)] as const)));
  if (![...data.values()].every(isMascotCardImage)) throw new Error(UNREADABLE_IMAGE);
  const card = buildMascotCardData(name, rig, (ref) => data.get(refKey(ref))!, deps.appVersion);
  const look = await deps.render(composeMascot(rig, 'initial', null).map((ref) => blobs.get(refKey(ref))!));
  return new Blob([embedEntityCard(look.bytes, JSON.stringify(card), { w: look.width, h: look.height })], { type: 'image/webp' });
}

/** The card data a file carries. Throws, naming the problem, on any file that is not a whole card. */
export async function readMascotCard(file: Blob): Promise<MascotCardData> {
  const json = readEntityCard(new Uint8Array(await file.arrayBuffer()));
  if (json === null) throw new Error(NOT_A_MASCOT_CARD);
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('This mascot card is corrupted.');
  }
  return parseMascotCardData(raw);
}

const dataUrlBlob = async (data: string): Promise<Blob> => new Blob([await dataUrlToBuffer(data)], { type: dataUrlMime(data) });

const DEFAULT_STORE: MascotCardStore = { add: addMascotImage, remove: deleteMascotImage };

/** Stores each of the card's images and gives the rig that names them. A failed store removes what this call added, then throws. */
export async function storeMascotCard(card: MascotCardData, store: MascotCardStore = DEFAULT_STORE): Promise<MascotRig> {
  const ids: string[] = [];
  try {
    for (const data of card.images) ids.push(await store.add(await dataUrlBlob(data)));
  } catch (cause: unknown) {
    await Promise.allSettled(ids.map((id) => store.remove(id)));
    throw cause;
  }
  return mascotRigFromCard(card, ids);
}
