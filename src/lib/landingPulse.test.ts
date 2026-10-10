// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { frames } from '@/test/landing';
import {
  LANDING_LAYER_CLASS, LANDING_PULSE_CLASS, LANDING_RING_CLASS, landingControl, landingRing, landingTarget, pulseLanding,
} from './landingPulse';

const row = () => {
  const node = document.createElement('div');
  document.body.append(node);
  return node;
};

const end = (target: Element, animationName: string) =>
  target.dispatchEvent(Object.assign(new Event('animationend', { bubbles: true }), { animationName }));

const reduceMotion = (reduce: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({
  matches: reduce && query === '(prefers-reduced-motion: reduce)',
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
}));

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** A rect at a place, for jsdom, which lays nothing out. */
const placeAt = (node: Element, left: number, top: number, width: number, height: number) => {
  node.getBoundingClientRect = () => new DOMRect(left, top, width, height);
};

const layerOf = (ring: HTMLElement) => ring.parentElement!;
const px = (value: string) => Number.parseFloat(value);
/** Where the ring stands on the page: the layer's offset plus the ring's offset inside it. */
const ringBox = (ring: HTMLElement) => {
  const layer = layerOf(ring);
  return {
    left: px(layer.style.left) + px(ring.style.left),
    top: px(layer.style.top) + px(ring.style.top),
    width: px(ring.style.width),
    height: px(ring.style.height),
  };
};

describe('pulseLanding', () => {
  it('draws the pulse in a layer on the page, not on the row, and removes it when the pulse ends', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    const ring = landingRing(node)!;
    expect(ring).toHaveClass(LANDING_PULSE_CLASS);
    expect(node.contains(ring)).toBe(false);
    expect(node.className).toBe('');
    expect(landingTarget(ring)).toBe(node);
    end(ring, 'landing-pulse');
    expect(landingRing(node)).toBeNull();
    expect(ring.isConnected).toBe(false);
    expect(document.querySelector(`.${LANDING_LAYER_CLASS}`)).toBeNull();
  });

  it('draws the still ring under reduced motion', () => {
    reduceMotion(true);
    const node = row();
    pulseLanding(node);
    const ring = landingRing(node)!;
    expect(ring).toHaveClass(LANDING_RING_CLASS);
    expect(ring).not.toHaveClass(LANDING_PULSE_CLASS);
    end(ring, 'landing-ring');
    expect(landingRing(node)).toBeNull();
  });

  it('lets the caller pick reduced motion over the system setting', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node, { reducedMotion: true });
    expect(landingRing(node)).toHaveClass(LANDING_RING_CLASS);
  });

  it('keeps the ring while another animation ends', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    end(node, 'landing-pulse');
    end(landingRing(node)!, 'spin');
    expect(landingRing(node)).toHaveClass(LANDING_PULSE_CLASS);
  });

  it('restarts on a repeat call with a new ring in place of the old one', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    const first = landingRing(node)!;
    pulseLanding(node);
    const second = landingRing(node)!;
    expect(second).not.toBe(first);
    expect(first.isConnected).toBe(false);
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(1);
    end(second, 'landing-pulse');
    expect(document.querySelector(`.${LANDING_LAYER_CLASS}`)).toBeNull();
  });

  it('removes the ring when the animation is canceled', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    const ring = landingRing(node)!;
    ring.dispatchEvent(Object.assign(new Event('animationcancel', { bubbles: true }), { animationName: 'landing-pulse' }));
    expect(ring.isConnected).toBe(false);
  });

  it('swaps a running pulse for the still ring when the next call reduces motion', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    pulseLanding(node, { reducedMotion: true });
    expect(landingRing(node)).toHaveClass(LANDING_RING_CLASS);
    expect(document.querySelectorAll(`.${LANDING_PULSE_CLASS}`)).toHaveLength(0);
  });

  it('removes the ring at once when the caller cancels', () => {
    reduceMotion(false);
    const node = row();
    const cancel = pulseLanding(node);
    cancel();
    expect(landingRing(node)).toBeNull();
    expect(document.querySelector(`.${LANDING_LAYER_CLASS}`)).toBeNull();
  });

  it('leaves a newer pulse alone when an older call cancels', () => {
    reduceMotion(false);
    const node = row();
    const stale = pulseLanding(node);
    pulseLanding(node);
    stale();
    expect(landingRing(node)).toHaveClass(LANDING_PULSE_CLASS);
  });

  it('keeps the layer out of focus and the accessibility tree', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    const layer = layerOf(landingRing(node)!);
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(layer).toHaveAttribute('inert');
  });

  it('stands the ring 4px outside its row and scales it to 10px out', () => {
    reduceMotion(false);
    const node = row();
    placeAt(node, 100, 50, 200, 24);
    pulseLanding(node);
    const ring = landingRing(node)!;
    expect(ringBox(ring)).toEqual({ left: 96, top: 46, width: 208, height: 32 });
    // (200 + 20) / (200 + 8) across, (24 + 20) / (24 + 8) down: the 4px ring lands 10px out on both axes.
    expect(Number(ring.style.getPropertyValue('--landing-sx'))).toBeCloseTo(220 / 208, 5);
    expect(Number(ring.style.getPropertyValue('--landing-sy'))).toBeCloseTo(44 / 32, 5);
  });

  it('follows its row when the row moves during the pulse', async () => {
    reduceMotion(false);
    const node = row();
    placeAt(node, 100, 50, 200, 24);
    pulseLanding(node);
    placeAt(node, 100, 10, 240, 24);
    await frames(1);
    const ring = landingRing(node)!;
    expect(ringBox(ring)).toEqual({ left: 96, top: 6, width: 248, height: 32 });
    expect(Number(ring.style.getPropertyValue('--landing-sx'))).toBeCloseTo(260 / 248, 5);
  });

  it('removes the ring when its row leaves the page', async () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    const ring = landingRing(node)!;
    node.remove();
    await frames(1);
    expect(ring.isConnected).toBe(false);
  });

  it('removes the ring when its row hides', async () => {
    reduceMotion(false);
    const node = row();
    let shown = true;
    node.checkVisibility = () => shown;
    pulseLanding(node);
    const ring = landingRing(node)!;
    await frames(1);
    expect(ring.isConnected).toBe(true);
    shown = false;
    await frames(1);
    expect(ring.isConnected).toBe(false);
    expect(landingRing(node)).toBeNull();
  });

  it('cuts the layer to each scroll window widened by the ring reach, so a flush row keeps its whole ring', () => {
    reduceMotion(false);
    const outer = row();
    outer.style.overflowX = 'hidden';
    placeAt(outer, 0, 0, 500, 900);
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    placeAt(scroller, 20, 100, 900, 300);
    const node = document.createElement('div');
    placeAt(node, 40, 100, 200, 24);
    outer.append(scroller);
    scroller.append(node);
    pulseLanding(node);
    const layer = layerOf(landingRing(node)!);
    // Across: the outer window, 10px wider each side, cut to the viewport. Down: the scroller, 10px taller each side.
    expect([layer.style.left, layer.style.top, layer.style.width, layer.style.height]).toEqual(['0px', '90px', '510px', '320px']);
    // The ring's top edge, 4px above the flush row, sits inside the layer.
    expect(ringBox(landingRing(node)!).top).toBeGreaterThanOrEqual(px(layer.style.top));
  });

  it('ignores the windows above a fixed ancestor, which do not clip it', () => {
    reduceMotion(false);
    const outer = row();
    outer.style.overflowY = 'hidden';
    placeAt(outer, 0, 0, 100, 100);
    const panel = document.createElement('div');
    panel.style.position = 'fixed';
    const node = document.createElement('div');
    outer.append(panel);
    panel.append(node);
    pulseLanding(node);
    const layer = layerOf(landingRing(node)!);
    expect([layer.style.top, layer.style.height]).toEqual(['0px', `${window.innerHeight}px`]);
  });

  it('draws in the layer of a dialog that holds the row, just above the dialog', () => {
    reduceMotion(false);
    const page = row();
    const dialog = row();
    Object.assign(dialog.style, { position: 'fixed', zIndex: '50' });
    const later = row();
    const node = document.createElement('div');
    dialog.append(node);
    pulseLanding(node);
    const layer = layerOf(landingRing(node)!);
    expect(layer.style.zIndex).toBe('50');
    expect(layer.previousElementSibling).toBe(dialog);
    expect(layer.nextElementSibling).toBe(later);
    expect(page.nextElementSibling).toBe(dialog);
  });

  it('draws a page row in the page layer, under a dialog opened later', () => {
    reduceMotion(false);
    const page = row();
    const node = document.createElement('div');
    page.append(node);
    const dialog = row();
    pulseLanding(node);
    const layer = layerOf(landingRing(node)!);
    expect(layer.style.zIndex).toBe('');
    expect(layer.previousElementSibling).toBe(page);
    expect(layer.nextElementSibling).toBe(dialog);
  });

  it('takes the ring color and corner radius from its row, so a themed panel keeps its own ring', () => {
    reduceMotion(false);
    const node = row();
    node.style.setProperty('--ring', '0 0% 98%');
    node.style.setProperty('--radius', '0.75rem');
    pulseLanding(node);
    const ring = landingRing(node)!;
    expect(ring.style.getPropertyValue('--ring')).toBe('0 0% 98%');
    expect(ring.style.getPropertyValue('--radius')).toBe('0.75rem');
  });
});

describe('landing keyframes', () => {
  it('name each ring class after keyframes in index.css, so animationend can match them', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    for (const name of [LANDING_PULSE_CLASS, LANDING_RING_CLASS]) {
      expect(css).toMatch(new RegExp(`@keyframes ${name} \\{`));
      expect(css).toMatch(new RegExp(`\\.${name} \\{\\s*animation: ${name} `));
    }
  });
});

describe('landingControl', () => {
  const rowWith = (html: string) => {
    const node = row();
    node.innerHTML = html;
    return node;
  };

  it('skips the label info button for the control', () => {
    const node = rowWith('<button aria-label="More info" data-hint-info></button><input id="field" />');
    expect(landingControl(node)?.id).toBe('field');
  });

  it('takes a field over a button before it', () => {
    const node = rowWith('<button id="option" role="radio" data-state="off"></button><input id="field" />');
    expect(landingControl(node)?.id).toBe('field');
  });

  it('takes the first enabled button of a row of buttons', () => {
    const node = rowWith('<button aria-label="More info" data-hint-info></button><button id="previous" disabled></button><button id="next"></button>');
    expect(landingControl(node)?.id).toBe('next');
  });

  it('takes the first live link button of a pager', () => {
    const node = rowWith('<a id="previous" href="#" aria-disabled="true"></a><a id="page" href="#" aria-current="page"></a>');
    expect(landingControl(node)?.id).toBe('page');
  });

  it('picks the control on screen over a hidden twin', () => {
    const node = rowWith('<button role="combobox" id="select"></button><button role="radio" data-state="on" id="segment"></button>');
    const segment = node.querySelector<HTMLElement>('#segment')!;
    segment.getClientRects = () => [new DOMRect(0, 0, 40, 20)] as unknown as DOMRectList;
    expect(landingControl(node)).toBe(segment);
  });

  it('takes a row that is a button as its own control', () => {
    const button = document.createElement('button');
    row().append(button);
    expect(landingControl(button)).toBe(button);
  });

  it('finds nothing in a row with no control', () => {
    expect(landingControl(rowWith('<button aria-label="More info" data-hint-info></button>'))).toBeNull();
  });
});
