/**
 * The shielded top layer: hosts on `<body>` whose content stays usable while a modal dialog is open. The
 * `window` host holds the help window and can sink under a dialog; the `toasts` host sits above it and never sinks.
 * A modal dialog blocks everything outside it in six ways. The host answers four and the dialog wrappers
 * answer two:
 *
 * | The dialog                                               | The answer                                         |
 * | -------------------------------------------------------- | -------------------------------------------------- |
 * | sets `pointer-events: none` on `<body>`                  | layer content sets `pointer-events: auto`          |
 * | marks every other body child `aria-hidden`               | the host has `aria-live`, which that pass keeps    |
 * | traps focus with `focusin` and `focusout` on `document`  | `focusin` stops at the host; a `focusout` that     |
 * |                                                          | moves focus into the layer stops at `<body>`       |
 * | cancels `wheel` and `touchmove` outside it on `document` | both stop at the host                              |
 * | closes on a press outside it                             | the wrappers call `inShieldedLayer` and prevent    |
 * | returns focus to its opener when it closes               | both                                               |
 *
 * A press must still reach `document`, because popovers and menus dismiss from there. React handles each
 * stopped event first: its listeners sit on the mount inside the host.
 *
 * This module imports nothing: the account site bundles the dialog wrappers that read it.
 */

const MARK = 'data-shielded-layer';

export type ShieldedLayerName = 'window' | 'toasts';

/** Above dialogs, popovers and selects (z-50). Below the chip typeahead (z-70) and tooltips (z-80). */
const LAYER_Z_INDEX: Record<ShieldedLayerName, number> = { window: 65, toasts: 66 };
/** Below dialogs, for a layer that a dialog covers. */
const COVERED_Z_INDEX = 40;
/** A closing dialog's exit animation, which stays above the layer until it ends. */
const DIALOG_EXIT_MS = 200;

/** Events the dialog library reads on `document` and must not see from inside the layer. */
const SHIELDED_EVENTS = ['focusin', 'wheel', 'touchmove'] as const;

const layers = new Map<ShieldedLayerName, { host: HTMLDivElement; mount: HTMLDivElement }>();

function stopAtLayer(event: Event): void {
  event.stopPropagation();
}

function stopFocusOutIntoLayer(event: FocusEvent): void {
  if (inShieldedLayer(event.relatedTarget)) event.stopPropagation();
}

/** True when `node` is inside the shielded layer. */
export function inShieldedLayer(node: EventTarget | null): boolean {
  return node instanceof Element && node.closest(`[${MARK}]`) !== null;
}

/** A dialog's outside-press handler that ignores a press in the layer and passes every other one on. */
export function ignoreLayerPress<E extends Event>(handler?: (event: E) => void): (event: E) => void {
  return (event) => {
    if (inShieldedLayer(event.target)) event.preventDefault();
    else handler?.(event);
  };
}

/**
 * A dialog's close-focus handler that leaves focus in the layer. The caller's handler runs first, because
 * it can hold cleanup, and can move focus to its own opener; focus then returns to the layer.
 */
export function keepLayerFocus(handler?: (event: Event) => void): (event: Event) => void {
  return (event) => {
    const held = inShieldedLayer(document.activeElement) ? document.activeElement : null;
    handler?.(event);
    if (held instanceof HTMLElement) {
      event.preventDefault();
      held.focus();
    }
  };
}

/** The element to portal into. The first call makes the layer; later calls return the same element. */
export function ensureShieldedLayer(name: ShieldedLayerName = 'window'): HTMLDivElement {
  let layer = layers.get(name);
  if (!layer) {
    const host = document.createElement('div');
    host.setAttribute(MARK, name);
    host.setAttribute('aria-live', 'off');
    host.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;z-index:${LAYER_Z_INDEX[name]};`;
    const mount = document.createElement('div');
    host.append(mount);
    for (const type of SHIELDED_EVENTS) host.addEventListener(type, stopAtLayer);
    if (layers.size === 0) document.body.addEventListener('focusout', stopFocusOutIntoLayer);
    layer = { host, mount };
    layers.set(name, layer);
  }
  if (!layer.host.isConnected) document.body.append(layer.host);
  return layer.mount;
}

/**
 * Puts the `window` layer under dialogs while one covers it, inert so focus and assistive tech skip it.
 * Uncovered, it is live at once and rises again once the closing dialog's exit has played.
 */
export function coverShieldedLayer(covered: boolean): void {
  const layer = layers.get('window');
  if (!layer) return;
  layer.mount.inert = covered;
  layer.host.style.transition = covered ? 'none' : `z-index 0s linear ${DIALOG_EXIT_MS}ms`;
  layer.host.style.zIndex = String(covered ? COVERED_Z_INDEX : LAYER_Z_INDEX.window);
}
