import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

// A real caret, focus and character delete: jsdom has none of them.

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

const WORLD = {
  id: 'e2e-open-value-edges',
  worldOverview: { name: 'E2E Open Value Edges', description: '', author: '' },
  locations: [],
  stats: [],
  // Both values are the same, so a random roll never changes the text under test.
  entities: [{ id: 'ent-0', name: 'Walker', type: 'Person', aiDescription: 'Go {{ph:ph-ed:world:e1}} now.' }],
  traits: [],
  statUpdates: [],
  placeholders: [{ id: 'ph-ed', name: 'Ed', values: [{ id: 'ph-ed-v0', text: 'Al' }, { id: 'ph-ed-v1', text: 'Al' }] }],
};

const FIELD = '[data-find-field="AI-Facing Description"]';
const BEFORE = 'Go ';
const AFTER = ' now.';

/** Opens the entity's description on the Values tab and returns its editor root. */
async function openValues(page: Page): Promise<Locator> {
  // An ended contest's results dialog reads the full list and would cover the editor.
  await page.route(/\/events(\?|$)/, (route) => route.fulfill({ json: { data: [] } }));
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'descriptions' });
  await page.getByText('Walker', { exact: true }).first().click();
  const field = page.locator(FIELD);
  await field.getByRole('tab', { name: 'Values' }).click();
  const root = field.locator('[contenteditable="true"]').first();
  await expect(root.locator('[data-open-value-text]')).toHaveText('Al');
  return root;
}

/** The open value's text, and the field text on each side of its chip. */
function parts(root: Locator): Promise<{ before: string; value: string; after: string }> {
  return root.evaluate((el) => {
    const value = el.querySelector('[data-open-value-text]');
    const chip = value?.closest('[data-lexical-decorator]');
    return {
      before: chip?.previousSibling?.textContent ?? '',
      value: value?.textContent ?? '',
      after: chip?.nextSibling?.textContent ?? '',
    };
  });
}

/** Whether keyboard focus is inside the open value. */
const focusInValue = (root: Locator) =>
  root.evaluate((el) => !!el.querySelector('[data-open-value-text]')?.contains(document.activeElement));

/**
 * Clicks the field text right beside the chip, on the given side. A click, rather than a run of arrow
 * keys: the editor reads its caret from the browser's own selection events, which lag behind keys
 * pressed as fast as a test presses them.
 */
async function caretBesideChip(page: Page, root: Locator, side: 'before' | 'after') {
  const spot = await root.evaluate((el, which) => {
    const chip = el.querySelector('[data-open-value-text]')?.closest('[data-lexical-decorator]');
    // The field text renders inside a span, so walk down to the text node the range needs.
    let text = (which === 'before' ? chip?.previousSibling : chip?.nextSibling) as Node | null;
    while (text && text.nodeType !== Node.TEXT_NODE) text = which === 'before' ? text.lastChild : text.firstChild;
    const length = text?.textContent?.length ?? 0;
    // A collapsed range has no box, so measure the character beside the chip and aim just inside it.
    const range = document.createRange();
    range.setStart(text as Node, which === 'before' ? length - 1 : 0);
    range.setEnd(text as Node, which === 'before' ? length : 1);
    const { left, right, top, height } = range.getBoundingClientRect();
    return { x: which === 'before' ? right - 1 : left + 1, y: top + height / 2 };
  }, side);
  await page.mouse.click(spot.x, spot.y);
}

/** Steps into the open value from the given side and waits for it to hold the keyboard. */
async function enterValue(page: Page, root: Locator, side: 'before' | 'after') {
  await caretBesideChip(page, root, side);
  await page.keyboard.press(side === 'before' ? 'ArrowRight' : 'ArrowLeft');
  await expect.poll(() => focusInValue(root)).toBe(true);
}

test.beforeEach(({ viewport: _viewport }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Mobile opens the field full screen on a tap');
});

test('ArrowLeft after a value enters it at its end, and a space plus ArrowRight drops the space after the chip', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'after');

  await page.keyboard.type(' ');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('Z');
  expect(await parts(root)).toEqual({ before: BEFORE, value: 'Al', after: ' Z now.' });
});

test('ArrowRight before a value enters it at its start, and a space plus ArrowLeft drops the space before the chip', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'before');

  await page.keyboard.type(' ');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('Y');
  expect(await parts(root)).toEqual({ before: 'Go Y ', value: 'Al', after: AFTER });
});

test('a space followed by a word stays in the value', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'after');
  await page.keyboard.type(' Bo');
  await page.keyboard.press('ArrowRight');
  expect(await parts(root)).toEqual({ before: BEFORE, value: 'Al Bo', after: AFTER });
});

test('focus leaving the editor drops a pending space after the chip', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'after');
  await page.keyboard.type(' ');
  await page.keyboard.press('Tab');
  await expect.poll(() => parts(root)).toEqual({ before: BEFORE, value: 'Al', after: `  now.` });
});

test('End drops a pending space after the chip, and Home drops one before it', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'after');
  await page.keyboard.type(' ');
  await page.keyboard.press('End');
  await expect.poll(() => parts(root)).toEqual({ before: BEFORE, value: 'Al', after: '  now.' });

  await enterValue(page, root, 'before');
  await page.keyboard.type(' ');
  await page.keyboard.press('Home');
  await expect.poll(() => parts(root)).toEqual({ before: 'Go  ', value: 'Al', after: '  now.' });
});

test('Backspace at a value start reaches nothing, and the first character still deletes', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'before');
  await page.keyboard.press('Backspace');
  expect(await parts(root)).toEqual({ before: BEFORE, value: 'Al', after: AFTER });

  // Typing moves the caret past the character it wrote, so this Backspace deletes the value's first one.
  await page.keyboard.type('X');
  await expect(root.locator('[data-open-value-text]')).toHaveText('XAl');
  await page.keyboard.press('Backspace');
  await expect(root.locator('[data-open-value-text]')).toHaveText('Al');
  expect(await parts(root)).toEqual({ before: BEFORE, value: 'Al', after: AFTER });
});

test('Delete at a value end pulls nothing in, and Backspace empties a value but no further', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'after');
  await page.keyboard.press('Delete');
  expect(await parts(root)).toEqual({ before: BEFORE, value: 'Al', after: AFTER });

  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect(root.locator('[data-open-value-text]')).toHaveText('');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');
  expect(await parts(root)).toEqual({ before: BEFORE, value: '', after: AFTER });
});

test('Enter inside a value adds a line break and leaves the field text alone', async ({ page }) => {
  const root = await openValues(page);
  await enterValue(page, root, 'after');
  await page.keyboard.press('Enter');
  expect(await parts(root)).toEqual({ before: BEFORE, value: 'Al', after: AFTER });
  // A break at the end of a line renders with the browser's own filler element beside it.
  expect(await root.locator('[data-open-value-text] br').count()).toBeGreaterThan(0);
});
