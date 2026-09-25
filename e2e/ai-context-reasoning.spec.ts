import { expect, test } from '@playwright/test';
import { gotoDev, openApp } from './app';

/** A turn's native reasoning shows in AI Context for that turn, and later turns' history leaves it out. */

const REASONING = 'Plan: the console answers the knock.';
const REPLY = 'The console blinks once.';

test('AI Context shows a turn\'s raw reasoning, and the next turn does not send it', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const bodies: string[] = [];
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => {
    bodies.push(route.request().postData() ?? '');
    const frame = (delta: object) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\n`;
    return route.fulfill({
      headers: { 'Content-Type': 'text/event-stream' },
      body: `${frame({ reasoning_content: REASONING })}${frame({ content: REPLY })}data: [DONE]\n\n`,
    });
  });
  await openApp(page, {
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });

  const act = async (action: string) => {
    await page.getByPlaceholder(/Type your action/).fill(action);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByText(REPLY).last()).toBeVisible();
  };
  await act('I knock on the seam.');

  await gotoDev(page, 'gameViewer', { modal: 'aiContext' });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Raw Reasoning' }).first()).toBeVisible();
  await expect(dialog.getByText(REASONING).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await gotoDev(page, 'gameViewer');

  const sent = bodies.length;
  await act('I knock again.');
  const later = bodies.slice(sent);
  // The history carries the first turn's reply, so its reasoning had the chance to ride along.
  expect(later.some((body) => body.includes(REPLY))).toBe(true);
  expect(later.filter((body) => body.includes(REASONING))).toEqual([]);
});
