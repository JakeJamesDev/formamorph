// Import SillyTavern's persona backup: the JSON its Persona Management panel downloads. It holds three keys,
// `personas` (avatar filename → name), `persona_descriptions` (avatar filename → description data), and
// `default_persona`. It holds no images, so the player picks the avatar files beside it.
import { randomUUID } from '@/lib/uuid';
import type { Entity } from '@/types';
import { renderUserMacro } from './userMacro';
import { CHAR_MACRO_RE } from './tavernCard';
import { IMAGE_CAPS, bytesToDataUrl, optimizeImageDataUrl } from './imageOptim';

/** One converted persona and the avatar file that matched its key, if any. */
export interface StPersona {
  key: string;
  entity: Entity;
  image?: string;
}

export interface StPersonaSkip {
  key: string;
  reason: string;
}

export interface StPersonaBackup {
  personas: StPersona[];
  /** The entity id of ST's default persona. */
  defaultId?: string;
  skipped: StPersonaSkip[];
  /** Picked image filenames that matched no persona. */
  unusedImages: string[];
}

const NOT_A_BACKUP = "This file isn't a SillyTavern persona backup.";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Convert the backup's text into marked library entities with fresh ids. An image matches a persona when its
 * filename equals the persona's key. Throws on a malformed file, so a bad pick imports nothing.
 */
export function convertStPersonaBackup(text: string, imageNames: string[]): StPersonaBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }
  if (!isRecord(raw) || !isRecord(raw.personas) || !isRecord(raw.persona_descriptions)) {
    throw new Error(NOT_A_BACKUP);
  }
  const descriptions = raw.persona_descriptions;
  const images = new Set(imageNames);
  const personas: StPersona[] = [];
  const skipped: StPersonaSkip[] = [];

  for (const [key, value] of Object.entries(raw.personas)) {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name) {
      skipped.push({ key, reason: 'no name' });
      continue;
    }
    const data = descriptions[key];
    const description = isRecord(data) && typeof data.description === 'string' ? data.description.trim() : '';
    const aiDescription = renderUserMacro(description.replace(CHAR_MACRO_RE, 'the other character'), { name });
    personas.push({
      key,
      entity: { id: randomUUID(), name, ...(aiDescription ? { aiDescription } : {}), persona: true },
      ...(images.has(key) ? { image: key } : {}),
    });
  }
  for (const key of Object.keys(descriptions)) {
    if (!(key in raw.personas)) skipped.push({ key, reason: 'a description with no persona' });
  }
  if (!personas.length) throw new Error('This SillyTavern backup holds no personas.');

  const keys = new Set(personas.map((p) => p.key));
  const defaultId = personas.find((p) => p.key === raw.default_persona)?.entity.id;
  return {
    personas,
    ...(defaultId ? { defaultId } : {}),
    skipped,
    unusedImages: imageNames.filter((name) => !keys.has(name)),
  };
}

/**
 * The id to make the global default, or undefined to leave it. The imported default wins only when no default
 * is set; one that names no library persona counts as unset, as the preselect rules already treat it.
 */
export function importedDefaultPersona(
  current: string | undefined,
  libraryPersonaIds: ReadonlySet<string>,
  importedId: string | undefined,
): string | undefined {
  if (!importedId) return undefined;
  return current && libraryPersonaIds.has(current) ? undefined : importedId;
}

/** One line per persona the player may need to fix by hand. `failed` names personas that could not be stored. */
export function stPersonaReport(backup: StPersonaBackup, failed: ReadonlySet<string> = new Set()): string[] {
  return [
    ...backup.personas.flatMap(({ key, entity, image }) => {
      if (failed.has(entity.id)) return [`${entity.name}: not saved`];
      return image ? [] : [`${entity.name}: no image named ${key}`];
    }),
    ...backup.skipped.map(({ key, reason }) => `${key}: skipped, ${reason}`),
    ...backup.unusedImages.map((name) => `${name}: matches no persona`),
  ];
}

const EXTENSION_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
};

/** Read the backup file and its picked avatars. Each matched avatar becomes that entity's portrait. */
export async function readStPersonaFiles(backup: File, images: File[]): Promise<StPersonaBackup> {
  const result = convertStPersonaBackup(await backup.text(), images.map((file) => file.name));
  const byName = new Map(images.map((file) => [file.name, file]));
  for (const persona of result.personas) {
    const file = persona.image ? byName.get(persona.image) : undefined;
    if (!file) continue;
    const mime = file.type || EXTENSION_MIME[file.name.split('.').pop()?.toLowerCase() ?? ''] || 'image/png';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      persona.entity.images = [await optimizeImageDataUrl(bytesToDataUrl(bytes, mime), IMAGE_CAPS.entity)];
    } catch (err) {
      // An unreadable avatar leaves that persona imageless, and the report lists it.
      console.error('Error reading persona image:', file.name, err);
      delete persona.image;
    }
  }
  return result;
}

/** True for a JSON pick, which the Entities import reads as a persona backup. */
export function isJsonFile(file: File): boolean {
  return file.type === 'application/json' || /\.json$/i.test(file.name);
}
