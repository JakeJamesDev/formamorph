import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/** The Equipment Settings Body rows on the `items` fixture: Humanoid with Main Hand, Off Hand and Ring ×2, Hound with Neck. */
const openBodies = async (page: Page, extra: Record<string, string> = {}) => {
  await openApp(page, extra);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'items', subtab: 'equipment', fixture: 'items' });
  const stage = page.locator('[data-body-layout-stage]').first();
  // The fixture stores a world before the editor opens.
  await expect(stage).toBeVisible({ timeout: 60_000 });
  await stage.scrollIntoViewIfNeeded();
  return stage;
};

const rect = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('not laid out');
  return box;
};

const center = (box: { x: number; y: number; width: number; height: number }) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

const drag = async (page: Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
};

const slotBox = (stage: Locator, label: string) => stage.locator(`[data-slot-box="${label}"]`);

test.describe('Body Layout editor', () => {
  test.slow();

  test('a pointer drag moves a box and stays inside the Backdrop', async ({ page }) => {
    const stage = await openBodies(page);
    const hand = slotBox(stage, 'Main Hand');
    const start = await rect(hand);
    await drag(page, center(start), { x: center(start).x + 40, y: center(start).y + 90 });
    const moved = await rect(hand);
    expect(moved.x - start.x).toBeCloseTo(40, -1);
    expect(moved.y - start.y).toBeCloseTo(90, -1);
    expect(moved.width).toBeCloseTo(start.width, 0);

    const bounds = await rect(stage);
    await drag(page, center(moved), { x: bounds.x - 400, y: bounds.y - 400 });
    const pinned = await rect(hand);
    expect(pinned.x).toBeGreaterThanOrEqual(bounds.x - 1);
    expect(pinned.y).toBeGreaterThanOrEqual(bounds.y - 1);
  });

  test('a right click leaves the selection alone', async ({ page }) => {
    const stage = await openBodies(page);
    const hand = slotBox(stage, 'Main Hand');
    await hand.click();
    await hand.click({ button: 'right' });
    await expect(hand).toHaveAttribute('aria-pressed', 'true');
  });

  test('a corner handle resizes a box, down to the smallest size', async ({ page }) => {
    const stage = await openBodies(page);
    const hand = slotBox(stage, 'Main Hand');
    await hand.click();
    const start = await rect(hand);
    const handle = stage.locator('[data-box-handle="se"]');
    await drag(page, center(await rect(handle)), { x: start.x + start.width + 30, y: start.y + start.height + 20 });
    const grown = await rect(hand);
    expect(grown.x).toBeCloseTo(start.x, 0);
    expect(grown.width).toBeCloseTo(start.width + 30, -1);
    expect(grown.height).toBeCloseTo(start.height + 20, -1);

    const bounds = await rect(stage);
    await drag(page, center(await rect(handle)), { x: start.x - 200, y: start.y - 200 });
    const least = await rect(hand);
    expect(least.width).toBeCloseTo(bounds.width * 0.04, 0);
    expect(least.height).toBeCloseTo(bounds.height * 0.04, 0);
  });

  test('a drag snaps to another box, and Alt skips it', async ({ page }) => {
    const stage = await openBodies(page);
    const hand1 = slotBox(stage, 'Main Hand');
    const hand2 = slotBox(stage, 'Off Hand');
    const target = (await rect(hand1)).y;
    expect((await rect(hand2)).y).toBeCloseTo(target, 0);

    // Alt leaves Off Hand where it is dropped, 4 px below Main Hand's top: within reach of the snap.
    await page.keyboard.down('Alt');
    const start = center(await rect(hand2));
    await drag(page, start, { x: start.x, y: start.y + 30 });
    const lowered = center(await rect(hand2));
    await drag(page, lowered, { x: lowered.x, y: lowered.y - 26 });
    await page.keyboard.up('Alt');
    expect((await rect(hand2)).y - target).toBeCloseTo(4, 0);

    // Without Alt, the same reach pulls it onto Main Hand's top, and a guide shows while it holds.
    const near = center(await rect(hand2));
    await page.mouse.move(near.x, near.y);
    await page.mouse.down();
    await page.mouse.move(near.x, near.y - 1);
    await expect(stage.locator('[data-snap-guide="y"]')).toBeVisible();
    await page.mouse.up();
    expect((await rect(hand2)).y).toBeCloseTo(target, 0);
    await expect(stage.locator('[data-snap-guide="y"]')).toHaveCount(0);
  });

  test('touch moves a box and resizes it from a handle', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'only the mobile project has touch');
    const stage = await openBodies(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [to] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const hand = slotBox(stage, 'Main Hand');
    const scrollBefore = await page.evaluate(() => document.scrollingElement?.scrollTop);
    const start = await rect(hand);
    await touch(center(start), { x: center(start).x + 30, y: center(start).y + 40 });
    const moved = await rect(hand);
    expect(moved.x - start.x).toBeCloseTo(30, -1);
    expect(moved.y - start.y).toBeCloseTo(40, -1);
    expect(await page.evaluate(() => document.scrollingElement?.scrollTop)).toBe(scrollBefore);

    const handle = await rect(stage.locator('[data-box-handle="se"]'));
    await touch(center(handle), { x: center(handle).x + 20, y: center(handle).y + 20 });
    const grown = await rect(hand);
    expect(grown.width - moved.width).toBeCloseTo(20, -1);
    expect(grown.height - moved.height).toBeCloseTo(20, -1);
  });

  test('a whole drag is one undo step', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the undo button sits behind a menu on mobile');
    const stage = await openBodies(page);
    const hand = slotBox(stage, 'Main Hand');
    const start = await rect(hand);
    await drag(page, center(start), { x: center(start).x + 40, y: center(start).y + 90 });
    expect((await rect(hand)).y).toBeGreaterThan(start.y + 50);
    await page.getByRole('button', { name: /^Undo/ }).first().click();
    const undone = await rect(hand);
    expect(undone.x).toBeCloseTo(start.x, 0);
    expect(undone.y).toBeCloseTo(start.y, 0);
  });

  test('the Snap to Others choice is remembered across a reload', async ({ page }) => {
    const stage = await openBodies(page);
    const toggle = page.getByRole('checkbox', { name: 'Snap to Others' }).first();
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
    await page.waitForFunction(() => localStorage.getItem('FORMAMORPH_bodyLayoutSnap') === 'false');
    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'items', subtab: 'equipment', fixture: 'items' });
    await expect(stage).toBeVisible({ timeout: 60_000 });
    await expect(toggle).not.toBeChecked();
  });

  test('dragging the bottom edge changes the aspect and boxes keep their fractions', async ({ page }) => {
    const stage = await openBodies(page);
    const hand = slotBox(stage, 'Main Hand');
    const before = await rect(stage);
    const fractionBefore = ((await rect(hand)).y - before.y) / before.height;
    const edge = stage.locator('[data-backdrop-edge]');
    const from = center(await rect(edge));
    await drag(page, from, { x: from.x, y: from.y - 120 });
    const after = await rect(stage);
    expect(after.height).toBeCloseTo(before.height - 120, -1);
    expect(after.width).toBeCloseTo(before.width, 0);
    expect(((await rect(hand)).y - after.y) / after.height).toBeCloseTo(fractionBefore, 2);
  });

  test('a small box inside a selected large box takes the pointer, and so do the handles', async ({ page }) => {
    const stage = await openBodies(page);
    const hand = slotBox(stage, 'Main Hand');
    await hand.click();
    const start = await rect(hand);
    const bounds = await rect(stage);
    // Grow Main Hand well past Ring so Ring sits inside it.
    await drag(page, center(await rect(stage.locator('[data-box-handle="se"]'))), { x: bounds.x + bounds.width * 0.7, y: bounds.y + bounds.height * 0.7 });
    const large = await rect(hand);
    expect(large.width).toBeGreaterThan(start.width);
    const ring = slotBox(stage, 'Ring 1');
    const ringCenter = center(await rect(ring));
    expect(ringCenter.x).toBeGreaterThan(large.x);
    expect(ringCenter.y).toBeLessThan(large.y + large.height);
    await page.mouse.click(ringCenter.x, ringCenter.y);
    await expect(ring).toHaveAttribute('aria-pressed', 'true');

    await hand.click({ position: { x: large.width - 20, y: large.height - 20 } });
    const handle = stage.locator('[data-box-handle="se"]');
    const hit = await handle.evaluate((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return document.elementFromPoint(x + width / 2, y + height / 2) === node;
    });
    expect(hit).toBe(true);
  });
});
