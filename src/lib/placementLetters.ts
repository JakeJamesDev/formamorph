import type {
  Dictionary, Entity, EntityGroup, GameLocation, Placeholder, Stat, Trait, TraitGroup, WorldOverview,
} from '@/types';
import { entitiesInTreeOrder } from './entityGroupTree';
import { locationRows } from './locationTree';
import {
  decodePlaceholderToken, hasPlaceholders, lonePlaceholderToken, parsePlaceholderText, PLACEHOLDER_PATH_SEPARATOR,
} from './placeholders';
import type { PlaceholderSegment, PlaceholderToken } from './placeholders';
import { allPlaceholders } from './placeholderHomes';
import { qualifiedPlaceholderName } from './placeholderTree';
import { inAuthoredOrder, traitOrderIndex } from './traitEffects';

/**
 * Placement letters — how a placed chip reads on an editor surface.
 *
 * Two Unique chips of one placeholder are two different rolls, and a name is the only thing that tells them
 * apart before play. Each Unique placement gets a letter from its position in the document: A, B, … Z, AA,
 * one sequence per placeholder. The letter is derived at render and never stored, so removing or moving a
 * placement renumbers the ones after it — it is a disambiguator, not an identity. A World chip is every
 * other World chip of its placeholder, so it takes no letter.
 *
 * An author label set on the chip replaces the default text outright.
 */

/** Placement id → letter, for every Unique placement an index covers. */
export type PlacementLetters = ReadonlyMap<string, string>;

export const EMPTY_LETTERS: PlacementLetters = new Map();

/** The letter for a 0-based position: A … Z, AA … AZ, BA … */
export function placementLetter(index: number): string {
  let out = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    out = String.fromCharCode(65 + (n % 26)) + out;
  }
  return out;
}

/**
 * Letter every Unique placement in `texts`, in the order the texts run and the chips sit in them. Letters
 * count per placeholder id. A placement seen twice keeps the letter of its first appearance, since both
 * chips share one roll.
 */
export function placementLetters(texts: Iterable<string>): PlacementLetters {
  const letters = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const text of texts) {
    if (!text || !hasPlaceholders(text)) continue;
    for (const seg of parsePlaceholderText(text)) {
      if (seg.type !== 'variable') continue;
      const token = decodePlaceholderToken(seg.token);
      if (!token || token.mode !== 'unique' || letters.has(token.placementId)) continue;
      const n = counts.get(token.id) ?? 0;
      counts.set(token.id, n + 1);
      letters.set(token.placementId, placementLetter(n));
    }
  }
  return letters;
}

/** True when two indexes letter the same placements the same way — what lets a memo keep its instance. */
export function sameLetters(a: PlacementLetters, b: PlacementLetters): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [id, letter] of a) if (b.get(id) !== letter) return false;
  return true;
}

const present = (texts: Array<string | undefined>): string[] => texts.filter((t): t is string => !!t);

/** The world slices a letter walk reads. Every one is optional: world JSON is hand-editable and arrives
 *  from third-party tools, and the walk runs inside the editor's render. */
export interface PlacementWorld {
  entities?: Entity[];
  entityGroups?: EntityGroup[];
  locations?: GameLocation[];
  traits?: Trait[];
  traitGroups?: TraitGroup[];
  stats?: Stat[];
  dictionaries?: Dictionary[];
  worldOverview?: WorldOverview;
  placeholders?: Placeholder[];
}

const entityTexts = (e: Entity) => present([e.name, ...(e.aliases ?? []), e.playerDescription, e.aiDescription, e.aiSummary, e.imageTags]);
const locationTexts = (l: GameLocation) => present([l.name, l.playerDescription, l.aiDescription, l.aiSummary, l.description, l.imageTags]);
const traitTexts = (t: Trait | TraitGroup) => present([t.name, t.playerDescription, t.aiDescription]);
const entryTexts = (b: Dictionary) => (b.entries ?? []).flatMap((en) => present([en.name, ...(en.key ?? []), ...(en.secondaryKeys ?? []), en.value]));
const valueTexts = (placeholders: Placeholder[] | undefined) => (placeholders ?? []).flatMap((p) => (p.values ?? []).map((v) => v.text));

/**
 * Every chip-bearing text of a world in document order: entities, locations and traits as their trees list
 * them, then trait groups, stats, dictionaries, the overview's prompt fields, and last the placeholders'
 * own values. The same fields the gameplay priming pass rolls across, so every chip that can roll in play
 * can carry a letter — and the letters run down the editor's lists, so `(A)` is always above `(B)`.
 */
export function worldPlacementTexts(world: PlacementWorld): string[] {
  const ov = world.worldOverview;
  const traits = world.traits ?? [];
  return [
    ...entitiesInTreeOrder(world.entityGroups ?? [], world.entities ?? []).flatMap(entityTexts),
    ...locationRows(world.locations ?? []).flatMap((row) => locationTexts(row.location)),
    ...inAuthoredOrder(traits, traitOrderIndex(traits, world.traitGroups ?? [])).flatMap(traitTexts),
    ...(world.traitGroups ?? []).flatMap(traitTexts),
    ...(world.stats ?? []).map((s) => s.name).filter(Boolean),
    ...(world.dictionaries ?? []).flatMap(entryTexts),
    ...present([ov?.systemPrompt, ov?.readme, ov?.introReadme, ov?.openingCue]),
    ...valueTexts(allPlaceholders(world)),
  ];
}

/** A library character's texts: its own fields, then the values it carries. */
export function entityPlacementTexts(entity: Entity): string[] {
  return [...entityTexts(entity), ...valueTexts(entity.placeholders)];
}

/** A library book's texts: its entries, then the values it carries. */
export function dictionaryPlacementTexts(book: Dictionary): string[] {
  return [...entryTexts(book), ...valueTexts(book.placeholders)];
}

/** The letter index of a whole world — what every surface inside the World Editor reads. */
export const worldPlacementLetters = (world: PlacementWorld): PlacementLetters => placementLetters(worldPlacementTexts(world));
/** The letter index of a library character, which is its own document. */
export const entityPlacementLetters = (entity: Entity): PlacementLetters => placementLetters(entityPlacementTexts(entity));
/** The letter index of a library book, which is its own document. */
export const dictionaryPlacementLetters = (book: Dictionary): PlacementLetters => placementLetters(dictionaryPlacementTexts(book));

/** What a chip whose placeholder is gone reads as on a text surface. */
const MISSING = '?';
/** What a Unique chip reads as where no index letters it — a field outside any walk, or a bare test. */
const UNLETTERED = 'Unique';

/**
 * The text one placement reads as: its author label if set; else `Name (A)` for a Unique chip with a letter,
 * `Name (Unique)` for one without, and plain `Name` for a World chip.
 */
export function placementDisplayName(token: PlaceholderToken, name: string, letters: PlacementLetters = EMPTY_LETTERS): string {
  if (token.label) return token.label;
  if (token.mode !== 'unique') return name;
  return `${name} (${letters.get(token.placementId) ?? UNLETTERED})`;
}

/**
 * A chip's name as every surface spells it: the qualified root, then each path step, so `Molly › Hair` and a
 * root `Hair` never read alike. `null` when the root placeholder is gone; a gone step reads as `missing`.
 * `relativeTo` drops the owner chain a surface already gives (a placeholder's own panel).
 */
export function chipPathName(
  token: PlaceholderToken,
  placeholders: readonly Placeholder[],
  { relativeTo, missing = MISSING }: { relativeTo?: string | null; missing?: string } = {},
): string | null {
  const root = qualifiedPlaceholderName(placeholders, token.id, relativeTo);
  if (root == null) return null;
  const segLabel = (seg: PlaceholderSegment) =>
    (seg.kind === 'slot' ? seg.name : placeholders.find((p) => p.id === seg.ref)?.name ?? missing);
  return [root, ...(token.path ?? []).map(segLabel)].join(PLACEHOLDER_PATH_SEPARATOR);
}

/**
 * Authored text with every chip replaced by what it is called, for the plain-text surfaces that show a name:
 * dropdowns, the canvas, modal titles, filenames, cards and listings. A chip that is the whole text reads
 * bare — `Town Name (A)` — and one inside prose keeps braces so the name stays visibly a chip:
 * `The {Town Name (A)} Inn`. A chip whose placeholder is gone reads `?`, plus its label if it has one.
 *
 * Deliberately never draws or describes values: a row shows what a thing is called, and its values live in
 * the tooltip. Text with no chips costs one regex test.
 */
export function labelPlaceholders(text: string, placeholders: Placeholder[] = [], letters: PlacementLetters = EMPTY_LETTERS): string {
  if (!text || !hasPlaceholders(text)) return text;
  const lone = lonePlaceholderToken(text);
  return parsePlaceholderText(text).map((seg) => {
    if (seg.type === 'text') return seg.value;
    const token = decodePlaceholderToken(seg.token);
    if (!token) return '';
    const name = chipPathName(token, placeholders);
    const shown = name == null
      ? (token.label ? `${MISSING} ${token.label}` : MISSING)
      : placementDisplayName(token, name, letters);
    return seg.token === lone ? shown : `{${shown}}`;
  }).join('');
}

/** The placeholder names behind the chips in `text`, so a search for a placeholder finds a chip that reads
 *  as its author label. Gone placeholders contribute nothing. */
export function chipPlaceholderNames(text: string, placeholders: Placeholder[]): string[] {
  if (!text || !hasPlaceholders(text)) return [];
  return parsePlaceholderText(text).flatMap((seg) => {
    if (seg.type === 'text') return [];
    const token = decodePlaceholderToken(seg.token);
    const name = token && chipPathName(token, placeholders);
    return name == null ? [] : [name];
  });
}
