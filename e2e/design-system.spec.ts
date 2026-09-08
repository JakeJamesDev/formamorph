import { expect, test } from '@playwright/test';

test('all design references fit the viewport and remain reachable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  const showcase = page.locator('[data-design-system-showcase]');
  await expect(showcase).toBeVisible();

  for (const name of ['Settings', 'Markdown', 'Community Cards', 'Find']) {
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
  }
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
