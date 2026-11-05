import { useSyncExternalStore } from 'react';

type Rgba = [number, number, number, number];

/** White at 25%: the symbols' color while a dimming layer reaches them. */
const DIMMED: Rgba = [255, 255, 255, 64];
// Five steps over the dimming layer's 150ms fade.
const FADE_STEPS = 5;
const FADE_STEP_MS = 30;
/** What dims the page behind a popup. A full-window dialog covers its own. */
const DIM_LAYER = '[data-dim-layer]';
/** Where an animation can change what reaches the corner: dimming layers and the dialogs above them. */
const LAYERED = `${DIM_LAYER}, [role="dialog"], [role="alertdialog"]`;

/** `#rrggbb`, or `#rrggbbaa` below full alpha. */
const toHex = (color: Rgba) => {
  const parts = color[3] >= 255 ? color.slice(0, 3) : color;
  return `#${parts.map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
};

/** The theme's foreground, opaque. Measured in `host`, off the body's child list the dimming check watches. */
function themeForeground(root: HTMLElement, host: HTMLElement): Rgba {
  const probe = document.createElement('span');
  probe.style.color = `hsl(${getComputedStyle(root).getPropertyValue('--foreground').trim()})`;
  host.append(probe);
  const [r = 255, g = 255, b = 255] = (getComputedStyle(probe).color.match(/\d+/g) ?? []).map(Number);
  probe.remove();
  return [r, g, b, 255];
}

/** Whether an open dimming layer is what the window buttons sit over. A closing one is see-through. */
function cornerIsDimmed(): boolean {
  for (const el of document.elementsFromPoint(window.innerWidth - 20, 10)) {
    const layer = el.closest(DIM_LAYER);
    if (!layer) return false;
    if (layer.getAttribute('data-state') !== 'closed') return true;
  }
  return false;
}

let fullScreen = false;
const fullScreenListeners = new Set<() => void>();
const subscribeFullScreen = (listener: () => void) => {
  fullScreenListeners.add(listener);
  return () => fullScreenListeners.delete(listener);
};

/** Whether full screen hid the window buttons. Only ever true on the Windows desktop build. */
export const useWindowFullScreen = (): boolean => useSyncExternalStore(subscribeFullScreen, () => fullScreen, () => false);

export function leaveWindowFullScreen(): void {
  void window.formamorphDesktop?.leaveFullScreen?.();
}

/** Sets the desktop flag and starts the window's drag area and symbol color. Only the Windows desktop build sets it. */
export function installWindowChrome(): void {
  const bridge = window.formamorphDesktop;
  if (!bridge?.windowOverlay) return;

  const root = document.documentElement;
  const dragArea = document.createElement('div');
  dragArea.className = 'window-drag-area';
  document.body.prepend(dragArea);

  // Full screen hides the window buttons, so the flag and the room it holds for them go too.
  const setFullScreen = (on: boolean) => {
    fullScreen = on;
    if (on) delete root.dataset.windowOverlay;
    else root.dataset.windowOverlay = '';
    dragArea.hidden = on;
    fullScreenListeners.forEach((listener) => listener());
  };
  setFullScreen(bridge.isFullScreen?.() ?? false);
  bridge.onFullScreen?.(setFullScreen);

  let sent = '';
  const send = (color: Rgba) => {
    const hex = toHex(color);
    if (hex === sent) return;
    sent = hex;
    void bridge.setWindowSymbolColor?.(hex);
  };

  let current: Rgba | null = null;
  let fadeTimer: number | undefined;
  const fadeTo = (target: Rgba) => {
    const from = current ?? target;
    let step = 0;
    const advance = () => {
      step += 1;
      // map keeps the tuple's four parts.
      current = from.map((part, i) => part + (target[i] - part) * (step / FADE_STEPS)) as Rgba;
      send(current);
      if (step < FADE_STEPS) fadeTimer = window.setTimeout(advance, FADE_STEP_MS);
    };
    advance();
  };

  let goal = '';
  let dimmed = false;
  let frame = 0;
  const sync = () => {
    frame = 0;
    const nowDimmed = cornerIsDimmed();
    const target = nowDimmed ? DIMMED : themeForeground(root, dragArea);
    const hex = toHex(target);
    if (hex === goal) return;
    goal = hex;
    window.clearTimeout(fadeTimer);
    // The dimming fades with the page; a theme change is instant, like the page's.
    const fades = !!current && nowDimmed !== dimmed;
    dimmed = nowDimmed;
    if (fades) {
      fadeTo(target);
      return;
    }
    current = target;
    send(target);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(sync);
  };

  sync();
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['class'] });
  // Popups mount and unmount as children of the body.
  new MutationObserver(schedule).observe(document.body, { childList: true });
  // A dialog covers its dimming layer only once it has opened, so recheck when one finishes animating.
  const onAnimation = (event: Event) => {
    if (event.target instanceof Element && event.target.matches(LAYERED)) schedule();
  };
  for (const type of ['animationstart', 'animationend', 'transitionend']) document.addEventListener(type, onAnimation, true);
}
