import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

/**
 * Edit on a player action in Chat and in Pages, from the menu to the saved text. jsdom hangs when a menu row opens a
 * Dialog, so the menu and the modal run here; the history write itself is unit-tested (`rewriteTurnAction`).
 */

async function openChat(page: Page) {
  page.on('pageerror', (error) => console.error(error.message));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await openApp(page, { FORMAMORPH_narrationLayout: 'chat' }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await page.locator('[data-chat-scroller] article').first().waitFor();
}

/** Each mounted turn's action and narration text, keyed by its turn index. */
function turnTexts(page: Page) {
  return page.locator('[data-chat-scroller] article[data-index]').evaluateAll((articles) =>
    Object.fromEntries(articles.map((a) => [
      (a as HTMLElement).dataset.index,
      {
        action: a.querySelector('[data-testid="player-action"]')?.textContent ?? null,
        narration: a.querySelector('[data-testid="narration"]')?.textContent ?? null,
      },
    ])));
}

test('Edit on an action bubble rewrites that action and nothing else', async ({ page }) => {
  await openChat(page);
  const index = (await page.locator('[data-chat-scroller] article[data-index]').nth(1).getAttribute('data-index'))!;
  const bubble = page.locator(`[data-chat-scroller] article[data-index="${index}"]`).getByTestId('player-action');
  await bubble.scrollIntoViewIfNeeded();
  const before = await turnTexts(page);
  const original = before[index].action!;

  await bubble.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox')).toHaveText(original);
  await dialog.getByRole('textbox').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('I knock on the wall.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  await expect(bubble).toHaveText('I knock on the wall.');
  const after = await turnTexts(page);
  expect(after[index]).toEqual({ ...before[index], action: 'I knock on the wall.' });
  // The list is virtualized: compare the neighbors mounted both times, and require at least one.
  const neighbors = Object.keys(before).filter((key) => key !== index && key in after);
  expect(neighbors.length).toBeGreaterThan(0);
  for (const key of neighbors) expect(after[key]).toEqual(before[key]);
});

test('Edit on the Pages action line rewrites that action and not the narration', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await openApp(page, { FORMAMORPH_narrationLayout: 'pages' }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const line = page.getByTestId('action-line');
  const narration = page.getByTestId('narration');
  await line.waitFor();
  const original = await line.textContent();
  const story = await narration.textContent();

  await line.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('textbox')).toHaveText(original!);
  await dialog.getByRole('textbox').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('I knock on the wall.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  await expect(line).toHaveText('I knock on the wall.');
  await expect(narration).toHaveText(story!);
});
