// What scripts told and showed the player with `player.tell` and `player.show`, by turn id (Q16, Q53). Held beside
// the history like scene images, so no request ever carries them (Q23) and a rolled-back turn drops its own.

import type { ChatMessage, ScriptTiming } from '@/types';
import { noticeHost, SHOW_SIZES, SHOW_WRAPS, type ScriptPromptHost, type ShowSize, type ShowWrap } from './scriptPrompts';
import { parseTurnContent, pruneTurnMap } from './turnDigest';

/** One tell, with the timing of the script that made it, so a replay replaces only its own (Q54). */
export interface ScriptTextTell {
  text: string;
  timing: ScriptTiming;
}

/** One shown image by Media List id. `sentence` anchors a During AI Output image to its sentence (Q6). */
export interface ScriptImageTell {
  image: string;
  size: ShowSize;
  wrap: ShowWrap;
  sentence?: number;
  timing: ScriptTiming;
}

/** A turn's tell list holds text and images in one call order (Q6). */
export type ScriptTell = ScriptTextTell | ScriptImageTell;

export const isImageTell = (tell: ScriptTell): tell is ScriptImageTell => 'image' in tell;

/** A turn's tells by turn id, in call order. */
export type TellMap = Record<string, ScriptTell[]>;

/** The timings a stats re-roll runs again. During AI Output never tells (Q45). */
export const REROLLED_TIMINGS: readonly ScriptTiming[] = ['start', 'before', 'after'];

const TIMINGS: readonly ScriptTiming[] = ['before', 'after', 'output', 'start', 'switch'];

/** The timings whose images show above the narration (Q11). */
const ABOVE_TIMINGS: readonly ScriptTiming[] = ['start', 'before'];

const NO_TELLS: readonly ScriptTell[] = [];

/** No During AI Output images, as one shared value. */
export const NO_SHOWS: readonly ScriptImageTell[] = [];

/** A turn's tells, in call order. */
export const turnTells = (map: TellMap, turnId: string | undefined): readonly ScriptTell[] =>
  (turnId && map[turnId]) || NO_TELLS;

/** A turn's tells, with the running reply's During AI Output images after them while the turn is the live one.
 *  Those images join the saved list only when the reply lands (Q4). */
export const liveTurnTells = (
  map: TellMap, turnId: string | undefined, liveTurnId: string | undefined, liveShows: readonly ScriptImageTell[],
): readonly ScriptTell[] => (turnId && turnId === liveTurnId && liveShows.length ? [...turnTells(map, turnId), ...liveShows] : turnTells(map, turnId));

/** Where a turn's tells render: images above the narration, images inside it, and the rest below in call order. */
export interface TellPlacement {
  above: readonly ScriptImageTell[];
  inline: readonly ScriptImageTell[];
  below: readonly ScriptTell[];
}

/** A turn's tells split by where they render (Q17). Text tells always go below. */
export function placeTells(tells: readonly ScriptTell[]): TellPlacement {
  const above: ScriptImageTell[] = [];
  const inline: ScriptImageTell[] = [];
  const below: ScriptTell[] = [];
  for (const tell of tells) {
    if (!isImageTell(tell)) below.push(tell);
    else if (ABOVE_TIMINGS.includes(tell.timing)) above.push(tell);
    else if (tell.timing === 'output') inline.push(tell);
    else below.push(tell);
  }
  return { above, inline, below };
}

/** A play run's host: tells and shows recorded with the run's timing, always as blocks (Q20). */
export const tellHost = (
  asks: ScriptPromptHost, timing: ScriptTiming, record: (tell: ScriptTell) => void, onToast: (text: string) => void,
): ScriptPromptHost => noticeHost(asks, {
  onTell: (text) => { record({ text, timing }); },
  onToast,
  onShow: ({ mediaId, size }) => { record({ image: mediaId, size, wrap: 'block', timing }); },
});

/** The map with one more tell on a turn. */
export const addTell = (map: TellMap, turnId: string, tell: ScriptTell): TellMap =>
  ({ ...map, [turnId]: [...(map[turnId] ?? []), tell] });

/** The map with a turn's tells set to `tells`. None leaves no entry. */
export function setTurnTells(map: TellMap, turnId: string, tells: readonly ScriptTell[]): TellMap {
  if (tells.length) return { ...map, [turnId]: [...tells] };
  if (!(turnId in map)) return map;
  const { [turnId]: _dropped, ...rest } = map;
  return rest;
}

/** The map without a turn's tells from `timings`, which a replay is about to make again. */
export const withoutTimings = (map: TellMap, turnId: string, timings: readonly ScriptTiming[]): TellMap =>
  setTurnTells(map, turnId, turnTells(map, turnId).filter((tell) => !timings.includes(tell.timing)));

/** The id of the newest turn in the history. Undefined before the first narration. */
export const latestTurnId = (history: readonly ChatMessage[]): string | undefined => {
  const last = history.findLast((message) => message.role === 'assistant');
  return last ? parseTurnContent(last.content)?.turnId : undefined;
};

/** Forget the tells of turns no longer in the history: a failed, rolled-back or regenerated turn. */
export const pruneTells = (map: TellMap, history: ChatMessage[]): TellMap => pruneTurnMap(map, history);

/** A well-formed saved tell, rebuilt with only its own fields. Anything else is undefined. */
function restoredTell(value: unknown): ScriptTell | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const tell = value as Record<string, unknown>;
  const timing = tell.timing as ScriptTiming;
  if (!TIMINGS.includes(timing)) return undefined;
  if (typeof tell.text === 'string') return { text: tell.text, timing };
  const { image, size, wrap, sentence } = tell;
  if (typeof image !== 'string' || !SHOW_SIZES.includes(size as ShowSize) || !SHOW_WRAPS.includes(wrap as ShowWrap)) return undefined;
  if (sentence !== undefined && !(typeof sentence === 'number' && Number.isInteger(sentence) && sentence >= 0)) return undefined;
  return { image, size: size as ShowSize, wrap: wrap as ShowWrap, ...(sentence !== undefined && { sentence }), timing };
}

/** The map a save holds, read back. A save is a file the player can edit, so only well-formed tells stay. */
export function restoreTells(raw: unknown): TellMap {
  const restored: TellMap = {};
  if (!raw || typeof raw !== 'object') return restored;
  for (const [turnId, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const tells = list.flatMap((value) => restoredTell(value) ?? []);
    if (tells.length) restored[turnId] = tells;
  }
  return restored;
}
