import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openApp } from './app';

/**
 * Regenerate and Edit on a turn with attached images, through the real game view. The save fixture carries
 * two images on its latest turn, so the setting alone decides what a regenerate sends.
 */

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const IMAGES = [
  { id: 'img-a', mime: 'image/png', dataUrl: PIXEL },
  { id: 'img-b', mime: 'image/png', dataUrl: `${PIXEL}#b` },
];

type Part = { type: string; text?: string; image_url?: { url: string } };
type Body = { messages: { role: string; content: string | Part[] }[] };

/** Opens the White Room in Chat with the latest turn's images, and records every request body. The
 *  `attach=sample` route stages its own images and turns the setting on. */
async function openWithImages(page: Page, imageAttachments: boolean, route = ''): Promise<Body[]> {
  page.on('pageerror', (error) => console.error(error.message));
  const save = JSON.parse(readFileSync('src/lib/devFixtures/whiteRoomSave.json', 'utf8'));
  const history: { role: string; content: string }[] = save.currentState.fullMessageHistory;
  const latest = JSON.parse(history.findLast((m) => m.role === 'assistant')!.content).turnId;
  if (!route) save.actionAttachments = { [latest]: IMAGES };
  await page.route('**/whiteRoomSave.json*', (route) => route.fulfill({
    contentType: 'application/javascript', body: `export default ${JSON.stringify(save)}`,
  }));
  const bodies: Body[] = [];
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', async (route) => {
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ contentType: 'text/event-stream', body:
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'The seam glows under your hand.' }, finish_reason: null }] })}\n\ndata: [DONE]\n\n` });
  });
  await openApp(page, {
    FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
    FORMAMORPH_narrationLayout: 'chat', FORMAMORPH_imageAttachments: imageAttachments,
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: `/#dev?view=gameViewer&fixture=whiteRoom${route}` });
  return bodies;
}

const latestTurn = (page: Page) => page.locator('[data-chat-scroller] article').last();
const thumbs = (page: Page) => latestTurn(page).getByRole('button', { name: /^View attached image/ });

async function regenerate(page: Page) {
  await expect(thumbs(page)).toHaveCount(2);
  await latestTurn(page).getByRole('button', { name: 'Re-generate Narration' }).click();
  await expect(latestTurn(page).getByTestId('narration')).toHaveText('The seam glows under your hand.', { timeout: 30_000 });
}

const withParts = (bodies: Body[]) => bodies.filter((body) => body.messages.some((m) => typeof m.content !== 'string'));

test('Regenerate sends the turn images again and keeps them on the new turn', async ({ page }) => {
  const bodies = await openWithImages(page, true);
  await regenerate(page);

  // Narration is the one prompt that includes attachments by default.
  const sent = withParts(bodies);
  expect(sent).toHaveLength(1);
  const last = sent[0].messages.at(-1)!;
  expect(last.role).toBe('user');
  const parts = last.content as Part[];
  expect(parts.map((part) => part.type)).toEqual(['text', 'image_url', 'image_url']);
  expect(parts.slice(1).map((part) => part.image_url?.url)).toEqual(IMAGES.map((image) => image.dataUrl));
  expect(sent[0].messages.slice(0, -1).every((m) => typeof m.content === 'string')).toBe(true);
  await expect(thumbs(page)).toHaveCount(2);
});

test('Regenerate on the attach=sample dev route sends its two staged images', async ({ page }) => {
  const bodies = await openWithImages(page, false, '&attach=sample');
  await regenerate(page);

  const sent = withParts(bodies);
  expect(sent).toHaveLength(1);
  expect((sent[0].messages.at(-1)!.content as Part[]).map((part) => part.type)).toEqual(['text', 'image_url', 'image_url']);
  await expect(thumbs(page)).toHaveCount(2);
});

test('Regenerate with Image Attachments off sends no images and keeps them on the new turn', async ({ page }) => {
  const bodies = await openWithImages(page, false);
  await regenerate(page);

  expect(bodies.length).toBeGreaterThan(0);
  expect(withParts(bodies)).toEqual([]);
  await expect(thumbs(page)).toHaveCount(2);
});

for (const imageAttachments of [true, false]) {
  test(`Removing an image in Edit takes it off the turn (setting ${imageAttachments ? 'on' : 'off'})`, async ({ page }) => {
    await openWithImages(page, imageAttachments);
    await expect(thumbs(page)).toHaveCount(2);
    await latestTurn(page).getByTestId('player-action').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Remove attached image 1' }).click();
    await expect(dialog.getByRole('button', { name: /^View attached image/ })).toHaveCount(1);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(thumbs(page)).toHaveCount(1);
    await latestTurn(page).getByRole('button', { name: 'View attached image 1' }).click();
    await expect(page.getByRole('dialog').locator(`img[src="${IMAGES[1].dataUrl}"]`)).toBeVisible();
  });
}
