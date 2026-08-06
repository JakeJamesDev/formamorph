import type { ChatMessage } from '@/types';
import { parseTurnContent } from '@/lib/turnDigest';
import { sameCharacterName } from '@/lib/entityMatch';
import { vectorKey, cosineSimilarity } from '@/lib/memoryRelevance';
import { DISCOVER_NAME_LABEL } from '@/lib/runtimeCharacters';

/**
 * Rebuilding a runtime-discovered character's description from everything the story has shown of them
 * since, rather than the single passage that introduced them (see runtimeCharacters.ts for how that
 * first description is made). Pure and deterministic: the caller supplies the history, the diary tail
 * and any embeddings, and gets back the exact user message to send.
 */

/** Labels the regen user message uses; the name label is shared with discovery. Passed to
 *  `cleanDiscoveredDescription` so an echoed label is cut from the response the same way. */
export const REGEN_FIRST_LABEL = 'The passage they first appeared in:';
export const REGEN_SINCE_LABEL = 'What the story has shown of them since:';
export const REGEN_LABELS = [REGEN_FIRST_LABEL, REGEN_SINCE_LABEL];

/** Most supplemental passages one regen carries, on top of the first-appearance passage. */
export const REGEN_MAX_PASSAGES = 8;
/** Character budget for those passages — roughly 3k tokens, so a long playthrough can't blow a small
 *  model's context. Newest passages win the budget; older ones are dropped silently. */
export const REGEN_MAX_CHARS = 12_000;

/** Which supplemental source feeds a regeneration, in the order they are preferred. */
export type RegenSource = 'semantic' | 'diary' | 'digests' | 'prose';

/** The memory settings that decide the supplemental source. Exactly one source is ever used. */
export interface RegenSourceSettings {
  semanticMemory: boolean;
  characterDiaries: boolean;
  memoryDigests: boolean;
}

/**
 * The preferred supplemental source for the current settings. Only one source rides — stacking a
 * character's diary onto their digests onto their raw prose says the same thing three ways and
 * crowds out the passage that actually introduced them. `prose` is always available, so this never
 * fails; a tier that turns out to be empty falls through inside `buildRegenContext`.
 */
export function selectRegenSource(settings: RegenSourceSettings): RegenSource {
  if (settings.semanticMemory) return 'semantic';
  if (settings.characterDiaries) return 'diary';
  if (settings.memoryDigests) return 'digests';
  return 'prose';
}

/** One committed turn this character took part in. */
export interface AppearanceTurn {
  turnId: string;
  narration: string;
  summary?: string;
}

/** The narration of the turn with this id, or '' when it is no longer in the history (rolled back). */
export function findTurnNarration(history: ChatMessage[], turnId: string | undefined): string {
  if (!turnId) return '';
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const parsed = parseTurnContent(message.content);
    if (parsed?.turnId === turnId) return parsed.narration?.trim() ?? '';
  }
  return '';
}

/**
 * Every committed turn whose participants include this character, chronological. Matching is
 * `sameCharacterName` so a variant of the coined name ("the mouse" vs "Grey Mouse") still counts as
 * an appearance. `excludeTurnId` drops the introducing turn, which rides the message separately.
 */
export function collectAppearances(
  history: ChatMessage[],
  name: string,
  excludeTurnId?: string,
): AppearanceTurn[] {
  const out: AppearanceTurn[] = [];
  for (const message of history) {
    if (message.role !== 'assistant') continue;
    const parsed = parseTurnContent(message.content);
    if (!parsed?.turnId || parsed.turnId === excludeTurnId) continue;
    if (!parsed.narration?.trim() || !parsed.entities?.length) continue;
    if (!parsed.entities.some((n) => sameCharacterName(n, name))) continue;
    out.push({ turnId: parsed.turnId, narration: parsed.narration.trim(), summary: parsed.summary?.trim() || undefined });
  }
  return out;
}

/**
 * Trim a chronological list to what fits the passage and character budgets, keeping the NEWEST items
 * and returning them chronological again. Recency wins because a description is meant to read as who
 * the character is now; the introducing passage carries the origin and is never part of this budget.
 */
export function capChronological<T>(items: T[], text: (item: T) => string, maxCount = REGEN_MAX_PASSAGES, maxChars = REGEN_MAX_CHARS): T[] {
  const kept: T[] = [];
  let chars = 0;
  for (let i = items.length - 1; i >= 0 && kept.length < maxCount; i--) {
    const length = text(items[i]).length;
    if (kept.length > 0 && chars + length > maxChars) break;
    kept.push(items[i]);
    chars += length;
  }
  return kept.reverse();
}

/**
 * Rank a character's digested appearances by similarity to the query and keep the closest, newest
 * first order restored. Appearances without a digest or without a cached vector simply can't be
 * ranked (per-entry fail-open). Returns `null` when nothing was rankable, so the caller falls to the
 * next source rather than sending an empty section.
 */
export function selectSemanticAppearances(
  appearances: AppearanceTurn[],
  queryVec: Float32Array,
  vectorsByKey: Map<string, Float32Array>,
  max = REGEN_MAX_PASSAGES,
): AppearanceTurn[] | null {
  const scored = appearances
    .map((turn, index) => ({ turn, index, vec: turn.summary ? vectorsByKey.get(vectorKey(turn.summary)) : undefined }))
    .filter((c): c is { turn: AppearanceTurn; index: number; vec: Float32Array } => !!c.vec)
    .map((c) => ({ ...c, sim: cosineSimilarity(queryVec, c.vec) }));
  if (scored.length === 0) return null;
  return scored
    .sort((a, b) => b.sim - a.sim)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((c) => c.turn);
}

/** Everything `buildRegenContext` needs. `diaryEntries` and `semantic` are only read by their own tier. */
export interface RegenContextInput {
  history: ChatMessage[];
  name: string;
  /** The turn that introduced the character (`DiscoveredEntity.sourceTurnId`). */
  sourceTurnId?: string;
  source: RegenSource;
  /** The character's diary entries, chronological, as `collectCharacterDiary` returns them. */
  diaryEntries?: string[];
  semantic?: { queryVec: Float32Array; vectorsByKey: Map<string, Float32Array> } | null;
}

/** The assembled context for one regeneration. */
export interface RegenContext {
  /** The source that actually produced `supplemental` — may be lower than the one asked for. */
  source: RegenSource;
  /** The introducing passage, or '' when that turn is gone from the history. */
  firstPassage: string;
  /** The supplemental texts, chronological. Empty when the character has never appeared since. */
  supplemental: string[];
}

/**
 * Assemble the regeneration context: the introducing passage plus supplemental texts from a single
 * source. A source that yields nothing falls through to the next one down, so an enabled-but-empty
 * feature (semantic memory with no embedded digests yet) degrades to raw prose instead of sending a
 * character with no history.
 */
export function buildRegenContext(input: RegenContextInput): RegenContext {
  const { history, name, sourceTurnId, source } = input;
  const firstPassage = findTurnNarration(history, sourceTurnId);
  const appearances = collectAppearances(history, name, sourceTurnId);

  const tiers: RegenSource[] = ['semantic', 'diary', 'digests', 'prose'];
  for (const tier of tiers.slice(tiers.indexOf(source))) {
    const supplemental = supplementalFor(tier, appearances, input);
    if (supplemental.length > 0) return { source: tier, firstPassage, supplemental };
  }
  return { source: 'prose', firstPassage, supplemental: [] };
}

function supplementalFor(tier: RegenSource, appearances: AppearanceTurn[], input: RegenContextInput): string[] {
  switch (tier) {
    case 'semantic': {
      if (!input.semantic) return [];
      const picked = selectSemanticAppearances(appearances, input.semantic.queryVec, input.semantic.vectorsByKey);
      return picked ? picked.map((t) => t.summary!).filter(Boolean) : [];
    }
    case 'diary':
      return capChronological(input.diaryEntries ?? [], (e) => e);
    case 'digests':
      return capChronological(appearances.filter((t) => t.summary), (t) => t.summary!).map((t) => t.summary!);
    case 'prose':
      return capChronological(appearances, (t) => t.narration).map((t) => t.narration);
  }
}

/**
 * The user message for a regeneration. The "since" section is omitted entirely when the character has
 * no later appearances, leaving exactly the original discovery message shape — a bare retry.
 */
export function buildRegenUserMessage(name: string, context: RegenContext): string {
  const parts = [`${DISCOVER_NAME_LABEL} ${name.trim()}`];
  if (context.firstPassage) parts.push(`${REGEN_FIRST_LABEL}\n${context.firstPassage}`);
  if (context.supplemental.length > 0) parts.push(`${REGEN_SINCE_LABEL}\n${context.supplemental.join('\n\n')}`);
  return parts.join('\n\n');
}
