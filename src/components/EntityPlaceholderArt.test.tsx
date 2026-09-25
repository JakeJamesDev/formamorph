import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { morphHue, morphPalette, type LetterMask } from '@/lib/placeholderArt';

// A solid block where the letter goes stands in for a font.
const blockMask: LetterMask = {
  width: 200,
  height: 300,
  ink: (x, y) => x >= 70 && x <= 130 && y >= 140 && y <= 240,
};
const { letterMask } = vi.hoisted(() => ({ letterMask: vi.fn() }));
vi.mock('@/lib/letterMask', async (original) => ({
  ...(await original<typeof import('@/lib/letterMask')>()),
  letterMask,
}));

import { EntityPlaceholderArt } from './EntityPlaceholderArt';

const root = document.documentElement;

/** The element a `url(#id)` reference names, looked up inside one svg only. */
function target(svg: Element, ref: string | null): Element | null {
  const id = ref?.match(/^url\(#(.+)\)$/)?.[1];
  return id ? svg.querySelector(`[id="${id}"]`) : null;
}

const backgroundStop = (container: HTMLElement) =>
  container.querySelector('linearGradient stop')?.getAttribute('stop-color');

beforeEach(() => {
  letterMask.mockReset().mockReturnValue(blockMask);
  root.classList.remove('dark', 'light');
  root.style.setProperty('--app-font', 'Test Sans');
});

afterEach(() => {
  root.style.removeProperty('--app-font');
  root.classList.remove('dark', 'light');
  Reflect.deleteProperty(document, 'fonts');
});

describe('EntityPlaceholderArt', () => {
  it('draws each shape in white inside a goo-filtered mask, filled with one gradient', () => {
    const { container } = render(<EntityPlaceholderArt id="e1" name="Bramble" />);
    const svg = container.querySelector('svg')!;
    const shapes = svg.querySelectorAll('rect[mask]');
    // The letter plus at least one cluster.
    expect(shapes.length).toBeGreaterThanOrEqual(2);
    for (const shape of shapes) {
      expect(target(svg, shape.getAttribute('fill'))?.tagName).toBe('linearGradient');
      const mask = target(svg, shape.getAttribute('mask'));
      expect(mask?.tagName).toBe('mask');
      const group = mask!.querySelector('g')!;
      expect(group.getAttribute('fill')).toBe('white');
      expect(target(svg, group.getAttribute('filter'))?.querySelector('feGaussianBlur')).toBeInstanceOf(Element);
    }
    expect(svg.querySelector('text')?.textContent).toBe('B');
  });

  it('gives every instance its own ids', () => {
    const { container } = render(
      <>
        <EntityPlaceholderArt id="same" name="Twin" />
        <EntityPlaceholderArt id="same" name="Twin" />
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const svg of container.querySelectorAll('svg')) {
      for (const el of svg.querySelectorAll('[fill^="url"], [mask], [filter]')) {
        for (const attr of ['fill', 'mask', 'filter']) {
          const ref = el.getAttribute(attr);
          if (ref?.startsWith('url')) expect(target(svg, ref)).not.toBeNull();
        }
      }
    }
  });

  it('waits for the font before it measures the letter, and paints the background meanwhile', async () => {
    let finishLoad!: () => void;
    const load = new Promise<void>((resolve) => { finishLoad = resolve; });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { check: () => false, load: () => load, ready: Promise.resolve() },
    });
    const { container } = render(<EntityPlaceholderArt id="e3" name="Bramble" />);
    expect(letterMask).not.toHaveBeenCalled();
    expect(container.querySelector('rect[mask]')).toBeNull();
    expect(backgroundStop(container)).toBeTruthy();

    await act(async () => { finishLoad(); await load; });
    expect(letterMask).toHaveBeenCalled();
    expect(container.querySelector('rect[mask]')).not.toBeNull();
  });

  it('redraws when the Font setting changes', async () => {
    const { container } = render(<EntityPlaceholderArt id="e4" name="Bramble" />);
    expect(letterMask).toHaveBeenLastCalledWith('B', 'Test Sans', expect.any(Number));
    expect(container.querySelector('text')?.style.fontFamily).toBe('Test Sans');

    await act(async () => { root.style.setProperty('--app-font', 'Other Serif'); });
    expect(letterMask).toHaveBeenLastCalledWith('B', 'Other Serif', expect.any(Number));
    expect(container.querySelector('text')?.style.fontFamily).toBe('Other Serif');
  });

  it('switches palettes with the theme', async () => {
    root.classList.add('light');
    const { container } = render(<EntityPlaceholderArt id="e5" name="Bramble" />);
    const hue = morphHue('e5');
    expect(backgroundStop(container)).toBe(morphPalette(hue, false).background[0]);

    await act(async () => { root.classList.replace('light', 'dark'); });
    expect(backgroundStop(container)).toBe(morphPalette(hue, true).background[0]);
  });

  it('seeds the hue from the listing id when there is one, else the local id', () => {
    // Two ids that land on different hues, so a wrong seed shows.
    const local = Array.from({ length: 20 }, (_, i) => `local-${i}`).find((id) => morphHue(id) !== morphHue('listing'))!;
    const { container: linked } = render(<EntityPlaceholderArt id={local} sourceId="listing" name="Bramble" />);
    const { container: plain } = render(<EntityPlaceholderArt id={local} name="Bramble" />);
    expect(backgroundStop(linked)).toBe(morphPalette(morphHue('listing'), false).background[0]);
    expect(backgroundStop(plain)).toBe(morphPalette(morphHue(local), false).background[0]);
  });
});
