import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * Chat layout's reading-line barrier in a real browser: the turn on the line drives the panels. jsdom has
 * no layout, so the rule itself is unit-tested and this checks it against real turn boxes.
 */

// Matches READING_LINE in src/lib/chatReadingLine.ts.
const READING_LINE = 0.3;
const WHEEL_STEP = 240;
const REPLY = 'The console blinks once.';

async function openChat(page: Page) {
  page.on('pageerror', (error) => console.error(error.message));
  await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
  await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
  await page.route('**/chat/completions', (route) => route.fulfill({
    headers: { 'Content-Type': 'text/event-stream' },
    body: `data: ${JSON.stringify({ choices: [{ delta: { content: REPLY }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
  }));
  await openApp(page, {
    FORMAMORPH_narrationLayout: 'chat',
    FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
    FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
  }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
  await page.locator('[data-chat-scroller] article').first().waitFor();
  // The list opens at the bottom over a few frames; start once it rests there.
  await expect.poll(async () => (await readingLine(page)).atBottom).toBe(true);
  // The stat bars animate in on load; the scroll starts once they rest.
  await expect.poll(() => statBarAnimations(page)).toBe(0);
  const box = (await page.locator('[data-chat-scroller]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** The turn number on the reading line, whether the list is at the bottom, and the latest turn number. */
function readingLine(page: Page) {
  return page.evaluate((share) => {
    const scroller = document.querySelector<HTMLElement>('[data-chat-scroller]')!;
    const box = scroller.getBoundingClientRect();
    const line = box.top + box.height * share;
    let onLine: number | null = null;
    let latest = 0;
    scroller.querySelectorAll<HTMLElement>('article[data-index]').forEach((el) => {
      const index = Number(el.dataset.index);
      latest = Math.max(latest, index + 1);
      const rect = el.getBoundingClientRect();
      if (rect.top <= line && rect.bottom > line) onLine = index + 1;
    });
    const atBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 2;
    return { onLine, atBottom, latest };
  }, READING_LINE);
}

/** The turn the banner names, or null when it is hidden (the panels follow the latest turn). */
async function bannerTurn(page: Page): Promise<number | null> {
  const banner = page.getByText(/^Viewing turn \d+ of \d+/);
  if (!(await banner.isVisible())) return null;
  return Number((await banner.textContent())!.match(/Viewing turn (\d+)/)![1]);
}

/** Animations running on the stat bars. */
function statBarAnimations(page: Page) {
  return page.evaluate(() => {
    const bars = document.querySelector('[role="tabpanel"][id$="-content-stats"]');
    return document.getAnimations().filter((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      return !!target && !!bars?.contains(target) && a.playState === 'running';
    }).length;
  });
}

/** Wheel up until the banner names a turn at least `turns` above the latest. */
async function scrollBack(page: Page, turns: number) {
  for (let step = 0; step < 60; step++) {
    await page.mouse.wheel(0, -WHEEL_STEP);
    const line = await readingLine(page);
    if (line.onLine !== null && line.latest - line.onLine >= turns) break;
  }
  const { onLine } = await readingLine(page);
  await expect.poll(() => bannerTurn(page)).toBe(onLine);
  return onLine!;
}

/** Pick a Narration Layout in the Settings modal and close it. */
async function switchLayout(page: Page, layout: 'Pages' | 'Chat') {
  await gotoDev(page, 'gameViewer', { modal: 'settings', tab: 'display' });
  await page.getByRole('radiogroup', { name: 'Narration Layout' }).getByRole('radio', { name: layout }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Drop the modal from the route, so the next open is a new hash.
  await gotoDev(page, 'gameViewer');
}

test.describe('Chat reading-line barrier', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the banner and the stats share the desktop layout');
  });

  test('the banner names the turn on the reading line at every step of a wheel scroll', async ({ page }) => {
    await openChat(page);
    expect(await bannerTurn(page)).toBeNull();
    const seen = new Set<number>();
    for (let step = 0; step < 60; step++) {
      await page.mouse.wheel(0, -WHEEL_STEP);
      // Turns mount and measure after the wheel, so the line and the banner are read together.
      const expected = async () => {
        const line = await readingLine(page);
        // The panels follow the latest turn at the bottom; elsewhere they show the turn on the line.
        return line.atBottom || line.onLine === line.latest ? null : line.onLine;
      };
      await expect.poll(async () => (await bannerTurn(page)) === (await expected()), { message: `step ${step}` }).toBe(true);
      expect(await statBarAnimations(page), `stat bars snap at step ${step}`).toBe(0);
      const turn = await bannerTurn(page);
      if (turn !== null) seen.add(turn);
      if ((await page.locator('[data-chat-scroller]').evaluate((el) => el.scrollTop)) === 0) break;
    }
    // The scroll went through history, not one turn.
    expect(seen.size).toBeGreaterThan(2);
  });

  test('a submit from history lands on the latest turn', async ({ page }) => {
    await openChat(page);
    const { latest } = await readingLine(page);
    await scrollBack(page, 3);
    await page.getByPlaceholder(/Type your action/).fill('I knock on the seam.');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('[data-chat-scroller] article').last()).toHaveAttribute('aria-label', `Turn ${latest + 1}`);
    await expect(page.getByText(REPLY)).toBeVisible();
    expect(await bannerTurn(page)).toBeNull();
  });

  test('a layout switch keeps the viewed turn in both directions', async ({ page }) => {
    await openChat(page);
    const viewed = await scrollBack(page, 3);
    await switchLayout(page, 'Pages');
    await expect(page.locator('[data-chat-scroller]')).toHaveCount(0);
    expect(await bannerTurn(page)).toBe(viewed);
    await switchLayout(page, 'Chat');
    await page.locator('[data-chat-scroller] article').first().waitFor();
    // Chat opens with the viewed turn on the reading line, so the banner keeps it.
    await expect.poll(async () => (await readingLine(page)).onLine).toBe(viewed);
    expect(await bannerTurn(page)).toBe(viewed);
  });
});
