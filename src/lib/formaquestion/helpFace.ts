/**
 * The face call: a fixed function of Formaquestion, so the AI picks the Mascot's face for its answer. It is
 * app-internal and no Tool: the help session runs it with the executor made here. It offers the rig's
 * enabled expressions by name.
 */
import type { ToolExecutor } from '@/lib/aiRequest/toolLoop';
import { parseToolArgs, type ToolCallResult } from '@/lib/tools/toolRunner';
import type { OfferedFunction } from '@/lib/tools/toolSchema';
import type { MascotLayer, MascotRig } from './mascot';

const FACE_PARAM = 'face';

/** The face call with no faces. The help session offers it with the rig's enabled expressions as the enum. */
export const HELP_FACE: OfferedFunction = {
  id: 'help-face',
  name: 'set_face',
  description: [
    'Purpose: Set the face you show beside this chat while the player reads your answer.',
    'Use when: You start an answer. Pick the face that matches the mood of your answer, then write the answer.',
    'Input: face — the name of one face from the list.',
    'Output: JSON with the face you set.',
  ].join('\n'),
  params: [{ name: FACE_PARAM, type: 'enum', description: 'The face that matches the mood of your answer.', required: true, options: [] }],
};

export interface FaceCall {
  fn: OfferedFunction;
  execute: ToolExecutor<OfferedFunction>;
  /** The layer ids of the faces the calls set since the last read, in call order. Reading empties the list. */
  takeFaces(): string[];
}

/** The rig's enabled expressions in list order. A repeated name keeps its first layer. */
function faces(rig: MascotRig): MascotLayer[] {
  const named = new Set<string>();
  return rig.layers.filter((row) => {
    if (row.kind !== 'expression' || !row.enabled || named.has(row.name)) return false;
    named.add(row.name);
    return true;
  });
}

/** The face call for one help question; null when the rig has no enabled expression. */
export function createFaceCall(rig: MascotRig): FaceCall | null {
  const offered = faces(rig);
  if (offered.length === 0) return null;
  const fn: OfferedFunction = {
    ...HELP_FACE,
    params: HELP_FACE.params.map((param) => ({ ...param, options: offered.map((row) => row.name) })),
  };
  const pending: string[] = [];
  const execute = async (_fn: OfferedFunction, argumentsText: string): Promise<ToolCallResult> => {
    const parsed = parseToolArgs(fn.params, argumentsText);
    if ('error' in parsed) return { text: JSON.stringify({ error: parsed.error }), failure: 'arguments' };
    const name = String(parsed.args[FACE_PARAM]);
    pending.push(offered.find((row) => row.name === name)!.id);
    return { text: JSON.stringify({ face: name }) };
  };
  return { fn, execute, takeFaces: () => pending.splice(0) };
}
