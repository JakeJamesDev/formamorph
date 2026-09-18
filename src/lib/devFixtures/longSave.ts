import { serializeTurnContent } from '@/lib/turnDigest';
import type { ChatMessage, GameState, SaveObject } from '@/types';

/**
 * A long save built from a short one: `turns` turns of real narration, cycled, each with its own turn id,
 * snapshot, and digest, and a scene image on every `imageEvery`-th turn. The base save gives the world's
 * state; its history is replaced.
 */
export function buildLongSave(base: SaveObject, { turns, narrations, images, imageEvery }: {
  turns: number;
  narrations: string[];
  images: string[];
  imageEvery: number;
}): SaveObject {
  const history: ChatMessage[] = [];
  const sceneImages: Record<string, string[]> = {};
  const snapshot: GameState = { ...base.currentState, fullMessageHistory: [] };
  const stateHistory: GameState[] = [];
  for (let i = 0; i < turns; i++) {
    const narration = narrations[i % narrations.length];
    const turnId = `long-turn-${i + 1}`;
    history.push({ role: 'user', content: i === 0 ? 'START GAME' : `I press on, step ${i + 1}.` });
    history.push({
      role: 'assistant',
      content: serializeTurnContent({
        narration, choices: [], stat_changes: [], turnId, entities: [], summary: narration.split('. ')[0],
      }),
    });
    if (i % imageEvery === 0) sceneImages[turnId] = [images[(i / imageEvery) % images.length]];
    stateHistory.push({ ...snapshot, gameplayText: narration, previousStateIndex: i === 0 ? null : i - 1 });
  }
  return {
    ...base,
    currentState: { ...snapshot, gameplayText: narrations[(turns - 1) % narrations.length], previousStateIndex: turns - 2 },
    stateHistory,
    messageHistory: history,
    sceneImages,
  };
}
