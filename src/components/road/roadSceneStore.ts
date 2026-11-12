import { sendFunnelStep, type FunnelSource } from '@/lib/funnel';

export type RoadSceneView = 'levels' | 'checklist';

let open = false;
let view: RoadSceneView = 'levels';
let source: FunnelSource | null = null;
const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  open = next;
  listeners.forEach((listener) => listener());
};

/**
 * Raises the scene from anywhere, on its levels or, with `'checklist'`, on the support checklist. `RoadSceneHost`
 * draws it. `from` owns this open's funnel steps until the scene closes.
 */
export const openRoadScene = (from: FunnelSource, start: RoadSceneView = 'levels'): void => {
  view = start;
  source = from;
  if (start === 'levels') sendFunnelStep(`${from}_see_levels`);
  publish(true);
};
export const closeRoadScene = (): void => {
  source = null;
  publish(false);
};
export const isRoadSceneOpen = (): boolean => open;
/** The view the last open asked for. */
export const roadSceneStart = (): RoadSceneView => view;
/** The entry point of the open scene; null while closed. */
export const roadSceneSource = (): FunnelSource | null => source;

export function subscribeRoadScene(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
