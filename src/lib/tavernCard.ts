// Import a SillyTavern / Character-Card character embedded in a PNG. Such cards store the card JSON base64'd
// in a PNG text chunk — `ccv3` (Character Card V3) preferred, else `chara` (V2/V1). We map only the fields a
// Formamorph world entity has a home for: name, and description + personality + scenario → `aiDescription`.
// The chat-runtime fields (first_mes, mes_example, greetings, system_prompt, …) have no narrative-entity
// equivalent and are dropped. An embedded `character_book` lorebook is offered separately to the dictionary
// library. See the MIT Character Card V3 spec (credited in THIRD-PARTY-NOTICES.md).

import type { Entity, Dictionary } from '@/types';
import { readPngTextChunks } from './sdMetadata';
import { convertLorebook } from './lorebookImport';

/** The subset of card fields we read. V2/V3 nest these under `data`; V1 is flat. */
interface TavernData {
  name?: unknown;
  description?: unknown;
  personality?: unknown;
  scenario?: unknown;
  character_book?: unknown;
}

/** Decode a base64 string as UTF-8 (the card JSON is UTF-8, so `atob` alone would mangle non-ASCII). */
function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** `{{char}}` → the character's name, `{{user}}` → "the player"; other macros are left untouched. */
function substituteMacros(text: string, name: string): string {
  return text
    .replace(/\{\{\s*char\s*\}\}/gi, name)
    .replace(/\{\{\s*user\s*\}\}/gi, 'the player');
}

/** The card's field object (unwrapping the V2/V3 `data` envelope), or null if the PNG carries no card. */
function readCardData(bytes: Uint8Array): TavernData | null {
  const chunks = readPngTextChunks(bytes);
  const raw = chunks.get('ccv3') ?? chunks.get('chara');
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Utf8(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const data = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : obj;
  return data as TavernData;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Build an entity from card fields: name, and description + personality + scenario folded into `aiDescription`. */
function cardToEntity(data: TavernData): Entity {
  const name = str(data.name) || 'Imported Character';
  const parts: string[] = [];
  if (str(data.description)) parts.push(str(data.description));
  if (str(data.personality)) parts.push(`Personality: ${str(data.personality)}`);
  if (str(data.scenario)) parts.push(`Scenario: ${str(data.scenario)}`);
  const aiDescription = substituteMacros(parts.join('\n\n'), name);
  return { id: crypto.randomUUID(), name, ...(aiDescription ? { aiDescription } : {}) };
}

/**
 * Read a SillyTavern character PNG into an entity plus its embedded lorebook (if any). Returns null when the
 * bytes carry no recognizable card chunk. The caller sets `entity.image` from the PNG's own pixels.
 */
export function readTavernCard(bytes: Uint8Array): { entity: Entity; book: Dictionary | null } | null {
  const data = readCardData(bytes);
  if (!data) return null;
  const entity = cardToEntity(data);
  const book = data.character_book ? convertLorebook({ character_book: data.character_book }, entity.name) : null;
  return { entity, book };
}
