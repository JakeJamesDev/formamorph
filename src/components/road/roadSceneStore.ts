let open = false;
const listeners = new Set<() => void>();
const publish = (next: boolean) => {
  open = next;
  listeners.forEach((listener) => listener());
};

/** Raises the scene from anywhere. `RoadSceneHost` draws it. */
export const openRoadScene = (): void => publish(true);
export const closeRoadScene = (): void => publish(false);
export const isRoadSceneOpen = (): boolean => open;

export function subscribeRoadScene(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
