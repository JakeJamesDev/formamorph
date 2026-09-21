import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './app';

/**
 * The bundled Open Chat world with one imported card's entity present, through the real game view: the
 * entity's greeting is page one, and the next turn's narration request runs on the world's own narration
 * prompt with its tone chips resolved. Only the view can show that the world prompt and its chip values
 * reach the request together.
 *
 * `OPEN_CHAT_LIVE=<chat completions URL>` with `OPEN_CHAT_MODEL=<id>` sends the same turn to a real model
 * and prints the reply, for the one-frame check a mock cannot make.
 */

interface LoggedRequest { type: string; messages: { role: string; content: string }[] }
interface LoggedTurn { action: string; requests: LoggedRequest[] }

const LIVE = process.env.OPEN_CHAT_LIVE;
const MOCK_REPLY = 'Maren sets a mug in front of you. "Drink it while it is hot," she says.';

const world = JSON.parse(readFileSync('src/defaultworlds/open-chat.json', 'utf8'));
const card = JSON.parse(readFileSync('testing/baseline/open-chat-cards.json', 'utf8'))[0].data;
const greeting: string = card.first_mes;
// The library entity the player picked at Enter World, as the card importer shapes one.
world.devPicked = [{
  id: 'e2e-card-entity',
  name: card.name,
  aiDescription: card.description.replaceAll('{{char}}', card.name),
  openings: [{ id: 'e2e-greeting', text: greeting, kind: 'narration' }],
}];

const settings = {
  FORMAMORPH_endpointUrl: LIVE ?? 'http://127.0.0.1:5190/v1/chat/completions',
  ...(LIVE ? { FORMAMORPH_modelName: process.env.OPEN_CHAT_MODEL ?? 'default' } : {}),
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
  FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
};

async function startOpenChat(page: Page) {
  page.on('pageerror', (error) => console.error(error.message));
  if (!LIVE) {
    await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
    await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
    await page.route('**/chat/completions', (route) => route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: MOCK_REPLY }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` }));
  }
  // The fixture loader boots whatever world file it is served, through the app's own load and migration.
  await page.route('**/whiteRoomWorld.json*', (route) => route.fulfill({
    contentType: 'application/javascript', body: `export default ${JSON.stringify(world)}`,
  }));
  await openApp(page, settings, { url: '/#dev?view=gameViewer&fixture=pickedOpening' });
  await page.waitForFunction(() => '__baseline' in window);
}

const turns = (page: Page) =>
  page.evaluate(() => (window as unknown as { __baseline: { getDebugTurns(): LoggedTurn[] } }).__baseline.getDebugTurns());

test('the greeting is page one, and the next turn runs on the world narration prompt with its tone chips resolved', async ({ page }) => {
  test.setTimeout(LIVE ? 180_000 : 30_000);
  await startOpenChat(page);
  await expect(page.getByText(/You're dripping on the poetry/).first()).toBeVisible();

  const action = '"Estate sale? Whose?" I pull a stool up to the counter.';
  await page.evaluate((text) => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
    .__baseline.runScript([text]), action);

  const log = await turns(page);
  expect(log[0].requests.map((request) => request.type)).not.toContain('narration');
  const narration = log[log.length - 1].requests.find((request) => request.type === 'narration')!;
  const system = narration.messages.find((message) => message.role === 'system')!.content;
  const chat = narration.messages.filter((message) => message.role !== 'system');

  expect(chat.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
  expect(chat[1].content).toContain("You're dripping on the poetry");
  // The world's prompt, not the preset's: its opening words, and every tone default as plain text.
  expect(system).toContain('told as a conversation');
  for (const placeholder of world.placeholders) expect(system).toContain(placeholder.values[0].text);
  expect(system).not.toContain('{{ph:');

  if (LIVE) {
    const reply = await page.evaluate(() => document.querySelector('main')?.textContent ?? document.body.textContent ?? '');
    console.log(`\n--- live reply page ---\n${reply.slice(-1500)}\n`);
  }
});
