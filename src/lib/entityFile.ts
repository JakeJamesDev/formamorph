import { randomUUID } from "@/lib/uuid";
import type { Entity, Placeholder } from '@/types';
import { APP_VERSION, WORLD_FILE_KIND, SAVE_FILE_KIND, migrateCarriedPlaceholders } from './version';
import { DICTIONARY_FILE_KIND } from './dictionaryFile';
import { describePlaceholders } from './placeholders';
import { carriedPlaceholders, sharedPlaceholdersUsed } from './placeholderHomes';
import { portablePlaceholders } from './placeholderGroups';
import type { Dictionary } from '@/types';
import { embedEntityCard, readEntityCard } from './entityCard';
import { readTavernCard } from './tavernCard';
import { IMAGE_CAPS, bytesToDataUrl, dataUrlMime, measureDataUrl, optimizeImageDataUrl, optimizeToWebpDataUrl } from './imageOptim';
import { entityImages, primaryImage } from './entityImages';
import { fetchAsDataUrl, isRemoteImage } from './imageSource';

/** Discriminator identifying a standalone character card (vs. a world, save, or dictionary file). */
export const ENTITY_FILE_KIND = 'entity' as const;

/** The text payload embedded in a character-card image. The portrait is the image itself, so `image` is omitted. */
export interface EntityCardData {
  formamorphKind: typeof ENTITY_FILE_KIND;
  version: string;
  name: string;
  aliases?: string[];
  type?: string;
  playerDescription?: string;
  aiDescription?: string;
  aiSummary?: string;
  /** Listing tags. Distinct from `imageTags`, which is the booru string for the image generator. */
  tags?: string[];
  imageTags?: string;
  /** Gallery slots past the first, as data-URLs. The primary is the card's own pixels, so only these need
   *  carrying in the text — which is also why a multi-picture card is a much bigger file. */
  extraImages?: string[];
  /** The entity's own placeholders, as they are (see lib/placeholders). A card with no
   *  `sharedPlaceholders` carries everything its chips use here, and reads it all as owned. */
  placeholders?: Placeholder[];
  /** The shared placeholders the entity's chips and its own reach, so they resolve after import. */
  sharedPlaceholders?: Placeholder[];
}

/** The card's text fields, stamped with the current app version. `model`/`sound` are intentionally dropped;
 *  of the gallery only the slots past the primary are carried, the primary being the card's own pixels.
 *  `available` is the placeholder pool to resolve the entity's used chips from — the world's combined list
 *  for a world entity, or the entity's own carried pool for a library one. */
export function buildEntityCardData(entity: Entity, available: Placeholder[] = carriedPlaceholders(entity)): EntityCardData {
  // Folders are the world's: a def leaves its folder reference behind.
  const owned = portablePlaceholders(entity.placeholders ?? []);
  const shared = portablePlaceholders(sharedPlaceholdersUsed(
    [entity.name, ...(entity.aliases ?? []), entity.playerDescription, entity.aiDescription, entity.aiSummary, entity.imageTags]
      .filter((t): t is string => !!t),
    owned,
    available,
  ));
  const extras = entityImages(entity).slice(1);
  return {
    formamorphKind: ENTITY_FILE_KIND,
    version: APP_VERSION,
    name: entity.name,
    ...(entity.aliases?.length ? { aliases: entity.aliases } : {}),
    ...(entity.type ? { type: entity.type } : {}),
    ...(entity.playerDescription ? { playerDescription: entity.playerDescription } : {}),
    ...(entity.aiDescription ? { aiDescription: entity.aiDescription } : {}),
    ...(entity.aiSummary ? { aiSummary: entity.aiSummary } : {}),
    ...(entity.tags?.length ? { tags: entity.tags } : {}),
    ...(entity.imageTags ? { imageTags: entity.imageTags } : {}),
    ...(extras.length ? { extraImages: extras } : {}),
    ...(owned.length ? { placeholders: owned } : {}),
    ...(shared.length ? { sharedPlaceholders: shared } : {}),
  };
}

/**
 * Parse an embedded card payload into a NEW entity (fresh id, so importing the same card twice never collides).
 * The gallery comes back holding only the carried extras — the importer unshifts the card's own pixels onto the
 * front as the primary. Rejects world/save/dictionary payloads with a targeted message.
 */
export function parseEntityCardData(raw: unknown): Entity {
  if (!raw || typeof raw !== 'object') throw new Error('Not a valid character card.');
  const obj = raw as Record<string, unknown>;
  const kind = obj.formamorphKind;
  if (kind === WORLD_FILE_KIND) throw new Error("That's a world file — import it from the Worlds tab.");
  if (kind === SAVE_FILE_KIND) throw new Error("That's a save file, not a character.");
  if (kind === DICTIONARY_FILE_KIND) throw new Error("That's a dictionary, not a character.");
  if (kind !== ENTITY_FILE_KIND) throw new Error('This file is not a character card.');
  const aliases = Array.isArray(obj.aliases)
    ? (obj.aliases as unknown[]).filter((a): a is string => typeof a === 'string' && !!a.trim())
    : [];
  const tags = Array.isArray(obj.tags)
    ? (obj.tags as unknown[]).filter((t): t is string => typeof t === 'string' && !!t.trim())
    : [];
  const extras = Array.isArray(obj.extraImages)
    ? (obj.extraImages as unknown[]).filter((u): u is string => typeof u === 'string' && !!u)
    : [];
  return {
    id: randomUUID(),
    name: typeof obj.name === 'string' && obj.name ? obj.name : 'Imported Character',
    ...(aliases.length ? { aliases } : {}),
    ...(typeof obj.type === 'string' && obj.type ? { type: obj.type } : {}),
    ...(typeof obj.playerDescription === 'string' && obj.playerDescription ? { playerDescription: obj.playerDescription } : {}),
    ...(typeof obj.aiDescription === 'string' && obj.aiDescription ? { aiDescription: obj.aiDescription } : {}),
    ...(typeof obj.aiSummary === 'string' && obj.aiSummary ? { aiSummary: obj.aiSummary } : {}),
    ...(tags.length ? { tags } : {}),
    ...(typeof obj.imageTags === 'string' && obj.imageTags ? { imageTags: obj.imageTags } : {}),
    ...(extras.length ? { images: extras } : {}),
    // Carried placeholders ride along: the owned ones stay the entity's when it is added to a world, the shared
    // ones merge into the world's list (see `adoptEntityPlaceholders`).
    ...(Array.isArray(obj.placeholders) ? { placeholders: migrateCarriedPlaceholders(obj.placeholders) } : {}),
    ...(Array.isArray(obj.sharedPlaceholders) ? { sharedPlaceholders: migrateCarriedPlaceholders(obj.sharedPlaceholders) } : {}),
  };
}

/** A simple deterministic initials-on-color portrait, used when an entity has no image so a card can still be made. */
async function placeholderPortrait(name: string): Promise<string> {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable for the placeholder portrait.');
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  ctx.fillStyle = `hsl(${hash % 360}, 45%, 35%)`;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold ${Math.round(size * 0.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  ctx.fillText(initials, size / 2, size / 2);
  const url = canvas.toDataURL('image/webp', 0.82);
  return url.startsWith('data:image/webp') ? url : optimizeImageDataUrl(url, IMAGE_CAPS.entity);
}

/**
 * Encode an entity as a shareable WebP character card: its portrait carrying the text fields in a metadata chunk.
 * Entities without a portrait get a generated placeholder so export always yields a valid image.
 */
export async function exportEntityCard(entity: Entity, available?: Placeholder[]): Promise<Blob> {
  // The generated portrait draws initials from the name, so a chip left raw is baked into the shipped image.
  let imageUrl = primaryImage(entity)
    || (await placeholderPortrait(describePlaceholders(entity.name, available ?? carriedPlaceholders(entity)) || 'Character'));
  // A card is its pixels, so a linked portrait has to be downloaded here. Deliberately not falling back to
  // the generated placeholder: shipping a card with the wrong face is worse than a failure the author can act on.
  if (isRemoteImage(imageUrl)) imageUrl = await fetchAsDataUrl(imageUrl, IMAGE_CAPS.entity);
  // Force WebP even if it comes out larger than the source: the card embeds its metadata in a WebP chunk, so
  // a PNG/JPEG portrait (which the size-optimizing path would keep for an already-small image) is unusable.
  if (dataUrlMime(imageUrl) !== 'image/webp') imageUrl = await optimizeToWebpDataUrl(imageUrl, IMAGE_CAPS.entity);
  if (dataUrlMime(imageUrl) !== 'image/webp') throw new Error('Could not encode the portrait as WebP.');
  const { w, h } = await measureDataUrl(imageUrl);
  const bytes = new Uint8Array(await (await fetch(imageUrl)).arrayBuffer());
  const card = embedEntityCard(bytes, JSON.stringify(buildEntityCardData(entity, available)), { w, h });
  return new Blob([card], { type: 'image/webp' });
}

/** Read a character-card image file back into an entity, using the card's own pixels as its portrait. */
export async function importEntityCard(file: File): Promise<Entity> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const json = readEntityCard(bytes);
  if (!json) throw new Error("This image isn't a Formamorph character card.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('This character card is corrupted.');
  }
  const entity = parseEntityCardData(raw);
  entity.images = [bytesToDataUrl(bytes, 'image/webp'), ...(entity.images ?? [])];
  return entity;
}

/**
 * Import a character image file into an entity plus an optional lorebook. Handles both our own WebP cards
 * (no lorebook) and SillyTavern character PNGs (`character_book` → a dictionary the caller can offer to save).
 * In both cases the file's own pixels become the entity's portrait.
 */
export async function importCharacterFile(file: File): Promise<{ entity: Entity; book: Dictionary | null }> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  const cardJson = readEntityCard(bytes);
  if (cardJson) {
    let raw: unknown;
    try {
      raw = JSON.parse(cardJson);
    } catch {
      throw new Error('This character card is corrupted.');
    }
    const entity = parseEntityCardData(raw);
    entity.images = [bytesToDataUrl(bytes, 'image/webp'), ...(entity.images ?? [])];
    return { entity, book: null };
  }

  const tavern = readTavernCard(bytes);
  if (tavern) {
    // The PNG's pixels are the portrait; re-encode to WebP to match how entity images are stored.
    tavern.entity.images = [await optimizeImageDataUrl(bytesToDataUrl(bytes, 'image/png'), IMAGE_CAPS.entity)];
    return tavern;
  }

  throw new Error("This image isn't a Formamorph character card or a SillyTavern character.");
}
