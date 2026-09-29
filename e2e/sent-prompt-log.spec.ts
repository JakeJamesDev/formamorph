import { expect, test } from '@playwright/test';
import { openApp } from './app';

/** An action whose request fails is kept in the sent-prompt log, and one click puts it back in the box. */

const ACTION = 'I pry the seam open with the crowbar, slowly.';

test('a failed send leaves its text in the sent-prompt log, which puts it back in the box', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({ status: 500, body: 'upstream down' }));
  await openApp(page, {
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });

  const box = page.getByPlaceholder(/Type your action/);
  await box.fill(ACTION);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  await expect(box).toHaveValue('');

  // Hidden while the box is closed; shown once it is focused.
  await expect(page.getByRole('button', { name: 'Sent prompts' })).toHaveCount(0);
  await box.focus();
  await page.getByRole('button', { name: 'Sent prompts' }).click();
  await page.getByTestId('sent-prompts').getByText(ACTION).click();
  await expect(box).toHaveValue(ACTION);
});
