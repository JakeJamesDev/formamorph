import { test, expect } from '@playwright/test';
import { openApp, openPromptEditor, chrome } from './app';

/**
 * The prompt editor's layout, chrome gating and caret behavior — the three things that shipped broken
 * with green unit tests, because each needs a browser: a real viewport to gate on, real hit-testing to
 * click through, and a real layout engine to measure a caret against.
 */

const DESKTOP = 'desktop';
const MOBILE = 'mobile';

/** Pin the shared split preference, which the field reads from localStorage before its first layout. */
const splitMode = (mode: 'auto' | 'split' | 'tabs') => ({ FORMAMORPH_promptSplitMode: mode });

test.describe('pane chrome is gated on the device, not just the width', () => {
  test('desktop full screen gets real tab buttons', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'desktop-only gate');
    await openApp(page, splitMode('tabs'));
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();

    // The swipe dots replace this tab bar, and a pointer has no swipe — a desktop reader who lost the
    // buttons has no way left to reach Preview at all.
    await expect(chrome.editTab(page)).toBeVisible();
    await expect(chrome.previewTab(page)).toBeVisible();
  });

  test('phone full screen swaps the tab bar for the swipe dots', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE, 'phone-only gate');
    await openApp(page);
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();

    // The other side of the same gate: on a phone the gesture is the control, so the tab bar is gone.
    await expect(chrome.editTab(page)).toHaveCount(0);
  });
});

test.describe('full screen measures the viewport it fills', () => {
  test('going full screen is what earns the split toggle', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'the toggle needs room for two panes');
    // A window where the inline slot is too narrow for two panes but the whole screen is not — the only
    // width at which the two measurements disagree, and so the only one that can catch the wrong one.
    // 1000-1160 all behave this way; the mid-band value keeps a layout tweak from silently flipping it.
    await page.setViewportSize({ width: 1100, height: 860 });
    await openApp(page, splitMode('tabs'));
    await openPromptEditor(page);

    // Precondition, and the reason the case exists: inline there is no room, so no toggle.
    await expect(chrome.toSplit(page)).toHaveCount(0);

    await chrome.enterFullscreen(page).click();
    // Measured against the inline slot it was opened from rather than the window it now fills, a
    // full-screen editor decides it is still too narrow and hides its own control.
    await expect(chrome.toSplit(page)).toBeVisible();
  });

  test('the two panes really sit side by side', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'a phone never splits');
    await openApp(page, splitMode('split'));
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();

    const editor = page.locator('[contenteditable="true"]').first();
    const preview = page.getByTestId('prompt-preview').first();
    const editBox = await editor.boundingBox();
    const previewBox = await preview.boundingBox();

    expect(editBox).not.toBeNull();
    expect(previewBox).not.toBeNull();
    // Both panes have real width and neither overlaps the other: the assertion a layout-free renderer
    // can't make, since every box it reports is zero.
    expect(editBox!.width).toBeGreaterThan(300);
    expect(previewBox!.width).toBeGreaterThan(300);
    expect(editBox!.x + editBox!.width).toBeLessThanOrEqual(previewBox!.x + 1);
  });
});

test.describe('the chrome is clickable where it is drawn', () => {
  test('the split toggle switches layout when clicked', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'the toggle only renders where two panes fit');
    await openApp(page, splitMode('tabs'));
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();
    await expect(chrome.editTab(page)).toBeVisible();

    // A real click, not a dispatched event: the full-screen editor is a layer over the Settings dialog,
    // and Radix parks `pointer-events: none` on the body while a dialog is open. A layer that inherits
    // that is drawn perfectly and receives nothing — geometry right, hit-testing dead.
    await chrome.toSplit(page).click();

    // Split has no tabs at all, so the buttons going away is the layout having actually changed.
    await expect(chrome.editTab(page)).toHaveCount(0);
    await expect(chrome.toTabs(page)).toBeVisible();

    await chrome.toTabs(page).click();
    await expect(chrome.editTab(page)).toBeVisible();
  });

  test('full screen can be left again', async ({ page }) => {
    await openApp(page);
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();
    await expect(chrome.exitFullscreen(page)).toBeVisible();

    await chrome.exitFullscreen(page).click();
    await expect(chrome.enterFullscreen(page)).toBeVisible();
  });
});

test.describe('the preview follows the caret', () => {
  test('a caret parked against a chip still reports its position', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== DESKTOP, 'following needs both panes on screen');
    await openApp(page, splitMode('split'));
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();

    const editor = page.locator('[contenteditable="true"]').first();
    const preview = page.getByTestId('prompt-preview').first();
    await expect(editor).toBeVisible();

    // Both panes start at the top, so any movement below is the follow having fired.
    expect(await preview.evaluate((el) => el.scrollTop)).toBe(0);

    // A chip is a Lexical decorator element. Scrolled to the end of a prompt several screens long, the
    // last one is far enough down that following it has somewhere to go.
    const chip = editor.locator('[data-lexical-decorator]').last();
    await expect(chip).toHaveCount(1);
    await chip.scrollIntoViewIfNeeded();
    const box = await chip.boundingBox();
    expect(box).not.toBeNull();

    // Click just past the chip's right edge: that puts a collapsed caret against a decorator, whose own
    // rect is zero-height. Read naively it measures as position zero and the preview jumps to the top
    // instead of following the cursor down.
    await page.mouse.click(box!.x + box!.width + 2, box!.y + box!.height / 2);

    await expect
      .poll(async () => preview.evaluate((el) => el.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(0);
  });
});
