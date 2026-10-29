/**
 * The story so far as Formaquestion reads it in game (Q15, Q21): milestone memories and the recent verbatim
 * turns, assembled by the narration's own history builders. Memory notes stay out: the player's and the ones
 * scripts wrote share one list. Diaries never reach it, since a turn rides as its narration alone.
 */
import { buildBandedHistory, buildVerbatimHistory, type BandTurn } from '@/lib/turnBanding';
import { estimateTokens } from '@/lib/memoryUtils';
import type { ChatMessage } from '@/types';

/** The most characters of story one help request holds, apart from the docs and world budgets. */
export const HELP_STORY_CHAR_BUDGET = 12_000;

/** One recent turn as the story holds it. */
export interface StoryTurn {
  action: string;
  narration: string;
}

export interface StorySoFar {
  /** The block text the request sends. */
  text: string;
  /** The milestone memories, one per line; empty with memory digests off. */
  memories: string;
  /** The recent turns, oldest first. */
  turns: StoryTurn[];
}

export interface StorySoFarInput {
  /** The committed turns, with the player's memory edits and deletions applied. */
  turns: BandTurn[];
  memoryDigests: boolean;
  /** The narration's verbatim floor. */
  verbatimFloor: number;
  /** The turn ids milestone selection removes. */
  milestoneDrop: Set<string> | null;
  stripMedia: boolean;
  budget?: number;
}

/** The banding margin: the larger of 256 tokens and 5% of the window. */
const marginOf = (window: number) => Math.max(256, Math.round(window * 0.05));

/** The context window whose banding budget, after its margin, is `tokens`. */
function windowFor(tokens: number): number {
  let window = tokens + 256;
  while (window - marginOf(window) < tokens) window++;
  return window;
}

/** Action and narration pairs as story turns. */
function turnsOf(messages: readonly ChatMessage[]): StoryTurn[] {
  const turns: StoryTurn[] = [];
  for (let i = 0; i + 1 < messages.length; i += 2) turns.push({ action: messages[i].content, narration: messages[i + 1].content });
  return turns;
}

const turnText =({ action, narration }: StoryTurn) => `Player: ${action}\n${narration}`;

/** The block text: the memories, then the recent turns. */
function storyText(memories: string, turns: readonly StoryTurn[]): string {
  return [
    ...(memories ? [`Earlier events:\n${memories}`] : []),
    ...(turns.length ? [`Recent turns:\n${turns.map(turnText).join('\n\n')}`] : []),
  ].join('\n\n');
}

/** The story so far, held under `budget` characters: the oldest memory goes first, then the oldest turn. */
export function storySoFar({ turns, memoryDigests, verbatimFloor, milestoneDrop, stripMedia, budget = HELP_STORY_CHAR_BUDGET }: StorySoFarInput): StorySoFar {
  const window = windowFor(estimateTokens(budget));
  let recent: StoryTurn[];
  let memories: string[] = [];
  if (memoryDigests) {
    const banded = buildBandedHistory({
      turns, contextWindow: window, promptTokens: 0, maxTokens: 0, verbatimFloor, keywords: [], actionEntities: [],
      rehydrateCap: 0, milestoneDrop, recapPrompt: '', stripMedia,
    });
    // The recap rides as the first exchange whenever it holds a memory; its text is one memory per line.
    memories = banded.recap ? banded.recap.split('\n').slice(1) : [];
    recent = turnsOf(banded.messages.slice(banded.recap ? 2 : 0));
  } else {
    recent = turnsOf(buildVerbatimHistory(turns, window, 0, 0, [], '', stripMedia).messages);
  }
  // The builders count tokens by estimate, so the characters can still run over.
  while (storyText(memories.join('\n'), recent).length > budget && (memories.length > 0 || recent.length > 1)) {
    if (memories.length > 0) memories = memories.slice(1);
    else recent.shift();
  }
  const memoryText = memories.join('\n');
  return { text: storyText(memoryText, recent), memories: memoryText, turns: recent };
}
