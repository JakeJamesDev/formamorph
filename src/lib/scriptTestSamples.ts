/**
 * What an editor run reads where play would hand a script its moment: the sentence a During AI Output script
 * rewrites, and the trait a When a Trait Switches script fires on (Q49). Test Code and the Test Bench share them.
 */

import type { NarrationInput, SandboxTrait, SwitchedTrait } from './statCodeExecutor';

/** The sentence the Test Bench hands each During AI Output script. */
export const SAMPLE_SENTENCE = 'The door opens.';

/** The `narration` of a run on one sentence: the first of its reply, with nothing before it. */
export const sampleNarration = (sentence: string): NarrationInput => ({ sentence, full: sentence, index: 0, sent: [], buffered: [] });

/**
 * The trait a switch run fires on, switched on: a trait script's own trait under `owner`, else the world's
 * first trait in tree order, else a blank one. `firstId` is that first trait's id.
 */
export function sampleSwitchedTrait(
  entries: readonly SandboxTrait[], firstId: string | undefined, own?: { entry: SandboxTrait; owner: string },
): SwitchedTrait {
  if (own) return { ...own.entry, enabled: true, owner: own.owner };
  const first = firstId === undefined ? undefined : entries.find((entry) => entry.id === firstId);
  return first ? { ...first, enabled: true, owner: '' } : { name: '', enabled: true, acquired: true, owner: '' };
}
