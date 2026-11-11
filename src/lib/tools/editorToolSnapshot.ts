import { authoredChipScene, type AuthoredWorld } from '@/lib/chipValues/authoredScene';
import { authoringStateOf } from '@/lib/openingState';
import type { StatCodeWorld } from '@/lib/statCodeTestRun';
import { buildToolSnapshot, type ToolSnapshot } from '@/lib/tools/toolSnapshot';

/** The snapshot an editor Tool run reads: the world as the editor holds it, at the authoring opening (Q210). */
export const editorToolSnapshot = (world: AuthoredWorld & StatCodeWorld): ToolSnapshot =>
  buildToolSnapshot(authoredChipScene(world), world.dictionaries ?? [], null, { state: authoringStateOf(world), authored: world });
