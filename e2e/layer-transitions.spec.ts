import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * Layer transitions in the Layered Image editor's preview, which draws through the same picture as play.
 * jsdom paints no frames, so the fade and the squash are sampled here, one read per animation frame.
 */

test.use({ viewport: { width: 1600, height: 1000 } });

interface Frame {
  /** The whole picture's height scale. */
  scaleY: number;
  /** Per Layer: how many looks it draws, and the newest one's opacity. */
  layers: Record<string, { looks: number; newest: number }>;
}

/** The full-screen rig editor, over the World Editor. */
const editor = (page: Page) => page.getByRole('dialog', { name: 'Scout Rig' });

async function openFace(page: Page): Promise<void> {
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'layeredEditor', tab: 'media' });
  await editor(page).getByRole('button', { name: /^Face/ }).click();
  await expect(editor(page).locator('[data-layered-preview] [data-layer="dev-layer-face"]')).toBeVisible();
}

/** Presses Play and reads every frame for `ms`. */
async function samplePlay(page: Page, ms: number): Promise<Frame[]> {
  await page.evaluate(() => {
    const stack = document.querySelector('[data-layered-preview] [data-layer-stack]')!;
    const read = (): Frame => ({
      scaleY: new DOMMatrix(getComputedStyle(stack).transform === 'none' ? '' : getComputedStyle(stack).transform).d,
      layers: Object.fromEntries([...stack.querySelectorAll<HTMLElement>('[data-layer]')].map((layer) => {
        const looks = [...layer.querySelectorAll<HTMLElement>('[data-layer-look]')];
        return [layer.dataset.layer!, { looks: looks.length, newest: Number(getComputedStyle(looks.at(-1)!).opacity) }];
      })),
    });
    const frames: Frame[] = [];
    (window as unknown as { layerFrames: Frame[] }).layerFrames = frames;
    const tick = () => {
      frames.push(read());
      if (frames.length < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await editor(page).getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(ms);
  return page.evaluate(() => (window as unknown as { layerFrames: Frame[] }).layerFrames.splice(0));
}

const fading = (frames: Frame[], layer: string) => frames.filter((frame) => frame.layers[layer]?.looks === 2);

test.describe('Layer transitions', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The full-screen editor is the desktop form');
  });

  test('a Dissolve change fades only its Layer, with no squash', async ({ page }) => {
    await openFace(page);
    const frames = await samplePlay(page, 600);
    const fade = fading(frames, 'dev-layer-face');
    expect(fade.length).toBeGreaterThan(5);
    for (let i = 1; i < fade.length; i++) expect(fade[i].layers['dev-layer-face'].newest).toBeGreaterThanOrEqual(fade[i - 1].layers['dev-layer-face'].newest - 0.001);
    expect(fade.some((frame) => frame.layers['dev-layer-face'].newest > 0.2 && frame.layers['dev-layer-face'].newest < 0.8)).toBe(true);
    expect(frames.at(-1)!.layers['dev-layer-face']).toEqual({ looks: 1, newest: 1 });
    for (const frame of frames) {
      expect(frame.scaleY).toBe(1);
      expect(frame.layers['dev-layer-body']).toEqual({ looks: 1, newest: 1 });
    }
  });

  test('a Jelly change squashes the whole picture once and swaps its Layer at the dip', async ({ page }) => {
    await openFace(page);
    await editor(page).locator('[data-layer-transition="dev-layer-face"]').getByRole('radio', { name: 'Jelly' }).click();
    const frames = await samplePlay(page, 800);
    const heights = frames.map((frame) => frame.scaleY);
    const dip = heights.indexOf(Math.min(...heights));
    // The default Jelly dips to 82% and stretches to 112%; the frames land near, not on, the extremes.
    expect(heights[dip]).toBeLessThan(0.9);
    expect(Math.max(...heights.slice(dip))).toBeGreaterThan(1.05);
    // One squash: the height falls below 90% in one stretch of frames only.
    const dips = heights.filter((h, i) => h < 0.9 && !(heights[i - 1] < 0.9)).length;
    expect(dips).toBe(1);
    expect(heights.at(-1)).toBe(1);
    // The Layer swaps with no fade between.
    for (const frame of frames) expect([0, 1]).toContain(frame.layers['dev-layer-face'].newest);
    for (const frame of frames) expect(frame.layers['dev-layer-body']).toEqual({ looks: 1, newest: 1 });
    expect(frames.at(-1)!.layers['dev-layer-face']).toEqual({ looks: 1, newest: 1 });
  });

  test('with reduced motion, a Jelly change samples as a fade with no scale change', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFace(page);
    await editor(page).locator('[data-layer-transition="dev-layer-face"]').getByRole('radio', { name: 'Jelly' }).click();
    const frames = await samplePlay(page, 600);
    const fade = fading(frames, 'dev-layer-face');
    expect(fade.some((frame) => frame.layers['dev-layer-face'].newest > 0.2 && frame.layers['dev-layer-face'].newest < 0.8)).toBe(true);
    for (const frame of frames) expect(frame.scaleY).toBe(1);
    expect(frames.at(-1)!.layers['dev-layer-face']).toEqual({ looks: 1, newest: 1 });
  });
});
