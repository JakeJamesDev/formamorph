import type { ChatMessage } from '@/types';
import { parseTurnContent } from './turnDigest';

/**
 * The player-facing narration of a raw assistant message, or null when none can be read.
 * Reads through `parseTurnContent` (strict JSON, then json5, `game_text` normalized), then a regex
 * for truncated content. Pure.
 */
export function narrationOf(content: string): string | null {
  const narration = parseTurnContent(content)?.narration;
  if (typeof narration === 'string') return narration;
  const match = (content || '').match(/"(?:narration|game_text)"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

/** The exported story: every readable assistant narration, reasoning stripped, broken turns left out. Pure. */
export function storyText(history: ChatMessage[]): string {
  return history
    .filter((m) => m.role === 'assistant')
    .map((m) => stripReasoning(narrationOf(m.content) ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}

// Tags reasoning models (or our inline-thinking directive) use to wrap private scratchpad.
const REASONING_TAGS = ['think', 'thinking', 'reasoning', 'thought'];
const REASONING_ALT = REASONING_TAGS.join('|');

/**
 * Remove complete reasoning blocks (`<think>…</think>` and the other known tags) from model
 * output so a model's private scratchpad never reaches the narration. Case-insensitive,
 * spans newlines. Pure.
 */
export function stripReasoning(text: string): string {
  let out = text || '';
  for (const tag of REASONING_TAGS) {
    out = out.replace(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'gi'), '');
  }
  return out;
}

/**
 * Streaming-safe variant: strips complete blocks, then truncates at a trailing opening tag
 * whose closing tag has not arrived yet — so an in-progress reasoning block isn't shown while
 * it streams. (`\b` keeps `<thinker` from matching.)
 */
export function stripReasoningLive(text: string): string {
  const out = stripReasoning(text);
  const m = out.match(new RegExp(`<(?:${REASONING_ALT})\\b`, 'i'));
  return m ? out.slice(0, m.index) : out;
}

/**
 * Where the answer starts: past a leading reasoning block, 0 when the text opens with none, or null while
 * that block has not closed. Pure.
 */
export function answerStart(text: string): number | null {
  const open = text.match(new RegExp(`^\\s*<(${REASONING_ALT})(?:\\s[^>]*)?>`, 'i'));
  if (!open) return 0;
  const close = new RegExp(`</${open[1]}>`, 'i').exec(text.slice(open[0].length));
  return close ? open[0].length + close.index + close[0].length : null;
}

/**
 * The inverse of `stripReasoning`: the concatenated text *inside* every complete reasoning block
 * (the model's private scratchpad), for the reasoning-block UI. Empty when there's no inline block
 * (a native reasoning model streams its scratchpad in a separate field, captured separately). Pure.
 */
export function extractReasoning(text: string): string {
  const blocks: string[] = [];
  for (const tag of REASONING_TAGS) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text || ''))) blocks.push(m[1]);
  }
  return blocks.join('\n\n').trim();
}

/**
 * Streaming variant: the completed blocks plus the tail of an in-progress block whose closing tag
 * hasn't arrived — so the live reasoning aside fills in as the model thinks. Pure.
 */
export function extractReasoningLive(text: string): string {
  const complete = extractReasoning(text);
  // A trailing opening tag with no closing tag after it → the still-streaming block's partial body.
  const open = (text || '').match(new RegExp(`<(?:${REASONING_ALT})\\b[^>]*>(?![\\s\\S]*</(?:${REASONING_ALT})>)`, 'i'));
  const partial = open ? (text || '').slice(open.index! + open[0].length) : '';
  return [complete, partial.trim()].filter(Boolean).join('\n\n').trim();
}
