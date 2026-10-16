import { expect, test, type Page, type Route } from '@playwright/test';
import { openApp } from './app';

/**
 * Regenerate Memory during a digest backfill, through the real game view: the press waits behind the running
 * pass with a Cancel, then runs; Cancel returns the row to idle. The model is held by hand, so the order of
 * the requests is the thing under test.
 */

const REWRITTEN = 'The party rested at the white seam.';

/** Holds every model request until the test answers it. */
async function holdModel(page: Page): Promise<Route[]> {
  const held: Route[] = [];
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => { held.push(route); });
  return held;
}

const answer = (route: Route, text: string) => route.fulfill({
  contentType: 'text/event-stream',
  body: `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
});

async function openMemoryManager(page: Page) {
  await page.getByRole('button', { name: 'Manage Memories' }).click();
  return page.getByRole('dialog');
}

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'The Memory tab is a desktop panel');
  page.on('pageerror', (error) => console.error(error.message));
});

async function openBackfill(page: Page) {
  const held = await holdModel(page);
  await openApp(page, {
    FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false, FORMAMORPH_concurrentTurnRequests: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: true, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom&tab=memory' });
  // The first backfill digest is in flight; answering it writes the first memory row.
  await expect.poll(() => held.length).toBe(1);
  const firstBody = held[0].request().postData();
  await answer(held.shift()!, 'The party woke in the white room.');
  await expect.poll(() => held.length).toBe(1);
  return { held, firstBody };
}

test('Regenerate Memory waits behind the running backfill, then runs', async ({ page }) => {
  const { held } = await openBackfill(page);
  const dialog = await openMemoryManager(page);
  const rewrite = dialog.getByRole('button', { name: 'Have the Story Write This Memory Again' }).first();
  await rewrite.click();

  await expect(dialog.getByRole('button', { name: 'Cancel Rewrite' })).toBeVisible();
  await expect(rewrite).toBeDisabled();
  // Only the running digest is out; the regenerate has not reached the model.
  await page.waitForTimeout(300);
  expect(held).toHaveLength(1);

  await answer(held.shift()!, 'The party left the white room.');
  await expect.poll(() => held.length).toBe(1); // the regenerate, ahead of the next digest
  await answer(held.shift()!, REWRITTEN);
  await expect(dialog.getByText(REWRITTEN)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel Rewrite' })).toHaveCount(0);
  await expect(rewrite).toBeEnabled();
});

test('Cancel while Regenerate Memory waits returns the row to idle and sends nothing', async ({ page }) => {
  const { held, firstBody } = await openBackfill(page);
  const dialog = await openMemoryManager(page);
  const rewrite = dialog.getByRole('button', { name: 'Have the Story Write This Memory Again' }).first();
  await rewrite.click();
  await dialog.getByRole('button', { name: 'Cancel Rewrite' }).click();

  await expect(dialog.getByRole('button', { name: 'Cancel Rewrite' })).toHaveCount(0);
  await expect(rewrite).toBeEnabled();
  await answer(held.shift()!, 'The party left the white room.');
  // The backfill goes on with its next digest. A regenerate left in the queue would send the first memory's
  // request again, ahead of it.
  await expect.poll(() => held.length).toBe(1);
  expect(held[0].request().postData()).not.toBe(firstBody);
});
