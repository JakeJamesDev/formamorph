import { serializeTurnContent } from '@/lib/turnDigest';
import type { AITurnResult, ChatMessage } from '@/types';

/** One played turn as the history holds it: the action, then the turn with its memory and diary fields. */
export function diaryTurn(
  turnId: string,
  fields: Pick<AITurnResult, 'summary' | 'diaries' | 'codeDiaries'>,
): ChatMessage[] {
  return [
    { role: 'user', content: 'Act.' },
    {
      role: 'assistant',
      content: serializeTurnContent({ narration: 'Something happens.', choices: [], stat_changes: [], turnId, ...fields }),
    },
  ];
}
