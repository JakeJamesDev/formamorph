import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './app';

/** Serve the whiteRoom world and save with Coin (60 of 100 in the save) carrying `code` and `regen`.
 *  `extra` is laid over the root of each fixture. */
async function coinWithCode(page: Page, code: string, regen = 0, extra: { World?: object; Save?: object } = {}) {
  for (const kind of ['World', 'Save'] as const) {
    const fixture = { ...JSON.parse(readFileSync(`src/lib/devFixtures/whiteRoom${kind}.json`, 'utf8')), ...extra[kind] };
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if ('id' in value && value.id === 'stat-coin' && 'name' in value) Object.assign(value, { code, regen });
      Object.values(value).forEach(visit);
    };
    visit(fixture);
    await page.route(`**/whiteRoom${kind}.json*`, (route) => route.fulfill({
      contentType: 'application/javascript', body: `export default ${JSON.stringify(fixture)}`,
    }));
  }
}

/** Answer every chat call: the stat tracker gets `statReply`, narration gets a line of prose. */
async function mockModel(page: Page, statReply: string) {
  let statCalls = 0;
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    const system = route.request().postDataJSON().messages
      .find((message: { role: string }) => message.role === 'system')?.content ?? '';
    const isStats = system.includes('stat tracker');
    if (isStats) statCalls += 1;
    const text = isStats ? statReply : 'You count the coins twice.';
    await route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` });
  });
  return () => statCalls;
}

const settings = (extra: Record<string, unknown> = {}) => ({
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
  FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  ...extra,
});

async function playOneTurn(page: Page) {
  const mobile = (page.viewportSize()?.width ?? 1280) < 768;
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  await expect(page.getByText(/60\s*\/\s*100/).first()).toBeVisible();
  await page.waitForFunction(() => '__baseline' in window);
  await page.evaluate(() => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
    .__baseline.runScript(['Count the coins.']));
  return mobile;
}

test('stat code halves an AI gain, and a stats re-roll lands the same value', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'self.value = self.previous.value + self.requested.value / 2;');
  const statCalls = await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  const mobile = await playOneTurn(page);

  // The AI asked +20 onto 60; the code keeps half of it.
  await expect(page.getByText(/70\s*\/\s*100/).first()).toBeVisible();

  if (mobile) await page.getByRole('button', { name: 'Game', exact: true }).click();
  await page.getByRole('button', { name: 'More re-generate options', exact: true }).click();
  await page.getByRole('button', { name: 'Re-generate Stats', exact: true }).click();
  await expect.poll(statCalls).toBe(2);
  await expect(page.getByRole('button', { name: 'More re-generate options', exact: true })).toBeEnabled();
  if (mobile) await page.getByRole('button', { name: 'Status', exact: true }).click();
  // From the same pre-turn 60, not from the 70 the first run left.
  await expect(page.getByText(/70\s*\/\s*100/).first()).toBeVisible();
  await expect(page.getByText(/(80|75)\s*\/\s*100/)).toHaveCount(0);
});

test('stat code reads the value after this turn’s regen, and the regen it applied', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'self.value = self.value + self.regenApplied;', 5);
  await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  // 60 + 20 asked + 5 regen = 85 is what code reads; it adds the regen once more.
  await expect(page.getByText(/90\s*\/\s*100/).first()).toBeVisible();
});

test('stat code sets its value from the playthrough’s roll of a placeholder', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  const mood = { id: 'ph-mood', name: 'Mood', values: [{ id: 'v-calm', text: 'calm' }, { id: 'v-angry', text: 'angry' }] };
  await coinWithCode(page, 'return { calm: 11, angry: 22 }[placeholders.Mood.value];', 0, {
    World: { placeholders: [mood] },
    Save: { placeholderRolls: { world: { 'ph-mood': 'angry' } } },
  });
  await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/22\s*\/\s*100/).first()).toBeVisible();
});

test('a stat code bound shows as the bar’s range, and the delta reports only the value’s movement', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'self.max = 150;');
  await mockModel(page, 'Coin: +20');
  await openApp(page, settings(), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/80\s*\/\s*150/).first()).toBeVisible();
  await expect(page.getByText('+20', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^\+(50|70)$/)).toHaveCount(0);
});

test('clock-reading stat code runs with zero asks on a turn with no stat update', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  await coinWithCode(page, 'return self.previous.value + self.requested.value + self.requested.max + 5 * deltaHours;');
  const statCalls = await mockModel(page, 'Coin: +20');
  await openApp(page, settings({ FORMAMORPH_statUpdatesEnabled: false }), { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await playOneTurn(page);

  await expect(page.getByText(/65\s*\/\s*100/).first()).toBeVisible();
  expect(statCalls()).toBe(0);
});
