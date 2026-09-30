import { randomUUID } from "@/lib/uuid";
import type {
  BlueprintOverride, Entity, Opening, Placeholder, PlaceholderPin, LibraryDetails, RequirementBearer, StatChange, Trait, TraitGroup,
  TraitLink, TraitLinkOverrides, TraitRequirement, TraitStatToggle,
} from '@/types';
import { readLibraryDetails } from './contentAuthor';
import { remintOpenings } from './openings';
import { APP_VERSION, WORLD_FILE_KIND, SAVE_FILE_KIND, migrateCarriedPlaceholders } from './version';
import { DICTIONARY_FILE_KIND } from './dictionaryFile';
import type { WorldAssociation } from './compatibleWorlds';
import { readComponentFileLinks, type ComponentFileLinks, type ComponentFileSource } from './componentFileLinks';
import { chipTexts } from './linkedContent';
import { carriedPlaceholders, sharedPlaceholdersUsed } from './placeholderHomes';
import { portablePlaceholders } from './placeholderGroups';
import type { Dictionary } from '@/types';
import { embedEntityCard, readEntityCard } from './entityCard';
import { readTavernCard, readTavernJson } from './tavernCard';
import { IMAGE_CAPS, bytesToDataUrl, dataUrlMime, measureDataUrl, optimizeImageDataUrl, optimizeToWebpDataUrl } from './imageOptim';
import { entityImages, primaryImage } from './entityImages';
import { fetchAsDataUrl, isRemoteImage } from './imageSource';
import { morphCardImage } from './morphArtCanvas';
import { portableOwnedTraits, type TraitWorld } from './portableTraits';
import { carriedBlueprints } from './blueprintTravel';

/** Discriminator identifying a standalone character card (vs. a world, save, or dictionary file). */
export const ENTITY_FILE_KIND = 'entity' as const;

/** The text payload embedded in a character-card image. The portrait is the image itself, so `image` is omitted. */
export interface EntityCardData {
  formamorphKind: typeof ENTITY_FILE_KIND;
  version: string;
  name: string;
  author?: string;
  aliases?: string[];
  pronouns?: string;
  /** The Persona mark. A shared persona arrives as a persona. */
  persona?: boolean;
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
  /** The blueprints the entity's copies read, so a receiving world can bind each copy (see lib/blueprintTravel). */
  blueprints?: Placeholder[];
  /** The entity's own openings and their weights (see lib/openings). Import mints fresh ids for both. */
  openings?: Opening[];
  openingWeights?: Record<string, number>;
  /** The entity's owned traits and groups (see lib/portableTraits). A requirement out of the entity also
   *  stores its target's name, so a receiving world can bind it. */
  traits?: Trait[];
  traitGroups?: TraitGroup[];
  /** The entity's links, each storing its original's name so a receiving world can bind it. */
  traitLinks?: TraitLink[];
  /** Where this character came from, so an importer can reconnect it (see lib/componentFileLinks). */
  source?: ComponentFileSource;
  /** The worlds this character is offered for, by listing id. Never the worlds themselves. */
  associations?: WorldAssociation[];
}

/** The card's text fields, stamped with the current app version. `model`/`sound` are intentionally dropped;
 *  of the gallery only the slots past the primary are carried, the primary being the card's own pixels.
 *  `available` is the placeholder pool to resolve the entity's used chips from — the world's combined list
 *  for a world entity, or the entity's own carried pool for a library one. `links` is what the card says
 *  about its source and the worlds it suits; a card written without it says nothing about either. `world` is
 *  the world a world entity's requirements point into, for their names. */
export function buildEntityCardData(
  entity: Entity,
  available: Placeholder[] = carriedPlaceholders(entity),
  links: ComponentFileLinks = {},
  libraryDetails?: LibraryDetails,
  world?: TraitWorld,
): EntityCardData {
  // Folders are the world's: a def leaves its folder reference behind.
  const owned = portablePlaceholders(entity.placeholders ?? []);
  const blueprints = portablePlaceholders(carriedBlueprints(entity, available));
  // The blueprints' values, and the copies' reworded ones, reach shared placeholders too.
  const reworded = owned.flatMap((p) => Object.values(p.valueOverrides ?? {}).flatMap((o) => (o.text ? [o.text.value] : [])));
  const shared = portablePlaceholders(sharedPlaceholdersUsed([...chipTexts(entity), ...reworded], [...owned, ...blueprints], available));
  const extras = entityImages(entity).slice(1);
  return {
    formamorphKind: ENTITY_FILE_KIND,
    version: APP_VERSION,
    name: entity.name,
    ...(libraryDetails?.author ? { author: libraryDetails.author } : {}),
    ...(entity.aliases?.length ? { aliases: entity.aliases } : {}),
    ...(entity.pronouns ? { pronouns: entity.pronouns } : {}),
    ...(entity.persona ? { persona: true } : {}),
    ...(entity.type ? { type: entity.type } : {}),
    ...(entity.playerDescription ? { playerDescription: entity.playerDescription } : {}),
    ...(entity.aiDescription ? { aiDescription: entity.aiDescription } : {}),
    ...(entity.aiSummary ? { aiSummary: entity.aiSummary } : {}),
    ...(entity.tags?.length ? { tags: entity.tags } : {}),
    ...(entity.imageTags ? { imageTags: entity.imageTags } : {}),
    ...(extras.length ? { extraImages: extras } : {}),
    ...(owned.length ? { placeholders: owned } : {}),
    ...(shared.length ? { sharedPlaceholders: shared } : {}),
    ...(blueprints.length ? { blueprints } : {}),
    ...(entity.openings?.length ? { openings: entity.openings } : {}),
    ...(entity.openings?.length && entity.openingWeights && Object.keys(entity.openingWeights).length
      ? { openingWeights: entity.openingWeights } : {}),
    ...portableOwnedTraits(entity, world),
    ...(links.source ? { source: links.source } : {}),
    ...(links.associations?.length ? { associations: links.associations } : {}),
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
  const openings = Array.isArray(obj.openings) ? (obj.openings as unknown[]).flatMap(cardOpening) : [];
  const weights = obj.openingWeights && typeof obj.openingWeights === 'object' && !Array.isArray(obj.openingWeights)
    ? Object.fromEntries(Object.entries(obj.openingWeights as Record<string, unknown>)
      .filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1])))
    : undefined;
  const carried = remintOpenings({ openings, openingWeights: weights });
  return {
    id: randomUUID(),
    name: typeof obj.name === 'string' && obj.name ? obj.name : 'Imported Character',
    ...(aliases.length ? { aliases } : {}),
    ...(typeof obj.pronouns === 'string' && obj.pronouns ? { pronouns: obj.pronouns } : {}),
    ...(obj.persona === true ? { persona: true } : {}),
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
    ...(Array.isArray(obj.blueprints) ? { blueprints: migrateCarriedPlaceholders(obj.blueprints) } : {}),
    ...(carried.openings ? { openings: carried.openings } : {}),
    ...(carried.openingWeights ? { openingWeights: carried.openingWeights } : {}),
    ...cardOwnedTraits(obj),
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hasIdAndName = (v: unknown): v is Record<string, unknown> & { id: string; name: string } =>
  isRecord(v) && typeof v.id === 'string' && !!v.id && typeof v.name === 'string';

const nameOf = (raw: Record<string, unknown>) => (typeof raw.name === 'string' && raw.name ? { name: raw.name } : {});

function cardBearer(raw: unknown): { bearer?: RequirementBearer } {
  if (!isRecord(raw)) return {};
  if (raw.kind === 'you') return { bearer: { kind: 'you' } };
  return raw.kind === 'entity' && typeof raw.id === 'string' ? { bearer: { kind: 'entity', id: raw.id, ...nameOf(raw) } } : {};
}

function cardRequirement(raw: unknown): TraitRequirement[] {
  if (!isRecord(raw) || typeof raw.id !== 'string') return [];
  if (raw.kind === 'playingAs') return [{ kind: raw.kind, id: raw.id, ...nameOf(raw) }];
  if (raw.kind !== 'trait' && raw.kind !== 'group') return [];
  return [{ kind: raw.kind, id: raw.id, ...nameOf(raw), ...cardBearer(raw.bearer) }];
}

/** The record's entries that `read` accepts; absent when none is left. */
function recordOf<V>(raw: unknown, read: (v: unknown) => V | undefined): Record<string, V> | undefined {
  if (!isRecord(raw)) return undefined;
  const out = Object.fromEntries(Object.entries(raw).flatMap(([k, v]) => {
    const value = read(v);
    return value === undefined ? [] : [[k, value] as const];
  }));
  return Object.keys(out).length ? out : undefined;
}

const cardPins = (raw: unknown): PlaceholderPin[] => (Array.isArray(raw) ? raw : []).flatMap((p): PlaceholderPin[] =>
  (isRecord(p) && typeof p.placeholderId === 'string' && typeof p.value === 'string'
    ? [{ placeholderId: p.placeholderId, value: p.value, ...(typeof p.valueId === 'string' ? { valueId: p.valueId } : {}) }]
    : []));

const cardStatChanges = (raw: unknown): StatChange[] => (Array.isArray(raw) ? raw : []).flatMap((c): StatChange[] =>
  (isRecord(c) && typeof c.statId === 'string' && typeof c.value === 'number'
    ? [{
      statId: c.statId, value: c.value,
      ...(c.type === 'min' || c.type === 'max' || c.type === 'starting' || c.type === 'regen' ? { type: c.type } : {}),
      ...(typeof c.interval === 'string' ? { interval: c.interval } : {}),
    }]
    : []));

const cardStatToggles = (raw: unknown): TraitStatToggle[] => (Array.isArray(raw) ? raw : []).flatMap((t): TraitStatToggle[] =>
  (isRecord(t) && typeof t.statId === 'string' && typeof t.enabled === 'boolean' ? [{ statId: t.statId, enabled: t.enabled }] : []));

/** One override as the card stores it, both sides read through `read`; undefined when either side is not one. */
function cardOverride<V>(raw: unknown, read: (v: unknown) => V | undefined): BlueprintOverride<V> | undefined {
  if (!isRecord(raw)) return undefined;
  const value = read(raw.value);
  const blueprint = read(raw.blueprint);
  return value !== undefined && blueprint !== undefined ? { value, blueprint } : undefined;
}

const cardBoolean = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
const cardMode = (v: unknown) => (v === 'optional' || v === 'alwaysOn' || v === 'hidden' ? v : undefined);
const cardList = <T>(read: (raw: unknown[]) => T[]) => (v: unknown) => (Array.isArray(v) ? read(v) : undefined);
const cardRequirements = cardList((v) => v.flatMap(cardRequirement));

/** A link's overrides on one trait, each field read in its own shape; undefined when none reads. */
function cardLinkOverrides(raw: unknown): TraitLinkOverrides | undefined {
  if (!isRecord(raw)) return undefined;
  const isDefault = cardOverride(raw.isDefault, cardBoolean);
  const playerToggle = cardOverride(raw.playerToggle, cardBoolean);
  const requires = cardOverride(raw.requires, cardRequirements);
  const placeholderPins = cardOverride(raw.placeholderPins, cardList(cardPins));
  const statChanges = cardOverride(raw.statChanges, cardList(cardStatChanges));
  const mode = cardOverride(raw.mode, cardMode);
  const out: TraitLinkOverrides = {
    ...(isDefault ? { isDefault } : {}),
    ...(mode ? { mode } : {}),
    ...(requires ? { requires } : {}),
    ...(placeholderPins ? { placeholderPins } : {}),
    ...(playerToggle ? { playerToggle } : {}),
    ...(statChanges ? { statChanges } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

function cardLink(raw: unknown): TraitLink[] {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.originalId !== 'string') return [];
  if (raw.kind !== 'trait' && raw.kind !== 'group') return [];
  const overrides = recordOf(raw.overrides, cardLinkOverrides);
  const keyNames = recordOf(raw.keyNames, (v) => (typeof v === 'string' && v ? v : undefined));
  return [{
    id: raw.id, originalId: raw.originalId, kind: raw.kind,
    originalName: typeof raw.originalName === 'string' ? raw.originalName : '',
    groupId: typeof raw.groupId === 'string' ? raw.groupId : null,
    ...(typeof raw.order === 'number' ? { order: raw.order } : {}),
    ...(overrides ? { overrides } : {}),
    ...(keyNames ? { keyNames } : {}),
  }];
}

/** The card's owned traits, groups and links. Stat effects are read as stored; a stat id the world lacks does nothing. */
function cardOwnedTraits(obj: Record<string, unknown>): Pick<Entity, 'traits' | 'traitGroups' | 'traitLinks'> {
  const traits: Trait[] = (Array.isArray(obj.traits) ? obj.traits : []).filter(hasIdAndName).map((t) => {
    const requires = Array.isArray(t.requires) ? t.requires.flatMap(cardRequirement) : [];
    const pins = cardPins(t.placeholderPins);
    const statToggles = cardStatToggles(t.statToggles);
    return {
      id: t.id,
      name: t.name,
      statChanges: cardStatChanges(t.statChanges),
      ...(statToggles.length ? { statToggles } : {}),
      ...(typeof t.playerDescription === 'string' ? { playerDescription: t.playerDescription } : {}),
      ...(typeof t.aiDescription === 'string' ? { aiDescription: t.aiDescription } : {}),
      ...(typeof t.groupId === 'string' ? { groupId: t.groupId } : {}),
      ...(typeof t.order === 'number' ? { order: t.order } : {}),
      ...(t.isDefault === true ? { isDefault: true } : {}),
      ...(t.playerToggle === true ? { playerToggle: true } : {}),
      ...(pins.length ? { placeholderPins: pins } : {}),
      ...(requires.length ? { requires } : {}),
    };
  });
  const traitGroups: TraitGroup[] = (Array.isArray(obj.traitGroups) ? obj.traitGroups : []).filter(hasIdAndName).map((g) => ({
    id: g.id,
    name: g.name,
    parentId: typeof g.parentId === 'string' ? g.parentId : null,
    ...(typeof g.playerDescription === 'string' ? { playerDescription: g.playerDescription } : {}),
    ...(typeof g.aiDescription === 'string' ? { aiDescription: g.aiDescription } : {}),
    ...(typeof g.order === 'number' ? { order: g.order } : {}),
    ...(typeof g.minPicks === 'number' ? { minPicks: g.minPicks } : {}),
    ...(typeof g.maxPicks === 'number' ? { maxPicks: g.maxPicks } : {}),
  }));
  const traitLinks = (Array.isArray(obj.traitLinks) ? obj.traitLinks : []).flatMap(cardLink);
  return {
    ...(traits.length ? { traits } : {}),
    ...(traitGroups.length ? { traitGroups } : {}),
    ...(traitLinks.length ? { traitLinks } : {}),
  };
}

/** One card row as an opening, or nothing when it is not one. An unknown kind reads as a Player Action. The
 *  id is kept only so the weights can follow it through the re-mint. */
function cardOpening(raw: unknown): Opening[] {
  if (!raw || typeof raw !== 'object') return [];
  const row = raw as Record<string, unknown>;
  if (typeof row.text !== 'string') return [];
  return [{
    id: typeof row.id === 'string' && row.id ? row.id : randomUUID(),
    text: row.text,
    kind: row.kind === 'narration' ? 'narration' : 'action',
  }];
}

/**
 * Encode an entity as a shareable WebP character card: its portrait carrying the text fields in a metadata chunk.
 * Entities without a portrait get Morph art so export always yields a valid image.
 */
export async function exportEntityCard(
  entity: Entity, available?: Placeholder[], links: ComponentFileLinks = {}, libraryDetails?: LibraryDetails, world?: TraitWorld,
): Promise<Blob> {
  // The art follows the listing, else the library item, so a card matches the tile it came from.
  let imageUrl = primaryImage(entity) || await morphCardImage(
    links.source?.sourceId || links.source?.libraryId || entity.id,
    entity.name,
    available ?? carriedPlaceholders(entity),
  );
  // A card is its pixels, so a linked portrait has to be downloaded here. Deliberately not falling back to
  // the generated placeholder: shipping a card with the wrong face is worse than a failure the author can act on.
  if (isRemoteImage(imageUrl)) imageUrl = await fetchAsDataUrl(imageUrl, IMAGE_CAPS.entity);
  // Force WebP even if it comes out larger than the source: the card embeds its metadata in a WebP chunk, so
  // a PNG/JPEG portrait (which the size-optimizing path would keep for an already-small image) is unusable.
  if (dataUrlMime(imageUrl) !== 'image/webp') imageUrl = await optimizeToWebpDataUrl(imageUrl, IMAGE_CAPS.entity);
  if (dataUrlMime(imageUrl) !== 'image/webp') throw new Error('Could not encode the portrait as WebP.');
  const { w, h } = await measureDataUrl(imageUrl);
  const bytes = new Uint8Array(await (await fetch(imageUrl)).arrayBuffer());
  const card = embedEntityCard(bytes, JSON.stringify(buildEntityCardData(entity, available, links, libraryDetails, world)), { w, h });
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
 * Import a WebP, SillyTavern PNG, or SillyTavern JSON card with optional lorebook and library metadata.
 * Image cards use their pixels as the portrait; JSON cards keep their avatar URL.
 */
export async function importCharacterFile(
  file: File,
): Promise<{ entity: Entity; book: Dictionary | null; links: ComponentFileLinks; libraryDetails?: LibraryDetails }> {
  if (file.type === 'application/json' || /\.json$/i.test(file.name)) {
    const tavern = readTavernJson(await file.text());
    if (!tavern) throw new Error("This JSON isn't a SillyTavern character card.");
    return { ...tavern, links: {} };
  }
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
    return { entity, book: null, links: readComponentFileLinks(raw), libraryDetails: readLibraryDetails(raw) };
  }

  const tavern = readTavernCard(bytes);
  if (tavern) {
    // The PNG's pixels are the portrait; re-encode to WebP to match how entity images are stored.
    tavern.entity.images = [await optimizeImageDataUrl(bytesToDataUrl(bytes, 'image/png'), IMAGE_CAPS.entity)];
    // A foreign card carries no relationships of ours.
    return { ...tavern, links: {} };
  }

  throw new Error("This image isn't a Formamorph character card or a SillyTavern character.");
}
