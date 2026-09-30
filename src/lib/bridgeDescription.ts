// One-shot description bridging for the world editor's player/AI description buttons.
// The direction picks which description is being written.

import type { AiSettingsSnapshot } from '@/lib/aiRequest/aiRequestSpec';
import { requestAiText } from '@/lib/aiRequest/aiText';

/** Which description is being written, and therefore which one is the source. */
export type BridgeDirection = 'playerDesc' | 'aiDesc';

/** The subject the description is about — entities and locations want different facets covered. */
export type BridgeKind = 'character' | 'location';

const SUBJECT: Record<BridgeKind, { noun: string; facets: string }> = {
  character: {
    noun: 'this character',
    facets: 'appearance, manner, and how they carry themselves',
  },
  location: {
    noun: 'this place',
    facets: 'layout, atmosphere, and what stands out on arrival',
  },
};

/**
 * The prompt for one direction. Player-facing text is what the game shows the player, so it stays
 * evocative and keeps the author's private notes out. AI-facing text is reference material the
 * narrator draws on, so it stays plain and factual.
 */
export function bridgePrompt(direction: BridgeDirection, kind: BridgeKind): string {
  const { noun, facets } = SUBJECT[kind];
  return direction === 'playerDesc'
    ? `You are the game's writer, turning a private reference note about ${noun} into the description a player reads. `
      + `Write flowing prose covering ${facets}, in the same voice a game would use to introduce ${noun}. `
      + 'Keep only what a player would learn by looking. Details the note holds back — secrets, plans, '
      + 'private history, author bookkeeping — stay out. '
      + 'Write 2 to 4 sentences, shorter than the note. Open on the description itself, with no title, label or heading above it.'
    : `You are the game's continuity writer, expanding a player-facing blurb about ${noun} into the reference `
      + 'the narrator uses. '
      + `Write plain declarative prose covering ${facets}, plus behavior and relationships the blurb implies. `
      + 'Stay consistent with every fact the blurb states, and keep additions to what it already suggests. '
      + 'Write 3 to 6 sentences. Open on the description itself, with no title, label or heading above it.';
}

/** Room for the longest direction (`aiDesc`, up to 6 sentences) with slack for a long subject. */
const BRIDGE_MAX_TOKENS = 400;

/**
 * Rewrite `text` into the other description through the request pipeline. Throws on a failed or empty
 * result; the caller surfaces failures (and ignores `AbortError`).
 */
export async function bridgeDescription(
  text: string,
  direction: BridgeDirection,
  kind: BridgeKind,
  opts: { snapshot: AiSettingsSnapshot; signal?: AbortSignal },
): Promise<string> {
  return requestAiText(opts.snapshot, {
    systemPrompt: bridgePrompt(direction, kind),
    messages: [{ role: 'user', content: text }],
    requestType: 'descriptionBridge',
    maxTokensOverride: BRIDGE_MAX_TOKENS,
  }, { signal: opts.signal });
}
