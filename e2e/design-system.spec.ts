import { expect, test } from '@playwright/test';

test('all design references fit the viewport and remain reachable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  const showcase = page.locator('[data-design-system-showcase]');
  await expect(showcase).toBeVisible();

  for (const name of ['Settings', 'Markdown', 'Community Cards']) {
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
