import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CANVAS, type Layout, type Rect } from '../layout';
import { fontsReady } from '../theme';

/** Where each `data-text` element of `node` sits on the canvas, measured from the real layout with the fonts in. Runs in the browser. */
export const measureText = async (layout: Layout, node: ReactNode): Promise<Rect[]> => {
  await fontsReady();
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '0', top: '0', visibility: 'hidden', pointerEvents: 'none' });
  host.style.width = `${CANVAS[layout].width}px`;
  host.style.height = `${CANVAS[layout].height}px`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(node));
    const origin = host.getBoundingClientRect();
    return [...host.querySelectorAll('[data-text]')].map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height };
    });
  } finally {
    root.unmount();
    host.remove();
  }
};
