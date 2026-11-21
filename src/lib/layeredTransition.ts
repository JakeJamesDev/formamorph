// What a change between two resolved stacks plays: which Layers fade, which swap at the dip, and which tuning squashes the picture.

import type { MascotTransition, MascotTransitionMode } from './formaquestion/mascotTransition';
import type { LayeredPicture } from './layeredImages';

/** One Layer whose shown Variant changed. No `to` = it now shows nothing. */
export interface LayerChange {
  layerId: string;
  to?: string;
  /** The mode it plays, after reduced motion. */
  mode: MascotTransitionMode;
  transition: MascotTransition;
}

export interface StackChange {
  /** Bottom Layer first. */
  changes: LayerChange[];
  /** The topmost changed Jelly Layer's transition, which squashes the whole picture once (Q20). */
  squash?: MascotTransition;
}

/**
 * The change from `from` to `to`. Only a change of a Layer's shown image counts (Q35). Undefined when nothing
 * animates: a first picture, another Layered Image, or no Layer changed. Under reduced motion Jelly plays as Dissolve (Q19).
 */
export function stackChange(from: LayeredPicture | undefined, to: LayeredPicture, reduced: boolean): StackChange | undefined {
  if (!from || from.entryId !== to.entryId) return undefined;
  const before = new Map(from.layers.map((layer) => [layer.id, layer.data]));
  const changes = to.layers.flatMap((layer): LayerChange[] => {
    if (!before.has(layer.id) || before.get(layer.id) === layer.data) return [];
    const mode = reduced && layer.transition.mode === 'jelly' ? 'dissolve' : layer.transition.mode;
    return [{ layerId: layer.id, mode, transition: layer.transition, ...(layer.data ? { to: layer.data } : {}) }];
  });
  if (!changes.length) return undefined;
  const squash = changes.findLast((change) => change.mode === 'jelly')?.transition;
  return { changes, ...(squash ? { squash } : {}) };
}
