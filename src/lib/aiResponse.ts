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
