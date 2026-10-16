import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

/** A pending turn shows no thought until its own reasoning streams: the last turn's never rides over onto it. */

const OLD_THOUGHT = 'Plan: the console answers the knock.';
const NEW_THOUGHT = 'Plan: the seam splits open.';
const REPLY = 'The console blinks once.';
const NEXT_REPLY = 'The seam splits with a hiss.';

const frame = (delta: object) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: null }] })}\n\n`;
const turnBody = (thought: string, reply: string) => `${frame({ reasoning_content: thought })}${frame({ content: reply })}data: [DONE]\n\n`;

/** Serves the first turn at once, then holds every later request until `release` is called. */
async function mockEndpoint(page: Page) {
  let held = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    if (held) await gate;
    return route.fulfill({
      headers: { 'Content-Type': 'text/event-stream' },
      body: held ? turnBody(NEW_THOUGHT, NEXT_REPLY) : turnBody(OLD_THOUGHT, REPLY),
    });
  });
  return { hold: () => { held = true; }, release: () => release() };
}

async function playFirstTurn(page: Page) {
  const endpoint = await mockEndpoint(page);
  await openApp(page, {
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await page.getByPlaceholder(/Type your action/).fill('I knock on the seam.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(REPLY).last()).toBeVisible();
  await expect(page.getByText(/Thought for/)).toHaveCount(1);
  return endpoint;
}

test('a new action shows no thought until its own reasoning streams', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const endpoint = await playFirstTurn(page);

  endpoint.hold();
  await page.getByPlaceholder(/Type your action/).fill('I pry at the seam.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('button', { name: 'Send' })).toHaveCount(0);
  await expect(page.getByText(/Thought for|Thinking…/)).toHaveCount(0);

  endpoint.release();
  await expect(page.getByText(NEXT_REPLY).last()).toBeVisible();
  await expect(page.getByText(/Thought for/)).toHaveCount(1);
});

test('a re-generated turn shows no thought until its own reasoning streams', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const endpoint = await playFirstTurn(page);

  endpoint.hold();
  await page.getByRole('button', { name: 'Re-generate Narration' }).first().click();
  await expect(page.getByText(/Thought for|Thinking…/)).toHaveCount(0);

  endpoint.release();
  await expect(page.getByText(NEXT_REPLY).last()).toBeVisible();
  await expect(page.getByText(/Thought for/)).toHaveCount(1);
});
