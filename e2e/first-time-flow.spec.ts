import { expect, test, type Page } from '@playwright/test';
import { openApp } from './app';

/**
 * The effort's whole path on a fresh profile: the intro, Play Emberwatch, five turns on a stubbed Demo AI, the
 * card and the scene. Nothing is seeded, so every step a new player meets is on the way.
 */

const NARRATION = 'The watch fire snaps in the wind above Emberwatch.';
const CHOICES = '1. Climb the wall\n2. Wake the captain';
const sse = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`;

/** Answers the Demo AI and keeps the community server out of the run. */
async function stubServers(page: Page) {
  await page.route(/\/events(\/active)?(\?|$)/, (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    const body = route.request().postDataJSON() as { messages: { role: string; content: string }[] };
    const system = body.messages.find((message) => message.role === 'system')?.content ?? '';
    const text = system.includes('player choice writer') ? CHOICES : system.includes('stat tracker') ? 'No changes' : NARRATION;
    await route.fulfill({ contentType: 'text/event-stream', body: sse(text) });
  });
}

const actionBox = (page: Page) => page.getByPlaceholder(/^Type your action/);
const card = (page: Page) => page.getByTestId('story-card');
const scene = (page: Page) => page.getByRole('dialog', { name: /Keep in Mind/ });

/** Sends the box and waits for the turn to settle: its text gone, and the re-roll awake with the choices back. */
async function sendAndSettle(page: Page) {
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(actionBox(page)).toHaveValue('', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /Climb the wall/ }).first()).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Regenerate Choices' }).first()).toBeEnabled({ timeout: 30_000 });
}

async function playTurn(page: Page, action: string) {
  await actionBox(page).fill(action);
  await sendAndSettle(page);
}

test('a fresh profile reaches the card and the scene through a first game', async ({ page }) => {
  test.setTimeout(240_000);
  page.on('pageerror', (error) => console.error(error.message));
  await stubServers(page);
  await page.goto('/');

  const play = page.getByRole('button', { name: 'Play Emberwatch' });
  await expect(play).toBeVisible({ timeout: 60_000 });
  await play.click();

  // The world's readme still queues in the game.
  const readme = page.getByRole('dialog').filter({ hasText: /Emberwatch/ });
  await expect(actionBox(page).or(readme).first()).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(500);
  if (await readme.isVisible()) await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: 'Demo AI' })).toBeVisible();
  await expect(actionBox(page)).toBeEnabled({ timeout: 30_000 });
  // Emberwatch rolls its opening: a first action waiting in the box, or a written page with its choices coming.
  // Neither counts as a turn.
  const firstChoice = page.getByRole('button', { name: /Climb the wall/ }).first();
  await expect(async () => {
    expect(await actionBox(page).inputValue() !== '' || await firstChoice.isVisible()).toBe(true);
  }).toPass({ timeout: 30_000 });
  if (await actionBox(page).inputValue() !== '') await sendAndSettle(page);
  await expect(page.getByRole('button', { name: 'Regenerate Choices' }).first()).toBeEnabled({ timeout: 30_000 });

  for (let turn = 1; turn <= 4; turn += 1) await playTurn(page, `Action ${turn}`);
  await expect(card(page)).toHaveCount(0);

  await playTurn(page, 'Action 5');
  await expect(card(page)).toBeVisible();
  // The card sits between the narration and the choices, in view, and leaves play usable.
  const cardBox = (await card(page).boundingBox())!;
  const narrationBox = (await page.getByTestId('narration').boundingBox())!;
  const choiceBox = (await page.getByRole('button', { name: /Climb the wall/ }).first().boundingBox())!;
  expect(cardBox.y).toBeGreaterThanOrEqual(narrationBox.y + narrationBox.height);
  expect(choiceBox.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height);
  expect(await card(page).evaluate((el) => el.contains(document.activeElement))).toBe(false);
  await actionBox(page).fill('A half-typed action');

  await card(page).getByRole('button', { name: 'See Levels' }).click();
  await expect(scene(page)).toBeVisible();
  await expect(page.locator('[data-road-stage]')).toBeVisible();

  await scene(page).getByRole('button', { name: 'Keep Playing' }).click();
  await expect(scene(page)).toHaveCount(0);
  await expect(card(page)).toHaveCount(0);
  await expect(actionBox(page)).toHaveValue('A half-typed action');
  await expect(page.getByTestId('narration')).toContainText(NARRATION);

  // The badge is the way back after the card.
  await page.getByRole('button', { name: 'Demo AI' }).click();
  await page.getByRole('dialog', { name: "You're Playing on the Demo AI" }).getByRole('button', { name: 'See Levels' }).click();
  await expect(scene(page)).toBeVisible();
  await scene(page).getByRole('button', { name: 'Keep Playing' }).click();
  await expect(scene(page)).toHaveCount(0);

  await playTurn(page, 'Action 6');
  await expect(card(page)).toHaveCount(0);
});

test('the card shows in Chat, in view, under the latest narration and above the choices', async ({ page }) => {
  test.setTimeout(120_000);
  await stubServers(page);
  // Four turns already on the record, so this game's next action is the fifth.
  await openApp(page, {
    FORMAMORPH_narrationLayout: 'chat', FORMAMORPH_thinkingMode: 'off', FORMAMORPH_demoAITurnCount: '4', FORMAMORPH_useCustomEndpoint: 'false', FORMAMORPH_endpointUrl: '',
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await expect(page.getByRole('button', { name: 'Demo AI' })).toBeVisible({ timeout: 60_000 });
  await expect(actionBox(page)).toBeEnabled({ timeout: 30_000 });
  await expect(card(page)).toHaveCount(0);

  await playTurn(page, 'Action 5');
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toBeInViewport();
  const cardBox = (await card(page).boundingBox())!;
  const choice = page.getByRole('button', { name: /Climb the wall/ }).first();
  expect((await choice.boundingBox())!.y).toBeGreaterThan(cardBox.y);
  await expect(actionBox(page)).toBeEnabled();
});

const FRAMES = [
  { name: 'card-chat-1280', layout: 'chat', width: 1280, height: 860 },
  { name: 'card-pages-1280', layout: 'pages', width: 1280, height: 860 },
  { name: 'card-pages-375', layout: 'pages', width: 375, height: 812 },
];

for (const { name, layout, width, height } of FRAMES) {
  for (const theme of ['dark', 'light']) {
    test(`frame ${name} ${theme}`, async ({ page }) => {
      test.skip(!process.env.STORY_CARD_FRAMES, 'frames only on request');
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height });
      await stubServers(page);
      await openApp(page, { FORMAMORPH_narrationLayout: layout, 'vite-ui-theme': theme }, { url: `/#dev?view=gameViewer&fixture=whiteRoom&modal=storyCard&tab=status` });
      await expect(card(page)).toBeVisible({ timeout: 60_000 });
      await card(page).scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `.scratch/frames/${name}${theme === 'light' ? '-light' : ''}.png`, style: '[aria-label^="Notifications"] { display: none !important; }' });
    });
  }
}
