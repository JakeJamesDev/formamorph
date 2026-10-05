import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';
import { expectScrollArrow, stubLongAnswer } from './scrollArrow';

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

  test('flips the Mascot to the wider gap once while the column is dragged across the middle', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    const start = await boxes(page);
    expect(start.mascot.x + start.mascot.width).toBeCloseTo(start.column.x, 0);

    const grip = (await helpWindow(page).locator('[data-fq-drag] svg').first().boundingBox())!;
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    // The column's center starts right of the middle and ends left of it, in small steps.
    const sides: string[] = [];
    const steps = 40;
    const travel = start.column.x + start.column.width / 2 - 960 + 400;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(from.x - (travel * i) / steps, from.y);
      const [mascot, column] = [(await piece(page, 'mascot').boundingBox())!, (await piece(page, 'column').boundingBox())!];
      sides.push(mascot.x < column.x ? 'left' : 'right');
    }
    await page.mouse.up();
    expect(sides[0]).toBe('left');
    expect(sides.at(-1)).toBe('right');
    // One flip: no side repeats after it changes.
    expect(sides.filter((side, i) => i > 0 && side !== sides[i - 1])).toHaveLength(1);

    const end = await boxes(page);
    expect(end.column.x + end.column.width / 2).toBeLessThan(960);
    expect(end.mascot.x).toBeCloseTo(end.column.x + end.column.width, 0);
    expect(end.mascot.y + end.mascot.height).toBeCloseTo(end.column.y + end.column.height, 0);
  });

  test('resizes the column from its corner grip, and each chat style keeps its own size at one place after a reload', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    const { column } = await boxes(page);

    const grip = (await piece(page, 'column').locator('[data-fq-resize]').boundingBox())!;
    expect(grip.x + grip.width).toBeCloseTo(column.x + column.width, 0);
    expect(grip.y + grip.height).toBeCloseTo(column.y + column.height, 0);
    // The grip sits under the ask field, so a press on it reaches the grip and not the Send button.
    const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-fq-resize]') !== null, from)).toBe(true);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 40, from.y - 80, { steps: 5 });
    await page.mouse.up();
    const resized = (await boxes(page)).column;
    expect(resized).toMatchObject({ x: column.x, y: column.y, width: column.width - 40 });
    expect(resized.height).toBeCloseTo(column.height - 80, 0);

    const pickStyle = async (style: string) => {
      await helpWindow(page).getByRole('button', { name: 'More Actions' }).click();
      await page.getByRole('menuitemradio', { name: style }).click();
      await expect(page.getByRole('menu')).toHaveCount(0);
    };
    await pickStyle('Full');
    const frame = (await helpWindow(page).boundingBox())!;
    expect(frame).toMatchObject({ x: column.x, y: column.y, width: column.width });
    expect(frame.height).toBeCloseTo(column.height, 0);
    // The whole Mascot stands left of the frame, at its height.
    const beside = page.locator('[data-fq-piece="mascot"]');
    await loaded(page, '[data-fq-piece="mascot"]');
    const mascot = (await beside.boundingBox())!;
    expect(mascot.x + mascot.width).toBeCloseTo(frame.x, 0);
    expect(mascot.height).toBeCloseTo(frame.height, 0);

    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await page.keyboard.press('F1');
    await expect(helpWindow(page)).not.toHaveAttribute('data-fq-chrome');
    await helpWindow(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const reloadedFrame = (await helpWindow(page).boundingBox())!;
    expect(reloadedFrame).toMatchObject({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });

    await pickStyle('Minimal');
    await expect(helpWindow(page)).toHaveAttribute('data-fq-chrome', 'minimal');
    const reloadedColumn = (await boxes(page)).column;
    expect(reloadedColumn).toMatchObject({ x: resized.x, y: resized.y, width: resized.width });
    expect(reloadedColumn.height).toBeCloseTo(resized.height, 0);
  });

  test('shows the scroll arrow above the ask pill once the player scrolls up, and a click returns to the end', async ({ page }) => {
    await stubLongAnswer(page);
    await openApp(page, { FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions' });
    await openHelp(page);
    await askField(page).fill('How do I make a blueprint?');
    await page.keyboard.press('Enter');
    await expect(helpWindow(page).getByRole('log', { name: 'Conversation' }).getByRole('listitem')).toHaveCount(40);
    await expectScrollArrow(helpWindow(page), askField(page));
  });

  test('opens the reader beside the column from a source name, whole on the screen, and the pill moves all three', async ({ page }) => {
    await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
    await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
    await page.route('**/chat/completions', async (route) => {
      const body = route.request().postDataJSON() as { max_tokens: number };
      // The AI Search request picks nothing, so the keyword search alone finds the sections.
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

/** A Mascot tab scroller's viewport, the element that scrolls. */
const scroller = (page: Page, name: 'mascot-preview' | 'mascot-controls') => page.locator(`[data-fq-scroll="${name}"]`);
/** The shared ScrollArea's vertical bar, which draws only while the viewport overflows. */
const scrollbar = (page: Page, name: 'mascot-preview' | 'mascot-controls') =>
  scroller(page, name).locator('xpath=..').locator('> [data-orientation="vertical"]');

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
    await openMaskTab(page);
    const target = '[data-fq-mask-target]';
    const headPreview = '[role="dialog"] [data-fq-piece="mascot"][data-fq-view="head"]';
    await loaded(page, headPreview);
    const preview = await pieceBox(page, target);

    // A quarter in from each side: a 444 by 592 box, drawn from below the default Mask's 680-pixel bottom.
    const from = { x: preview.x + (preview.width * 3) / 4, y: preview.y + (preview.height * 3) / 4 };
    const to = { x: preview.x + preview.width / 4, y: preview.y + preview.height / 4 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    // While the drag runs, the head preview already takes the new box.
    await expect.poll(async () => (await pieceBox(page, headPreview)).width).toBeCloseTo(96 * BASE_ASPECT, 0);
    await page.mouse.up();

    const box = await pieceBox(page, '[data-fq-mask-box]');
    expect(box.x).toBeCloseTo(to.x, 0);
    expect(box.y).toBeCloseTo(to.y, 0);
    expect(box.width).toBeCloseTo(from.x - to.x, 0);
    expect(box.height).toBeCloseTo(from.y - to.y, 0);

    // The stored Mask reaches the window's head view after a reload, once the draft is saved.
    const save = page.getByTestId('mascot-footer').getByRole('button', { name: 'Save' });
    await save.click();
    await expect(save).toBeDisabled();
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

  test('fades the handles until the pointer is on the box or a drag runs, with no fade under reduced motion', async ({ page }) => {
    await openMaskTab(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
    await page.mouse.move(0, 0);
    await expect.poll(() => gripOpacities(page)).toEqual(Array(9).fill(FADED));

    const box = await pieceBox(page, '[data-fq-mask-box]');
    await page.mouse.move(box.x + box.width / 4, box.y + box.height / 4);
    await expect.poll(() => gripOpacities(page)).toEqual(Array(9).fill(1));
    expect(await gripTransition(page)).not.toBe('0s');

    // A drag keeps them shown when the pointer runs off the box.
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 4, box.y + box.height + 40, { steps: 4 });
    await page.mouse.move(0, 0, { steps: 4 });
    await expect.poll(() => gripOpacities(page)).toEqual(Array(9).fill(1));
    await page.mouse.up();
    await expect.poll(() => gripOpacities(page)).toEqual(Array(9).fill(FADED));

    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await gripTransition(page)).toBe('0s');
  });

  test('fades the handles again after a handle drag, and shows them for a keyboard focus', async ({ page }) => {
    await openMaskTab(page);
    const corner = page.getByRole('button', { name: 'Bottom-Right Corner' });
    const at = (await corner.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x - 20, at.y - 20, { steps: 4 });
    await page.mouse.up();
    await page.mouse.move(0, 0);
    await expect.poll(() => gripOpacities(page)).toEqual(Array(9).fill(FADED));

    await corner.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => gripOpacities(page)).toEqual(Array(9).fill(1));
  });

  test('resizes a small box from an edge handle, not the move grip under it', async ({ page }) => {
    await openMaskTab(page);
    // Shrink the box toward its top-left corner until the move grip would cover the side handles.
    const corner = (await page.getByRole('button', { name: 'Bottom-Right Corner' }).boundingBox())!;
    const box = await pieceBox(page, '[data-fq-mask-box]');
    await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + 30, { steps: 6 });
    await page.mouse.up();
    const small = await pieceBox(page, '[data-fq-mask-box]');
    expect(small.width).toBeLessThan(40);

    const edge = (await page.getByRole('button', { name: 'Right Edge' }).boundingBox())!;
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
    await page.mouse.down();
    await page.mouse.move(edge.x + edge.width / 2 + 40, edge.y + edge.height / 2, { steps: 4 });
    await page.mouse.up();
    const grown = await pieceBox(page, '[data-fq-mask-box]');
    expect(grown.x).toBeCloseTo(small.x, 0);
    expect(grown.width).toBeCloseTo(small.width + 40, 0);
  });
});

test.describe('the Mask on a coarse pointer', () => {
  test.use({ hasTouch: true });
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The touch screen here is a wide one, where the tab has room for the preview');
  });

  test('draws the handles at full opacity with no hover', async ({ page }) => {
    await openMaskTab(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await page.mouse.move(0, 0);
    await expect.poll(() => gripOpacities(page)).toEqual(Array(9).fill(1));
  });
});

test.describe('the second pass controls', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The wide tab and the Mascot piece are the desktop form');
  });

  const scaleSlider = (page: Page) => page.getByRole('slider', { name: 'Scale' });

  /** Sets Scale on the Mascot tab by key: Home is the Auto stop at 20, and each arrow is one 5-point step up from it. */
  async function setScale(page: Page, arrows: number): Promise<void> {
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });
    await scaleSlider(page).focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < arrows; i++) await page.keyboard.press('ArrowRight');
    await expect(scaleSlider(page)).toHaveAttribute('aria-valuetext', arrows === 0 ? 'Auto' : `${20 + arrows * 5}%`);
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await openHelp(page);
  }

  test('a percent Scale sizes the Mascot from the base height, level with the column bottom, and Auto goes back to the column height', async ({ page }) => {
    await setScale(page, 6);
    const percent = await boxes(page);
    // 50% of the 1184-pixel base, at the base's aspect, with the column unchanged.
    expect(percent.mascot.height).toBeCloseTo(592, 0);
    expect(percent.mascot.width / percent.mascot.height).toBeCloseTo(BASE_ASPECT, 2);
    expect(percent.mascot.y + percent.mascot.height).toBeCloseTo(percent.column.y + percent.column.height, 0);
    expect(percent.mascot.x + percent.mascot.width).toBeCloseTo(percent.column.x, 0);
    expect(percent.column.width).toBe(400);

    await setScale(page, 0);
    const auto = await boxes(page);
    expect(auto.mascot.height).toBeCloseTo(auto.column.height, 0);
    expect(auto.column.height).toBeCloseTo(percent.column.height, 0);
  });

  test('the Scrim paints a panel 0.75rem past the column at its 60% default, behind the pieces', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    const { column } = await boxes(page);
    const scrim = page.locator('[data-fq-scrim]');
    const box = (await scrim.boundingBox())!;
    expect(box).toMatchObject({ x: column.x - 12, y: column.y - 12, width: column.width + 24 });
    expect(box.height).toBeCloseTo(column.height + 24, 0);
    expect(await scrim.evaluate((el) => getComputedStyle(el).opacity)).toBe('0.6');
    // The field above the scrim takes the press, and a press on the scrim's rim reaches the app.
    const field = (await askField(page).boundingBox())!;
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#formaquestion-window') !== null, { x: field.x + 8, y: field.y + 8 })).toBe(true);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#formaquestion-window') === null, { x: column.x - 6, y: column.y + column.height / 2 })).toBe(true);
  });

  test.describe('on a short screen', () => {
    test.use({ viewport: { width: 1280, height: 700 } });

    test('the Mascot tab keeps its preview in place while the controls scroll, and both columns show the shared scrollbar', async ({ page }) => {
      await openApp(page);
      await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });
      await loaded(page, '[data-fq-mask-target]');
      const preview = page.locator('[data-fq-mascot-preview]');
      const controls = scroller(page, 'mascot-controls');
      const before = (await preview.boundingBox())!;
      const side = (await controls.boundingBox())!;
      // The preview sits left of the controls.
      expect(before.x + before.width).toBeLessThanOrEqual(side.x);
      expect(await controls.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

      await expect(scrollbar(page, 'mascot-controls')).toHaveCount(1);
      // The preview column is too short for its content here, so it scrolls and shows the bar too.
      await expect(scrollbar(page, 'mascot-preview')).toHaveCount(1);
      await expect.poll(() => scroller(page, 'mascot-preview').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

      await controls.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await expect.poll(() => controls.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      const after = (await preview.boundingBox())!;
      expect(after.y).toBeCloseTo(before.y, 0);
      expect(after.x).toBeCloseTo(before.x, 0);
    });
  });

  test.describe('on a tall screen', () => {
    // The widget is 744px with its padding; the column holds it from about 1180px of viewport height.
    test.use({ viewport: { width: 1920, height: 1200 } });

    test('the Mascot tab preview column holds its content with no scrollbar', async ({ page }) => {
      await openApp(page);
      await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });
      await loaded(page, '[data-fq-mask-target]');
      await expect(scroller(page, 'mascot-preview')).toBeVisible();
      expect(await scroller(page, 'mascot-preview').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(false);
      await expect(scrollbar(page, 'mascot-preview')).toHaveCount(0);
    });
  });

  test.describe('below the wide layout', () => {
    test.use({ viewport: { width: 900, height: 700 } });

    test('the Mascot tab stack has one scroller, which holds the preview and the controls', async ({ page }) => {
      await openApp(page);
      await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });
      await loaded(page, '[data-fq-mask-target]');
      const stack = page.locator('[data-fq-scroll="mascot-tab"]');
      await expect(stack).toHaveCount(1);
      await expect(scroller(page, 'mascot-preview')).toHaveCount(0);
      await expect(scroller(page, 'mascot-controls')).toHaveCount(0);
      expect(await stack.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      await expect(stack.locator('[data-fq-mascot-preview]')).toHaveCount(1);
      await expect(stack.locator('[data-fq-mascot-controls]')).toHaveCount(1);
      await expect(stack.locator('xpath=..').locator('> [data-orientation="vertical"]')).toHaveCount(1);
    });
  });

  test.describe('with the Mascot off', () => {
    const boxOf = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!;

    test("one line holds the columns' place, centered, and its link opens General", async ({ page }) => {
      await openApp(page, { FORMAMORPH_helpSettings: { mascot: false } });
      await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });

      const line = page.getByTestId('mascot-off-status');
      await expect(line).toContainText('The Mascot is off. Select “General” to turn it on.');
      await expect(page.locator('[data-fq-mascot-preview]')).toBeHidden();
      await expect(page.locator('[data-fq-mascot-controls]')).toBeHidden();
      await expect(page.getByTestId('mascot-footer').getByRole('button', { name: 'Save' })).toBeDisabled();
      await expect(page.getByRole('combobox', { name: 'Preset' })).toBeDisabled();

      // The line sits between the preset row and the footer, centered across the footer's width.
      const header = await boxOf(page.getByTestId('mascot-preset-row'));
      const footer = await boxOf(page.getByTestId('mascot-footer'));
      const text = await boxOf(line.locator('p'));
      expect(text.y).toBeGreaterThan(header.y + header.height);
      expect(text.y + text.height).toBeLessThan(footer.y);
      expect(text.x + text.width / 2).toBeCloseTo(footer.x + footer.width / 2, -1);

      await line.getByRole('button', { name: 'General' }).click();
      await expect(page.getByRole('tab', { name: 'General' })).toHaveAttribute('data-state', 'active');
    });

    test('toggling the switch on General moves neither the preset row nor the footer', async ({ page }) => {
      await openApp(page);
      await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });
      await loaded(page, '[data-fq-mask-target]');
      const frame = async () => [await boxOf(page.getByTestId('mascot-preset-row')), await boxOf(page.getByTestId('mascot-footer'))];
      const on = await frame();

      await page.getByRole('tab', { name: 'General' }).click();
      await page.getByRole('checkbox', { name: 'Mascot' }).click();
      await page.getByRole('tab', { name: 'Mascot' }).click();
      await expect(page.getByTestId('mascot-off-status')).toContainText('The Mascot is off');
      expect(await frame()).toEqual(on);
    });
  });

  test('the Endpoint tab puts Answer and Search on one row, over an editor headed by the active endpoint', async ({ page }) => {
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'endpoint' });
    // The route selects carry no accessible name, so the two first selects of the tab stand for the two fields.
    const routes = page.getByRole('dialog').getByRole('combobox');
    await expect(routes.first()).toContainText('Use Active Endpoint');
    await expect(routes.nth(1)).toContainText('Same as Answer');
    // The two labels top the two fields, so equal tops mean one row. A longer hint can push one select lower.
    const answerLabel = (await page.getByRole('dialog').locator('label', { hasText: 'Answer Endpoint' }).boundingBox())!;
    const pickLabel = (await page.getByRole('dialog').locator('label', { hasText: 'Search Endpoint' }).boundingBox())!;
    expect(pickLabel.y).toBeCloseTo(answerLabel.y, 0);
    const answer = (await routes.first().boundingBox())!;
    const pick = (await routes.nth(1).boundingBox())!;
    expect(pick.x).toBeGreaterThan(answer.x + answer.width - 1);
    const heading = page.getByRole('heading', { name: /^Edit .*\(Active Endpoint\)$/ });
    await expect(heading).toBeVisible();
    expect((await heading.boundingBox())!.y).toBeGreaterThan(answer.y + answer.height);
  });
});

/** The resting opacity of a Mask handle away from the box. */
const FADED = 0.3;

/** Opens the Mascot tab on an editable copy of the read-only Default, so the Mask draws its handles. */
async function openMaskTab(page: Page): Promise<void> {
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'formaquestionSettings', tab: 'mascot' });
  await loaded(page, '[data-fq-mask-target]');
  const presetRow = page.getByTestId('mascot-preset-row');
  await expect(presetRow.getByRole('combobox', { name: 'Preset' })).toHaveText('Default');
  await expect(page.locator('[data-fq-mask-box] button')).toHaveCount(0);
  await presetRow.getByRole('button', { name: 'Duplicate' }).click();
  await expect(presetRow.getByRole('combobox', { name: 'Preset' })).toHaveText('Default (copy)');
  await expect(page.locator('[data-fq-mask-box] button')).toHaveCount(9);
}

/** The painted opacity of the eight handles and the move grip. */
const gripOpacities = (page: Page) =>
  page.locator('[data-fq-mask-box] button').evaluateAll((grips) => grips.map((grip) => Number(getComputedStyle(grip).opacity)));

const gripTransition = (page: Page) =>
  page.locator('[data-fq-mask-box] button').first().evaluate((grip) => getComputedStyle(grip).transitionDuration);

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
