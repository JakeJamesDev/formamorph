import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './app';
import { WRITTEN_OPENING_TEXT as WRITTEN } from '../src/lib/devFixtures';

/**
 * A new game whose draw is an Opening Narration, through the real game view: page one is the authored
 * text with no narration request, the post-narration requests still go out, and the next turn's request
 * begins on the hidden start message. The pipeline's own tests cover the plan; only the view can show
 * what reaches history and the page.
 */

interface LoggedRequest { type: string; messages: { role: string; content: string }[] }
interface LoggedTurn { action: string; requests: LoggedRequest[] }

async function mockModel(page: Page, failFirst = 0) {
  let calls = 0;
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    calls += 1;
    if (calls <= failFirst) { await route.fulfill({ status: 500, body: 'down' }); return; }
    await route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Step through the door' }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` });
  });
  return () => calls;
}

const settings = {
  FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
  FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: true,
  FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
};

/** Serve the fixture world with its own openings in place of the fixture's single row. */
async function withOpenings(page: Page, overview: { openings: object[]; openingWeights?: Record<string, number> }) {
  const world = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomWorld.json', 'utf8'));
  Object.assign(world.worldOverview, overview);
  await page.route('**/whiteRoomWorld.json*', (route) => route.fulfill({
    contentType: 'application/javascript', body: `export default ${JSON.stringify(world)}`,
  }));
}

const actionBox = (page: Page) => page.getByPlaceholder(/^Type your action/);

const turns = (page: Page) =>
  page.evaluate(() => (window as unknown as { __baseline: { getDebugTurns(): LoggedTurn[] } }).__baseline.getDebugTurns());

/** Settled: the turn is over when the choices it waited on are on the page. */
async function startOnWrittenOpening(page: Page, pageOne: string | RegExp = WRITTEN) {
  page.on('pageerror', (error) => console.error(error.message));
  const calls = await mockModel(page);
  await openApp(page, settings, { url: '/#dev?view=gameViewer&fixture=writtenOpening' });
  await expect(page.getByText(pageOne).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step through the door' }).first()).toBeVisible();
  await page.waitForFunction(() => '__baseline' in window);
  return calls;
}

test('Start Game on an Opening Narration is page one, with no narration request and an empty box', async ({ page }) => {
  await startOnWrittenOpening(page);

  const [opening] = await turns(page);
  const types = opening.requests.map((request) => request.type);
  expect(types).toContain('choices');
  expect(types).not.toContain('narration');
  await expect(actionBox(page)).toHaveValue('');
});

test('the next turn\'s request begins on the hidden start message, then the written page', async ({ page }) => {
  await startOnWrittenOpening(page);
  await page.evaluate(() => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
    .__baseline.runScript(['I walk to the door.']));

  const log = await turns(page);
  const narration = log[log.length - 1].requests.find((request) => request.type === 'narration');
  const chat = narration!.messages.filter((message) => message.role !== 'system');
  expect(chat.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
  expect(chat[0].content).toBe('START GAME');
  expect(chat[1].content).toContain(WRITTEN);
});

test('Re-generate in a pool of one Opening Narration leaves page one as it is', async ({ page }) => {
  const calls = await startOnWrittenOpening(page);
  const before = calls();
  await page.getByRole('button', { name: 'Re-generate', exact: true }).click();

  await expect(page.getByText(WRITTEN).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step through the door' }).first()).toBeVisible();
  expect(calls()).toBe(before);
  expect(await turns(page)).toHaveLength(1);
});

test('Re-generate swipes to the opening not yet shown, and never repeats the one on the page', async ({ page }) => {
  const FERRY = 'The ferry bell rings twice.';
  const REEDS = 'You wake in the reed-beds.';
  await withOpenings(page, { openings: [
    { id: 'o1', text: FERRY, kind: 'narration' }, { id: 'o2', text: REEDS, kind: 'narration' },
  ] });
  await startOnWrittenOpening(page, /ferry bell|reed-beds/);
  const shown = async () => ((await page.getByText(FERRY).count()) > 0 ? FERRY : REEDS);
  const other = (text: string) => (text === FERRY ? REEDS : FERRY);

  // Two presses: the first exhausts the set, the second starts it over with the page still excluded.
  let current = await shown();
  for (let press = 0; press < 2; press++) {
    await page.getByRole('button', { name: 'Re-generate', exact: true }).click();
    await expect(page.getByText(other(current)).first()).toBeVisible();
    await expect(page.getByText(current)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Step through the door' }).first()).toBeVisible();
    current = other(current);
  }
  const log = await turns(page);
  expect(log.flatMap((turn) => turn.requests.map((request) => request.type))).not.toContain('narration');
});

test('Re-generate that draws an Opening Action returns to the filled box, not started', async ({ page }) => {
  const ACTION = 'I open my eyes and look around.';
  // The action row all but never wins the first draw; it is the only row left for the second.
  await withOpenings(page, {
    openings: [{ id: 'o1', text: WRITTEN, kind: 'narration' }, { id: 'o2', text: ACTION, kind: 'action' }],
    openingWeights: { o2: 0.000001 },
  });
  const calls = await startOnWrittenOpening(page);
  const before = calls();
  await page.getByRole('button', { name: 'Re-generate', exact: true }).click();

  await expect(actionBox(page)).toHaveValue(ACTION);
  await expect(page.getByText(WRITTEN)).toHaveCount(0);
  expect(calls()).toBe(before);
});

test('a request that fails after a written page one keeps the page, and the next submit is a normal turn', async ({ page }) => {
  page.on('pageerror', (error) => console.error(error.message));
  // One request at a time, so the failed choices request ends the turn instead of being absorbed.
  await mockModel(page, 1);
  await openApp(page, { ...settings, FORMAMORPH_concurrentTurnRequests: false },
    { url: '/#dev?view=gameViewer&fixture=writtenOpening' });
  await expect(page.getByText(WRITTEN).first()).toBeVisible();
  await expect(actionBox(page)).toBeEnabled();
  await page.waitForFunction(() => '__baseline' in window);

  await page.evaluate(() => (window as unknown as { __baseline: { runScript(actions: string[]): Promise<void> } })
    .__baseline.runScript(['I walk to the door.']));
  const log = await turns(page);
  // A second opening turn would record the start proxy here in place of the player's action.
  expect(log.map((turn) => turn.action)).toEqual(['START GAME', 'I walk to the door.']);
  const narration = log[1].requests.find((request) => request.type === 'narration');
  const chat = narration!.messages.filter((message) => message.role !== 'system');
  expect(chat.map((message) => message.role)).toEqual(['user', 'assistant', 'user']);
  expect(chat[1].content).toContain(WRITTEN);
});
