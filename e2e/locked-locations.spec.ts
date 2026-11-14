import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { openApp } from './app';

/**
 * Locked locations on Change Location, in a real browser: a real click on a locked row or box lands on it and
 * leaves the player where they were (Q3). The frames show the List and the Map in both themes.
 */

const FRAMES = '.scratch/frames';

async function openTravel(page: Page, theme: 'light' | 'dark') {
  // A reachable endpoint, so no connection dialog covers the travel dialog. No turn is played.
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await openApp(page, { 'vite-ui-theme': theme, FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions' }, { url: '/#dev?view=gameViewer&fixture=lockedPlaces&modal=location' });
  const dialog = page.getByRole('dialog', { name: 'Change Location' });
  await dialog.waitFor();
  return dialog;
}

/** Where the player stands, as the List marks it. */
async function standing(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Change Location' });
  await dialog.getByRole('tab', { name: 'List' }).click();
  return dialog.locator('button[aria-current="location"]').textContent();
}

test.use({ viewport: { width: 1280, height: 800 } });

test.describe('a locked location', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the frames and the Map clicks are desktop');
  });

  test('refuses a List click and keeps the player where they were', async ({ page }) => {
    const dialog = await openTravel(page, 'light');
    await dialog.getByRole('tab', { name: 'List' }).click();
    const corridor = dialog.getByRole('button', { name: /^Corridor/ });
    await expect(corridor).toContainText('The hatch is sealed from the other side.');
    // aria-disabled fails Playwright's enabled check; force still sends a real mouse click to the box.
    await corridor.click({ force: true });
    await expect(dialog).toBeVisible();
    expect(await standing(page)).toContain('The White Room');
  });

  test('refuses a Map click and keeps the player where they were', async ({ page }) => {
    const dialog = await openTravel(page, 'light');
    await dialog.getByRole('tab', { name: 'Map' }).click();
    const corridor = dialog.locator('.react-flow__node[data-id="dev-corridor"] button');
    await expect(corridor).toHaveAttribute('aria-disabled', 'true');
    // aria-disabled fails Playwright's enabled check; force still sends a real mouse click to the box.
    await corridor.click({ force: true });
    await expect(dialog).toBeVisible();
    expect(await standing(page)).toContain('The White Room');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`frames the List and the Map in ${theme}`, async ({ page }) => {
      mkdirSync(FRAMES, { recursive: true });
      const suffix = theme === 'dark' ? '-dark' : '';
      const dialog = await openTravel(page, theme);
      await dialog.getByRole('tab', { name: 'List' }).click();
      await dialog.getByRole('button', { name: /^Vent Crawl/ }).waitFor();
      await page.screenshot({ path: `${FRAMES}/locked-list${suffix}.png` });
      await dialog.getByRole('tab', { name: 'Map' }).click();
      await dialog.locator('.react-flow__node[data-id="dev-corridor"]').waitFor();
      await page.waitForTimeout(400);
      await dialog.locator('.react-flow__node[data-id="dev-corridor"] button').hover();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${FRAMES}/locked-map${suffix}.png` });
    });
  }
});
