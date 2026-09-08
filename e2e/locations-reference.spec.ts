import { expect, test } from '@playwright/test';

test('locations reference preserves local edits, hierarchy, and responsive tools', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('FORMAMORPH_introSeen', '1');
    localStorage.setItem('FORMAMORPH_canvasSnap', 'false');
    localStorage.setItem('FORMAMORPH_canvasGridVisible', 'false');
    localStorage.setItem('FORMAMORPH_canvasConnectionStyle', 'elbow');
  });
  await page.goto('/#dev?modal=designSystem');
  await page.evaluate(async () => {
    document.documentElement.dataset.theme = 'purple';
    document.documentElement.style.setProperty('--app-font', '"Atkinson Hyperlegible", sans-serif');
    await document.fonts.load('16px "Atkinson Hyperlegible"');
  });
  await page.getByRole('tab', { name: 'Locations', exact: true }).click();
  const showcase = page.locator('[data-design-system-showcase]');
  const selected = page.getByLabel('Selected Location', { exact: true });
  await expect(selected).toContainText('(20, 60)');
  await expect(page.locator('.react-flow__node')).toHaveCount(8);
  await expect(page.locator('.react-flow__node-locationGroup')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge[data-id^="connection:"]')).toHaveCount(4);
  await expect(page.locator('[data-id="implicit:archive>market"]')).toHaveCount(0);
  for (const [childId, parentId] of [['archive', 'harbor'], ['reading', 'archive']]) {
    const child = await page.locator(`.react-flow__node[data-id="${childId}"]`).boundingBox();
    const parent = await page.locator(`.react-flow__node[data-id="${parentId}"]`).boundingBox();
    expect(child!.x).toBeGreaterThan(parent!.x);
    expect(child!.y).toBeGreaterThan(parent!.y);
    expect(child!.x + child!.width).toBeLessThan(parent!.x + parent!.width);
    expect(child!.y + child!.height).toBeLessThan(parent!.y + parent!.height);
  }
  const width = await showcase.evaluate(element => [element.scrollWidth, element.clientWidth]);
  expect(width[0]).toBeLessThanOrEqual(width[1]);
  await page.screenshot({ path: testInfo.outputPath('embedded.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Edit Full Screen', exact: true }).click();
  await expect(page.getByRole('toolbar', { name: 'Canvas Tools' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Align Left', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Snap To Grid', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const search = page.getByRole('combobox', { name: 'Find a Location' });
  await search.fill('coastal charts');
  await expect(page.getByRole('option')).toContainText('Reading Room');
  await search.press('Enter');
  const reading = page.locator('.react-flow__node[data-id="reading"]');
  await expect(reading.locator('[data-flash]')).toHaveCount(1);
  await expect(reading).toBeInViewport();
  await reading.click();
  await expect(reading).toHaveClass(/selected/);
  await page.screenshot({ path: testInfo.outputPath('revealed-location.png'), animations: 'disabled' });
  const originalPosition = await reading.getAttribute('style');
  await page.keyboard.press('ArrowRight');
  await expect(reading).not.toHaveAttribute('style', originalPosition!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(reading).toHaveAttribute('style', originalPosition!);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(reading).not.toHaveAttribute('style', originalPosition!);
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  const viewport = page.locator('.react-flow__viewport');
  const beforePan = await viewport.getAttribute('style');
  const canvas = await page.locator('.react-flow').boundingBox();
  await page.mouse.move(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height - 100);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(canvas!.x + canvas!.width / 2 + 60, canvas!.y + canvas!.height - 140, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  await expect(viewport).not.toHaveAttribute('style', beforePan!);
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  const fitted = await viewport.getAttribute('style');
  await page.getByRole('button', { name: 'Zoom In', exact: true }).click();
  await expect(viewport).not.toHaveAttribute('style', fitted!);
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  const beforeMinimap = await viewport.getAttribute('style');
  const minimap = page.locator('.react-flow__minimap');
  await expect(minimap).toBeVisible();
  await minimap.click({ position: { x: 16, y: 16 } });
  await expect(viewport).not.toHaveAttribute('style', beforeMinimap!);
  await page.getByRole('button', { name: 'Fit View', exact: true }).click();
  const beforeArrange = await reading.getAttribute('style');
  await page.getByRole('button', { name: 'Auto Arrange', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(reading).toHaveAttribute('style', beforeArrange!);
  await page.getByRole('button', { name: 'Show Grid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show Grid', exact: true })).toHaveAttribute('aria-pressed', 'false');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(value);
    }, theme);
    await search.focus();
    await expect(search).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath(`fullscreen-${theme}.png`), animations: 'disabled' });
  }
  const appearance = await search.evaluate(element => ({
    font: getComputedStyle(element).fontFamily,
    palette: document.documentElement.dataset.theme,
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  expect(appearance.palette).toBe('purple');
  expect(appearance.font).toContain('Atkinson');
  expect(appearance.reduced).toBe(true);
  const edge = page.locator('[data-id="connection:quay-garden:forward"] .react-flow__edge-interaction');
  const connectionPoint = () => edge.evaluate(element => {
    const path = element as SVGPathElement;
    // Pick the exposed end beyond the Group frame that the Connection crosses.
    const at = path.getPointAtLength(path.getTotalLength() * 0.95);
    const screen = new DOMPoint(at.x, at.y).matrixTransform(path.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  });
  let point = await connectionPoint();
  await page.mouse.click(point.x, point.y);
  const hint = page.getByRole('textbox', { name: 'Travel Hint' });
  const originalHint = 'along the elevated footbridge above the harbor warehouses and winter storage yards';
  await expect(hint).toHaveValue(originalHint);
  await hint.fill('through the north gate');
  await hint.locator('..').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('.react-flow__edgelabel-renderer')).toContainText(originalHint);
  point = await connectionPoint();
  await page.mouse.click(point.x, point.y);
  await expect(hint).toHaveValue(originalHint);
  await page.screenshot({ path: testInfo.outputPath('connection-inspector.png'), animations: 'disabled' });
  await hint.locator('..').getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(() => [
    localStorage.getItem('FORMAMORPH_canvasSnap'),
    localStorage.getItem('FORMAMORPH_canvasGridVisible'),
    localStorage.getItem('FORMAMORPH_canvasConnectionStyle'),
  ])).toEqual(['false', 'false', 'elbow']);
  await page.getByRole('button', { name: 'Exit Full Screen', exact: true }).click();
  await expect(selected).toContainText('(40, 60)');
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Locations', exact: true }).click();
  await expect(selected).toContainText('(20, 60)');
});
