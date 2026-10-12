import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

/** Autosave keeps the world's last turns, as many as Autosaves Kept says, each named by its turn, overwriting
 *  the oldest; lowering the setting trims the extras on the next autosave. */

async function play(page: Page, action: string) {
  await page.getByPlaceholder(/Type your action/).fill(action);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
}

/** The autosave records in the game's save database, by name. */
const autosaveNames = (page: Page) => page.evaluate(() => new Promise<string[]>((resolve, reject) => {
  const open = indexedDB.open('FORMAMORPH_DB');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const request = open.result.transaction('saveRecords', 'readonly').objectStore('saveRecords').getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(
      (request.result as Array<{ name: string; isAutosave?: boolean }>).filter((r) => r.isAutosave).map((r) => r.name).sort(),
    );
  };
}));

test('seven turns keeping five leave the five latest autosaves, named by turn, and lowering it to two trims the rest', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'storage behavior, not layout');
  page.on('pageerror', (error) => console.error(error.message));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({
    headers: { 'Content-Type': 'text/event-stream' },
    body: `data: ${JSON.stringify({ choices: [{ delta: { content: 'The console blinks.' }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
  }));
  await openApp(page, {
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
    FORMAMORPH_autosaveEnabled: true, FORMAMORPH_autosaveSlots: 5,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });

  for (let i = 1; i <= 7; i++) await play(page, `I knock, time ${i}.`);
  await expect.poll(() => autosaveNames(page)).toHaveLength(5);
  const names = await autosaveNames(page);
  expect(names.every((name) => /^Autosave · Turn \d+$/.test(name))).toBe(true);
  // The fixture opens mid-story, so the turn numbers are read, not assumed: five consecutive, the latest last.
  const turns = names.map((name) => Number(name.split('Turn ')[1])).sort((a, b) => a - b);
  expect(turns[4] - turns[0]).toBe(4);

  // Lowered in Settings: a warning until Settings closes, then the next autosave leaves two.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('tab', { name: 'Data' }).click();
  const slider = settings.locator('#autosaveSlots').getByRole('slider');
  await slider.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(settings.getByRole('status').filter({ hasText: 'autosaves past 2 on its next autosave' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  // Reopened, 2 is where it now stands: nothing was lowered this time, so no warning.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await settings.getByRole('tab', { name: 'Data' }).click();
  await expect(settings.locator('#autosaveSlots').getByRole('slider')).toHaveAttribute('aria-valuenow', '2');
  await expect(settings.getByText(/on its next autosave/)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await play(page, 'I knock once more.');
  await expect.poll(() => autosaveNames(page)).toHaveLength(2);
});

