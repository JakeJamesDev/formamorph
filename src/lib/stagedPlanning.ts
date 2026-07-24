import type { Entity, ChatMessage, AIRequestType, SceneEntity } from "@/types";
import { renderPromptTemplate } from "./promptTemplate";
import { collectCharacterDiary } from "./turnDigest";
import { selectRelevantDiary } from "./semanticDiary";
import { sameCharacterName, matchNames, findEntityNames } from "./entityMatch";
import { escapeRegExp } from "./utils";
import { NONE_PLACEHOLDER } from "./promptFallbacks";

/** One entry in the director's cast: a name plus their placement/action, if the director gave one.
 *  `isPlayer` marks the player character — listed for scene grounding, never given a motivation pass.
 *  `alias` is how the player currently knows a not-yet-named character (from the "Name (alias)" form),
 *  captured so the scene list can show the alias without spoiling the real name. */
export interface DirectorCastMember {
  name: string;
  stance?: string;
  alias?: string;
  isPlayer?: boolean;
}

/** The director's parsed output: the scene staging and an ordered, de-duplicated cast. */
export interface ParsedDirector {
  scene: string;
  cast: DirectorCastMember[];
}

/** A cast member after entity matching: `entity` is set when the name matches a present author entity. */
export interface ChosenCharacter {
  name: string;
  stance?: string;
  entity?: Entity;
}

/** The capped selection sent to the character pass, plus the names that overflowed the cap. */
export interface CastSelection {
  chosen: ChosenCharacter[];
  overflow: string[];
}

const BULLET_RE = /^\s*[-*•]\s+(.+)$/;

// The separator between a cast bullet's name and its stance clause: a spaced dash or "name: stance".
const CAST_SEP_RE = /\s+[—–-]\s+|:\s/;

/** Split a bullet's name field into the real name and, if present, the parenthetical alias — so
 *  "Maela (the silver-haired woman)" yields real name "Maela" and alias "the silver-haired woman", while a
 *  plain "Bram (ferryman)" role gloss yields "Bram" (alias "ferryman"). Surrounding markup/punctuation
 *  (**bold**, "quotes", a trailing ".") is trimmed; internal punctuation survives, so hyphenated / dotted
 *  names (Jean-Luc, Dr. Strange, R2-D2) stay intact. Used by both parseDirectorCast and the reveal sanitizer,
 *  so the two agree on where a name ends. */
function splitNameAlias(nameField: string): { real: string; alias?: string } {
  const clean = (s: string) => s.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  const m = nameField.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    const alias = clean(m[2]);
    return alias ? { real: clean(m[1]), alias } : { real: clean(m[1]) };
  }
  return { real: clean(nameField) };
}

/** The name field of a bullet body: everything before the " — stance" / ": stance" separator. */
function castNameField(body: string): string {
  const s = body.trim();
  const sep = s.search(CAST_SEP_RE);
  return sep !== -1 ? s.slice(0, sep) : s;
}

/** The stance/action clause after the name separator, cleaned of markdown/quotes; undefined if none. */
function castStance(body: string): string | undefined {
  const s = body.trim();
  const m = s.match(CAST_SEP_RE);
  if (!m || m.index === undefined) return undefined;
  const rest = s.slice(m.index + m[0].length).replace(/^\*+|\*+$/g, "").replace(/^["']+|["']+$/g, "").trim();
  return rest || undefined;
}

// Generic ways a model refers to the player character (narrated in second person, no proper name).
const PLAYER_ALIASES = new Set([
  "you", "player", "the player", "player character", "the player character",
  "yourself", "protagonist", "the protagonist", "main character", "the main character",
]);

/** True when a director cast name refers to the player character. The player is never directed — their
 *  actions come from real input — so such an entry is flagged and skipped before the motivation pass. */
export function isPlayerCharacterName(name: string): boolean {
  return PLAYER_ALIASES.has(name.trim().toLowerCase());
}

// Sentinels a model emits to say "no one is here" — they are not characters and must not become a pass.
const EMPTY_CAST_NAMES = new Set([
  "none", "n/a", "na", "no one", "noone", "nobody", "no characters", "no character", "empty", "nothing",
]);

// Multi-word "the scene is empty" declarations a model emits as a lone cast bullet, beyond the single-word
// sentinels above: "no other characters present", "no one else", "nobody else here", "no NPCs present".
const EMPTY_CAST_RE = /^no( one else| others?| other \w+| \w+ (?:present|here|remaining))\b|^nobody else\b/;

/** True when a director cast name is a "nobody is present" sentinel rather than an actual character. */
export function isEmptyCastName(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/[.!]+$/, "");
  return EMPTY_CAST_NAMES.has(n) || EMPTY_CAST_RE.test(n);
}

/**
 * Parse the director's free-text output into a scene note and cast list. Expects the format:
 *   Scene: <text>
 *   Cast:
 *   - <name> — <stance>
 * but tolerates the model breaking after `Scene:` (text on following lines) and a missing header:
 * everything before the cast section is scene prose, bullets are always the cast, and once the cast
 * section starts (a `Cast:` header or the first bullet) nothing more is treated as scene. Cast names
 * are de-duplicated case-insensitively in order.
 */
export function parseDirectorCast(raw: string): ParsedDirector {
  const lines = raw.split("\n");
  const cast: DirectorCastMember[] = [];
  const seen = new Set<string>();
  const sceneParts: string[] = [];
  let inCast = false; // once true (Cast: header or a bullet), later lines are no longer scene prose

  // Add one cast member from a bullet body or an inline "Cast: <name> - <stance>". The name field is split
  // into the real name and any parenthetical alias ("Maela (the hooded woman)" → name "Maela", alias
  // captured) so a name resolves to its entity even when the model appends a role/alias gloss. The player is
  // normalized to "Player Character" and flagged (never given a motivation pass); "no one present" sentinels
  // are dropped, and names are de-duplicated case-insensitively in order.
  const addCastMember = (body: string) => {
    const { real, alias } = splitNameAlias(castNameField(body));
    if (!real || isEmptyCastName(real)) return;
    const isPlayer = isPlayerCharacterName(real);
    const displayName = isPlayer ? "Player Character" : real;
    const key = displayName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cast.push({
      name: displayName,
      stance: castStance(body),
      ...(alias && !isPlayer ? { alias } : {}),
      ...(isPlayer ? { isPlayer: true } : {}),
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bullet = trimmed.match(BULLET_RE);
    if (bullet) {
      inCast = true;
      addCastMember(bullet[1]);
      continue;
    }

    // A "Cast:" header opens the cast section. Trailing text on it is a member inlined by the model
    // (e.g. "Cast: Player Character - Resting"); a bare "none" trailing text drops via addCastMember.
    const castHeader = trimmed.match(/^cast\b\s*:?\s*(.*)$/i);
    if (castHeader) {
      inCast = true;
      if (castHeader[1].trim()) addCastMember(castHeader[1]);
      continue;
    }

    // A "Scene:" label carries its text inline or on the following lines — capture the inline remainder
    // (the later lines fall through to the fallback below), but only before the cast section begins so a
    // stray second "Scene:" after the cast can't pollute or merge into the scene.
    const sceneMatch = trimmed.match(/^scene\s*:\s*(.*)$/i);
    if (sceneMatch) {
      if (!inCast && sceneMatch[1].trim()) sceneParts.push(sceneMatch[1].trim());
      continue;
    }

    // Any other prose line is scene staging, until the cast section begins.
    if (!inCast) sceneParts.push(trimmed);
  }

  return { scene: sceneParts.join(" ").trim(), cast };
}

/** A parsed cast split by role: the player flagged, NPCs isolated, and NPC names bucketed by whether they
 *  resolve to a defined author entity (loose narration match) or are ad-hoc/invented (strict match). */
export interface ClassifiedCast {
  /** The full cast with player entries flagged (`isPlayer`), matched by trait name as well as by label. */
  flaggedCast: DirectorCastMember[];
  /** The cast minus the player — the beings that get a motivation pass / count as participants. */
  npcCast: DirectorCastMember[];
  /** Canonical names of defined entities the cast named — confirmed against narration with a loose match. */
  directorCandidates: string[];
  /** Ad-hoc names the planner invented (no entity record) — confirmed against narration with a strict match. */
  adHocCandidates: string[];
}

/**
 * Classify a parsed cast against the world's entities and the player's names. Flags the player (the planner
 * sometimes names them instead of using the "Player Character" label, so match selected trait names too, but
 * never a name that resolves to a world entity — that's an NPC), drops them from the NPC set, and buckets the
 * remaining names into defined-entity candidates (loose match) vs. ad-hoc candidates (strict match). Shared
 * by the staged pipeline and the precall planner so both drive participation the same way.
 */
export function classifyCast(
  cast: DirectorCastMember[],
  entities: Entity[],
  playerNames: string[],
): ClassifiedCast {
  const definedByLower = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e.name]));
  const isKnownEntity = (n: string) => definedByLower.has(n.trim().toLowerCase());
  const flaggedCast = cast.map((c) =>
    c.isPlayer || isKnownEntity(c.name) ? c
      : playerNames.some((pn) => sameCharacterName(pn, c.name)) ? { ...c, isPlayer: true }
      : c,
  );
  const npcCast = flaggedCast.filter((c) => !c.isPlayer);
  const directorCandidates: string[] = [];
  const adHocCandidates: string[] = [];
  for (const member of npcCast) {
    const canonical = definedByLower.get(member.name.trim().toLowerCase());
    if (canonical) directorCandidates.push(canonical);
    else adHocCandidates.push(member.name);
  }
  return { flaggedCast, npcCast, directorCandidates, adHocCandidates };
}

/**
 * Build the live scene list (the Entities tab) for one turn. When a planner ran (`cast` is the turn's NPC
 * cast, with any aliases), presence is the planner's call — mention in the narration alone does NOT add
 * someone. Each present being resolves to its canonical entity name (so the portrait ties) or its ad-hoc
 * name, carries its alias, and is marked `revealed` once the real name has appeared in the narration
 * (`priorNarration` = all past turns, `narrationSoFar` = this turn so far, so reveal flips mid-stream).
 * With no planner (`cast` is null — Off/Inline modes), fall back to the narration parse: a named entity is
 * by definition already revealed.
 */
export function buildSceneList(args: {
  cast: DirectorCastMember[] | null;
  entities: Entity[];
  narrationSoFar: string;
  priorNarration: string;
}): SceneEntity[] {
  const { cast, entities, narrationSoFar, priorNarration } = args;
  if (!cast) {
    return findEntityNames(narrationSoFar, entities).map((name) => ({ name, revealed: true }));
  }
  const revealedIn = `${priorNarration}\n${narrationSoFar}`;
  const definedByLower = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e.name]));
  const out: SceneEntity[] = [];
  const seen = new Set<string>();
  for (const member of cast) {
    if (member.isPlayer) continue;
    const name = definedByLower.get(member.name.trim().toLowerCase()) ?? member.name;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      ...(member.alias ? { alias: member.alias } : {}),
      revealed: matchNames(revealedIn, [name]).length > 0,
    });
  }
  return out;
}

// What the narrator is shown in place of a not-yet-revealed name the planner gave no alias for — keeps a
// bare real name (the model ignoring the parenthetical alias rule) out of the narration's input.
const REVEAL_FALLBACK = "someone the player has not yet identified";

/**
 * Keep not-yet-revealed character names out of the plan the narrator reads. For each cast bullet naming a
 * character whose real name has NOT appeared in past narration (`isRevealed` is the caller's narration-corpus
 * check), rewrite that name everywhere in the plan — Scene, Cast, and Beats — to the parenthetical alias the
 * planner gave ("the silver-haired woman"), or a neutral fallback when it gave none. Revealed names, the
 * player, and empty-cast sentinels are left untouched. This is the code-side backstop for the prompt's alias
 * rule, which small/large models honor unevenly.
 */
export function sanitizePlanForReveal(plan: string, isRevealed: (realName: string) => boolean): string {
  const renames: { real: string; to: string }[] = [];
  const seen = new Set<string>();
  for (const line of plan.split("\n")) {
    const bullet = line.trim().match(BULLET_RE);
    if (!bullet) continue; // bullets are always cast members (matches parseDirectorCast)
    const { real, alias } = splitNameAlias(castNameField(bullet[1]));
    if (!real || isPlayerCharacterName(real) || isEmptyCastName(real)) continue;
    const key = real.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (isRevealed(real)) continue;
    renames.push({ real, to: alias || REVEAL_FALLBACK });
  }
  let out = plan;
  for (const { real, to } of renames) {
    const esc = escapeRegExp(real);
    // Drop the "Real (alias)" pairing first (so the cast bullet doesn't become "alias (alias)"), then any
    // bare occurrence left in the Scene/Beats prose. Function replacement avoids `$&`-style pitfalls.
    out = out.replace(new RegExp(`\\b${esc}\\b\\s*\\([^)]*\\)`, "gi"), () => to);
    out = out.replace(new RegExp(`\\b${esc}\\b`, "gi"), () => to);
  }
  return out;
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
    stance: c.stance,
    entity: byName.get(c.name.trim().toLowerCase()),
  }));
  return { chosen: all.slice(0, cap), overflow: all.slice(cap).map((c) => c.name) };
}

const entityBlurb = (entity: Entity): string =>
  entity.aiSummary?.trim() || entity.aiDescription?.trim() || "";

/** Build the user message for one character's motivation pass (entity vs. ad-hoc identity line). */
export function buildCharacterUserMessage(args: {
  character: ChosenCharacter;
  scene: string;
  action: string;
  diary?: string[];
  recap?: string;
}): string {
  const { character, scene, action, diary, recap } = args;
  // The blurb is a general baseline, not this turn's pose — framed so a static description doesn't
  // re-anchor the character to its opening stance every turn (the recap/scene carry the live situation).
  const identity = character.entity
    ? `You are ${character.name}.\nMy background (who I am in general, not this exact moment): ${entityBlurb(character.entity) || "(no description provided)"}`
    : `You are ${character.name}.\n(Introduced by the director and not a predefined character — portray yourself as a fitting minor presence.)`;

  const diaryBlock = diary && diary.length
    ? `\n\nMy diary so far (my own private memories, oldest first — stay consistent with them):\n${diary.map((d) => `- ${d}`).join("\n")}`
    : "";
  const recapBlock = recap && recap.trim()
    ? `\n\nWhat just happened (here "you" / "your" means the player character, not me):\n${recap.trim()}`
    : "";
  const stanceLine = character.stance ? `\n\nWhere I am now: ${character.stance}` : "";
  const sceneLine = scene ? `\n\nScene right now: ${scene}` : "";
  return `${identity}${diaryBlock}${recapBlock}${stanceLine}${sceneLine}\n\nThe player's latest action (their own words — any "I" / "me" / "my" here is the player character, not me): ${action}\n\nAs ${character.name}, from where I stand in this scene, state in the first person what I want and what I do now.`;
}

/** Build the user message for one character's diary pass: their identity plus the turn narration to
 *  record from their point of view. `entity` is the matched defined entity (undefined for ad-hoc). */
export function buildDiaryUserMessage(args: {
  name: string;
  entity?: Entity;
  narration: string;
}): string {
  const { name, entity, narration } = args;
  const identity = entity
    ? `You are ${name}.\nWho you are: ${entityBlurb(entity) || "(no description provided)"}`
    : `You are ${name}.`;
  return `${identity}\n\nAccount of what just happened (in it, "you" means the player character, not you - you appear as ${name}):\n${narration}\n\nAs ${name}, write my own diary entry now - one or two sentences, first person ("I" = ${name}).`;
}

/** Build the user message for the storyboard (merge) pass: the recent-story recap, the director's
 *  scene staging, the per-character intents, and any overflow names beyond the cap. */
export function buildStoryboardUserMessage(args: {
  recap: string;
  scene: string;
  intents: { name: string; text: string }[];
  overflow: string[];
  action: string;
}): string {
  const { recap, scene, intents, overflow, action } = args;
  const parts: string[] = [];
  if (recap) parts.push(`What just happened:\n${recap}`);
  if (scene) parts.push(`Scene: ${scene}`);
  if (intents.length) {
    parts.push(`Character intentions:\n${intents.map((i) => `- ${i.name}: ${i.text}`).join("\n")}`);
  }
  if (overflow.length) parts.push(`Also present: ${overflow.join(", ")}`);
  parts.push(`The player's latest action: ${action}`);
  parts.push("Reconcile these into the turn plan now.");
  return parts.join("\n\n");
}

/** Assemble the staged plan injected into the narration: the director's scene staging + the cast's
 *  current stances (grounding) ahead of the storyboard beats. Blank sections are omitted. */
export function buildStagedPlan(args: {
  scene: string;
  stances: DirectorCastMember[];
  beats: string;
}): string {
  const { scene, stances, beats } = args;
  const parts: string[] = [];
  if (scene.trim()) parts.push(`Scene: ${scene.trim()}`);
  const present = stances.filter((c) => c.name.trim());
  if (present.length) {
    parts.push(
      `Present entities:\n${present.map((c) => (c.stance ? `- ${c.name} - ${c.stance}` : `- ${c.name}`)).join("\n")}`,
    );
  }
  if (beats.trim()) parts.push(`What happens:\n${beats.trim()}`);
  return parts.join("\n\n");
}

/** The AI-request callback the staged pipeline drives (a subset of GameViewer's makeAIRequest). */
export type StagedRequestFn = (
  systemPrompt: string,
  messages: ChatMessage[],
  requestType: AIRequestType,
  maxTokens: number | null,
  signal?: AbortSignal,
) => Promise<string>;

/** The output of one staged-planning run: the injectable plan plus the cast names to confirm against
 *  the narration afterward. */
export interface StagedPlanningResult {
  /** The assembled plan to inject into the narration ("" when the run was aborted). */
  turnPlan: string;
  /** Defined entities the director cast (loose narration match). */
  directorCandidates: string[];
  /** Ad-hoc names the director invented (strict narration match). */
  adHocCandidates: string[];
  /** The turn's NPC cast (player excluded), with aliases — drives the live scene list via buildSceneList. */
  cast: DirectorCastMember[];
}

/**
 * Run the staged planning pipeline for one turn: director (scene + cast) → one motivation pass per
 * chosen character (sequential, capped) → storyboarder. Returns the plan plus the cast names to
 * confirm against the narration afterward. On abort it returns early with an empty plan; the caller
 * should re-check `signal.aborted` and bail. `request` is GameViewer's makeAIRequest, injected so this
 * stays pure/testable.
 */
export async function runStagedPlanning(ctx: {
  action: string;
  stageValues: Record<string, string>;
  lastStory: string;
  entities: Entity[];
  presentEntityIds: string[];
  /** Selected trait names — used to recognize the player when the director names them instead of labeling. */
  playerNames: string[];
  characterDiaries: boolean;
  /** Run the per-character motivation passes concurrently (they're independent) instead of one at a time. */
  concurrentCharacters: boolean;
  fullMessageHistory: ChatMessage[];
  diaryMemoryEntries: number;
  /** Diary retrieval (semantic-memory step 4): when set, each character's diary block becomes the
   *  recent tail plus the relevant older entries (lib/semanticDiary) instead of pure recency. Null =
   *  the pre-feature last-N path, byte-identical. */
  diaryRetrieval?: { queryVec: Float32Array; vectorsByKey: Map<string, Float32Array> } | null;
  caps: { director: number; character: number; storyboard: number };
  /** Max characters sent to the per-character pass (overflow goes to the storyboard). Infinity = unbounded. */
  activeCharacterCap: number;
  /** The (user-editable) staged-stage prompts, seeded from the defaults in GamePrompts. */
  directorPrompt: string;
  directorUserPrompt: string;
  characterPrompt: string;
  storyboardPrompt: string;
  request: StagedRequestFn;
  signal: AbortSignal;
}): Promise<StagedPlanningResult> {
  const {
    action, stageValues, lastStory, entities, presentEntityIds, playerNames, characterDiaries,
    concurrentCharacters, fullMessageHistory, diaryMemoryEntries, caps, activeCharacterCap,
    directorPrompt, directorUserPrompt, characterPrompt, storyboardPrompt, request, signal,
    diaryRetrieval = null,
  } = ctx;

  // 1) Director: who is in the scene and what carries over.
  const directorOut = await request(
    renderPromptTemplate(directorPrompt, stageValues),
    [{ role: "user", content: renderPromptTemplate(directorUserPrompt, { "<NARRATION>": lastStory || NONE_PLACEHOLDER, "<PLAYER ACTION>": action }) }],
    "director", caps.director, signal,
  );
  if (signal.aborted) return { turnPlan: "", directorCandidates: [], adHocCandidates: [], cast: [] };
  const { scene, cast } = parseDirectorCast(directorOut || "");
  const { flaggedCast, npcCast, directorCandidates, adHocCandidates } = classifyCast(cast, entities, playerNames);

  if (npcCast.length === 0) {
    // No one to reconcile — skip the character + storyboard passes (they'd only invent filler).
    return { turnPlan: buildStagedPlan({ scene, stances: flaggedCast, beats: "" }), directorCandidates, adHocCandidates, cast: npcCast };
  }

  const presentEntities = entities.filter((e) => presentEntityIds.includes(e.id));
  const { chosen, overflow } = matchCastToEntities(npcCast, presentEntities, activeCharacterCap);

  // 2) One motivation pass per chosen character. They're independent, so run concurrently when enabled (the
  // debug capture correlates each request to its response by id, so parallel same-type "character" calls
  // stay correctly paired). Intents keep cast order either way, which the storyboard message relies on.
  const runCharacter = (member: (typeof chosen)[number]) => {
    // Feed the character its own diary as private memory (Slice B) — only when enabled. With
    // retrieval, the whole diary is collected and lib/semanticDiary keeps the recent tail plus the
    // relevant older entries (chronological either way, so the block's "oldest first" stays true).
    const all = characterDiaries
      ? collectCharacterDiary(fullMessageHistory, member.name, diaryRetrieval ? Number.MAX_SAFE_INTEGER : diaryMemoryEntries)
      : [];
    const diary = diaryRetrieval ? selectRelevantDiary(all, diaryRetrieval.queryVec, diaryRetrieval.vectorsByKey) : all;
    return request(
      renderPromptTemplate(characterPrompt, { ...stageValues, "<CHARACTER NAME>": member.name }),
      [{ role: "user", content: buildCharacterUserMessage({ character: member, scene, action, diary, recap: lastStory }) }],
      "character", caps.character, signal,
    );
  };
  let intents: { name: string; text: string }[] = [];
  if (concurrentCharacters) {
    const texts = await Promise.all(chosen.map(runCharacter));
    if (signal.aborted) return { turnPlan: "", directorCandidates, adHocCandidates, cast: npcCast };
    intents = chosen.map((member, i) => ({ name: member.name, text: texts[i] })).filter((intent) => intent.text);
  } else {
    for (const member of chosen) {
      const text = await runCharacter(member);
      if (signal.aborted) return { turnPlan: "", directorCandidates, adHocCandidates, cast: npcCast };
      if (text) intents.push({ name: member.name, text });
    }
  }

  // 3) Storyboarder: consolidate the cast + intentions into this turn's plan.
  const plan = await request(
    renderPromptTemplate(storyboardPrompt, stageValues),
    [{ role: "user", content: buildStoryboardUserMessage({ recap: lastStory, scene, intents, overflow, action }) }],
    "storyboard", caps.storyboard, signal,
  );
  if (signal.aborted) return { turnPlan: "", directorCandidates, adHocCandidates, cast: npcCast };
  // Ground the narration in the director's scene + cast stances alongside the storyboard beats.
  return { turnPlan: buildStagedPlan({ scene, stances: flaggedCast, beats: plan || "" }), directorCandidates, adHocCandidates, cast: npcCast };
}
