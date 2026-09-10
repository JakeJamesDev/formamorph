import { expect, test } from '@playwright/test';
import { gotoDev, openApp } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

/** One stat with a long-sentence band, which is what the descriptor row's width rule is about. */
const WORLD = {
  id: 'e2e-stat-widths',
  worldOverview: { name: 'E2E Stat Widths', description: '', author: '' },
  locations: [],
  entities: [],
  traits: [],
  statUpdates: [],
  stats: [{
    id: 'stat-a', name: 'Warmth', type: 'number', description: 'How thawed the traveler is.',
    min: 0, max: 100, value: 40, regen: 0, code: 'return 40;',
    descriptors: [
      { id: 'band-a', threshold: 30, description: 'Chilled through. Hands shake, and fine work is beyond you.' },
      { id: 'band-b', threshold: 100, description: 'Warm enough to think straight and hold a steady hand.' },
    ],
  }],
};

/**
 * The pane holding the stat panel is not monotonic in viewport width. Below `md` the panel is the
 * full-width detail sheet; at `md` the editor splits and the panel takes half. So a width that is
 * comfortable at 767 is cramped at 820, and a viewport-keyed rule that only steps up gets it wrong in
 * the middle. These widths are the corners of that shape.
 */
const WIDTHS = [375, 767, 820, 900, 1280, 1600];

/**
 * The tab label's own text box, which spills outside the trigger long before `scrollWidth` reports it —
 * the trigger's overflow is visible, so an over-wide label simply draws over its neighbor.
 *
 * Scoped to the panel's own strip: the editor's strip is on the same screen and carries a Stats tab of
 * its own.
 */
async function labelFit(page: import('@playwright/test').Page, name: string) {
  const strip = page.getByRole('tablist', { name: 'Stat Fields' });
  return strip.getByRole('tab', { name, exact: true }).evaluate((element) => {
    const trigger = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const label = range.getBoundingClientRect();
    return { triggerLeft: trigger.left, triggerRight: trigger.right, labelLeft: label.left, labelRight: label.right };
  });
}

const openStat = async (page: import('@playwright/test').Page, subtab: string) => {
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'stats', subtab });
  await page.getByText('Warmth', { exact: true }).first().click();
  await expect(page.getByRole('tablist', { name: 'Stat Fields' })).toBeVisible();
};

const loadWorld = async (page: import('@playwright/test').Page) => {
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    const id = await dev.putWorld(world);
    await dev.editWorld(id);
  }, WORLD);
};

/** Nothing pushes the page sideways. */
const noSidewaysScroll = async (page: import('@playwright/test').Page) => {
  const scroll = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(scroll.content).toBeLessThanOrEqual(scroll.viewport);
};

for (const width of WIDTHS) {
  test(`the stat panel fits its pane at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loadWorld(page);
    await openStat(page, 'details');

    for (const name of ['Details', 'Descriptors', 'Code']) {
      const fit = await labelFit(page, name);
      expect(fit.labelLeft).toBeGreaterThanOrEqual(fit.triggerLeft - 1);
      expect(fit.labelRight).toBeLessThanOrEqual(fit.triggerRight + 1);
    }

    // The identity row's type column either holds a select or does not exist. The name field keeps the
    // flexible track, so a second track narrower than the select itself is the failure this guards.
    const identity = page.locator('div.grid').filter({ has: page.getByText('Name', { exact: true }) }).first();
    const columns = await identity.evaluate((element) => {
      const tracks = getComputedStyle(element).gridTemplateColumns.split(' ').map(Number.parseFloat);
      return { count: tracks.length, last: tracks[tracks.length - 1] };
    });
    if (columns.count > 1) expect(columns.last).toBeGreaterThanOrEqual(176);

    await noSidewaysScroll(page);
  });

  test(`a descriptor band gets room for its sentence at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await loadWorld(page);
    await openStat(page, 'descriptors');

    // The threshold box keeps a fixed width for its unit tag, and a two-digit number needs a fraction of
    // it. Whatever the pane, the sentence must end up with at least twice the number's room — the row wraps
    // to get it wherever the panel is too narrow to give it side by side. Merely wider is not enough: at
    // 820px the unwrapped row gave a 58-character sentence 142px against the number's 112px.
    const threshold = page.getByLabel('Threshold for Chilled through. Hands shake, and fine work is beyond you.');
    const sentence = page.getByLabel('Description', { exact: true }).first();
    const numberWidth = (await threshold.boundingBox())!.width;
    const sentenceWidth = (await sentence.boundingBox())!.width;
    expect(sentenceWidth).toBeGreaterThanOrEqual(numberWidth * 2);

    // Both controls stay reachable at every width; neither is what wrapping drops.
    await expect(page.getByRole('button', { name: /^Pins for Chilled through/ })).toBeVisible();
    await noSidewaysScroll(page);
  });
}
