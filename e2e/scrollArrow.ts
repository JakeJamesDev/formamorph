import { expect, type Locator, type Page } from '@playwright/test';

/** An answer long enough to scroll the conversation. */
export const LONG_ANSWER = Array.from({ length: 40 }, (_, n) => `${n + 1}. Select the control for step ${n + 1} and wait for the list to change.`).join('\n');

/**
 * Stubs a text endpoint that answers with LONG_ANSWER and picks nothing. The caller opens the app with the
 * returned endpoint URL.
 */
export async function stubLongAnswer(page: Page): Promise<void> {
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    const body = route.request().postDataJSON() as { max_tokens: number };
    const text = body.max_tokens === 150 ? 'No section of the list answers the question.' : LONG_ANSWER;
    const frame = `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\n`;
    await route.fulfill({ contentType: 'text/event-stream', body: `${frame}data: [DONE]\n\n` });
  });
}

/**
 * After a long answer: no arrow at the end, an arrow at the bottom center of the conversation and above the
 * ask field once the player scrolls up, and a click that returns to the end and removes it.
 */
export async function expectScrollArrow(helpWindow: Locator, askField: Locator): Promise<void> {
  const scroller = helpWindow.locator('[data-fq-scroll="conversation"]');
  const arrow = helpWindow.getByRole('button', { name: 'Scroll to End' });
  const away = () => scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);

  await expect.poll(away).toBeLessThanOrEqual(2);
  await expect(arrow).toHaveCount(0);

  await scroller.evaluate((el) => { el.scrollTop = 0; });
  await expect(arrow).toBeVisible();
  const painted = (await arrow.boundingBox())!;
  const area = (await scroller.boundingBox())!;
  const field = (await askField.boundingBox())!;
  expect(painted.x + painted.width / 2, 'centered on the conversation').toBeCloseTo(area.x + area.width / 2, 0);
  expect(painted.y + painted.height, 'inside the conversation').toBeLessThanOrEqual(area.y + area.height);
  expect(painted.y + painted.height, 'above the input').toBeLessThanOrEqual(field.y);
  expect(painted.width).toBeCloseTo(painted.height, 0);

  await arrow.click();
  await expect.poll(away).toBeLessThanOrEqual(2);
  await expect(arrow).toHaveCount(0);
}
