import type { Entity } from "@/types";

/** One entry in the director's cast — just a name; matching to an author entity happens later. */
export interface DirectorCastMember {
  name: string;
}

/** The director's parsed output: a short continuation note and an ordered, de-duplicated cast. */
export interface ParsedDirector {
  continuation: string;
  cast: DirectorCastMember[];
}

/** A cast member after entity matching: `entity` is set when the name matches a present author entity. */
export interface ChosenCharacter {
  name: string;
  entity?: Entity;
}

/** The capped selection sent to the character pass, plus the names that overflowed the cap. */
export interface CastSelection {
  chosen: ChosenCharacter[];
  overflow: string[];
}

const BULLET_RE = /^\s*[-*•]\s+(.+)$/;

/** Strip a bullet body down to the character name: drop a "— why involved" / ": reason" clause,
 *  surrounding markdown bold, and quotes. Hyphenated names survive (only spaced dashes split). */
function castName(body: string): string {
  let s = body.trim();
  // cut at the first " — " / " - " / ": " separator that introduces the reason clause
  const sep = s.search(/\s+[—–-]\s+|:\s/);
  if (sep !== -1) s = s.slice(0, sep);
  return s.replace(/^\*+|\*+$/g, "").replace(/^["']+|["']+$/g, "").trim();
}

// Generic ways a model refers to the player character (narrated in second person, no proper name).
const PLAYER_ALIASES = new Set([
  "you", "player", "the player", "player character", "the player character",
  "yourself", "protagonist", "the protagonist", "main character", "the main character",
]);

/** True when a director cast name refers to the player character. The player is never directed — their
 *  actions come from real input — so such an entry is dropped before the motivation pass. */
export function isPlayerCharacterName(name: string): boolean {
  return PLAYER_ALIASES.has(name.trim().toLowerCase());
}

// Sentinels a model emits to say "no one is here" — they are not characters and must not become a pass.
const EMPTY_CAST_NAMES = new Set([
  "none", "n/a", "na", "no one", "noone", "nobody", "no characters", "no character", "empty", "nothing",
]);

/** True when a director cast name is a "nobody is present" sentinel rather than an actual character. */
export function isEmptyCastName(name: string): boolean {
  return EMPTY_CAST_NAMES.has(name.trim().toLowerCase());
}

/**
 * Parse the director's free-text output into a continuation note and cast list. Expects the format:
 *   Continuation: <text>
 *   Cast:
 *   - <name> — <reason>
 * but tolerates a missing header: bullet lines are always the cast, and the first non-bullet,
 * non-header line becomes the continuation. Cast names are de-duplicated case-insensitively in order.
 */
export function parseDirectorCast(raw: string): ParsedDirector {
  const lines = raw.split("\n");
  const cast: DirectorCastMember[] = [];
  const seen = new Set<string>();
  const continuationParts: string[] = [];
  let explicitContinuation = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bullet = trimmed.match(BULLET_RE);
    if (bullet) {
      const name = castName(bullet[1]);
      const key = name.toLowerCase();
      // Drop the player character and "no one present" sentinels — neither is a directable character.
      if (name && !isPlayerCharacterName(name) && !isEmptyCastName(name) && !seen.has(key)) {
        seen.add(key);
        cast.push({ name });
      }
      continue;
    }

    const contMatch = trimmed.match(/^continuation\s*:\s*(.*)$/i);
    if (contMatch) {
      explicitContinuation = true;
      if (contMatch[1].trim()) continuationParts.push(contMatch[1].trim());
      continue;
    }

    // A "Cast:" header line carries no continuation text. Anything trailing it (e.g. an inline
    // "none" sentinel) is not continuation prose, so skip the whole line either way.
    if (/^cast\b\s*:?/i.test(trimmed)) continue;

    // Any other prose line is continuation, but only before an explicit Continuation marker has
    // claimed it (so a stray trailing line doesn't append to an explicit note).
    if (!explicitContinuation) continuationParts.push(trimmed);
  }

  return { continuation: continuationParts.join(" ").trim(), cast };
}

/**
 * Match each cast name to an author entity present at the location (case-insensitive), apply the cap
 * (keeping director order), and return the rest as plain overflow names for the storyboarder.
 */
export function matchCastToEntities(
  cast: DirectorCastMember[],
  entities: Entity[],
  cap = 3,
): CastSelection {
  const byName = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e]));
  const all: ChosenCharacter[] = cast.map((c) => ({
    name: c.name,
    entity: byName.get(c.name.trim().toLowerCase()),
  }));
  return { chosen: all.slice(0, cap), overflow: all.slice(cap).map((c) => c.name) };
}

const entityBlurb = (entity: Entity): string =>
  entity.aiSummary?.trim() || entity.aiDescription?.trim() || "";

/** Build the user message for one character's motivation pass (entity vs. ad-hoc identity line). */
export function buildCharacterUserMessage(args: {
  character: ChosenCharacter;
  continuation: string;
  action: string;
}): string {
  const { character, continuation, action } = args;
  const identity = character.entity
    ? `Character: ${character.name}\nWho they are: ${entityBlurb(character.entity) || "(no description provided)"}`
    : `Character: ${character.name}\n(Introduced by the director and not a predefined character — portray them as a fitting minor presence.)`;

  const scene = continuation ? `\n\nScene so far: ${continuation}` : "";
  return `${identity}${scene}\n\nThe player's latest action: ${action}\n\nState ${character.name}'s motivation and what they intend to do this turn.`;
}

/** Build the user message for the storyboard (merge) pass: the recent-story recap, the director's
 *  continuation, the per-character intents, and any overflow names beyond the cap. */
export function buildStoryboardUserMessage(args: {
  recap: string;
  continuation: string;
  intents: { name: string; text: string }[];
  overflow: string[];
  action: string;
}): string {
  const { recap, continuation, intents, overflow, action } = args;
  const parts: string[] = [];
  if (recap) parts.push(`What just happened:\n${recap}`);
  if (continuation) parts.push(`Scene continuation: ${continuation}`);
  if (intents.length) {
    parts.push(`Character intentions:\n${intents.map((i) => `- ${i.name}: ${i.text}`).join("\n")}`);
  }
  if (overflow.length) parts.push(`Also present: ${overflow.join(", ")}`);
  parts.push(`The player's latest action: ${action}`);
  parts.push("Reconcile these into the turn plan now.");
  return parts.join("\n\n");
}
