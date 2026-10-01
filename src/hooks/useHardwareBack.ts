import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { inShieldedLayer } from '@/components/ui/shielded-layer';
import { resolveBackAction } from '@/lib/backAction';
import { backStops, type BackStop } from './useBackStop';

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

/**
 * The topmost open layer. Portals append in opening order, so the last one in the document is on top,
 * except in the shielded layer: it paints above every dialog although its host comes first.
 */
function findTopLayer(): Element | undefined {
  const layers = Array.from(document.querySelectorAll(OPEN_LAYER_SELECTOR));
  const shielded = layers.filter((layer) => inShieldedLayer(layer));
  return shielded[shielded.length - 1] ?? layers[layers.length - 1];
}

/** The innermost back step whose screen lives inside `layer`. */
function innermostStopIn(stops: readonly BackStop[], layer: Element): BackStop | undefined {
  for (let i = stops.length - 1; i >= 0; i--) {
    const element = stops[i].within?.current;
    if (element && layer.contains(element)) return stops[i];
  }
  return undefined;
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
      const topLayer = findTopLayer();
      const stops = backStops();
      const innermost = stops[stops.length - 1];
      const layerStop = topLayer ? innermostStopIn(stops, topLayer) : undefined;
      switch (resolveBackAction({ modalOpen: topLayer !== undefined, subScreens: stops.length, stopInsideLayer: layerStop !== undefined, viewHistory })) {
        case 'close-modal':
          closeTopLayer();
          break;
        case 'go-back':
          // The top layer's own step answers first, then the innermost sub-screen, then the view.
          if (layerStop) layerStop.run();
          else if (innermost) innermost.run();
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
