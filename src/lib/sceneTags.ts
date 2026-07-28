// Composes the booru tag line for a scene image out of three sources that each own a different part of the
// picture: the location's authored tags (background), the present characters' authored tags (subjects), and
// the action tags the text model writes from this turn's narration. The authored tags go in verbatim — the
// model only ever contributes action/pose/composition — so a world keeps a consistent look across turns.

import { normalizeBooruTags } from './imagePrompt';
import { escapeRegExp } from './utils';

/** One character in frame: the display name (for the model's user message) and their authored tags. */
export interface SceneCharacter {
  name: string;
  /** Other names the story calls them, stripped from the model's tags along with the name itself. */
  aliases?: string[];
  tags: string;
}

/** Booru models lose track of who is who past two subjects, so a crowd is rendered as its two leads. */
export const MAX_SCENE_CHARACTERS = 2;

/** Split a tag line into trimmed, non-empty tags. */
export function splitTags(line: string): string[] {
  return line.split(',').map((t) => t.trim()).filter(Boolean);
}

// Subject-count tags. Each character's authored tags usually open with their own (`1girl`), which cannot
// simply be concatenated — two of them reads as one girl twice over, not as two girls. They're stripped per
// character and re-derived for the group below.
const GIRL_COUNT = /^(\d+girls?|multiple girls)$/;
const BOY_COUNT = /^(\d+boys?|multiple boys)$/;
const OTHER_COUNT = /^(\d+others?|multiple others)$/;
// `solo`/`solo focus` describe a one-subject frame, which a composed scene never guarantees.
const SOLO = /^solo(?: focus)?$/;

const isCountTag = (tag: string) =>
  GIRL_COUNT.test(tag) || BOY_COUNT.test(tag) || OTHER_COUNT.test(tag) || SOLO.test(tag);

// Authored location tags are written for an empty scenery shot (the tag prompt tells the model to include
// "no humans"), which directly contradicts putting characters in the frame. Dropped whenever anyone is present.
const NO_HUMANS = /^(no humans|nobody|no people)$/;

/**
 * Take the cast's names back out of a tag the model wrote. Told who is in frame, a model tags them by name
 * — `dean wolfram, walking` — and no image model has ever seen that as a tag, so it either does nothing or
 * poisons the whole line. The name is deleted and whatever else the tag said is kept (`dean wolfram walking`
 * → `walking`); a tag that was only the name disappears.
 *
 * A multi-word name is removed wherever it appears. A single-word name is removed only where it leads the
 * tag — which is where a name-as-subject lands (`mira reaching out`) — because one word is as likely to be a
 * real tag as a character: a world with someone called Rain still keeps `heavy rain`.
 */
export function stripNames(tag: string, names: string[]): string {
  let out = tag;
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const pattern = escapeRegExp(name);
    out = name.includes(' ')
      ? out.replace(new RegExp(`\\b${pattern}\\b`, 'gi'), ' ')
      : out.replace(new RegExp(`^\\s*${pattern}\\b`, 'i'), ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Take a world's place names back out of a tag the model wrote. The narration names where it is happening,
 * so the model tags it — `sedge landing, wooden dock` — and an invented place name means nothing to an
 * image model.
 *
 * Matched by FULL NAME ONLY, never by its words: `Classroom A` is worth removing, `classroom` and `a` are
 * not, and a tag keeps whatever it said around the name. A name that is itself a real tag is left alone
 * entirely — a world with a location called Kitchen still gets `kitchen` in its pictures — which is what
 * `knownTags` is for; without it every name is stripped.
 */
export function stripPlaces(tag: string, places: string[], knownTags?: ReadonlySet<string>): string {
  let out = tag;
  for (const raw of places) {
    const place = raw.trim();
    if (!place || knownTags?.has(place.toLowerCase())) continue;
    out = out.replace(new RegExp(`\\b${escapeRegExp(place)}\\b`, 'gi'), ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Booru plural for a count: `1girl`, `2girls`. */
const countTag = (n: number, singular: string, plural: string) => `${n}${n === 1 ? singular : plural}`;

/**
 * Group count tags for the characters in frame, derived from the count tag each one carries: two girls
 * become `2girls`, a girl and a boy stay `1girl, 1boy`. A character whose tags name no count is assumed to
 * be a person of unstated kind (`1other`), since they were put in the scene deliberately.
 *
 * `solo` is never emitted: the player character is in most scenes and has no tags of their own, so claiming
 * a single-subject frame would fight the narration rather than describe it.
 */
export function deriveCountTags(characters: SceneCharacter[]): string[] {
  let girls = 0;
  let boys = 0;
  let others = 0;
  for (const character of characters) {
    const tags = splitTags(character.tags.toLowerCase());
    // A character's own tags can only describe one character, so a `2girls` left in an authored field
    // still counts as one subject here.
    if (tags.some((t) => GIRL_COUNT.test(t))) girls += 1;
    else if (tags.some((t) => BOY_COUNT.test(t))) boys += 1;
    else others += 1;
  }
  const out: string[] = [];
  if (girls) out.push(countTag(girls, 'girl', 'girls'));
  if (boys) out.push(countTag(boys, 'boy', 'boys'));
  if (others) out.push(countTag(others, 'other', 'others'));
  return out;
}

/**
 * Build the full prompt line for a scene image, in booru weight order: who is in frame, what they look
 * like, what they're doing, then where. Tags are normalized and deduped across all four sources, first
 * occurrence winning — so a tag the location and a character share is not sent twice.
 *
 * Characters past `MAX_SCENE_CHARACTERS` are dropped; the caller passes them in prominence order.
 */
export function composeSceneTags(input: {
  characters: SceneCharacter[];
  locationTags: string;
  /** The model's contribution: action, pose, framing. */
  actionTags: string;
  /** The world's place names, removed from the model's tags (never from the authored ones). */
  places?: string[];
  /** Real tags, so a place name that is also one survives. */
  knownTags?: ReadonlySet<string>;
}): string {
  const characters = input.characters.slice(0, MAX_SCENE_CHARACTERS);
  const counts = deriveCountTags(characters);
  // Authored tags are never scrubbed for names or places: an author who typed one meant it.
  const appearance = characters.flatMap((c) => splitTags(c.tags)).filter((t) => !isCountTag(t.toLowerCase()));
  // The model is told who is in frame, so it writes them in by name; take the names back out.
  const castNames = characters.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
  const action = splitTags(input.actionTags)
    .map((t) => stripNames(t, castNames))
    .map((t) => stripPlaces(t, input.places ?? [], input.knownTags))
    .filter((t) => t && !isCountTag(t.toLowerCase()));
  const place = splitTags(input.locationTags).filter(
    (t) => !(characters.length > 0 && NO_HUMANS.test(t.toLowerCase())),
  );
  // normalizeBooruTags does the lowercasing, un-joining and dedupe the whole pipeline relies on.
  return normalizeBooruTags([...counts, ...appearance, ...action, ...place].join(', '));
}
