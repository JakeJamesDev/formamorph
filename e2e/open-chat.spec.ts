import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gotoDev, openApp } from './app';
import { readTavernJson } from '../src/lib/tavernCard';

/**
 * Open Chat with an imported card's entity picked, through the real game view. Only the view can show
 * that the world's narration prompt and its tone chip values reach the request together.
 * `OPEN_CHAT_LIVE=<completions URL>` and `OPEN_CHAT_MODEL=<id>` send the turn to a real model and print it.
 */

interface LoggedRequest { type: string; messages: { role: string; content: string }[] }
interface LoggedTurn { action: string; requests: LoggedRequest[] }

const LIVE = process.env.OPEN_CHAT_LIVE;
const MOCK_REPLY = 'Maren sets a mug in front of you. "Drink it while it is hot," she says.';

const world = JSON.parse(readFileSync('src/defaultworlds/open-chat.json', 'utf8'));
const card = JSON.parse(readFileSync('testing/baseline/open-chat-cards.json', 'utf8'))[0];
// The library entity the player picked at Enter World, read by the card importer.
world.devPicked = [readTavernJson(JSON.stringify(card))!.entity];

const settings = {
  FORMAMORPH_endpointUrl: LIVE ?? 'http://127.0.0.1:5190/v1/chat/completions',
  ...(LIVE ? { FORMAMORPH_modelName: process.env.OPEN_CHAT_MODEL ?? 'default' } : {}),
  FORMAMORPH_narrationLayout: 'chat',
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
  FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
};

async function mockModel(page: Page) {
  page.on('pageerror', (error) => console.error(error.message));
  if (LIVE) return;
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({ contentType: 'text/event-stream', body:
    `data: ${JSON.stringify({ choices: [{ delta: { content: MOCK_REPLY }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` }));
}

async function startOpenChat(page: Page) {
  await mockModel(page);
  // The fixture loader boots whatever world file it is served, through the app's own load and migration.
  await page.route('**/whiteRoomWorld.json*', (route) => route.fulfill({
    contentType: 'application/javascript', body: `export default ${JSON.stringify(world)}`,
  }));
  await openApp(page, settings, { url: '/#dev?view=gameViewer&fixture=pickedOpening' });
  await page.waitForFunction(() => '__baseline' in window);
}

// A tile shows its thumbnail once the art loads and its title until then; either one selects the world.
const openChatCard = (page: Page) => page.getByRole('img', { name: 'Open Chat', exact: true })
  .or(page.getByRole('heading', { name: 'Open Chat', exact: true })).first();

const turns = (page: Page) =>
  page.evaluate(() => (window as unknown as { __baseline: { getDebugTurns(): LoggedTurn[] } }).__baseline.getDebugTurns());

/** Play one action, then return the turn log and the last turn's narration request. */
async function playTurn(page: Page, action: string) {
  await page.evaluate((text) => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
    .__baseline.runScript([text]), action);
  const log = await turns(page);
  return { log, narration: log[log.length - 1].requests.find((request) => request.type === 'narration')! };
}

const systemOf = (request: LoggedRequest) => request.messages.find((message) => message.role === 'system')!.content;

/** Quick Start the stored Open Chat world from the Main Menu and play one turn; returns its narration system prompt. */
async function quickStartTurn(page: Page): Promise<string> {
  await openChatCard(page).click();
  await page.getByRole('button', { name: 'Quick Start' }).click();
  await page.waitForFunction(() => '__baseline' in window);
  return systemOf((await playTurn(page, 'Hello.')).narration);
}

const QUICK_START_SKIP = 'in portrait the Quick Start button shows only its icon and has no accessible name';

test('the greeting is page one, and the next turn runs on the world narration prompt with its tone chips resolved', async ({ page }) => {
  test.setTimeout(LIVE ? 180_000 : 30_000);
  await startOpenChat(page);
  await expect(page.getByText(/You're dripping on the poetry/).first()).toBeVisible();

  const { log, narration } = await playTurn(page, '"Estate sale? Whose?" I pull a stool up to the counter.');
  expect(log[0].requests.map((request) => request.type)).not.toContain('narration');
  const system = systemOf(narration);
  const chat = narration.messages.filter((message) => message.role !== 'system');

  expect(chat.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
  expect(chat[1].content).toContain("You're dripping on the poetry");
  // The world's prompt, not the preset's: its opening words, and a listed value of every tone chip as plain
  // text. The fixture starts with no traits, so each chip reads its roll.
  expect(system).toContain('chatting with the player by message');
  for (const placeholder of world.placeholders) {
    expect(placeholder.values.filter((value: { text: string }) => system.includes(value.text)), placeholder.name)
      .toHaveLength(1);
  }
  expect(system).not.toContain('{{ph:');

  if (LIVE) {
    const reply = await page.evaluate(() => document.querySelector('main')?.textContent ?? document.body.textContent ?? '');
    console.log(`
--- live reply page ---
${reply.slice(-1500)}
`);
  }
});

// A clean profile: the bundled world as seeded, entered through Quick Start with no picks.
test('a Quick Start applies the middle setting of every tone group', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', QUICK_START_SKIP);
  await mockModel(page);
  await openApp(page, settings);
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  const system = await quickStartTurn(page);

  for (const placeholder of world.placeholders) {
    const [low, middle, high] = placeholder.values.map((value: { text: string }) => value.text);
    expect(system, placeholder.name).toContain(middle);
    expect(system, placeholder.name).not.toContain(low);
    expect(system, placeholder.name).not.toContain(high);
  }
});

// A pin names its value by id, so an author's edit of the text reaches play through the unchanged trait.
test('editing a pinned value in the World Editor changes what its trait sends', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', QUICK_START_SKIP);
  const edited = 'Keep each message to exactly one short paragraph.';
  await mockModel(page);
  await openApp(page, settings);
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  await page.evaluate(() => (window as unknown as { __fmDev: { editWorld(id: string): Promise<void> } }).__fmDev
    .editWorld('open-chat'));
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'placeholders' });
  await page.getByText('reply length', { exact: true }).first().click();
  await page.getByRole('radio', { name: 'Multiline' }).click();
  await page.getByLabel('Value 2', { exact: true }).click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(edited);
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await save.click();
  await expect(save).toBeDisabled();

  // The bare root, since a reload keeps the dev route and reopens the editor.
  await page.goto('/');
  const system = await quickStartTurn(page);
  expect(system).toContain(edited);
  // Every chip still reads its default trait's pin: the edit moved one text, not the pins.
  const [replyLength, ...others] = world.placeholders;
  for (const value of replyLength.values) expect(system).not.toContain(value.text);
  for (const placeholder of others) expect(system, placeholder.name).toContain(placeholder.values[1].text);
});
