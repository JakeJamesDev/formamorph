import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * The Formaquestion Mascot beside the minimal chat column. jsdom has no layout and loads no image, so the
 * pieces' boxes, the base's real aspect and the painted motion are checked here.
 */

test.use({ viewport: { width: 1920, height: 1080 } });

/** The default base is 888 by 1184. */
const BASE_ASPECT = 888 / 1184;

const helpWindow = (page: Page) => page.locator('#formaquestion-window');
const piece = (page: Page, name: 'mascot' | 'column') => helpWindow(page).locator(`[data-fq-piece="${name}"]`);
const askField = (page: Page) => helpWindow(page).getByRole('textbox', { name: 'Ask a Question' });

async function openHelp(page: Page): Promise<void> {
  await page.keyboard.press('F1');
  await expect(askField(page)).toBeFocused();
  await helpWindow(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  // Every image of the Mascot has loaded, so it draws at the base's aspect.
  await expect.poll(() => piece(page, 'mascot').evaluate((el) => [...el.querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  await expect.poll(async () => (await piece(page, 'mascot').boundingBox())?.width ?? 0).toBeGreaterThan(0);
}

/** The pieces' boxes at rest: a face change bounces the Mascot first. */
async function boxes(page: Page) {
  await expect.poll(() => piece(page, 'mascot').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  return { mascot: (await piece(page, 'mascot').boundingBox())!, column: (await piece(page, 'column').boundingBox())! };
}

test.describe('the Mascot on a desktop screen', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The Mascot piece is the desktop form');
  });

  test('stands left of the column at the base aspect and the column height, and the pill moves both', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    const { mascot, column } = await boxes(page);
    expect(mascot.x + mascot.width).toBeCloseTo(column.x, 0);
    expect(mascot.y + mascot.height).toBeCloseTo(column.y + column.height, 0);
    expect(mascot.height).toBeCloseTo(column.height, 0);
    expect(mascot.width / mascot.height).toBeCloseTo(BASE_ASPECT, 2);
    expect(column.width).toBe(400);

    // A press in the column's empty top left reaches the app, not the window.
    const throughGap = await page.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('#formaquestion-window'), { x: column.x + 8, y: column.y + 80 });
    expect(throughGap).toBe(true);

    const grip = (await helpWindow(page).locator('[data-fq-drag] svg').first().boundingBox())!;
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 200, from.y - 100, { steps: 5 });
    await page.mouse.up();
    const moved = await boxes(page);
    expect(moved.mascot.x).toBeCloseTo(mascot.x - 200, 0);
    expect(moved.column.x).toBeCloseTo(column.x - 200, 0);
    expect(moved.column.y).toBeCloseTo(column.y - 100, 0);

    // The device keeps the column's box.
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await openHelp(page);
    const reloaded = await boxes(page);
    expect(reloaded.column.x).toBeCloseTo(moved.column.x, 0);
    expect(reloaded.column.y).toBeCloseTo(moved.column.y, 0);
    expect(reloaded.mascot.x).toBeCloseTo(moved.mascot.x, 0);
  });

  test('opens the reader beside the column from a source name, whole on the screen, and the pill moves all three', async ({ page }) => {
    await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
    await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
    await page.route('**/chat/completions', async (route) => {
      const body = route.request().postDataJSON() as { max_tokens: number };
      // The AI Picks request picks nothing, so the keyword search alone finds the sections.
      const text = body.max_tokens === 150 ? 'No section of the list answers the question.' : '1. Open the **Traits** tab.\n2. Select **New Blueprint**.';
      const frame = `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: null }] })}\n\n`;
      await route.fulfill({ contentType: 'text/event-stream', body: `${frame}data: [DONE]\n\n` });
    });
    await openApp(page, { FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions' });
    await openHelp(page);
    await askField(page).fill('How do I make a blueprint?');
    await page.keyboard.press('Enter');
    await helpWindow(page).getByRole('group', { name: 'Sources' }).getByRole('button', { name: /How to Make a Blueprint/ }).click();

    const reader = helpWindow(page).locator('[data-fq-piece="reader"]');
    await expect(reader.getByRole('heading', { name: 'How to Make a Blueprint', level: 3 })).toBeVisible();
    await expect.poll(async () => (await reader.boundingBox())?.width ?? 0).toBeGreaterThan(0);
    const readerBox = async () => (await reader.boundingBox())!;
    const { mascot, column } = await boxes(page);
    const opened = await readerBox();
    expect(opened.x).toBeCloseTo(column.x + column.width + 8, 0);
    expect(opened.y).toBeCloseTo(column.y, 0);
    expect(opened.height).toBeCloseTo(column.height, 0);
    expect(opened.x + opened.width).toBeLessThanOrEqual(1920);
    expect(mascot.x + mascot.width).toBeCloseTo(column.x, 0);

    // The gap between the column and the reader belongs to the app.
    const throughGap = await page.evaluate(({ x, y }) => !document.elementFromPoint(x, y)?.closest('#formaquestion-window'), { x: column.x + column.width + 4, y: column.y + column.height / 2 });
    expect(throughGap).toBe(true);

    const grip = (await helpWindow(page).locator('[data-fq-drag] svg').first().boundingBox())!;
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 150, from.y - 60, { steps: 5 });
    await page.mouse.up();
    const moved = await boxes(page);
    const movedReader = await readerBox();
    expect(moved.column.x).toBeCloseTo(column.x - 150, 0);
    expect(moved.mascot.x).toBeCloseTo(mascot.x - 150, 0);
    expect(movedReader.x).toBeCloseTo(opened.x - 150, 0);
    expect(movedReader.y).toBeCloseTo(opened.y - 60, 0);

    // The reader's own button closes it. The column and the Mascot stay.
    await reader.getByRole('button', { name: 'Close Reader' }).click();
    await expect(reader).toHaveCount(0);
    await expect(piece(page, 'column')).toBeVisible();
    await expect(piece(page, 'mascot')).toBeVisible();
  });

  test('zooms open with the column from the Help tab, as the framed window does', async ({ page }) => {
    await openApp(page);
    const frames = await page.evaluate(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', bubbles: true }));
      const samples: { scale: number; duration: string; origin: number }[] = [];
      for (let i = 0; i < 40; i++) {
        await new Promise(requestAnimationFrame);
        const section = document.getElementById('formaquestion-window');
        const column = section?.querySelector<HTMLElement>('[data-fq-piece="column"]');
        if (!section || !column) continue;
        const style = getComputedStyle(section);
        // The painted scale: the column's box on screen over its laid-out width.
        // The fixed point on the screen: the laid-out left plus the origin's x.
        const origin = parseFloat(section.style.left) + parseFloat(style.transformOrigin.split(' ')[0]);
        samples.push({ scale: column.getBoundingClientRect().width / column.offsetWidth, duration: style.animationDuration, origin });
        if (section.getAnimations().length === 0) break;
      }
      return samples;
    });
    expect(frames[0].duration).toBe('0.2s');
    expect(frames[0].scale).toBeLessThan(0.95);
    expect(frames[0].scale).toBeGreaterThanOrEqual(0.75);
    for (let i = 1; i < frames.length; i++) expect(frames[i].scale).toBeGreaterThanOrEqual(frames[i - 1].scale - 0.001);
    expect(frames.at(-1)!.scale).toBeCloseTo(1, 3);

    // The zoom's fixed point is the Help tab, at the right edge of the screen.
    const tab = (await page.getByRole('button', { name: 'Help', exact: true }).boundingBox())!;
    for (const frame of frames) expect(frame.origin).toBeCloseTo(tab.x + tab.width / 2, 0);
  });
});

const pieceBox = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

/** Waits until every image under the selector has loaded and the piece has a size. */
async function loaded(page: Page, selector: string): Promise<void> {
  await expect.poll(() => page.locator(selector).evaluate((el) => [...el.querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  await expect.poll(async () => (await page.locator(selector).boundingBox())?.width ?? 0).toBeGreaterThan(0);
}

test.describe('the face change', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The Mascot piece is the desktop form');
  });

  /** A text endpoint that answers every request with one short reply. */
  async function openWithAi(page: Page): Promise<void> {
    await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
    await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
    await page.route('**/chat/completions', (route) => route.fulfill({
      contentType: 'text/event-stream',
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: 'Open the **Traits** tab.' }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`,
    }));
    await openApp(page, { FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions' });
  }

  interface Sample { scaleX: number; scaleY: number; looks: number; newest: string }

  /** Sends a question and reads the painted scale of the Mascot and its number of looks on every frame for `ms`. */
  async function sampleSend(page: Page, ms: number): Promise<Sample[]> {
    await page.evaluate((duration) => {
      const samples: { scaleX: number; scaleY: number; looks: number; newest: string }[] = [];
      const until = performance.now() + 100 + duration;
      const read = () => {
        const piece = document.querySelector<HTMLElement>('#formaquestion-window [data-fq-piece="mascot"]');
        if (piece) {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(piece).transform);
          const newest = [...piece.querySelectorAll('[data-fq-look="new"] img')].map((img) => img.getAttribute('src')).join(' ');
          samples.push({ scaleX: matrix.a, scaleY: matrix.d, looks: piece.querySelectorAll('[data-fq-look]').length, newest });
        }
        if (performance.now() < until) requestAnimationFrame(read);
        else (window as unknown as { fqSamples: typeof samples }).fqSamples = samples;
      };
      requestAnimationFrame(read);
    }, ms);
    await askField(page).fill('How do I add a trait?');
    await helpWindow(page).getByRole('button', { name: 'Send' }).click();
    await page.waitForFunction(() => 'fqSamples' in window);
    return page.evaluate(() => (window as unknown as { fqSamples: Sample[] }).fqSamples);
  }

  test('squashes below full height, stretches past it, and settles back, as the look swaps', async ({ page }) => {
    await openWithAi(page);
    await openHelp(page);
    const samples = await sampleSend(page, 700);
    const heights = samples.map((sample) => sample.scaleY);
    const dip = heights.indexOf(Math.min(...heights));
    const peak = heights.indexOf(Math.max(...heights));
    // The default Jelly dips to 82% and stretches to 112%; the frames land near, not on, the extremes.
    expect(heights[dip]).toBeLessThan(0.9);
    expect(heights[peak]).toBeGreaterThan(1.06);
    expect(dip).toBeLessThan(peak);
    expect(samples[dip].scaleX).toBeGreaterThan(1);
    // The old look stays under the new one only until the dip.
    expect(samples.some((sample) => sample.looks === 2)).toBe(true);
    expect(samples.at(-1)).toMatchObject({ scaleX: 1, scaleY: 1, looks: 1 });
  });

  test('swaps the look at once under the reduced-motion preference', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openWithAi(page);
    await openHelp(page);
    const samples = await sampleSend(page, 700);
    expect(samples.length).toBeGreaterThan(10);
    // The look did change while the frames were read.
    expect(new Set(samples.map((sample) => sample.newest)).size).toBeGreaterThan(1);
    expect(samples.every((sample) => sample.scaleX === 1 && sample.scaleY === 1 && sample.looks === 1)).toBe(true);
  });
});

test.describe('the Mask', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The drag and the head toggle are the desktop form');
  });

  test('takes the box a drag draws on the preview, the head preview follows, and the window head draws it', async ({ page }) => {
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });
    const target = '[data-fq-mask-target]';
    const headPreview = '[role="dialog"] [data-fq-piece="mascot"][data-fq-view="head"]';
    await loaded(page, target);
    await loaded(page, headPreview);
    const preview = await pieceBox(page, target);

    // A quarter in from each side of the base: a 444 by 592 box, the base's own aspect.
    const from = { x: preview.x + preview.width / 4, y: preview.y + preview.height / 4 };
    const to = { x: preview.x + (preview.width * 3) / 4, y: preview.y + (preview.height * 3) / 4 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    // While the drag runs, the head preview already takes the new box.
    await expect.poll(async () => (await pieceBox(page, headPreview)).width).toBeCloseTo(96 * BASE_ASPECT, 0);
    await page.mouse.up();

    const box = await pieceBox(page, '[data-fq-mask-box]');
    expect(box.x).toBeCloseTo(from.x, 0);
    expect(box.y).toBeCloseTo(from.y, 0);
    expect(box.width).toBeCloseTo(to.x - from.x, 0);
    expect(box.height).toBeCloseTo(to.y - from.y, 0);

    // The stored Mask reaches the window's head view after a reload.
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await openHelp(page);
    await helpWindow(page).getByRole('button', { name: 'Show Head Only' }).click();
    const head = '#formaquestion-window [data-fq-piece="mascot"][data-fq-view="head"]';
    await loaded(page, head);
    const drawn = await pieceBox(page, head);
    expect(drawn.height).toBeCloseTo(96, 0);
    expect(drawn.width).toBeCloseTo(96 * BASE_ASPECT, 0);
    // The Mask is half the base each way, so the whole base draws at twice the head's size.
    const frame = (await page.locator(`${head} > div`).boundingBox())!;
    expect(frame.width).toBeCloseTo(drawn.width * 2, 0);
    expect(frame.x).toBeCloseTo(drawn.x - drawn.width / 2, 0);
  });
});

test.describe('the Mascot on a mobile-size screen', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'The sheet is the mobile form');
  });

  test('shows the masked head left of the pill row, with no full view and no toggle', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    const head = '#formaquestion-window [data-fq-piece="mascot"]';
    await loaded(page, head);
    await expect(page.locator(head)).toHaveCount(1);
    await expect(page.locator(head)).toHaveAttribute('data-fq-view', 'head');
    await expect(helpWindow(page).getByRole('button', { name: /^Show / })).toHaveCount(0);

    // The default Mask is 768 by 680.
    const drawn = await pieceBox(page, head);
    const pill = (await helpWindow(page).locator('[data-fq-drag]').boundingBox())!;
    expect(drawn.height).toBeCloseTo(64, 0);
    expect(drawn.width).toBeCloseTo((64 * 768) / 680, 0);
    expect(drawn.x + drawn.width).toBeLessThanOrEqual(pill.x);
    expect(drawn.y + drawn.height).toBeCloseTo(pill.y + pill.height, 0);
    expect(drawn.x).toBeGreaterThanOrEqual(0);
  });
});
