import { expect, test } from '@playwright/test';

test('all design references fit the viewport and remain reachable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  const showcase = page.locator('[data-design-system-showcase]');
  await expect(showcase).toBeVisible();

  for (const name of ['Settings', 'Markdown', 'Community Cards', 'Find', 'Code Templates', 'Locations', 'Context Menu', 'Footer Actions']) {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const dimensions = await showcase.evaluate(element => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const labelDimensions = await tab.evaluate(element => {
      const tabBounds = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const labelBounds = range.getBoundingClientRect();
      return {
        content: element.scrollWidth,
        viewport: element.clientWidth,
        labelLeft: labelBounds.left,
        labelRight: labelBounds.right,
        tabLeft: tabBounds.left,
        tabRight: tabBounds.right,
      };
    });
    expect(labelDimensions.content).toBeLessThanOrEqual(labelDimensions.viewport);
    expect(labelDimensions.labelLeft).toBeGreaterThanOrEqual(labelDimensions.tabLeft - 1);
    expect(labelDimensions.labelRight).toBeLessThanOrEqual(labelDimensions.tabRight + 1);
  }
});

test('the Code Templates reference validates and inserts into its local target', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  await page.getByRole('tab', { name: 'Code Templates', exact: true }).click();

  const reference = page.getByRole('region', { name: 'Stat Code Templates' });
  const opener = reference.getByRole('button', { name: 'Open Code Templates' });
  await opener.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Code Templates' });
  await expect(dialog).toBeVisible();
  expect(await page.locator(':focus').evaluate((element) => Boolean(element.closest('[role="dialog"]')))).toBe(true);

  const insert = dialog.getByRole('button', { name: 'Insert Code' });
  await expect(insert).toBeDisabled();
  await dialog.getByRole('combobox', { name: 'First Stat' }).click();
  await page.getByRole('option', { name: 'Warmth' }).click();
  await dialog.getByRole('combobox', { name: 'Second Stat' }).click();
  await page.getByRole('option', { name: 'Fatigue' }).click();

  const weight = dialog.getByRole('textbox', { name: 'Weight' });
  await weight.fill('invalid');
  await expect(dialog.getByText('Must be a number')).toBeVisible();
  await expect(insert).toBeDisabled();

  await weight.fill('0.25');
  await expect(dialog.getByText('Must be a number')).toBeHidden();
  await expect(dialog).toContainText('const weight = 0.25;');
  await expect(insert).toBeEnabled();
  await insert.click();

  await expect(dialog).toBeHidden();
  await expect(reference).toContainText('const weight = 0.25;');
  await expect(reference.getByText('The local sample stat code is updated.')).toBeVisible();
});

test('the Find reference exposes local search states and keyboard focus', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  await page.getByRole('tab', { name: 'Find', exact: true }).click();

  const reference = page.getByRole('region', { name: 'Find Bar Reference' });
  await reference.getByRole('button', { name: 'Find and Replace', exact: true }).click();
  const find = reference.getByRole('textbox', { name: 'Find' });
  await expect(find).toBeFocused();

  await find.fill('harbor');
  await expect(reference.getByText('1 / 5')).toBeVisible();
  await reference.getByRole('button', { name: 'Previous match' }).click();
  await expect(reference.getByText('5 / 5')).toBeVisible();
  await expect(reference.getByRole('textbox', { name: 'Keeper Description' })).toHaveAttribute('data-find-current', 'true');

  await reference.getByRole('button', { name: 'Close find' }).click();
  await expect(reference.getByRole('button', { name: 'Find', exact: true })).toBeFocused();
});
