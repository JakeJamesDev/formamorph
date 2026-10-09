import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * The World Editor's Save face through a real save, sampled every frame in a compositing browser: the
 * walk from Save to Saved and back, the Saved hold, the fade, and a width that never moves. jsdom has no
 * layout or clock for any of this.
 */

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

const WORLD = {
  id: 'e2e-save-states',
  worldOverview: { name: 'Save States', description: '', author: '' },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
};
const FACE = 'button[data-tour-anchor="save"]';

interface Sample { t: number; face: string; width: number; opacity: number; disabled: boolean }
interface Recording { samples: Sample[]; sequence: string[] }

async function openEditor(page: Page) {
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'overview' });
  await expect(page.locator(FACE)).toBeDisabled();
}

/** Gives the world a change, so Save has something to write. */
async function edit(page: Page, name: string) {
  await page.getByLabel('World Name').fill(name);
  await expect(page.locator(FACE)).toBeEnabled();
}

/** Waits out the Saved hold. Playwright counts Saved's `aria-disabled` as disabled, so the real `disabled` is read. */
const settleOnMutedSave = (page: Page) => expect(page.locator(FACE)).toHaveJSProperty('disabled', true, { timeout: 5000 });

/** Records the shown face on every DOM change, and the face's box and look on every frame, until `stop`. */
async function startRecording(page: Page, selector: string) {
  await page.evaluate((sel) => {
    const face = document.querySelector<HTMLButtonElement>(sel)!;
    const shown = () => face.querySelector<HTMLElement>('[data-save-face][aria-hidden="false"]')?.dataset.saveFace ?? '';
    const rec = { samples: [] as Sample[], sequence: [shown()], stop: false };
    new MutationObserver(() => {
      const now = shown();
      if (rec.sequence[rec.sequence.length - 1] !== now) rec.sequence.push(now);
    }).observe(face, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
    const t0 = performance.now();
    const tick = () => {
      const cs = getComputedStyle(face);
      rec.samples.push({
        t: performance.now() - t0, face: shown(), width: face.getBoundingClientRect().width,
        opacity: Number(cs.opacity), disabled: face.disabled,
      });
      if (!rec.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    (window as unknown as { __saveRec: typeof rec }).__saveRec = rec;
  }, selector);
}

const stopRecording = (page: Page) => page.evaluate((): Recording => {
  const rec = (window as unknown as { __saveRec: Recording & { stop: boolean } }).__saveRec;
  rec.stop = true;
  return { samples: rec.samples, sequence: rec.sequence };
});

test.describe('Save button states', () => {
  test('walks Save, Saving…, Saved, holds, then fades to the muted Save at one width', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the labeled face lives in the desktop app bar');
    await openEditor(page);
    await edit(page, 'Saltmarsh');
    await startRecording(page, FACE);
    await page.locator(FACE).click();
    await settleOnMutedSave(page);
    // Past the 700ms fade.
    await page.waitForTimeout(1000);
    const { samples, sequence } = await stopRecording(page);

    expect(sequence).toEqual(['save', 'saving', 'saved', 'save']);
    const widths = samples.map((s) => s.width);
    expect(Math.max(...widths) - Math.min(...widths), `widths ${Math.min(...widths)}–${Math.max(...widths)}`).toBeLessThan(0.5);

    const savedFrames = samples.filter((s) => s.face === 'saved');
    const hold = savedFrames[savedFrames.length - 1].t - savedFrames[0].t;
    expect(hold, `Saved held ${hold.toFixed(0)}ms`).toBeGreaterThan(1850);
    expect(hold).toBeLessThan(2300);
    expect(savedFrames.every((s) => s.opacity === 1 && !s.disabled)).toBe(true);

    // The fade: the muted Save's opacity eases from 1 to 0.5 over many frames, never back up.
    const after = samples.filter((s) => s.t > savedFrames[savedFrames.length - 1].t);
    const easing = after.filter((s) => s.opacity > 0.5 && s.opacity < 1);
    expect(easing.length, `${easing.length} fade frames`).toBeGreaterThanOrEqual(10);
    expect(easing.every((s, i) => i === 0 || s.opacity <= easing[i - 1].opacity)).toBe(true);
    const settled = after.find((s) => s.opacity === 0.5)!;
    const fade = settled.t - savedFrames[savedFrames.length - 1].t;
    expect(fade, `fade took ${fade.toFixed(0)}ms`).toBeGreaterThan(500);
    expect(fade).toBeLessThan(1000);
    expect(after[after.length - 1]).toMatchObject({ face: 'save', opacity: 0.5, disabled: true });
  });

  test('keeps one width through Saving… and Failed in the reference', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the reference bar is desktop-width');
    await openApp(page);
    await page.goto('/#dev?modal=designSystem&tab=surface-app-bar');
    const region = page.getByRole('region', { name: 'Surface App Bar' });
    await region.locator(FACE).waitFor();
    await startRecording(page, FACE);
    await region.locator(FACE).click();
    await expect(region.getByRole('button', { name: 'Saved' })).toBeVisible();
    await region.getByRole('checkbox', { name: 'Fail Saves' }).click();
    await region.getByRole('button', { name: 'Make a Change' }).click();
    await region.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(region.getByRole('button', { name: 'Failed' })).toBeVisible();
    const { samples, sequence } = await stopRecording(page);

    expect(sequence).toEqual(['save', 'saving', 'saved', 'save', 'saving', 'failed']);
    const shown = new Set(samples.map((s) => s.face));
    expect([...shown].sort()).toEqual(['failed', 'save', 'saved', 'saving']);
    const widths = samples.map((s) => s.width);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.5);
  });

  test('mobile morphs the icon-only Save to the check', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the icon-only face lives in the mobile footer');
    await openEditor(page);
    await edit(page, 'Saltmarsh');
    await startRecording(page, FACE);
    await page.locator(FACE).click();
    await settleOnMutedSave(page);
    const { samples, sequence } = await stopRecording(page);

    expect(sequence).toEqual(['save', 'saving', 'saved', 'save']);
    await expect(page.locator(FACE)).toHaveText('');
    const widths = samples.map((s) => s.width);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(0.5);
    expect(samples.some((s) => s.face === 'saved')).toBe(true);
  });
});
