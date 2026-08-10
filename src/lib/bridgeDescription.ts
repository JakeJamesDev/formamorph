// One-shot, non-streaming description bridging for the world editor's player/AI description buttons.
// Same request shape as `summarize.ts`; the direction picks which description is being written.

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
      + 'Write 2 to 4 sentences, shorter than the note. Output only the description.'
    : `You are the game's continuity writer, expanding a player-facing blurb about ${noun} into the reference `
      + 'note the narrator uses. '
      + `Write plain declarative prose covering ${facets}, plus behavior and relationships the blurb implies. `
      + 'Stay consistent with every fact the blurb states, and keep additions to what it already suggests. '
      + 'Write 3 to 6 sentences. Output only the note.';
}

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

// A rewrite that must stay faithful to the source, so it sits low - but both directions are prose the
// author will read, and 0 gives flat, near-identical phrasing on our tiers.
const BRIDGE_TEMPERATURE = 0.6;

/** Room for the longest direction (`aiDesc`, up to 6 sentences) with slack for a long subject. */
const BRIDGE_MAX_TOKENS = 400;

/**
 * Rewrite `text` into the other description via the configured chat-completions endpoint. Throws on a
 * non-OK response or an empty/unparseable result; the caller surfaces failures (and ignores `AbortError`).
 */
export async function bridgeDescription(
  text: string,
  direction: BridgeDirection,
  kind: BridgeKind,
  opts: { endpointUrl: string; apiToken: string; modelName: string; signal?: AbortSignal },
): Promise<string> {
  const res = await fetch(opts.endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.apiToken ? { Authorization: `Bearer ${opts.apiToken}` } : {}),
    },
    body: JSON.stringify({
      model: opts.modelName,
      messages: [
        { role: 'system', content: bridgePrompt(direction, kind) },
        { role: 'user', content: text },
      ],
      temperature: BRIDGE_TEMPERATURE,
      max_tokens: BRIDGE_MAX_TOKENS,
      stream: false,
    }),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as ChatCompletion;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('Empty description response');
  return content.trim();
}
