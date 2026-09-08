import { expect, type Page, test } from '@playwright/test';

const openReference = async (page: Page) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem&tab=rich-lists');
  const reference = page.getByRole('tabpanel', { name: 'Rich Lists' });
  await expect(reference).toBeVisible();
  return reference;
};

test('rich-list actions stay local and reachable through bounded panes', async ({ page }, testInfo) => {
  const reference = await openReference(page);
  const editor = reference.getByRole('region', { name: 'World Editor List' });
  const saves = reference.getByRole('region', { name: 'Save and Load List' });

  await editor.getByText('The Clockwork Archivist With a Deliberately Long Name').click();
  const selectedName = editor.getByRole('textbox', { name: 'Selected Name' });
  await expect(selectedName).toHaveValue('The Clockwork Archivist With a Deliberately Long Name');
  await selectedName.fill('The Brass Archivist');
  await editor.getByRole('button', { name: 'Duplicate' }).first().click();
  await expect(editor.getByText('The Brass Archivist Copy')).toBeVisible();
  await editor.getByRole('button', { name: 'Delete' }).first().click();
  await expect(editor.getByText('The Brass Archivist', { exact: true })).toBeHidden();

  const saveName = saves.getByRole('textbox', { name: 'Save Name' });
  await saveName.fill('Before the Bell Rings');
  await saves.getByRole('button', { name: 'Save', exact: true }).click();
  await saves.getByRole('button', { name: 'Load save “Before the Bell Rings”' }).click();
  await expect(saves).toContainText('Loaded “Before the Bell Rings”.');
  await saves.getByRole('button', { name: 'Export save “Before the Bell Rings”' }).click();
  await expect(saves).toContainText('Prepared “Before the Bell Rings” for export.');
  await saves.getByRole('button', { name: 'Delete save “Before the Bell Rings”' }).click();
  await expect(saves.getByRole('button', { name: 'Load save “Before the Bell Rings”' })).toHaveCount(0);
  await expect(saves).toContainText('Deleted “Before the Bell Rings”.');
  await saveName.fill('   ');
  await expect(saves.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

  const firstSaveBefore = await saves.getByRole('button', { name: /^Load save/ }).first().getAttribute('aria-label');
  const grips = saves.getByRole('button', { name: 'Drag to reorder' });
  const source = await grips.nth(0).boundingBox();
  const target = await grips.nth(1).boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => saves.getByRole('button', { name: /^Load save/ }).first().getAttribute('aria-label'))
    .not.toBe(firstSaveBefore);

  const panes = reference.locator('[data-radix-scroll-area-viewport]');
  await expect(panes).toHaveCount(2);
  for (const pane of await panes.all()) {
    const before = await pane.evaluate((element) => ({
      top: element.scrollTop,
      viewport: element.clientHeight,
      content: element.scrollHeight,
    }));
    expect(before.content).toBeGreaterThan(before.viewport);
    await pane.hover();
    await page.mouse.wheel(0, 240);
    await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(before.top);
  }

  if (testInfo.project.name === 'mobile') {
    const pane = panes.first();
    await pane.evaluate((element) => { element.scrollTop = 0; });
    const box = await pane.boundingBox();
    expect(box).not.toBeNull();
    const x = box!.x + box!.width / 2;
    const startY = box!.y + box!.height * 0.75;
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - 120 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => pane.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  }

  const editorGrip = editor.getByRole('button', { name: 'Drag to reorder' }).first();
  await editorGrip.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(editorGrip).toBeFocused();
  expect(await editorGrip.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  await page.keyboard.press('Tab');
  const editorSelection = editor.getByRole('button', { name: /^Select / }).first();
  await expect(editorSelection).toBeFocused();
  expect(await editorSelection.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  await page.keyboard.press('Enter');

  const lastSaveAction = saves.getByRole('button', { name: 'Delete save “Arrival at Tidemark”' });
  await saveName.focus();
  for (let step = 0; step < 40 && !await lastSaveAction.evaluate((element) => element === document.activeElement); step += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(lastSaveAction).toBeFocused();
  const focusReveal = await lastSaveAction.evaluate((element) => {
    const viewport = element.closest('[data-radix-scroll-area-viewport]')?.getBoundingClientRect();
    const focused = element.getBoundingClientRect();
    return viewport ? focused.top >= viewport.top && focused.bottom <= viewport.bottom : false;
  });
  expect(focusReveal).toBe(true);

  const layout = await reference.evaluate((element) => {
    const cards = Array.from(element.querySelectorAll('[role="region"]')).map((card) => card.getBoundingClientRect());
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sameRow: Math.abs(cards[0].top - cards[1].top) < 2,
    };
  });
  expect(layout.pageOverflow).toBeLessThanOrEqual(0);
  expect(layout.sameRow).toBe(testInfo.project.name === 'desktop');
});

test('rich-list scrollbars retain the shared appearance and long-content gutter', async ({ page }) => {
  const reference = await openReference(page);
  const measurements = await reference.evaluate((element) => {
    const regions = Array.from(element.querySelectorAll('[role="region"]'));
    return regions.map((region) => {
      const viewport = region.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]');
      const scrollbar = region.querySelector<HTMLElement>('[data-orientation="vertical"]');
      const thumb = scrollbar?.firstElementChild as HTMLElement | null;
      const longRow = region.querySelector<HTMLElement>('[aria-label*="Western Breakwater"]');
      return {
        arrows: scrollbar?.querySelectorAll('button').length,
        gutter: viewport ? getComputedStyle(viewport).paddingRight : null,
        longRowFits: longRow ? longRow.scrollWidth <= longRow.clientWidth : true,
        radius: thumb ? getComputedStyle(thumb).borderRadius : null,
        width: scrollbar ? getComputedStyle(scrollbar).width : null,
      };
    });
  });

  expect(measurements).toEqual([
    expect.objectContaining({ arrows: 0, gutter: '11px', radius: '9999px', width: '10px' }),
    expect.objectContaining({ arrows: 0, gutter: '11px', longRowFits: true, radius: '9999px', width: '10px' }),
  ]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`rich lists inherit the ${theme} Forest theme and Atkinson font`, async ({ page }, testInfo) => {
    await page.addInitScript((nextTheme) => localStorage.setItem('vite-ui-theme', nextTheme), theme);
    const reference = await openReference(page);
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'forest');
      document.documentElement.style.setProperty(
        '--app-font',
        "'Atkinson Hyperlegible', ui-sans-serif, system-ui, sans-serif",
      );
      document.documentElement.style.fontSize = '20px';
    });

    await expect(page.locator('html')).toHaveClass(new RegExp(`(^|\\s)${theme}(\\s|$)`));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
    const appearance = await reference.evaluate((element) => ({
      font: getComputedStyle(element).fontFamily,
      pageFont: getComputedStyle(document.body).fontFamily,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      selected: getComputedStyle(element.querySelector('[data-editor-row-selected]')!).backgroundColor,
      surface: getComputedStyle(element.querySelector('[role="region"]')!).backgroundColor,
      thumb: getComputedStyle(element.querySelector('[data-orientation="vertical"]')!.firstElementChild!).backgroundColor,
    }));
    expect(appearance.font).toBe(appearance.pageFont);
    expect(appearance.font).toContain('Atkinson Hyperlegible');
    expect(appearance.pageOverflow).toBeLessThanOrEqual(0);
    expect(appearance.selected).not.toBe(appearance.surface);
    expect(appearance.thumb).not.toBe(appearance.surface);
    await testInfo.attach(`${theme}-forest-atkinson-rich-lists`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
}
