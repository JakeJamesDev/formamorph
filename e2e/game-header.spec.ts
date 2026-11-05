import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

/** The game header's two-segment button: a save made from one half appears in the other, and loads. And the left panel's row. */

/** Stores this spec's frames in this folder, when set. */
const FRAMES_DIR = process.env.WINDOW_FRAMES_DIR;

const setTheme = (page: Page, theme: string) => page.evaluate((t) => {
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(t);
}, theme);

async function play(page: Page, action: string) {
  await page.getByPlaceholder(/Type your action/).fill(action);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
}

test('the left panel row reads Back, Music and the toggle, 8px above the entity image', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The row is desktop only');
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await openApp(page, {}, { url: '/#dev?view=gameViewer&fixture=entityStats&tab=entities' });

  const back = page.getByRole('button', { name: 'Exit to Main Menu' });
  const toggle = page.getByRole('button', { name: 'Hide Entity View' });
  await back.waitFor();
  const gap = () => toggle.evaluate((el) => {
    const row = el.parentElement as HTMLElement;
    // The section's grid clip holds the 8px margin, so measure the box inside it.
    const view = row.nextElementSibling?.firstElementChild?.firstElementChild;
    return view?.querySelector('img') ? view.getBoundingClientRect().top - row.getBoundingClientRect().bottom : null;
  });
  await expect.poll(gap).toBe(8);

  // Back, Music and the toggle share one row, in that order, with Back at the far left.
  const boxes = await Promise.all([back, page.getByRole('button', { name: 'Turn Music Off' }), toggle].map((b) => b.boundingBox()));
  const [b, m, t] = boxes.map((box) => { if (!box) throw new Error('A row control is missing'); return box; });
  expect(new Set([b.y, m.y, t.y]).size).toBe(1);
  expect(b.x).toBeLessThan(m.x - 80);
  expect(m.x + m.width).toBeLessThanOrEqual(t.x);

  if (FRAMES_DIR) {
    mkdirSync(FRAMES_DIR, { recursive: true });
    const clip = { x: 0, y: 0, width: t.x + t.width + 24, height: 460 };
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(FRAMES_DIR, `game-left-row-${theme}.png`), clip });
      await page.getByRole('button', { name: 'Turn Music Off' }).click();
      await page.mouse.move(600, 500);
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(FRAMES_DIR, `game-left-row-music-off-${theme}.png`), clip });
      await page.getByRole('button', { name: 'Turn Music On' }).click();
    }
    await setTheme(page, 'dark');
  }
});

test('mobile keeps its single menu', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone profile only');
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await openApp(page, {}, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });

  await page.getByRole('button', { name: 'More Actions' }).click();
  for (const name of ['Save Game', 'Load Game', 'Edit World', 'AI Context', 'Settings', 'Exit to Main Menu']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  if (FRAMES_DIR) {
    mkdirSync(FRAMES_DIR, { recursive: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(FRAMES_DIR, 'game-mobile-375.png') });
  }
});

test('a save from the Save half appears under the Load half and reaches the saved game', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The direct buttons are desktop only');
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  let narration = 'The console blinks.';
  await page.route('**/chat/completions', (route) => route.fulfill({
    headers: { 'Content-Type': 'text/event-stream' },
    body: `data: ${JSON.stringify({ choices: [{ delta: { content: narration }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
  }));
  await openApp(page, {
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
    FORMAMORPH_autosaveEnabled: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });

  await play(page, 'I knock.');
  await expect(page.getByText('The console blinks.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Save Game' }).click();
  const save = page.getByRole('dialog', { name: 'Save Game' });
  await save.getByPlaceholder('Enter save name').fill('Before The Door');
  await save.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(save).toBeHidden();

  narration = 'The door swings open.';
  await play(page, 'I push.');
  await expect(page.getByText('The door swings open.').first()).toBeVisible();

  await page.getByRole('button', { name: 'Load Game' }).click();
  const load = page.getByRole('dialog', { name: 'Load Game' });
  await load.getByText('Before The Door').click();
  // The fixture's world isn't in the library, so its save asks before it loads in place.
  await page.getByRole('alertdialog', { name: 'Load a save from another world?' }).getByRole('button', { name: 'Confirm' }).click();
  await expect(load).toBeHidden();

  await expect(page.getByText('The console blinks.').first()).toBeVisible();
  await expect(page.getByText('The door swings open.')).toHaveCount(0);
});
