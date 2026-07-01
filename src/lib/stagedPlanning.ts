import type { Entity, ChatMessage, AIRequestType } from "@/types";
import { renderPromptTemplate } from "./promptTemplate";
import { collectCharacterDiary } from "./turnDigest";
import { defaultDirectorPrompt, defaultCharacterPrompt, defaultStoryboardPrompt } from "@/components/game/GamePrompts";

/** One entry in the director's cast: a name plus their placement/action, if the director gave one.
 *  `isPlayer` marks the player character — listed for scene grounding, never given a motivation pass. */
export interface DirectorCastMember {
  name: string;
  stance?: string;
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

/** Strip a bullet body down to the character name: drop a " — stance" / ": stance" clause, then trim any
 *  surrounding markup/punctuation (**bold**, "quotes", a trailing "."). Internal punctuation survives, so
 *  hyphenated / dotted names (Jean-Luc, Dr. Strange, R2-D2) are kept intact. */
function castName(body: string): string {
  let s = body.trim();
  const sep = s.search(CAST_SEP_RE);
  if (sep !== -1) s = s.slice(0, sep);
  return s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
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

/** True when a director cast name is a "nobody is present" sentinel rather than an actual character. */
export function isEmptyCastName(name: string): boolean {
  return EMPTY_CAST_NAMES.has(name.trim().toLowerCase());
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

  // Add one cast member from a bullet body or an inline "Cast: <name> - <stance>". The player is
  // normalized to "Player Character" and flagged (never given a motivation pass); "no one present"
  // sentinels are dropped, and names are de-duplicated case-insensitively in order.
  const addCastMember = (body: string) => {
    const name = castName(body);
    if (!name || isEmptyCastName(name)) return;
    const isPlayer = isPlayerCharacterName(name);
    const displayName = isPlayer ? "Player Character" : name;
    const key = displayName.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cast.push({
      name: displayName,
      stance: castStance(body),
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
}): string {
  const { character, scene, action, diary } = args;
  const identity = character.entity
    ? `You are ${character.name}.\nWho you are: ${entityBlurb(character.entity) || "(no description provided)"}`
    : `You are ${character.name}.\n(Introduced by the director and not a predefined character — portray yourself as a fitting minor presence.)`;

  const diaryBlock = diary && diary.length
    ? `\n\nMy diary so far (my own private memories, oldest first — stay consistent with them):\n${diary.map((d) => `- ${d}`).join("\n")}`
    : "";
  const stanceLine = character.stance ? `\nCurrent stance: ${character.stance}` : "";
  const sceneLine = scene ? `\n\nScene: ${scene}` : "";
  return `${identity}${diaryBlock}${stanceLine}${sceneLine}\n\nThe player's latest action: ${action}\n\nAs ${character.name}, state in the first person ("I ...") what you want and what you intend to do this turn.`;
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

export interface StagedPlanningResult {
  /** The assembled plan to inject into the narration ("" when the run was aborted). */
  turnPlan: string;
  /** Defined entities the director cast (loose narration match). */
  directorCandidates: string[];
  /** Ad-hoc names the director invented (strict narration match). */
  adHocCandidates: string[];
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
  characterDiaries: boolean;
  fullMessageHistory: ChatMessage[];
  diaryMemoryEntries: number;
  caps: { director: number; character: number; storyboard: number };
  request: StagedRequestFn;
  signal: AbortSignal;
}): Promise<StagedPlanningResult> {
  const {
    action, stageValues, lastStory, entities, presentEntityIds, characterDiaries,
    fullMessageHistory, diaryMemoryEntries, caps, request, signal,
  } = ctx;
  const directorCandidates: string[] = [];
  const adHocCandidates: string[] = [];
  const recap = lastStory ? `What just happened:\n${lastStory}\n\n` : "";

  // 1) Director: who is in the scene and what carries over.
  const directorOut = await request(
    renderPromptTemplate(defaultDirectorPrompt, stageValues),
    [{ role: "user", content: `${recap}The player's next action: ${action}\n\nDescribe the scene and list the cast now.` }],
    "director", caps.director, signal,
  );
  if (signal.aborted) return { turnPlan: "", directorCandidates, adHocCandidates };
  const { scene, cast } = parseDirectorCast(directorOut || "");
  // The player may be listed for scene grounding but is never directed or matched as a participant.
  const npcCast = cast.filter((c) => !c.isPlayer);
  // Split the cast into defined entities (director vouched → loose match) and ad-hoc names (strict match).
  const definedByLower = new Map(entities.map((e) => [e.name.trim().toLowerCase(), e.name]));
  for (const member of npcCast) {
    const canonical = definedByLower.get(member.name.trim().toLowerCase());
    if (canonical) directorCandidates.push(canonical);
    else adHocCandidates.push(member.name);
  }

  if (npcCast.length === 0) {
    // No one to reconcile — skip the character + storyboard passes (they'd only invent filler).
    return { turnPlan: buildStagedPlan({ scene, stances: cast, beats: "" }), directorCandidates, adHocCandidates };
  }

  const presentEntities = entities.filter((e) => presentEntityIds.includes(e.id));
  const { chosen, overflow } = matchCastToEntities(npcCast, presentEntities, 3);

  // 2) One motivation pass per chosen character (sequential — makeAIRequest captures per call).
  const intents: { name: string; text: string }[] = [];
  for (const member of chosen) {
    // Feed the character its own recent diary as private memory (Slice B) — only when enabled.
    const diary = characterDiaries ? collectCharacterDiary(fullMessageHistory, member.name, diaryMemoryEntries) : [];
    const text = await request(
      renderPromptTemplate(defaultCharacterPrompt, stageValues),
      [{ role: "user", content: buildCharacterUserMessage({ character: member, scene, action, diary }) }],
      "character", caps.character, signal,
    );
    if (signal.aborted) return { turnPlan: "", directorCandidates, adHocCandidates };
    if (text) intents.push({ name: member.name, text });
  }

  // 3) Storyboarder: consolidate the cast + intentions into this turn's plan.
  const plan = await request(
    renderPromptTemplate(defaultStoryboardPrompt, stageValues),
    [{ role: "user", content: buildStoryboardUserMessage({ recap: lastStory, scene, intents, overflow, action }) }],
    "storyboard", caps.storyboard, signal,
  );
  if (signal.aborted) return { turnPlan: "", directorCandidates, adHocCandidates };
  // Ground the narration in the director's scene + cast stances alongside the storyboard beats.
  return { turnPlan: buildStagedPlan({ scene, stances: cast, beats: plan || "" }), directorCandidates, adHocCandidates };
}
