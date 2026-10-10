import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp, openEditorSection } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

/** One entity, so its panel opens with Name as the first field of its scroll window. */
const WORLD = {
  id: 'e2e-landing-clip',
  worldOverview: { name: 'E2E Landing Clip', description: '', author: '' },
  locations: [],
  stats: [],
  entities: [{ id: 'ent-a', name: 'Ember Speckle', type: 'Mushroom', aliases: ['speckle'] }],
  traits: [],
  statUpdates: [],
};

/** One painted pixel, as PNG bytes. Two equal buffers are the same color. */
const pixel = (page: Page, x: number, y: number) =>
  page.screenshot({ clip: { x: Math.floor(x), y: Math.floor(y), width: 1, height: 1 } });

/** Opens the World Editor on the one entity's panel. */
async function openEntity(page: Page): Promise<void> {
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities' });
  await page.getByText('Ember Speckle', { exact: true }).first().click();
}

/** The nearest ancestor that scrolls or cuts a field down. */
const scrollWindowOf = (field: Locator) => field.evaluateHandle((frame) => {
  let scroller = frame.parentElement;
  while (scroller && getComputedStyle(scroller).overflowY === 'visible') scroller = scroller.parentElement;
  return scroller!;
});

test('a history reveal on a field flush with its scroll window shows the whole ring', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'The mobile detail sheet puts the image above Name, so no field is flush');
  // The still ring holds one look for its 1.5 s, so a pixel read during it is stable.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openEntity(page);

  const field = page.locator('[data-history-field="name"]:visible').first();
  await field.getByRole('textbox', { name: 'Name' }).click();
  await page.keyboard.press('End');
  await page.keyboard.type('s');
  await openEditorSection(page, 'Stats');
  await page.keyboard.press('Control+z');
  await expect(page.locator('.landing-ring')).toHaveCount(1);

  // The scenario: the field's top edge is its scroll window's top edge, so the ring's top edge lies outside it.
  const windowTop = await (await scrollWindowOf(field)).evaluate((scroller) => scroller.getBoundingClientRect().top);
  expect(Math.abs((await field.boundingBox())!.y - windowTop)).toBeLessThan(1);

  // The ring's 2px border starts 4px outside the field. Sample its middle row on top and its middle column on the left.
  const box = (await field.boundingBox())!;
  const top = { x: box.x + box.width / 2, y: box.y - 3 };
  const side = { x: box.x - 3, y: box.y + box.height / 2 };
  const topDuring = await pixel(page, top.x, top.y);
  const sideDuring = await pixel(page, side.x, side.y);
  await expect(page.locator('.landing-ring')).toHaveCount(0);
  const topAfter = await pixel(page, top.x, top.y);
  const sideAfter = await pixel(page, side.x, side.y);
  expect(await field.boundingBox()).toEqual(box);

  // The control: the left edge sits inside the scroll window, which never cuts it.
  expect(sideDuring.equals(sideAfter)).toBe(false);
  // The top edge painted the ring's color while it ran, and the page's own color once it ended.
  expect(topDuring.equals(sideDuring)).toBe(true);
  expect(topDuring.equals(topAfter)).toBe(false);
});

/** Starts the still ring on an element through the app's own module, as a landing does. */
const pulse = (page: Page, selector: string) => page.evaluate(async ([modulePath, target]) => {
  const { pulseLanding } = await import(/* @vite-ignore */ modulePath) as typeof import('../src/lib/landingPulse');
  pulseLanding(document.querySelector<HTMLElement>(target)!, { reducedMotion: true });
}, ['/src/lib/landingPulse.ts', selector] as const);

test('the ring follows its field when the panel scrolls during the pulse', async ({ page }, info) => {
  test.skip(info.project.name === 'mobile', 'The desktop split layout holds the panel in its own scroll window');
  await openEntity(page);
  const field = page.locator('[data-history-field="pronouns"]:visible').first();
  await field.waitFor();

  await pulse(page, '[data-history-field="pronouns"]');
  const ring = page.locator('.landing-ring');
  const scrolled = await (await scrollWindowOf(field)).evaluate((scroller) => {
    scroller.scrollTop += 40;
    return scroller.scrollTop;
  });
  expect(scrolled).toBeGreaterThan(0);
  await expect.poll(async () => {
    const [ringBox, fieldBox] = [await ring.boundingBox(), await field.boundingBox()];
    return ringBox && fieldBox ? Math.round(ringBox.y - (fieldBox.y - 4)) : null;
  }).toBe(0);
});

test('a ring on a row inside a dialog paints above the dialog and never takes a hit', async ({ page }) => {
  await openApp(page);
  // The start-up toast covers the dialog's header on mobile; close it so the baseline pixel holds still.
  const toast = page.getByText('Loaded default worlds');
  await toast.waitFor();
  await page.getByRole('button', { name: /close/i }).first().click();
  await toast.waitFor({ state: 'hidden' });
  await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'display' });
  const row = page.getByRole('dialog').locator('[data-surface-target]:visible').first();
  await row.evaluate((element) => element.setAttribute('data-landing-probe', ''));
  // The dialog's own entrance must end first, or the baseline pixel is mid-motion.
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'));
  const box = (await row.boundingBox())!;
  const side = { x: box.x - 3, y: box.y + box.height / 2 };
  const hit = () => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.landing-layer') !== null, side);

  const before = await pixel(page, side.x, side.y);
  await pulse(page, '[data-landing-probe]');
  const during = await pixel(page, side.x, side.y);
  expect(await hit()).toBe(false);
  await expect(page.locator('.landing-ring')).toHaveCount(0);

  expect(during.equals(before)).toBe(false);
  expect((await pixel(page, side.x, side.y)).equals(before)).toBe(true);
});
