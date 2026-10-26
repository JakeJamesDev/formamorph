/**
 * What an editor run reads where play would hand a script its moment: the sentence a During AI Output script
 * rewrites, and the trait a When a Trait Switches script fires on (Q49). Test Code and the Test Bench share them.
 */

import type { WorldOverview } from '@/types';
import { EMPTY_REPLY, type NarrationInput, type SandboxTrait, type SandboxTurn, type SwitchedTrait } from './statCodeExecutor';
import { heaviestWorldOpening } from './openings';
import type { RunTiming } from './statCodeTiming';

/** The action an editor run reads as the player's. */
export const SAMPLE_ACTION = 'Look around.';

/** The page an After the AI editor run reads. */
export const SAMPLE_PAGE = 'The door creaks open onto a dim, quiet hall.';

/** The choices an After the AI editor run reads. */
export const SAMPLE_CHOICES: readonly string[] = ['Step inside.', 'Call out.', 'Walk away.'];

/** The `turn` an editor run reads: At Game Start opens on the world's own opening at turn 1, a narration one
 *  reading empty; every other timing reads the sample action at turn 2. Only After the AI reads a page and choices. */
export const sampleTurn = (overview: WorldOverview | null | undefined, timing: RunTiming): SandboxTurn => {
  if (timing === 'start') return { action: heaviestWorldOpening(overview)?.text.trim() ?? '', number: 1, ...EMPTY_REPLY };
  return timing === 'after'
    ? { action: SAMPLE_ACTION, number: 2, narration: SAMPLE_PAGE, choices: SAMPLE_CHOICES }
    : { action: SAMPLE_ACTION, number: 2, ...EMPTY_REPLY };
};

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
