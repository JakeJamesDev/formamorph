import { expect, test } from '@playwright/test';
import { gotoDev, openApp } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

/** One entity, so the panel opens on a real Profile tab with all its Advanced fields. */
const WORLD = {
  id: 'e2e-entity-widths',
  worldOverview: { name: 'E2E Entity Widths', description: '', author: '' },
  locations: [],
  stats: [],
  entities: [{ id: 'ent-a', name: 'Ember Speckle', type: 'Mushroom', aliases: ['speckle'] }],
  traits: [],
  statUpdates: [],
};

/**
 * The pane holding the entity panel is not monotonic in viewport width. Below `md` the panel is the
 * full-width detail sheet; at `md` the editor splits and the panel takes half. So a width that is
 * comfortable at 767 is cramped at 820, and a viewport-keyed rule that only steps up gets it wrong in
 * the middle. These widths are the corners of that shape.
 */
const WIDTHS = [375, 767, 820, 900, 1280, 1600];

/**
 * The tab label's own text box, which spills outside the trigger long before `scrollWidth` reports it —
 * the trigger's overflow is visible, so an over-wide label simply draws over its neighbor.
 *
 * Scoped to the panel's own strip: the editor's strip is on the same screen and carries a Placeholders
 * tab of its own.
 */
async function labelFit(page: import('@playwright/test').Page, name: string) {
  const strip = page.getByRole('tablist', { name: 'Entity Fields' });
  return strip.getByRole('tab', { name, exact: true }).evaluate((element) => {
    const trigger = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const label = range.getBoundingClientRect();
    return { triggerLeft: trigger.left, triggerRight: trigger.right, labelLeft: label.left, labelRight: label.right };
  });
}

for (const width of WIDTHS) {
  test(`the entity panel fits its pane at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page);
    await page.evaluate(async (world) => {
      const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
      const id = await dev.putWorld(world);
      await dev.editWorld(id);
    }, WORLD);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'profile' });
    await page.getByText('Ember Speckle', { exact: true }).first().click();
    await expect(page.getByRole('tablist', { name: 'Entity Fields' })).toBeVisible();

    // Every tab's label inside its own trigger. A label that spills overlaps its neighbor's.
    for (const name of ['Profile', 'Descriptions', 'Placeholders']) {
      const fit = await labelFit(page, name);
      expect(fit.labelLeft).toBeGreaterThanOrEqual(fit.triggerLeft - 1);
      expect(fit.labelRight).toBeLessThanOrEqual(fit.triggerRight + 1);
    }

    // Profile's second column either holds its fields or does not exist. A 43px column that wraps a name
    // one letter per line is the failure this guards.
    const grid = page.locator('div.grid').filter({ has: page.getByText('Image', { exact: true }) }).first();
    const columns = await grid.evaluate((element) => {
      const tracks = getComputedStyle(element).gridTemplateColumns.split(' ').map(Number.parseFloat);
      return { count: tracks.length, last: tracks[tracks.length - 1] };
    });
    if (columns.count > 1) expect(columns.last).toBeGreaterThan(240);

    // Nothing pushes the page sideways at any of these widths.
    const scroll = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(scroll.content).toBeLessThanOrEqual(scroll.viewport);
  });
}
