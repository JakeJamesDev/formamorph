import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/** Mobile, the split's first desktop width, a laptop, and two widths past the modal's own cap. */
const WIDTHS = [375, 820, 1280, 1600, 2560];

/** The caps in `src/components/modals/libraryEditorLayout.ts`, restated so a changed cap fails here. */
const MODAL_MAX = 1400;
const FIELD_MAX = 800;

/** Measured once the open animation is done: it zooms from 95%, so an early read is short. */
async function dialogWidth(page: Page) {
  return page.getByRole('dialog').evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
    return element.getBoundingClientRect().width;
  });
}

async function fieldColumnWidth(page: Page) {
  const column = page.getByRole('dialog').locator('[data-field-column]');
  await expect(column).toBeVisible();
  return column.evaluate((element) => element.getBoundingClientRect().width);
}

async function expectDialogWidth(page: Page, width: number) {
  expect(Math.abs(await dialogWidth(page) - Math.min(width * 0.95, MODAL_MAX))).toBeLessThanOrEqual(1);
}

/** Nothing pushes the page sideways. */
async function expectNoHorizontalOverflow(page: Page) {
  const scroll = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(scroll.content).toBeLessThanOrEqual(scroll.viewport);
}

/**
 * The Placeholders split spans the dialog, and on desktop its two panes share that width evenly.
 * Mobile shows one pane at a time, so there only the split's own width is checked.
 */
async function expectPlaceholderPanesShareWidth(page: Page, width: number) {
  const dialog = await dialogWidth(page);
  const split = page.getByRole('dialog').locator('[data-list-detail]');
  await expect(split).toBeVisible();
  const boxes = await split.evaluate((element) => ({
    split: element.getBoundingClientRect().width,
    panes: Array.from(element.children).map((child) => child.getBoundingClientRect().width),
  }));
  expect(boxes.split).toBeGreaterThanOrEqual(dialog - 4);
  if (width >= 768) {
    expect(boxes.panes).toHaveLength(2);
    expect(Math.abs(boxes.panes[0] - boxes.panes[1])).toBeLessThanOrEqual(2);
    expect(boxes.panes[0] + boxes.panes[1]).toBeGreaterThanOrEqual(boxes.split - 2);
  }
}

for (const width of WIDTHS) {
  test.describe(`library editors at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      // An ended event's poster opens over the Main Menu and covers the editor.
      await page.route(/\/events(\?|$)/, (route) => route.fulfill({ json: { data: [] } }));
      await openApp(page);
    });

    test('the entity editor is 95vw to its cap, with capped fields and full-width placeholders', async ({ page }) => {
      await gotoDev(page, 'mainMenu', { modal: 'entityEditor', tab: 'profile' });
      await expectDialogWidth(page, width);

      for (const tab of ['profile', 'descriptions', 'openings']) {
        await gotoDev(page, 'mainMenu', { modal: 'entityEditor', tab });
        expect(await fieldColumnWidth(page)).toBeLessThanOrEqual(FIELD_MAX);
        await expectNoHorizontalOverflow(page);
      }

      await gotoDev(page, 'mainMenu', { modal: 'entityEditor', tab: 'placeholders' });
      await expectPlaceholderPanesShareWidth(page, width);
      await expectNoHorizontalOverflow(page);
    });

    test('the dictionary editor is 95vw to its cap, with capped fields and full-width placeholders', async ({ page }) => {
      // The dictionary editor has no tab slot in the dev router, so its tabs are clicked.
      await gotoDev(page, 'mainMenu', { modal: 'dictionaryEditor' });
      await expectDialogWidth(page, width);

      // Mobile opens on the book's detail, over the tree that holds the add button.
      const back = page.getByRole('dialog').getByRole('button', { name: 'Dictionary', exact: true });
      if (width < 768) await back.click();
      await page.getByRole('dialog').getByRole('button', { name: 'Add entry' }).click();
      expect(await fieldColumnWidth(page)).toBeLessThanOrEqual(FIELD_MAX);
      await expectNoHorizontalOverflow(page);

      await page.getByRole('tab', { name: 'Overview', exact: true }).click();
      expect(await fieldColumnWidth(page)).toBeLessThanOrEqual(FIELD_MAX);
      await expectNoHorizontalOverflow(page);

      await page.getByRole('tab', { name: 'Placeholders', exact: true }).click();
      await expectPlaceholderPanesShareWidth(page, width);
      await expectNoHorizontalOverflow(page);
    });
  });
}
