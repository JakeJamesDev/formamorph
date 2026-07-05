import type { Entity } from '@/types';
import { APP_VERSION, WORLD_FILE_KIND, SAVE_FILE_KIND } from './version';
import { DICTIONARY_FILE_KIND } from './dictionaryFile';
import type { Dictionary } from '@/types';
import { embedEntityCard, readEntityCard } from './entityCard';
import { readTavernCard } from './tavernCard';
import { IMAGE_CAPS, bytesToDataUrl, dataUrlMime, measureDataUrl, optimizeImageDataUrl } from './imageOptim';

/** Discriminator identifying a standalone character card (vs. a world, save, or dictionary file). */
export const ENTITY_FILE_KIND = 'entity' as const;

/** The text payload embedded in a character-card image. The portrait is the image itself, so `image` is omitted. */
export interface EntityCardData {
  formamorphKind: typeof ENTITY_FILE_KIND;
  version: string;
  name: string;
  type?: string;
  playerDescription?: string;
  aiDescription?: string;
  aiSummary?: string;
  imageTags?: string;
}

/** The card's text fields, stamped with the current app version. `image`/`model`/`sound` are intentionally dropped. */
export function buildEntityCardData(entity: Entity): EntityCardData {
  return {
    formamorphKind: ENTITY_FILE_KIND,
    version: APP_VERSION,
    name: entity.name,
    ...(entity.type ? { type: entity.type } : {}),
    ...(entity.playerDescription ? { playerDescription: entity.playerDescription } : {}),
    ...(entity.aiDescription ? { aiDescription: entity.aiDescription } : {}),
    ...(entity.aiSummary ? { aiSummary: entity.aiSummary } : {}),
    ...(entity.imageTags ? { imageTags: entity.imageTags } : {}),
  };
}

/**
 * Parse an embedded card payload into a NEW entity (fresh id, so importing the same card twice never collides).
 * `image` is left undefined here — the importer fills it from the card's own pixels. Rejects world/save/dictionary
 * payloads with a targeted message.
 */
export function parseEntityCardData(raw: unknown): Entity {
  if (!raw || typeof raw !== 'object') throw new Error('Not a valid character card.');
  const obj = raw as Record<string, unknown>;
  const kind = obj.formamorphKind;
  if (kind === WORLD_FILE_KIND) throw new Error("That's a world file — import it from the Worlds tab.");
  if (kind === SAVE_FILE_KIND) throw new Error("That's a save file, not a character.");
  if (kind === DICTIONARY_FILE_KIND) throw new Error("That's a dictionary, not a character.");
  if (kind !== ENTITY_FILE_KIND) throw new Error('This file is not a character card.');
  return {
    id: crypto.randomUUID(),
    name: typeof obj.name === 'string' && obj.name ? obj.name : 'Imported Character',
    ...(typeof obj.type === 'string' && obj.type ? { type: obj.type } : {}),
    ...(typeof obj.playerDescription === 'string' && obj.playerDescription ? { playerDescription: obj.playerDescription } : {}),
    ...(typeof obj.aiDescription === 'string' && obj.aiDescription ? { aiDescription: obj.aiDescription } : {}),
    ...(typeof obj.aiSummary === 'string' && obj.aiSummary ? { aiSummary: obj.aiSummary } : {}),
    ...(typeof obj.imageTags === 'string' && obj.imageTags ? { imageTags: obj.imageTags } : {}),
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
export async function exportEntityCard(entity: Entity): Promise<Blob> {
  let imageUrl = entity.image || (await placeholderPortrait(entity.name || 'Character'));
  if (dataUrlMime(imageUrl) !== 'image/webp') imageUrl = await optimizeImageDataUrl(imageUrl, IMAGE_CAPS.entity);
  if (dataUrlMime(imageUrl) !== 'image/webp') throw new Error('Could not encode the portrait as WebP.');
  const { w, h } = await measureDataUrl(imageUrl);
  const bytes = new Uint8Array(await (await fetch(imageUrl)).arrayBuffer());
  const card = embedEntityCard(bytes, JSON.stringify(buildEntityCardData(entity)), { w, h });
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
  entity.image = bytesToDataUrl(bytes, 'image/webp');
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
    entity.image = bytesToDataUrl(bytes, 'image/webp');
    return { entity, book: null };
  }

  const tavern = readTavernCard(bytes);
  if (tavern) {
    // The PNG's pixels are the portrait; re-encode to WebP to match how entity images are stored.
    tavern.entity.image = await optimizeImageDataUrl(bytesToDataUrl(bytes, 'image/png'), IMAGE_CAPS.entity);
    return tavern;
  }

  throw new Error("This image isn't a Formamorph character card or a SillyTavern character.");
}
