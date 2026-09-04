/**
 * What the Android hardware back button should do next, decided from the app's own state rather than
 * from the WebView's history. The app never navigates, so the WebView has one entry and its default
 * back behavior is to close the app from anywhere.
 */
export type BackAction = 'close-modal' | 'go-back' | 'confirm-exit';

/** The state a back press is answered against. */
export interface BackButtonState {
  /** A dialog, menu or popover is layered over the view. */
  modalOpen: boolean;
  /** Screens that fill a view without being a modal or a view of their own, such as the avatar editor. */
  subScreens: number;
  /** The innermost sub-screen lives inside the topmost layer, so its back step is that layer's own. */
  stopInsideLayer?: boolean;
  /** Views entered so far, oldest first. The last one is on screen. */
  viewHistory: readonly string[];
}

/**
 * A layer over the view takes the press before the view does, and the view takes it before the app
 * does. A layer that carries its own back step (the World Editor's guarded exit) runs that step rather
 * than being dismissed. Only the first screen of a run has nothing left to fall back to, so only it
 * asks to exit.
 */
export function resolveBackAction({ modalOpen, subScreens, stopInsideLayer, viewHistory }: BackButtonState): BackAction {
  if (modalOpen && !(stopInsideLayer && subScreens > 0)) return 'close-modal';
  return subScreens > 0 || viewHistory.length > 1 ? 'go-back' : 'confirm-exit';
}

/**
 * The trail after entering `view`. A view already in the trail pops it back to that view, so returning
 * the way you came never grows the trail; anything new is pushed. The same view twice is a no-op, and
 * the trail is returned unchanged so React skips the render.
 */
export function recordView<T>(trail: T[], view: T): T[] {
  if (trail[trail.length - 1] === view) return trail;
  const seen = trail.lastIndexOf(view);
  return seen >= 0 ? trail.slice(0, seen + 1) : [...trail, view];
}
