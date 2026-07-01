import type { ChatMessage } from '@/types';

/**
 * Approximate the character cost of a chat history, matching what getTrimmedMessageHistory
 * actually sends: assistant messages count only their narration, not the choices/stat_changes
 * JSON wrapper. Pair with `estimateTokens` to gauge the history's token cost.
 */
export function estimateHistoryChars(history: ChatMessage[]): number {
  let total = 0;
  for (const msg of history) {
    if (!msg || !msg.content) continue;
    if (msg.role === 'assistant') {
      try {
        const parsed = JSON.parse(msg.content);
        total += (parsed.narration ?? parsed.game_text ?? '').length;
      } catch {
        total += msg.content.length;
      }
    } else {
      total += msg.content.length;
    }
  }
  return total;
}

/** Rough token estimate from a character count (~4 chars/token). For display gauges only. */
export function estimateTokens(chars: number): number {
  return Math.ceil(Math.max(0, chars) / 4);
}
