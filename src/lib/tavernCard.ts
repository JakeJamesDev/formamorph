// SillyTavern JSON/PNG cards; the Character Card V3 spec is credited in THIRD-PARTY-NOTICES.md.

import { randomUUID } from "@/lib/uuid";
import type { Entity, Dictionary, Opening, LibraryDetails } from '@/types';
import { readPngTextChunks } from './sdMetadata';
import { convertLorebook } from './lorebookImport';
import { canonicalUserMacro } from './userMacro';

/** The subset of card fields we read. V2/V3 nest these under `data`; V1 is flat. */
interface TavernData {
  name?: unknown;
  description?: unknown;
  personality?: unknown;
  scenario?: unknown;
  first_mes?: unknown;
  alternate_greetings?: unknown;
  character_book?: unknown;
  creator?: unknown;
  tags?: unknown;
  avatar?: unknown;
}

export interface TavernImport {
  entity: Entity;
  book: Dictionary | null;
  libraryDetails: LibraryDetails;
}

/** Decode a base64 string as UTF-8 (the card JSON is UTF-8, so `atob` alone would mangle non-ASCII). */
function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/** Every spelling of the SillyTavern char macro. */
export const CHAR_MACRO_RE = /\{\{\s*char\s*\}\}/gi;

/** `{{char}}` → the character's name, `{{user}}` → the Player Name chip; other macros are left untouched. */
function substituteMacros(text: string, name: string): string {
  return canonicalUserMacro(text.replace(CHAR_MACRO_RE, name));
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

/** Build an entity from card fields: name, description + personality + scenario folded into `aiDescription`,
 *  and the greetings as openings. */
function cardToEntity(data: TavernData): Entity {
  const name = str(data.name) || 'Imported Character';
  const parts: string[] = [];
  if (str(data.description)) parts.push(str(data.description));
  if (str(data.personality)) parts.push(`Personality: ${str(data.personality)}`);
  if (str(data.scenario)) parts.push(`Scenario: ${str(data.scenario)}`);
  const aiDescription = substituteMacros(parts.join('\n\n'), name);
  const openings = cardOpenings(data, name);
  return { id: randomUUID(), name, ...(aiDescription ? { aiDescription } : {}), ...(openings.length ? { openings } : {}) };
}

/** The first message, then each alternate greeting, as Narration rows at the default weight. The user macro
 *  stays in the text for the draw to render. */
function cardOpenings(data: TavernData, name: string): Opening[] {
  const alternates: unknown[] = Array.isArray(data.alternate_greetings) ? data.alternate_greetings : [];
  return [data.first_mes, ...alternates]
    .map(str)
    .filter(Boolean)
    .map((text) => ({ id: randomUUID(), text: substituteMacros(text, name), kind: 'narration' }));
}

/**
 * Read a SillyTavern character PNG into an entity plus its embedded lorebook (if any). Returns null when the
 * bytes carry no recognizable card chunk. The caller sets the portrait from the PNG's own pixels.
 */
export function readTavernCard(bytes: Uint8Array): TavernImport | null {
  const data = readCardData(bytes);
  if (!data) return null;
  return convertCard(data);
}

function convertCard(data: TavernData): TavernImport {
  const entity = cardToEntity(data);
  const book = data.character_book ? convertLorebook({ character_book: data.character_book }, entity.name) : null;
  const author = str(data.creator);
  const tags = Array.isArray(data.tags) ? [...new Set(data.tags.map(str).filter(Boolean))] : [];
  return { entity, book, libraryDetails: { ...(author ? { author } : {}), tags } };
}

/** Read a standalone V1/V2/V3 card, keeping an HTTP(S) avatar as a linked portrait. */
export function readTavernJson(text: string): TavernImport | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if ('formamorphKind' in obj) return null;
  let data: TavernData;
  if ('spec' in obj) {
    if (obj.spec !== 'chara_card_v2' && obj.spec !== 'chara_card_v3') return null;
    if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) return null;
    data = obj.data as TavernData;
  } else {
    if (!['description', 'personality', 'scenario', 'first_mes', 'mes_example']
      .some((key) => typeof obj[key] === 'string')) return null;
    data = obj;
  }
  if (!str(data.name)) return null;
  const result = convertCard(data);
  const avatar = str(data.avatar);
  try {
    const url = new URL(avatar);
    if (url.protocol === 'https:' || url.protocol === 'http:') result.entity.images = [avatar];
  } catch { /* Missing or malformed avatar leaves the portrait empty. */ }
  return result;
}
