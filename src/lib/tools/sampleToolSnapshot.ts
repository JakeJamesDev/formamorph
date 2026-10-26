/**
 * The Tool Snapshot of the sample world, for trying a Tool with no world open. Apart from `toolSnapshot`, so a reader
 * of the empty snapshot never loads the opening fold and the sandbox behind it.
 */
import type { ChatMessage } from '@/types';
import type { ChipScene } from '@/lib/chipValues/chipScene';
import { sampleChipScene, sampleDictionaries, samplePersona, sampleWorld } from '@/lib/chipValues/sampleScene';
import { serializeTurnContent } from '@/lib/turnDigest';
import { buildMemoryLedger, closedTurns, scriptMemories } from '@/lib/memoryView';
import { NO_OPENING_PICKS, openingStateOf } from '@/lib/openingState';
import { SAMPLE_ACTION } from '@/lib/scriptTestSamples';
import { EMPTY_REPLY } from '@/lib/statCodeExecutor';
import { buildToolSnapshot, type ToolScriptSource, type ToolSnapshot } from './toolSnapshot';

/** The sample world's past turns: each one a digest, some with a diary entry. */
function sampleHistory(): ChatMessage[] {
  const turns: { summary: string; diaries?: Record<string, string> }[] = [
    { summary: 'Wren sold Bell a lantern of salt glass at the Landing.' },
    { summary: 'Harrow warned Wren that the Long Ebb would strand the boats.', diaries: { Bell: 'Wren asked a fair price for the lantern. I owe Wren a favor.' } },
    { summary: 'A gull stole bread from the Boathouse.', diaries: { Wren: 'nothing notable' } },
  ];
  return turns.flatMap(({ summary, diaries }, i) => [
    { role: 'user', content: 'Look around.' },
    { role: 'assistant', content: serializeTurnContent({ ...EMPTY_REPLY, stat_changes: [], turnId: `sample-${i + 1}`, summary, diaries }) },
  ]);
}

/** The sample world as a game in progress (Q44): its persona, who is in the scene, notes, clock and memories, as the
 *  sample scene has them. */
function sampleScriptSource(scene: ChipScene, history: ChatMessage[]): ToolScriptSource {
  const persona = samplePersona();
  const opening = openingStateOf(sampleWorld(), NO_OPENING_PICKS, { ref: { source: 'library', entityId: persona.id }, libraryEntity: persona });
  const ledger = buildMemoryLedger({ history, overrides: {}, pins: {}, selection: null, verbatimFloor: 0 });
  return {
    state: {
      ...opening, notes: scene.notes,
      ownerTraits: { ...opening.ownerTraits, inSceneIds: scene.inSceneIds },
      clock: { deltaHours: 0, elapsedHours: scene.time?.elapsed ?? 0 },
      memories: scriptMemories(ledger, history),
      // An in-turn Tool call: the sample turns closed, the next one in progress, its reply not yet in.
      turn: { action: SAMPLE_ACTION, number: closedTurns(history) + 1, ...EMPTY_REPLY },
    },
    authored: null,
  };
}

/** The Tool Snapshot of the sample world, for trying a Tool with no world open. */
export const sampleToolSnapshot = (): ToolSnapshot => {
  const scene = sampleChipScene();
  const history = sampleHistory();
  return buildToolSnapshot(scene, sampleDictionaries(), { history, overrides: null, verbatimFloor: 0 }, sampleScriptSource(scene, history));
};
