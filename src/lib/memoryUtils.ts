import type { ChatMessage } from '@/types';

/**
 * Approximate the "memory" (character) cost of a chat history, matching what
 * getTrimmedMessageHistory actually sends: assistant messages count only their
 * `game_text`, not the choices/stat_changes JSON wrapper. The Max Memory setting
 * (aiMessageLimit) is measured in these same characters.
 */
export function estimateHistoryChars(history: ChatMessage[]): number {
  let total = 0;
  for (const msg of history) {
    if (!msg || !msg.content) continue;
    if (msg.role === 'assistant') {
      try {
        const parsed = JSON.parse(msg.content);
        total += (parsed.game_text || '').length;
      } catch {
        total += msg.content.length;
      }
    } else {
      total += msg.content.length;
    }
  }
  return total;
}
