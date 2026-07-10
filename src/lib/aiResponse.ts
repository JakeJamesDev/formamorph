import json5 from 'json5';

/**
 * Extract the player-facing narration from a raw AI assistant message.
 * Tries lenient JSON5, then strict JSON, then a regex fallback; returns a safe
 * placeholder string if none parse. Reads the current `narration` field and falls back to the legacy
 * `game_text` (v1.2 / pre-release 2.0 saves). Pure — no logging or other side effects.
 */
export function parseNarration(content: string): string {
  const pick = (obj: { narration?: string; game_text?: string }): string =>
    obj.narration ?? obj.game_text ?? 'No narration available';
  try {
    const clean = (content || '').trim();
    try {
      return pick(json5.parse(clean));
    } catch {
      return pick(JSON.parse(clean));
    }
  } catch {
    const match = (content || '').match(/"(?:narration|game_text)"\s*:\s*"([^"]+)"/);
    if (match && match[1]) return match[1];
    return 'Error parsing message. Please check console for details.';
  }
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
