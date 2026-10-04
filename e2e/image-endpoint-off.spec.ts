import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * Settings → Endpoints → Image: the switch and the reachability badge must not move the rows above the
 * content. Box positions are the claim, which jsdom reports as zero.
 */

const IMAGE_BASE = 'http://image.e2e.test';

const STORE = {
  activeId: 'p0',
  presets: [{ id: 'p0', name: 'E2E', overrides: { provider: 'a1111', endpoint: IMAGE_BASE, model: '' } }],
};

/** Holds the probe's answer until `release` runs, so the badge can be measured while it is checking. */
async function holdProbe(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`${IMAGE_BASE}/sdapi/v1/sd-models`, async (route) => {
    await gate;
    await route.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } });
  });
  return release;
}

const boxOf = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!;

test.describe('Settings → Endpoints → Image: off state and badge slot', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) < 768, 'Measured at one desktop size');

  test('the badge slot holds one box from checking to reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openApp(page, { FORMAMORPH_imageEndpointPresets: JSON.stringify(STORE) });
    const release = await holdProbe(page);
    await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'endpoints', subtab: 'image' });

    const slot = page.getByTestId('image-reachability-slot');
    await expect(slot).toContainText('Checking');
    const checking = await boxOf(slot);
    const switchBox = await boxOf(page.getByRole('checkbox', { name: 'Enable Image Generation' }));

    release();
    await expect(slot).toContainText('Reachable');
    expect(await boxOf(slot)).toEqual(checking);
    expect(await boxOf(page.getByRole('checkbox', { name: 'Enable Image Generation' }))).toEqual(switchBox);
  });

  test('toggling the switch moves no row above the content', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openApp(page, { FORMAMORPH_imageEndpointPresets: JSON.stringify(STORE) });
    await page.route(`${IMAGE_BASE}/sdapi/v1/sd-models`, (route) =>
      route.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } }));
    await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'endpoints', subtab: 'image' });

    const header = page.getByTestId('image-preset-header');
    const slot = page.getByTestId('image-reachability-slot');
    const toggle = page.getByRole('checkbox', { name: 'Enable Image Generation' });
    await expect(slot).toContainText('Reachable');
    const above = async () => [await boxOf(header), await boxOf(slot), await boxOf(toggle)];
    const before = await above();

    await toggle.click();
    await expect(page.getByText('Image generation is off.')).toBeVisible();
    await expect(page.locator('#imageEndpoint')).toBeDisabled();
    expect(await above()).toEqual(before);

    await toggle.click();
    await expect(page.locator('#imageEndpoint')).toBeEnabled();
    expect(await above()).toEqual(before);
  });

  test('the disabled rows still scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 560 });
    await openApp(page, { FORMAMORPH_imageEndpointPresets: JSON.stringify(STORE), FORMAMORPH_imageGenDisabled: 'true' });
    await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'endpoints', subtab: 'image' });

    await expect(page.locator('#imageEndpoint')).toBeDisabled();
    const viewport = page.locator('[role="tabpanel"][data-state="active"] [data-radix-scroll-area-viewport]').last();
    expect(await viewport.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
    const box = (await viewport.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  });
});
