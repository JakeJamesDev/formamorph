import type { ChatMessage } from '@/types';

/**
 * Request Anatomy: the labeled map of one assembled request.
 *
 * Every message a request sends is split into two kinds of **run** — *authored* text, owned by a
 * prompt-editor surface the player can type in, and *context*, which the app assembled around it. The runs
 * ride as a sidecar: a parallel structure aligned to the messages by index and offset, never a field on
 * {@link ChatMessage}. Nothing here can reach an endpoint, because nothing here is a message.
 *
 * A source names the *editor*, not the prompt: every pass has a System Prompt and most have a User Message,
 * so which prompt a run belongs to comes from the request's own type (see `promptJump`).
 *
 * Runs are built by joining labeled pieces ({@link tilePieces}), so a message's runs tile its content by
 * construction — the offsets cannot drift from the text they index.
 */

/** An editable prompt surface — one per editor a player can own text in. */
export type AnatomySource =
  | 'system-template'
  | 'user-template'
  | 'recap'
  | 'now'
  | 'recall'
  | 'direction';

/**
 * What produced a context run the app assembled. A run a chip produced is identified by its token instead
 * (see {@link AnatomyRun.chip}), so nothing here is a catch-all for "whatever a chip injected".
 */
export type ContextLabel =
  | 'condensed'
  | 'notes'
  | 'recalled'
  | 'past-action'
  | 'past-narration'
  | 'action'
  | 'mode-directive'
  | 'turn-plan'
  | 'narration'
  | 'character-brief'
  | 'diary-brief'
  | 'intents'
  | 'scene-cast';

/**
 * One run of a message's content. `source` is the editor whose field the run came out of — the text itself
 * when nothing else is set, or the template that placed the chip when `chip` is. `chip` is the affix-free
 * token, so the anatomy can draw the very chip the player placed. `contextLabel` names an assembled run.
 */
export interface AnatomyRun {
  start: number;
  end: number;
  source?: AnatomySource;
  chip?: string;
  contextLabel?: ContextLabel;
}

/**
 * One request's runs. `system` indexes the system prompt as the caller assembled it; `messages[i]` indexes
 * the caller's message `i`. Both are ordered and non-overlapping. An empty list means "unlabeled" — what a
 * capture taken before this feature, or a pass that builds no sidecar, leaves behind.
 */
export interface RequestAnatomy {
  system: AnatomyRun[];
  messages: AnatomyRun[][];
}

/** A labeled piece of text on its way into a run. `glue` merges into its neighbor's run instead of
 *  claiming one — assembly joins (the blank line between a recap and its now-line) belong to the text they
 *  join, not to a run of their own. */
export interface AnatomyPiece {
  text: string;
  source?: AnatomySource;
  chip?: string;
  contextLabel?: ContextLabel;
  glue?: boolean;
}

/** Content plus the runs that tile it exactly. */
export interface TiledRuns {
  content: string;
  runs: AnatomyRun[];
}

const sameLabel = (a: AnatomyPiece, b: AnatomyRun): boolean =>
  a.source === b.source && a.chip === b.chip && a.contextLabel === b.contextLabel;

/**
 * Join pieces into one string and the runs covering it. Empty pieces vanish, adjacent pieces sharing a
 * label merge into one run, and glue extends whichever run it sits against (the previous one, or the next
 * when it leads). The result always tiles: no gaps, no overlaps, `end` of the last run = content length.
 */
export function tilePieces(pieces: AnatomyPiece[]): TiledRuns {
  let content = '';
  const runs: AnatomyRun[] = [];
  // Glue waiting for a run to attach to, when it arrives before any labeled piece.
  let leading = '';
  for (const piece of pieces) {
    const text = leading + piece.text;
    leading = '';
    if (!text) continue;
    if (piece.glue && runs.length === 0) {
      // Nothing to extend yet — hold it and let the next labeled piece's run open on it.
      leading = text;
      continue;
    }
    const start = content.length;
    content += text;
    const last = runs[runs.length - 1];
    if (piece.glue) {
      last.end = content.length;
      continue;
    }
    if (last && sameLabel(piece, last)) last.end = content.length;
    else runs.push({
      start,
      end: content.length,
      ...(piece.source ? { source: piece.source } : {}),
      ...(piece.chip ? { chip: piece.chip } : {}),
      ...(piece.contextLabel ? { contextLabel: piece.contextLabel } : {}),
    });
  }
  // Trailing glue with nothing after it still has to land somewhere, or the runs stop short of the content.
  if (leading) {
    const start = content.length;
    content += leading;
    const last = runs[runs.length - 1];
    if (last) last.end = content.length;
    else runs.push({ start, end: content.length });
  }
  return { content, runs };
}

/** Drop trailing whitespace from a tiled result, clamping the runs to what survives (the same `trimEnd`
 *  the narration system prompt applies after rendering). */
export function trimEndTiled(tiled: TiledRuns): TiledRuns {
  const content = tiled.content.trimEnd();
  if (content.length === tiled.content.length) return tiled;
  const runs: AnatomyRun[] = [];
  for (const run of tiled.runs) {
    if (run.start >= content.length) break;
    runs.push({ ...run, end: Math.min(run.end, content.length) });
  }
  return { content, runs };
}

/** Whether `runs` cover `content` exactly — ordered, gapless, non-overlapping, ending at the end. The
 *  builders guarantee this; the tests assert it generically, and the viewer never assumes it (a capture
 *  from an older build has no runs at all). */
export function runsTile(content: string, runs: AnatomyRun[]): boolean {
  let at = 0;
  for (const run of runs) {
    if (run.start !== at || run.end < run.start) return false;
    at = run.end;
  }
  return at === content.length;
}

/** One message of a request, with its runs — the shape both anatomy surfaces render. */
export interface AnatomyBlock {
  role: ChatMessage['role'];
  content: string;
  runs: AnatomyRun[];
}

/**
 * Line up a captured request's wire messages with its sidecar. Wire message 0 is the system message the
 * request layer prepends, so it takes `anatomy.system`; the rest take `anatomy.messages` in order. A
 * message with no runs renders unlabeled, which is what a pre-anatomy capture gets for all of them.
 */
export function toAnatomyBlocks(messages: ChatMessage[], anatomy?: RequestAnatomy): AnatomyBlock[] {
  return messages.map((message, i) => ({
    role: message.role,
    content: message.content,
    runs: (i === 0 ? anatomy?.system : anatomy?.messages[i - 1]) ?? [],
  }));
}

/** What each editor surface is called, so a run points at the field that owns it. */
export const SOURCE_LABELS: Record<AnatomySource, string> = {
  'system-template': 'System Prompt',
  'user-template': 'User Message',
  recap: 'Recap Message',
  now: 'Now Message',
  recall: 'Recall Message',
  direction: 'Direction Message',
};

/** What each assembled run is called on its chip — short and title-case, so a chip stays pill-sized. */
export const CONTEXT_LABELS: Record<ContextLabel, string> = {
  condensed: 'Memory Recap',
  notes: 'Notes',
  recalled: 'Recalled Turn',
  'past-action': 'Past Action',
  'past-narration': 'Past Narration',
  action: 'Your Action',
  'mode-directive': 'Mode Directive',
  'turn-plan': 'Turn Plan',
  narration: 'Narration',
  'character-brief': 'Character Brief',
  'diary-brief': 'Diary Brief',
  intents: 'Intents',
  'scene-cast': 'Scene Cast',
};

/** What each assembled run is, in the player's own words — the chip's tooltip. */
export const CONTEXT_HINTS: Record<ContextLabel, string> = {
  condensed: 'older turns, condensed by Memory Summaries',
  notes: 'your own memory notes, as you wrote them',
  recalled: 'the turn Scene Recall brought back, word-for-word',
  'past-action': 'your action on a recent turn',
  'past-narration': 'the narration that answered it, word-for-word',
  action: 'your action, as you typed it',
  'mode-directive': 'the instruction your Thinking mode adds',
  'turn-plan': 'the plan this turn was given before it was written',
  narration: 'the narration this turn produced',
  'character-brief': 'who this character is, what they remember, and where the scene left them',
  'diary-brief': 'who is writing, and the turn they are writing about',
  intents: 'what each character said they want this turn',
  'scene-cast': 'who is in frame for this picture',
};
