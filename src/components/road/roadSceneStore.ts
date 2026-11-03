import { sendFunnelStep } from '@/lib/funnel';

export type RoadSceneView = 'levels' | 'checklist';

let open = false;
let view: RoadSceneView = 'levels';
const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  open = next;
  listeners.forEach((listener) => listener());
};

/** Raises the scene from anywhere, on its levels or, with `'checklist'`, on the support checklist. `RoadSceneHost` draws it. */
export const openRoadScene = (start: RoadSceneView = 'levels'): void => {
  view = start;
  if (start === 'levels') sendFunnelStep('see_levels');
  publish(true);
};
export const closeRoadScene = (): void => publish(false);
export const isRoadSceneOpen = (): boolean => open;
/** The view the last open asked for. */
export const roadSceneStart = (): RoadSceneView => view;

export function subscribeRoadScene(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
