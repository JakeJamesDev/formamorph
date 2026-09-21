import { expect, test, type Locator, type Page } from '@playwright/test';

export interface ChipSurface {
  field: Locator;
  editor: Locator;
  paletteChip: Locator;
  chipLabel: string;
}

export interface ChipSurfaceAdapter {
  name: string;
  open(page: Page): Promise<ChipSurface>;
  reopen(page: Page): Promise<ChipSurface>;
}

/** Replace the authored field through normal editor input. */
export async function setChipFieldText(page: Page, editor: Locator, text: string): Promise<void> {
  await editor.click();
  await page.keyboard.press('Control+a');
  if (text) await page.keyboard.type(text);
  else await page.keyboard.press('Backspace');
  await expect(editor).toHaveText(text);
}

/** Native browser drag to the editor's right edge, where the drop caret resolves after its text. */
export async function dragChipToEnd(source: Locator, editor: Locator): Promise<void> {
  const box = await editor.boundingBox();
  expect(box).not.toBeNull();
  await source.dragTo(editor, { targetPosition: { x: box!.width - 8, y: box!.height / 2 } });
}

/** Drop coordinates measured from a real rendered text run; the drag still lets the browser choose the caret. */
export async function beforeText(editor: Locator, text: string): Promise<{ x: number; y: number }> {
  return editor.evaluate((root, wanted) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest('[contenteditable="false"]')) continue;
      const at = node.textContent?.indexOf(wanted) ?? -1;
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, Math.min(at + 1, node.textContent?.length ?? at + 1));
      const rect = range.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      return { x: rect.left - box.left + 1, y: rect.top - box.top + rect.height / 2 };
    }
    throw new Error(`Text not found: ${wanted}`);
  }, text);
}

/**
 * Shared behavior contract for production chip editors. Each adapter only opens its real screen and
 * identifies the field and its existing click source; gestures and assertions stay here.
 */
export function chipInteractionContract(adapter: ChipSurfaceAdapter): void {
  test.describe(`chip interaction (${adapter.name})`, () => {
    test.beforeEach(({ viewport: _viewport }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'Native chip dragging is a desktop interaction');
    });

    test('click insertion keeps the intended field, caret, and next keystroke', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, 'Before after');
      await page.keyboard.press('Home');

      await surface.paletteChip.click();
      await page.keyboard.type('Z');

      await expect(surface.editor).toHaveText(`${surface.chipLabel}ZBefore after`);
    });

    test('a palette drag inserts once at the drop caret and remains reusable', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, 'Before after');
      await page.keyboard.press('Home');

      await dragChipToEnd(surface.paletteChip, surface.editor);

      await expect(surface.editor).toHaveText(`Before after${surface.chipLabel}`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveCount(1);
      await surface.field.getByRole('button', { name: 'Undo' }).click();
      await expect(surface.editor).toHaveText('Before after');
      await surface.field.getByRole('button', { name: 'Redo' }).click();
      await expect(surface.editor).toHaveText(`Before after${surface.chipLabel}`);
      await dragChipToEnd(surface.paletteChip, surface.editor);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveCount(2);
    });

    test('a palette drag targets its unfocused empty editor and subsequent typing', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, '');
      await surface.paletteChip.focus();

      await dragChipToEnd(surface.paletteChip, surface.editor);

      await expect(surface.editor).toHaveText(surface.chipLabel);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveCount(1);
      await expect(surface.editor).toBeFocused();
      await page.keyboard.type('Z');
      await expect(surface.editor).toHaveText(`${surface.chipLabel}Z`);
    });

    test('palette insertion and movement persist exactly after reopening', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, 'Before after');
      await surface.paletteChip.focus();
      await dragChipToEnd(surface.paletteChip, surface.editor);
      const placed = surface.editor.locator('[data-lexical-decorator]').first();
      const token = await placed.locator('[data-chip-token]').getAttribute('data-chip-token');
      await placed.dragTo(surface.editor, { targetPosition: await beforeText(surface.editor, 'Before') });
      await expect(surface.editor).toHaveText(`${surface.chipLabel}Before after`);

      const reopened = await adapter.reopen(page);
      await expect(reopened.editor).toHaveText(`${surface.chipLabel}Before after`);
      await expect(reopened.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);
    });

    test('Preview rejects palette drops and preserves editing afterward', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, 'Before after');
      await dragChipToEnd(surface.paletteChip, surface.editor);
      const token = await surface.editor.locator('[data-chip-token]').getAttribute('data-chip-token');
      await surface.field.getByRole('tab', { name: 'Preview', exact: true }).click();
      const preview = surface.field.getByTestId('prompt-preview');
      const text = await preview.textContent();
      await surface.paletteChip.dragTo(preview);
      await expect(preview).toHaveText(text!);
      await expect(page.locator('[data-chip-drop-caret]:visible')).toHaveCount(0);
      await surface.field.getByRole('tab', { name: 'Edit', exact: true }).click();
      await expect(surface.editor).toHaveText(`Before after${surface.chipLabel}`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);
      await dragChipToEnd(surface.paletteChip, surface.editor);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveCount(2);
    });

    test('palette insertion in wrapped text survives fullscreen movement', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 800 });
      const surface = await adapter.open(page);
      const text = 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron '
        + 'pi rho sigma tau upsilon phi chi psi omega alpha beta gamma delta epsilon target omega';
      await setChipFieldText(page, surface.editor, text);
      const target = await beforeText(surface.editor, 'target');
      const start = await beforeText(surface.editor, 'Alpha');
      expect(target.y).toBeGreaterThan(start.y + 4);
      await surface.paletteChip.dragTo(surface.editor, { targetPosition: target });
      await expect(surface.editor).toHaveText(text.replace('target', `${surface.chipLabel}target`));
      const placed = surface.editor.locator('[data-lexical-decorator]').first();
      const token = await placed.locator('[data-chip-token]').getAttribute('data-chip-token');
      await page.setViewportSize({ width: 700, height: 800 });
      await surface.field.getByRole('button', { name: 'Edit full screen' }).click();
      await placed.dragTo(surface.editor, { targetPosition: await beforeText(surface.editor, 'Alpha') });
      await expect(surface.editor).toHaveText(`${surface.chipLabel}${text}`);
      await dragChipToEnd(placed, surface.editor);
      await expect(surface.editor).toHaveText(`${text}${surface.chipLabel}`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`palette feedback and cancellation respect the ${theme} theme`, async ({ page }, testInfo) => {
        await page.addInitScript((value) => localStorage.setItem('vite-ui-theme', value), theme);
        const surface = await adapter.open(page);
        await setChipFieldText(page, surface.editor, 'Before after');
        await page.evaluate(() => {
          document.addEventListener('dragstart', (event) => {
            document.documentElement.dataset.dragEffect = event.dataTransfer?.effectAllowed;
            const ghost = document.querySelector('[data-chip-drag-ghost] > *');
            document.documentElement.dataset.ghostOpacity = ghost ? getComputedStyle(ghost).opacity : '';
          }, { once: true });
        });
        const sourceBox = await surface.paletteChip.boundingBox();
        const editorBox = await surface.editor.boundingBox();
        expect(sourceBox).not.toBeNull();
        expect(editorBox).not.toBeNull();
        await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
        await page.mouse.down();
        await page.mouse.move(editorBox!.x + editorBox!.width - 8, editorBox!.y + editorBox!.height / 2, { steps: 8 });
        await page.mouse.move(editorBox!.x + editorBox!.width - 8, editorBox!.y + editorBox!.height / 2);
        const caret = page.locator('[data-chip-drop-caret]:visible');
        await expect(caret).toHaveCount(1);
        await expect(page.locator('html')).toHaveAttribute('data-drag-effect', 'copy');
        await expect(page.locator('html')).toHaveAttribute('data-ghost-opacity', '0.6');
        const style = await caret.evaluate((element) => {
          const probe = document.createElement('div');
          probe.style.background = 'hsl(var(--foreground))';
          document.body.appendChild(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          probe.remove();
          const rect = element.getBoundingClientRect();
          return { color: getComputedStyle(element).backgroundColor, expected, width: rect.width, height: rect.height, x: rect.x };
        });
        expect(style.color).toBe(style.expected);
        expect(style.width).toBe(2);
        expect(style.height).toBeGreaterThan(0);
        expect(style.x).toBeGreaterThan(editorBox!.x);
        expect(style.x).toBeLessThan(editorBox!.x + editorBox!.width);
        await page.screenshot({ path: `.scratch/chip-drag/${adapter.name}-${theme}.png`, animations: 'disabled' });
        await testInfo.attach(`${adapter.name}-${theme}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await expect(surface.editor).toHaveText('Before after');
        await expect(caret).toHaveCount(0);
        await surface.paletteChip.dragTo(surface.field.getByRole('button', { name: 'Edit full screen' }));
        await expect(surface.editor).toHaveText('Before after');
        await expect(caret).toHaveCount(0);
        await dragChipToEnd(surface.paletteChip, surface.editor);
        await expect(surface.editor).toHaveText(`Before after${surface.chipLabel}`);
      });
    }

    test('a placed chip moves once, and history restores both states', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, 'Before after');
      await page.keyboard.press('Home');
      await surface.paletteChip.click();
      const placed = surface.editor.locator('[data-lexical-decorator]').first();
      await expect(placed).toBeVisible();
      const token = await placed.locator('[data-chip-token]').getAttribute('data-chip-token');

      await dragChipToEnd(placed, surface.editor);
      await expect(surface.editor.locator('[data-lexical-decorator]')).toHaveCount(1);
      await expect(surface.editor).toHaveText(`Before after${surface.chipLabel}`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);

      await placed.dragTo(surface.editor, { targetPosition: await beforeText(surface.editor, 'after') });
      await expect(surface.editor).toHaveText(`Before ${surface.chipLabel}after`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);

      await placed.dragTo(surface.editor, { targetPosition: await beforeText(surface.editor, 'Before') });
      await expect(surface.editor).toHaveText(`${surface.chipLabel}Before after`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);

      await surface.field.getByRole('button', { name: 'Undo' }).click();
      await expect(surface.editor).toHaveText(`Before ${surface.chipLabel}after`);
      await surface.field.getByRole('button', { name: 'Redo' }).click();
      await expect(surface.editor).toHaveText(`${surface.chipLabel}Before after`);
    });

    test('an outside drop preserves the placement and leaves the next move independent', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, 'Before after');
      await page.keyboard.press('Home');
      await surface.paletteChip.click();
      const placed = surface.editor.locator('[data-lexical-decorator]').first();

      await placed.dragTo(surface.paletteChip);
      await expect(surface.editor).toHaveText(`${surface.chipLabel}Before after`);

      await dragChipToEnd(placed, surface.editor);
      await expect(surface.editor).toHaveText(`Before after${surface.chipLabel}`);
    });

    test('returning to the original caret and pressing Escape cancel cleanly', async ({ page }) => {
      const surface = await adapter.open(page);
      await setChipFieldText(page, surface.editor, 'Before after');
      await page.keyboard.press('Home');
      await surface.paletteChip.click();
      const placed = surface.editor.locator('[data-lexical-decorator]').first();
      const token = await placed.locator('[data-chip-token]').getAttribute('data-chip-token');
      const editorBox = await surface.editor.boundingBox();
      expect(editorBox).not.toBeNull();

      await placed.dragTo(surface.editor, { targetPosition: { x: 2, y: editorBox!.height / 2 } });
      await expect(surface.editor).toHaveText(`${surface.chipLabel}Before after`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);

      await page.evaluate(() => {
        document.addEventListener('dragstart', () => document.documentElement.dataset.e2eDragStarted = '', { once: true });
      });
      const sourceBox = await placed.boundingBox();
      expect(sourceBox).not.toBeNull();
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
      await page.mouse.down();
      await page.mouse.move(editorBox!.x + editorBox!.width - 8, editorBox!.y + editorBox!.height / 2, { steps: 8 });
      await expect(page.locator('html')).toHaveAttribute('data-e2e-drag-started', '');
      await expect(page.locator('[data-chip-drop-caret]:visible')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await page.mouse.up();

      await expect(surface.editor).toHaveText(`${surface.chipLabel}Before after`);
      await expect(surface.editor.locator('[data-chip-token]')).toHaveAttribute('data-chip-token', token!);
      await expect(page.locator('[data-chip-drop-caret]:visible')).toHaveCount(0);
      await dragChipToEnd(placed, surface.editor);
      await expect(surface.editor).toHaveText(`Before after${surface.chipLabel}`);
    });
  });
}
