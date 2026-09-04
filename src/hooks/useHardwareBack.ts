import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { resolveBackAction } from '@/lib/backAction';
import { backStops } from './useBackStop';

/**
 * Radix's dismissable layers as they reach the DOM. Dialogs and alerts carry their own role; menus,
 * selects and popovers all sit inside the popper wrapper, which only exists while one is open.
 */
const OPEN_LAYER_SELECTOR =
  '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"],[data-radix-popper-content-wrapper]';

/**
 * Dismiss the topmost layer. Radix answers Escape on the highest layer only, so one press closes one
 * layer, and a layer that refuses Escape refuses the back button the same way.
 */
function closeTopLayer(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

export interface HardwareBackOptions {
  /** Views entered so far, oldest first. The last one is on screen. */
  viewHistory: readonly string[];
  /** Leave the current view for the one before it. */
  onGoBack: () => void;
  /** Raise the prompt that stands in front of closing the app. */
  onConfirmExit: () => void;
}

/**
 * Answer the Android hardware back button from the app's own state. Mount it only in the Android app:
 * everywhere else the plugin has no event to send.
 */
export function useHardwareBack(options: HardwareBackOptions): void {
  // The listener is registered once and reads through this, so a new view or handler never re-registers.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const pending = App.addListener('backButton', () => {
      const { viewHistory, onGoBack, onConfirmExit } = latest.current;
      const modalOpen = document.querySelector(OPEN_LAYER_SELECTOR) !== null;
      const stops = backStops();
      switch (resolveBackAction({ modalOpen, subScreens: stops.length, viewHistory })) {
        case 'close-modal':
          closeTopLayer();
          break;
        case 'go-back':
          // The innermost sub-screen answers first; the view itself only once none is left.
          if (stops.length > 0) stops[stops.length - 1]();
          else onGoBack();
          break;
        case 'confirm-exit':
          onConfirmExit();
          break;
      }
    });
    return () => {
      void pending.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);
}
