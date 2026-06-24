import json5 from 'json5';

/**
 * Extract the player-facing `game_text` from a raw AI assistant message.
 * Tries lenient JSON5, then strict JSON, then a regex fallback; returns a safe
 * placeholder string if none parse. Pure — no logging or other side effects.
 */
export function parseGameText(content: string): string {
  try {
    const clean = (content || '').trim();
    try {
      return json5.parse(clean).game_text || 'No game text available';
    } catch {
      return JSON.parse(clean).game_text || 'No game text available';
    }
  } catch {
    const match = (content || '').match(/"game_text"\s*:\s*"([^"]+)"/);
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
 * it streams. (`\b` keeps "<thinker" from matching.)
 */
export function stripReasoningLive(text: string): string {
  const out = stripReasoning(text);
  const m = out.match(new RegExp(`<(?:${REASONING_ALT})\\b`, 'i'));
  return m ? out.slice(0, m.index) : out;
}
