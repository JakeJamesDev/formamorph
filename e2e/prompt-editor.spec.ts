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

test.describe('focus never opens or re-opens full screen by itself', () => {
  // A phone raises its keyboard whenever the caret lands in the editor, so anything that moves focus
  // there without being asked raises it too. There is no soft keyboard to drive in a browser test, so
  // these measure the mechanism instead: who holds focus, and what that does to the full-screen state.
  // Together they are the loop that made the keyboard impossible to dismiss — each link, not the symptom.

  test('focus alone does not open full screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE, 'only phones auto-open');
    await openApp(page);
    await openPromptEditor(page);
    const editor = page.locator('[contenteditable]').first();

    // Focus without a tap is what a closing dialog hands back. Opening on it made leaving full screen
    // re-enter it immediately, so the reader could never get out.
    await editor.focus();
    await expect(page.getByRole('dialog', { name: 'Prompts' })).toHaveCount(0);
  });

  test('a tap still opens full screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE, 'only phones auto-open');
    await openApp(page);
    await openPromptEditor(page);

    // The other half: distinguishing tap from focus must not cost the feature itself.
    await page.locator('[contenteditable]').first().click();
    await expect(page.getByRole('dialog', { name: 'Prompts' })).toBeVisible();
  });

  test('opening full screen leaves the caret out of the editor', async ({ page }) => {
    await openApp(page);
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();
    await expect(page.getByRole('dialog', { name: 'Prompts' })).toBeVisible();

    // Radix focuses a dialog's first focusable on open. Landing in the editor raises a phone's keyboard
    // before the reader has asked to type anything.
    const inEditor = await page.evaluate(() => !!document.activeElement?.hasAttribute('contenteditable'));
    expect(inEditor).toBe(false);
  });

  test('leaving full screen does not hand focus back to the editor', async ({ page }) => {
    await openApp(page);
    await openPromptEditor(page);
    await chrome.enterFullscreen(page).click();

    // Type first, so focus is genuinely in the editor — the state a reader is in when they go to leave.
    const editor = page.locator('[contenteditable]').first();
    await editor.click();
    await expect(async () => {
      expect(await page.evaluate(() => !!document.activeElement?.hasAttribute('contenteditable'))).toBe(true);
    }).toPass();

    await chrome.exitFullscreen(page).click();
    await expect(page.getByRole('dialog', { name: 'Prompts' })).toHaveCount(0);

    // Radix restores focus on close to whatever held it — here, the editor being left. That refocus
    // raises the keyboard again, and used to re-trigger full screen along with it.
    const backInEditor = await page.evaluate(() => !!document.activeElement?.hasAttribute('contenteditable'));
    expect(backInEditor).toBe(false);
    await expect(page.getByRole('dialog', { name: 'Prompts' })).toHaveCount(0);
  });
});

test.describe('a dropdown does not resize as you scroll it', () => {
  test('reaching either end leaves every option where it was', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE, 'the prompt picker is the phone-width control');
    await openApp(page);
    await openPromptEditor(page);

    // The prompt picker is the one list long enough to scroll at this width.
    await page.getByRole('combobox').filter({ hasText: '·' }).click();
    const viewport = page.locator('[data-radix-select-viewport]');
    await viewport.waitFor();

    // Radix mounts each scroll chevron only while there is somewhere to scroll that way. In normal flow
    // that made arriving at an end delete a row, moving every option — including the one under the
    // finger. Real wheel events, because Radix drives these off its own scroll handling and a scripted
    // scrollTop does not reproduce the state changes.
    const layout = () =>
      page.$$eval('[role="option"]', (opts) => opts.map((o) => (o as HTMLElement).offsetTop).join(','));
    const height = () => viewport.evaluate((el) => Math.round(el.clientHeight));

    const atTop = { layout: await layout(), height: await height() };

    await viewport.hover();
    await page.mouse.wheel(0, 600); // hard to the bottom
    await page.waitForTimeout(250);
    const atBottom = { layout: await layout(), height: await height() };

    await page.mouse.wheel(0, -600); // and back
    await page.waitForTimeout(250);
    const backAtTop = { layout: await layout(), height: await height() };

    expect(atBottom.layout).toBe(atTop.layout);
    expect(backAtTop.layout).toBe(atTop.layout);
    expect(atBottom.height).toBe(atTop.height);
    expect(backAtTop.height).toBe(atTop.height);
  });

  test('the chevrons sit over the list rather than inside it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== MOBILE, 'same control as above');
    await openApp(page);
    await openPromptEditor(page);
    await page.getByRole('combobox').filter({ hasText: '·' }).click();
    const viewport = page.locator('[data-radix-select-viewport]');
    await viewport.waitFor();

    // The mechanism behind the case above, asserted directly: a chevron in flow is what lets its
    // mounting move anything. Out of flow, it cannot.
    const inFlow = await viewport.evaluate((vp) =>
      [...(vp.parentElement?.children ?? [])]
        .filter((c) => c !== vp && c.querySelector('svg'))
        .some((c) => getComputedStyle(c).position !== 'absolute'));
    expect(inFlow).toBe(false);
  });
});
