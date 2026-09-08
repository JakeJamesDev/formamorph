import { expect, test } from '@playwright/test';

const openReference = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  await page.getByRole('tab', { name: 'Context Menu', exact: true }).click();
  return page.getByRole('region', { name: 'Grouped Context Actions' });
};

test('the Main Menu context menu keeps its actions local and keyboard-accessible', async ({ page }) => {
  const reference = await openReference(page);
  const sample = reference.getByRole('button', { name: /sample world/i });
  const beforeStorage = await page.evaluate(() => JSON.stringify(localStorage));

  await sample.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitemradio', { name: 'Medium' })).toHaveAttribute('aria-checked', 'true');

  const menuBox = await menu.boundingBox();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThanOrEqual(0);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const labelLefts = await menu.locator('[role="menuitemradio"], [role="menuitem"]').evaluateAll((items) => (
    items.map((item) => {
      const textNodes = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      let node = textNodes.nextNode();
      while (node && !node.textContent?.trim()) node = textNodes.nextNode();
      if (!node) return null;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    }).filter((left): left is number => left !== null)
  ));
  expect(labelLefts.length).toBeGreaterThan(0);
  expect(Math.max(...labelLefts) - Math.min(...labelLefts)).toBeLessThanOrEqual(1);

  await menu.getByRole('menuitemradio', { name: 'Large' }).click();
  await expect(reference.getByText('The tile size is large.')).toBeVisible();

  await sample.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Archive of Very Long Expeditions and Unfinished Maps' }).click();
  await expect(reference.getByText('The sample group is Archive of Very Long Expeditions and Unfinished Maps.')).toBeVisible();

  await sample.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Create New Group' }).click();
  await expect(reference.getByText('The sample group is New Group.')).toBeVisible();

  await sample.click({ button: 'right' });
  await menu.getByRole('menuitem', { name: 'Delete' }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Delete World' });
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  await expect(sample).toBeVisible();

  await sample.focus();
  await page.keyboard.press('Shift+F10');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(sample).toBeFocused();

  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(beforeStorage);
});

test('the Main Menu context menu opens by touch and dismisses outside', async ({ page }) => {
  const reference = await openReference(page);
  const sample = reference.getByRole('button', { name: /sample world/i });

  await sample.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 100 });
  await page.waitForTimeout(750);
  await expect(page.getByRole('menu')).toBeVisible();
  await page.dispatchEvent('[aria-label="Sample world: The Lantern District"]', 'pointerup', {
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
  });

  await page.mouse.click(4, 4);
  await expect(page.getByRole('menu')).toBeHidden();
});

for (const theme of ['light', 'dark'] as const) {
  test(`the Main Menu context menu inherits the ${theme} Forest theme and Atkinson font`, async ({ page }, testInfo) => {
    await page.addInitScript((nextTheme) => {
      localStorage.setItem('vite-ui-theme', nextTheme);
    }, theme);
    const reference = await openReference(page);
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'forest');
      document.documentElement.style.setProperty(
        '--app-font',
        "'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif",
      );
    });

    await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');

    await reference.getByRole('button', { name: /sample world/i }).click({ button: 'right' });
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const fonts = await menu.evaluate((element) => ({
      menu: getComputedStyle(element).fontFamily,
      page: getComputedStyle(document.body).fontFamily,
    }));
    expect(fonts.menu).toBe(fonts.page);
    expect(fonts.menu).toContain('Atkinson Hyperlegible');
    await expect(menu).toHaveClass(/bg-popover/);
    await expect(menu).toHaveCSS('opacity', '1');
    await testInfo.attach(`${theme}-forest-atkinson`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
  });
}
