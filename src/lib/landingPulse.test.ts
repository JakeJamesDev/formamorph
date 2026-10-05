// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANDING_PULSE_CLASS, LANDING_RING_CLASS, landingControl, pulseLanding } from './landingPulse';

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

describe('pulseLanding', () => {
  it('adds the pulse class and takes it off when the pulse animation ends', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    expect(node).toHaveClass(LANDING_PULSE_CLASS);
    expect(node).not.toHaveClass(LANDING_RING_CLASS);
    end(node, 'landing-pulse');
    expect(node).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('draws the still ring without the pulse class under reduced motion', () => {
    reduceMotion(true);
    const node = row();
    pulseLanding(node);
    expect(node).toHaveClass(LANDING_RING_CLASS);
    expect(node).not.toHaveClass(LANDING_PULSE_CLASS);
    end(node, 'landing-ring');
    expect(node).not.toHaveClass(LANDING_RING_CLASS);
  });

  it('lets the caller pick reduced motion over the system setting', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node, { reducedMotion: true });
    expect(node).toHaveClass(LANDING_RING_CLASS);
  });

  it('keeps the class while a child animation ends', () => {
    reduceMotion(false);
    const node = row();
    const child = document.createElement('span');
    node.append(child);
    pulseLanding(node);
    end(child, 'landing-pulse');
    end(node, 'spin');
    expect(node).toHaveClass(LANDING_PULSE_CLASS);
  });

  it('restarts on a repeat call by taking the class off first, and ends once', async () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    const seen: (string | null)[] = [];
    const observer = new MutationObserver((records) => seen.push(...records.map((r) => r.oldValue)));
    observer.observe(node, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    pulseLanding(node);
    await Promise.resolve();
    observer.disconnect();
    // The add saw an empty class: the earlier pulse came off first, which restarts a running animation.
    expect(seen).toContain('');
    expect(node).toHaveClass(LANDING_PULSE_CLASS);
    end(node, 'landing-pulse');
    expect(node).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('takes the class off when the animation is canceled', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    node.dispatchEvent(Object.assign(new Event('animationcancel', { bubbles: true }), { animationName: 'landing-pulse' }));
    expect(node).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('swaps a running pulse for the still ring when the next call reduces motion', () => {
    reduceMotion(false);
    const node = row();
    pulseLanding(node);
    pulseLanding(node, { reducedMotion: true });
    expect(node).toHaveClass(LANDING_RING_CLASS);
    expect(node).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('takes the class off at once when the caller cancels', () => {
    reduceMotion(false);
    const node = row();
    const cancel = pulseLanding(node);
    cancel();
    expect(node).not.toHaveClass(LANDING_PULSE_CLASS);
  });

  it('scales the ring from 4px to 10px out for the row it lands on, and clears the scale with the class', () => {
    reduceMotion(false);
    const node = row();
    node.getBoundingClientRect = () => ({ width: 200, height: 24 } as DOMRect);
    const cancel = pulseLanding(node);
    // (200 + 20) / (200 + 8) across, (24 + 20) / (24 + 8) down: the 4px ring lands 10px out on both axes.
    expect(Number(node.style.getPropertyValue('--landing-sx'))).toBeCloseTo(220 / 208, 5);
    expect(Number(node.style.getPropertyValue('--landing-sy'))).toBeCloseTo(44 / 32, 5);
    cancel();
    expect(node.style.getPropertyValue('--landing-sx')).toBe('');
    expect(node.style.getPropertyValue('--landing-sy')).toBe('');
  });

  it('leaves a newer pulse alone when an older call cancels', () => {
    reduceMotion(false);
    const node = row();
    const stale = pulseLanding(node);
    pulseLanding(node);
    stale();
    expect(node).toHaveClass(LANDING_PULSE_CLASS);
  });
});

describe('landing keyframes', () => {
  it('name each class after keyframes in index.css, so animationend can match them', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    for (const name of [LANDING_PULSE_CLASS, LANDING_RING_CLASS]) {
      expect(css).toMatch(new RegExp(`@keyframes ${name} \\{`));
      // The ring is the row's ::after; its animation events still target the row.
      expect(css).toMatch(new RegExp(`\\.${name}::after \\{\\s*animation: ${name} `));
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
    const node = rowWith('<button aria-label="More info"></button><input id="field" />');
    expect(landingControl(node)?.id).toBe('field');
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
    expect(landingControl(rowWith('<button aria-label="More info"></button>'))).toBeNull();
  });
});
