import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { NON_GUIDE_PAGES } from '../src/lib/docs/docsChecks';
import { docHeadings } from '../src/lib/docs/headingAnchors';
import { gotoDev, openApp, openWorldEditor } from './app';
import { expectScrollArrow, stubLongAnswer } from './scrollArrow';

/**
 * Formaquestion: the Help tab and the help window, in the shielded layer above every dialog.
 *
 * This needs a browser. jsdom has no layout, no hit-testing, no focus trap that follows real focus and no
 * scroll lock, and those are what a modal dialog uses against everything outside it.
 */

// A full HD desktop: the 900px Settings dialog and the 400px window fit side by side.
test.use({ viewport: { width: 1920, height: 1080 } });

// These specs cover the framed window, so the Mascot is off unless the page already stored settings.
// `formaquestion-mascot.spec.ts` covers the minimal chrome.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('FORMAMORPH_helpSettings') === null) localStorage.setItem('FORMAMORPH_helpSettings', JSON.stringify({ mascot: false }));
  });
});

const helpWindow = (page: Page) => page.locator('#formaquestion-window');
const helpTab = (page: Page) => page.getByRole('button', { name: 'Help', exact: true });
const askField = (page: Page) => helpWindow(page).getByRole('textbox', { name: 'Ask a Question' });
const searchField = (page: Page) => helpWindow(page).getByRole('searchbox', { name: 'Search the Guide' });
const results = (page: Page) => helpWindow(page).getByRole('list', { name: 'Search Results' });
const reader = (page: Page) => helpWindow(page).getByRole('article');
const settings = (page: Page) => page.getByRole('dialog', { name: 'Settings' });

type Box = { x: number; y: number; width: number; height: number };

/** Which surface holds keyboard focus. */
async function focusOwner(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'body';
    if (el.closest('#formaquestion-window')) return 'window';
    if (el.closest('[data-shielded-layer]')) return 'tab';
    return el.closest('[role="dialog"], [role="alertdialog"]') ? 'dialog' : 'page';
  });
}

/** The window's box once its open animation has ended. Mid-zoom, the box is smaller and elsewhere. */
async function settledBox(page: Page): Promise<Box> {
  await helpWindow(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  return (await helpWindow(page).boundingBox())!;
}

/** Start a count of the animations that begin on the window itself. */
async function countWindowAnimations(page: Page): Promise<void> {
  await page.evaluate(() => {
    const counter = window as unknown as { fqAnimations: number };
    counter.fqAnimations = 0;
    document.addEventListener('animationstart', (event) => {
      if ((event.target as Element).id === 'formaquestion-window') counter.fqAnimations++;
    }, true);
  });
}

/** The window's open animation as the browser computed it. */
const motionOf = (page: Page) => helpWindow(page).evaluate((el) => {
  const style = getComputedStyle(el);
  return {
    duration: style.animationDuration,
    enterScale: parseFloat(style.getPropertyValue('--tw-enter-scale')),
    enterOpacity: parseFloat(style.getPropertyValue('--tw-enter-opacity')),
  };
});

const windowAnimations = (page: Page) => page.evaluate(() => (window as unknown as { fqAnimations: number }).fqAnimations);

/** Opens an item of the window's title bar menu. */
async function pickMenuItem(page: Page, name: string): Promise<void> {
  await helpWindow(page).getByRole('button', { name: 'More Actions' }).click();
  await page.getByRole('menuitem', { name }).click();
}

async function openHelp(page: Page): Promise<void> {
  await page.keyboard.press('F1');
  await expect(askField(page)).toBeVisible();
  await settledBox(page);
}

/** Goes to the window's Search tab. The window opens on Ask. */
async function showSearch(page: Page): Promise<void> {
  await helpWindow(page).getByRole('tab', { name: 'Search' }).click();
  await expect(searchField(page)).toBeVisible();
}

async function openHelpOverSettings(page: Page, tab = 'endpoints'): Promise<void> {
  await openApp(page);
  await gotoDev(page, 'mainMenu', { modal: 'settings', tab });
  await expect(settings(page)).toBeVisible();
  // The dialog zooms in as it opens; a press aimed mid-zoom lands elsewhere.
  await settings(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  await openHelp(page);
  await showSearch(page);
}

/** Drag the window by its title bar so that its left edge lands on `x`. */
async function dragWindowTo(page: Page, x: number): Promise<void> {
  const box = await settledBox(page);
  const grip = { x: box.x + 120, y: box.y + 20 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + (x - box.x), grip.y, { steps: 5 });
  await page.mouse.up();
}

/** Drag the window until it no longer covers `target`, and fail when it still does. */
async function moveWindowClearOf(page: Page, target: Locator): Promise<void> {
  const overlaps = async () => {
    const t = (await target.boundingBox())!;
    const w = await settledBox(page);
    return w.x < t.x + t.width && t.x < w.x + w.width && w.y < t.y + t.height && t.y < w.y + w.height;
  };
  if (await overlaps()) {
    const t = (await target.boundingBox())!;
    const w = await settledBox(page);
    const toLeft = t.x - w.width - 8;
    await dragWindowTo(page, toLeft >= 0 ? toLeft : t.x + t.width + 8);
  }
  expect(await overlaps(), 'the window still covers the target').toBe(false);
}

async function openSection(page: Page, pageTitle: RegExp, section: string): Promise<void> {
  await helpWindow(page).getByRole('tab', { name: 'Guide' }).click();
  const contents = helpWindow(page).getByRole('navigation', { name: 'Guide Contents' });
  await contents.getByRole('button', { name: pageTitle }).click();
  await contents.getByRole('button', { name: section, exact: true }).click();
  await expect(reader(page)).toBeVisible();
}

test.describe('Formaquestion on a desktop screen', () => {
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The floating window is the desktop form');
  });

  test('the Help tab shows on every screen, F1 toggles the window, and the window keeps its state across screens', async ({ page }) => {
    await openApp(page);
    /** F1 opens the window with the cursor in the field of its open tab, and the next F1 closes it. */
    const toggles = async (field = askField) => {
      await expect(helpTab(page)).toBeVisible();
      await page.keyboard.press('F1');
      await expect(field(page)).toBeFocused();
      await page.keyboard.press('F1');
      await expect(helpWindow(page)).toBeHidden();
    };

    // The Main Menu.
    await toggles();

    // The World Editor, a dialog.
    await openWorldEditor(page);
    await toggles();

    // The game view. The window opens before the screen change and is still open after it.
    await page.keyboard.press('F1');
    await showSearch(page);
    await searchField(page).fill('blueprint');
    await gotoDev(page, 'gameViewer', { fixture: 'whiteRoom' });
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await expect(helpTab(page)).toBeVisible();
    await expect(searchField(page)).toHaveValue('blueprint');
    await searchField(page).focus();
    await page.keyboard.press('F1');
    await expect(helpWindow(page)).toBeHidden();
    // The window is still on its Search tab.
    await toggles(searchField);
  });

  test('the player types in the window, then in Settings, and Escape closes Settings only', async ({ page }) => {
    await openHelpOverSettings(page);
    await moveWindowClearOf(page, settings(page));

    await searchField(page).click();
    await page.keyboard.type('endpoint');
    await expect(searchField(page)).toHaveValue('endpoint');
    expect(await focusOwner(page)).toBe('window');
    await expect(settings(page)).toBeVisible();

    const model = settings(page).locator('#modelName');
    await model.click();
    await model.fill('');
    await page.keyboard.type('typed-behind-the-window');
    await expect(model).toHaveValue('typed-behind-the-window');
    expect(await focusOwner(page)).toBe('dialog');

    // Back in the window: both keep their text, and both stay open.
    await searchField(page).click();
    await page.keyboard.type(' preset');
    await expect(searchField(page)).toHaveValue('endpoint preset');
    await expect(model).toHaveValue('typed-behind-the-window');

    await model.click();
    await page.keyboard.press('Escape');
    await expect(settings(page)).toBeHidden();
    await expect(helpWindow(page)).toBeVisible();
    await expect(searchField(page)).toHaveValue('endpoint preset');
  });

  test('Formaquestion Settings opens from the menu, the window waits closed, and comes back with its text', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    await askField(page).click();
    await page.keyboard.type('kept across the settings');
    await pickMenuItem(page, 'Settings');
    const help = page.getByRole('dialog', { name: 'Formaquestion Settings' });
    await expect(help).toBeVisible();
    await expect(helpWindow(page)).toBeHidden();
    const picks = help.getByRole('checkbox', { name: 'AI Search' });
    await picks.click();
    await expect(picks).toHaveAttribute('aria-checked', 'false');
    expect(await focusOwner(page)).toBe('dialog');

    await page.keyboard.press('Escape');
    await expect(help).toBeHidden();
    await expect(helpWindow(page)).toBeVisible();
    await expect(askField(page)).toHaveValue('kept across the settings');
    await expect(askField(page)).toBeFocused();
  });

  test('AI Context opens from the menu, the window waits closed, and comes back with its text', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    await askField(page).click();
    await page.keyboard.type('kept across AI Context');
    await pickMenuItem(page, 'AI Context');
    const context = page.getByRole('dialog', { name: 'AI Context' });
    await expect(context).toBeVisible();
    await expect(helpWindow(page)).toBeHidden();
    await expect(context.getByRole('button', { name: 'Collapse all' })).toBeDisabled();

    await context.getByRole('button', { name: 'Close' }).click();
    await expect(context).toBeHidden();
    await expect(helpWindow(page)).toBeVisible();
    await expect(askField(page)).toHaveValue('kept across AI Context');
  });

  test('Escape from the window closes the dialog, keeps the window and its search text, and leaves focus in the window', async ({ page }) => {
    await openHelpOverSettings(page);
    await searchField(page).click();
    await page.keyboard.type('draft');
    await page.keyboard.press('Escape');
    await expect(settings(page)).toHaveCount(0);
    await expect(helpWindow(page)).toBeVisible();
    await expect(searchField(page)).toHaveValue('draft');
    // The dialog library returns focus to its opener one task after the dialog leaves the DOM.
    await page.waitForTimeout(250);
    expect(await focusOwner(page)).toBe('window');

    // With no dialog open, Escape does nothing to the window.
    await page.keyboard.press('Escape');
    await expect(helpWindow(page)).toBeVisible();
    await expect(searchField(page)).toHaveValue('draft');
  });

  test('a closing alert dialog does not take focus from the window', async ({ page }) => {
    await openHelpOverSettings(page);
    await moveWindowClearOf(page, settings(page));
    await settings(page).getByRole('button', { name: 'Reset AI Endpoint', exact: true }).click();
    const alert = page.getByRole('alertdialog');
    await expect(alert).toBeVisible();

    await searchField(page).click();
    await page.keyboard.type('above an alert');
    await expect(searchField(page)).toHaveValue('above an alert');
    await expect(alert).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(alert).toHaveCount(0);
    await expect(settings(page)).toBeVisible();
    await page.waitForTimeout(250);
    expect(await focusOwner(page)).toBe('window');
  });

  test('a popover and a select inside a dialog still open above it and work while the window is open', async ({ page }) => {
    await openHelpOverSettings(page, 'display');
    await moveWindowClearOf(page, settings(page));
    // Focus starts in the window, so the popover opens from a dialog that does not hold focus.
    await searchField(page).click();

    await settings(page).getByRole('button', { name: 'More info' }).first().click();
    const popover = page.locator('[data-radix-popper-content-wrapper] [role="dialog"]');
    await expect(popover).toBeVisible();
    const box = (await popover.boundingBox())!;
    const onTop = await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-radix-popper-content-wrapper]'),
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(onTop).toBe(true);
    // A press in the window dismisses the popover and leaves the dialog open.
    await searchField(page).click();
    await expect(popover).toBeHidden();
    await expect(settings(page)).toBeVisible();

    const font = settings(page).locator('#fontFamily');
    const before = await font.textContent();
    await font.click();
    const option = page.getByRole('option').nth(1);
    const picked = await option.textContent();
    await option.click();
    await expect(font).toHaveText(picked!);
    expect(picked).not.toBe(before);
    await expect(helpWindow(page)).toBeVisible();
  });

  test('the window paints above the dialog, takes the wheel under its scroll lock, and a screen reader still sees it', async ({ page }) => {
    await openHelpOverSettings(page);
    const win = await settledBox(page);
    const top = await page.evaluate(
      ([x, y]) => (document.elementFromPoint(x, y)?.closest('#formaquestion-window') ? 'window' : 'other'),
      [win.x + win.width / 2, win.y + win.height / 2],
    );
    expect(top).toBe('window');

    await helpWindow(page).getByRole('tab', { name: 'Guide' }).click();
    const viewport = helpWindow(page).locator('[data-fq-scroll="contents"]');
    expect(await viewport.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100);
    const box = (await viewport.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

    // The dialog hides every other body child from assistive technology. The layer stays in the tree.
    expect(await page.evaluate(() => !!document.querySelector('#formaquestion-window')?.closest('[aria-hidden="true"]'))).toBe(false);
    await expect(page.getByRole('dialog', { name: 'Formaquestion' })).toBeVisible();
  });

  test('the window moves and resizes with the pointer, with no lag, and stays whole on the screen', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    const start = await settledBox(page);

    // Move: the painted box follows each pointer step at once. A transition on left and top would trail.
    await page.mouse.move(start.x + 120, start.y + 20);
    await page.mouse.down();
    await page.mouse.move(start.x + 120 - 300, start.y + 20 - 200, { steps: 3 });
    const during = (await helpWindow(page).boundingBox())!;
    expect(Math.abs(during.x - (start.x - 300))).toBeLessThanOrEqual(1);
    expect(Math.abs(during.y - (start.y - 200))).toBeLessThanOrEqual(1);
    await page.mouse.up();

    // Past the screen edge the window stops at the edge.
    await dragWindowTo(page, -500);
    expect((await settledBox(page)).x).toBe(0);

    // Resize from the bottom right corner. The top left corner stays put.
    const before = await settledBox(page);
    const grip = await helpWindow(page).locator('[data-fq-resize]').boundingBox();
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip!.x + grip!.width / 2 + 220, grip!.y + grip!.height / 2 + 60, { steps: 3 });
    await page.mouse.up();
    const after = await settledBox(page);
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(Math.round(after.width)).toBe(Math.round(before.width) + 220);
    expect(Math.round(after.height)).toBe(Math.round(before.height) + 60);
    // 620px is past the 560px line, so the grip changed the layout too.
    await expect(helpWindow(page).locator('[data-fq-layout="wide"]')).toBeVisible();
    await expect(helpWindow(page).getByRole('button', { name: 'Wide View' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the place and size survive a reload, and the window returns inside a smaller screen', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    await dragWindowTo(page, 300);
    await helpWindow(page).getByRole('button', { name: 'Wide View' }).click();
    const placed = await settledBox(page);
    expect(Math.round(placed.width)).toBe(720);

    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await openHelp(page);
    expect(await settledBox(page)).toEqual(placed);

    // A smaller browser window: the stored box no longer fits, and the window comes back inside.
    await dragWindowTo(page, 1100);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect.poll(async () => {
      const box = (await helpWindow(page).boundingBox())!;
      return box.x >= 0 && box.y >= 0 && box.x + box.width <= 1280 && box.y + box.height <= 720;
    }).toBe(true);
  });

  test('the Help tab drags to another edge, keeps its place across a reload, and opens on a press with no move', async ({ page }) => {
    await openApp(page);
    await expect(helpTab(page)).toHaveAttribute('data-fq-edge', 'right');
    const tab = (await helpTab(page).boundingBox())!;
    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2);
    await page.mouse.down();
    await page.mouse.move(40, 300, { steps: 5 });
    await page.mouse.up();
    await expect(helpTab(page)).toHaveAttribute('data-fq-edge', 'left');
    // A move does not open the window.
    await expect(helpWindow(page)).toHaveCount(0);
    const moved = (await helpTab(page).boundingBox())!;
    expect(moved.x).toBe(0);
    expect(Math.abs(moved.y + moved.height / 2 - 300)).toBeLessThanOrEqual(2);

    await page.reload();
    await page.waitForFunction(() => '__fmDev' in window);
    await expect(helpTab(page)).toHaveAttribute('data-fq-edge', 'left');
    expect((await helpTab(page).boundingBox())!.y).toBe(moved.y);

    await helpTab(page).click();
    await expect(askField(page)).toBeFocused();
    // The window grows out of the tab: its zoom is fixed at the tab's center.
    const origin = await helpWindow(page).evaluate((el) => {
      const [x, y] = getComputedStyle(el).transformOrigin.split(' ').map(parseFloat);
      const box = el.getBoundingClientRect();
      return { x: box.left + x, y: box.top + y };
    });
    await settledBox(page);
    const at = (await helpTab(page).boundingBox())!;
    expect(Math.abs(origin.x - (at.x + at.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(origin.y - (at.y + at.height / 2))).toBeLessThanOrEqual(1);

    await helpWindow(page).getByRole('button', { name: 'Close Formaquestion' }).click();
    await expect(helpWindow(page)).toHaveCount(0);
    await expect(helpTab(page)).toBeFocused();
  });

  test('the Help tab moves with the arrow keys', async ({ page }) => {
    await openApp(page);
    await helpTab(page).focus();
    const start = (await helpTab(page).boundingBox())!;
    await page.keyboard.press('ArrowDown');
    expect((await helpTab(page).boundingBox())!.y).toBeGreaterThan(start.y);
    await page.keyboard.press('ArrowLeft');
    await expect(helpTab(page)).toHaveAttribute('data-fq-edge', 'left');
    await expect(helpTab(page)).toBeFocused();
    expect((await helpTab(page).boundingBox())!.x).toBe(0);
  });

  test('the contents list shows every indexed page, and a click shows the section', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    await helpWindow(page).getByRole('tab', { name: 'Guide' }).click();
    const contents = helpWindow(page).getByRole('navigation', { name: 'Guide Contents' });
    // Each guide page in the docs folder shows by its own title.
    const titles = readdirSync('docs')
      .filter((name) => name.endsWith('.md') && !NON_GUIDE_PAGES.includes(name.slice(0, -'.md'.length)))
      .map((name) => docHeadings(readFileSync(`docs/${name}`, 'utf-8')).find((heading) => heading.level === 1)!.text);
    expect(titles.length).toBeGreaterThan(30);
    await expect(contents.getByRole('button')).toHaveCount(titles.length);
    expect((await contents.getByRole('button').allTextContents()).sort()).toEqual([...titles].sort());

    await openSection(page, /Formaquestion/, 'How to Search the Guide');
    await expect(reader(page)).toContainText('Type two or more letters in Search the Guide.');
    await expect(reader(page).getByRole('heading', { name: 'How to Search the Guide', level: 3 })).toBeVisible();
  });

  test('search shows ranked sections for a query and an empty state for no match', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    await showSearch(page);
    await searchField(page).fill('how do I make a blueprint');
    const rows = results(page).getByRole('button');
    await expect(rows.first()).toContainText('How to Make a Blueprint');
    await expect(rows.first()).toContainText('World Editor: Traits');
    expect(await rows.count()).toBeGreaterThan(3);

    await rows.first().click();
    await expect(reader(page).getByRole('heading', { name: 'How to Make a Blueprint', level: 3 })).toBeVisible();
    // The pressed row left the screen. Focus stays in the window, so one F1 closes it.
    await expect.poll(() => focusOwner(page)).toBe('window');
    await page.keyboard.press('F1');
    await expect(helpWindow(page)).toHaveCount(0);
    await page.keyboard.press('F1');
    await expect(reader(page).getByRole('heading', { name: 'How to Make a Blueprint', level: 3 })).toBeVisible();

    await helpWindow(page).getByRole('tab', { name: 'Search' }).click();
    await searchField(page).fill('zzqqxx');
    await expect(helpWindow(page).getByRole('status')).toHaveText('No sections match “zzqqxx”');
    await expect(results(page)).toHaveCount(0);
  });

  test('a link to a docs page opens in the reader, and a link to an outside site opens in the browser', async ({ page, context }) => {
    // The outside site is never loaded: the route answers for it.
    await context.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ contentType: 'text/html', body: '<title>outside</title>' }));
    await openApp(page);
    await openHelp(page);
    await openSection(page, /Formaquestion/, 'Search');

    await reader(page).getByRole('link', { name: 'World Format' }).click();
    await expect(reader(page)).toHaveAccessibleName(/World Format/);
    // The app's own address did not change: the dev router reads the hash.
    expect(new URL(page.url()).hash).not.toContain('docs=');
    await expect(helpWindow(page).getByText('[blocked]')).toHaveCount(0);

    await helpWindow(page).getByRole('button', { name: 'Contents' }).click();
    const contents = helpWindow(page).getByRole('navigation', { name: 'Guide Contents' });
    // The contents still show the page the player came from, open and marked.
    await expect(contents.getByRole('button', { name: 'Introduction', exact: true, pressed: true })).toBeVisible();
    await contents.getByRole('button', { name: /Formamorph Wiki/ }).click();
    // The home page is the first page, so its introduction is the first of those that now show.
    await contents.getByRole('button', { name: 'Introduction', exact: true }).first().click();
    const outside = reader(page).getByRole('link', { name: /play Formamorph in your browser/ });
    await expect(outside).toHaveAttribute('target', '_blank');
    const [popup] = await Promise.all([context.waitForEvent('page'), outside.click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe('https://jakejamesdev.github.io/formamorph/');
    // The reader stays where it was.
    await expect(reader(page).getByRole('link', { name: /play Formamorph in your browser/ })).toBeVisible();
  });

  test('with reduced motion the window shows and hides at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page);
    await countWindowAnimations(page);
    await page.keyboard.press('F1');
    await expect(askField(page)).toBeFocused();
    await helpWindow(page).getByRole('button', { name: 'Close Formaquestion' }).click();
    await expect(helpWindow(page)).toHaveCount(0);
    expect(await windowAnimations(page)).toBe(0);
  });

  test('without reduced motion the window animates open and closed', async ({ page }) => {
    await openApp(page);
    await countWindowAnimations(page);
    await page.keyboard.press('F1');
    await expect(askField(page)).toBeFocused();
    // Open: 200ms, from 75% and from clear.
    expect(await motionOf(page)).toMatchObject({ duration: '0.2s', enterScale: 0.75, enterOpacity: 0 });
    await settledBox(page);

    // Close: 150ms, to 75% and to clear. The last frame stays until the window leaves, and takes no press.
    const closing = await page.evaluate(async () => {
      document.querySelector<HTMLElement>('#formaquestion-window [aria-label="Close Formaquestion"]')!.click();
      await new Promise(requestAnimationFrame);
      const style = getComputedStyle(document.getElementById('formaquestion-window')!);
      return {
        duration: style.animationDuration,
        fill: style.animationFillMode,
        exitScale: parseFloat(style.getPropertyValue('--tw-exit-scale')),
        exitOpacity: parseFloat(style.getPropertyValue('--tw-exit-opacity')),
        pointerEvents: style.pointerEvents,
      };
    });
    expect(closing).toEqual({ duration: '0.15s', fill: 'forwards', exitScale: 0.75, exitOpacity: 0, pointerEvents: 'none' });
    await expect(helpWindow(page)).toHaveCount(0);
    expect(await windowAnimations(page)).toBe(2);
  });

  test('F1 and the Help tab stand down while the welcome animation plays', async ({ page }) => {
    test.setTimeout(60_000);
    await openApp(page);
    await expect(helpTab(page)).toBeVisible();
    await gotoDev(page, 'mainMenu', { modal: 'intro' });
    await expect(page.locator('#fm-intro-goo')).toBeAttached();
    await expect(helpTab(page)).toHaveCount(0);
    await page.keyboard.press('F1');
    await expect(helpWindow(page)).toHaveCount(0);

    // The animation ends by itself, and help comes back.
    await expect(page.locator('#fm-intro-goo')).toHaveCount(0, { timeout: 30_000 });
    await expect(helpTab(page)).toBeVisible();
    await page.keyboard.press('F1');
    await expect(askField(page)).toBeFocused();
  });

  test('a tutorial note does not block F1', async ({ page }) => {
    await openApp(page, { 'formamorph.tutorialsSeen': [] });
    await expect(page.getByRole('dialog', { name: /^(Sign In|Bugs & Suggestions)$/ }).first()).toBeVisible();
    await page.keyboard.press('F1');
    await expect(askField(page)).toBeFocused();
  });

  test('a trip to a mobile-size screen shows the sheet and brings the window back as it was', async ({ page }) => {
    await openApp(page);
    await openHelp(page);
    await dragWindowTo(page, 900);
    await helpWindow(page).getByRole('button', { name: 'Wide View' }).click();
    await searchField(page).fill('blueprint');
    const placed = await settledBox(page);

    await page.setViewportSize({ width: 600, height: 900 });
    await expect(helpWindow(page)).toHaveAttribute('data-fq-sheet', '');
    expect(await settledBox(page)).toEqual({ x: 0, y: 0, width: 600, height: 900 });
    await showSearch(page);
    await expect(searchField(page)).toHaveValue('blueprint');

    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(helpWindow(page)).not.toHaveAttribute('data-fq-sheet');
    expect(await settledBox(page)).toEqual(placed);
  });

  type HelpBody = { max_tokens: number; messages: { role: string; content: string }[] };

  /** `HELP_PICK_MAX_TOKENS` in helpPicks.ts. The node loader cannot import that module: it pulls in the wordlist JSON. */
  const PICK_MAX_TOKENS = 150;

  /**
   * A text endpoint that answers every answer request with `answer` and every AI Search request with a reply
   * that picks nothing, so the keyword search alone finds the sections. It records each request body by kind.
   */
  async function openWithAi(page: Page, answer: string): Promise<{ answers: HelpBody[]; picks: HelpBody[] }> {
    const bodies = { answers: [] as HelpBody[], picks: [] as HelpBody[] };
    await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
    await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
    await page.route('**/chat/completions', async (route) => {
      const body = route.request().postDataJSON() as HelpBody;
      const pick = body.max_tokens === PICK_MAX_TOKENS;
      (pick ? bodies.picks : bodies.answers).push(body);
      const text = pick ? 'No section of the list answers the question.' : answer;
      const half = Math.ceil(text.length / 2);
      const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`;
      await route.fulfill({ contentType: 'text/event-stream', body: `${frame(text.slice(0, half))}${frame(text.slice(half))}data: [DONE]\n\n` });
    });
    await openApp(page, { FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions' });
    return bodies;
  }

  const conversation = (page: Page) => helpWindow(page).getByRole('log', { name: 'Conversation' });

  test('a question asked above Settings gets one answer from the docs, and its source opens in the reader', async ({ page }) => {
    const bodies = await openWithAi(page, '1. Open the **Traits** tab.\n2. Select **New Blueprint**.');
    await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'endpoints' });
    await expect(settings(page)).toBeVisible();
    await settings(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    await openHelp(page);

    await askField(page).click();
    await page.keyboard.type('How do I make a blueprint?');
    await helpWindow(page).getByRole('button', { name: 'Send' }).click();

    await expect(conversation(page).getByRole('listitem')).toHaveCount(2);
    await expect(conversation(page)).toContainText('Select New Blueprint.');
    await expect(settings(page)).toBeVisible();
    // One AI Search request, then one answer request that carries the sections the search found.
    expect(bodies.picks).toHaveLength(1);
    expect(bodies.answers).toHaveLength(1);
    expect(bodies.answers[0].messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(bodies.answers[0].messages[1].content).toContain('## How to Make a Blueprint');

    const sources = conversation(page).getByRole('group', { name: 'Sources' });
    await sources.getByRole('button', { name: /How to Make a Blueprint/ }).click();
    await expect(reader(page).getByRole('heading', { name: 'How to Make a Blueprint', level: 3 })).toBeVisible();
    // The pressed source left the screen. Focus stays in the window.
    await expect.poll(() => focusOwner(page)).toBe('window');
  });

  test('Take Me There opens the Settings tab that the answer describes, and the window stays open', async ({ page }) => {
    await openWithAi(page, '1. Open the **Display** tab.\n2. Pick a font.');
    await openHelp(page);
    await askField(page).fill('How do I change the narration font?');
    await page.keyboard.press('Enter');
    const sources = conversation(page).getByRole('group', { name: 'Sources' });
    // The buttons are the fold, Take Me There, the open screen's lead, then the first section the search found.
    await expect(sources.getByRole('button').nth(2)).toContainText('The Library Tabs');
    await expect(sources.getByRole('button').nth(3)).toContainText('How to Change the Narration Font');
    await expect(settings(page)).toHaveCount(0);

    await sources.getByRole('button', { name: 'Take Me There' }).click();
    await expect(settings(page)).toBeVisible();
    // The Display tab holds the font list, so the control is on screen.
    await expect(settings(page).locator('#fontFamily')).toBeVisible();
    await expect(helpWindow(page)).toBeVisible();
    await expect(conversation(page)).toContainText('Pick a font.');
  });

  test('Take Me There from a game asks first, and Cancel leaves the game as it was', async ({ page }) => {
    await openWithAi(page, '1. Select **Start Game** on a world tile.');
    await gotoDev(page, 'gameViewer', { fixture: 'whiteRoom' });
    const action = page.getByPlaceholder(/Type your action/);
    // The fixture fills the box with its opening cue; the typed action replaces it once that has landed.
    await expect(action).toHaveValue(/^Begin the story/);
    await action.fill('I wait by the seam.');
    await openHelp(page);
    await askField(page).fill('How do I start a game?');
    await page.keyboard.press('Enter');
    const sources = conversation(page).getByRole('group', { name: 'Sources' });
    await expect(sources.getByRole('button', { name: /How to Start a Game/ })).toBeVisible();

    await sources.getByRole('button', { name: 'Take Me There' }).click();
    const leave = page.getByRole('alertdialog', { name: 'Exit to Main Menu' });
    await expect(leave).toBeVisible();
    await leave.getByRole('button', { name: 'Cancel' }).click();
    await expect(leave).toHaveCount(0);

    // The game is untouched: its screen, its typed action and the help window all stay.
    await expect(action).toHaveValue('I wait by the seam.');
    await expect(page.getByRole('button', { name: 'Send', exact: true }).first()).toBeVisible();
    await expect(helpWindow(page)).toBeVisible();
    // A second click asks again: the refusal left no request pending.
    await sources.getByRole('button', { name: 'Take Me There' }).click();
    await expect(leave).toBeVisible();
    await leave.getByRole('button', { name: 'Cancel' }).click();
    await expect(action).toHaveValue('I wait by the seam.');
  });

  test('a long answer keeps the conversation at its end, and the question field stays in view', async ({ page }) => {
    const steps = Array.from({ length: 40 }, (_, n) => `${n + 1}. Select the control for step ${n + 1} and wait for the list to change.`).join('\n');
    await openWithAi(page, steps);
    await openHelp(page);
    await askField(page).fill('How do I make a blueprint?');
    await page.keyboard.press('Enter');

    await expect(conversation(page).getByRole('listitem')).toHaveCount(40);
    const scroller = helpWindow(page).locator('[data-fq-scroll="conversation"]');
    await expect.poll(() => scroller.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThanOrEqual(2);
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight), 'the answer is longer than the window').toBe(true);
    const field = (await askField(page).boundingBox())!;
    const frame = await settledBox(page);
    expect(field.y + field.height).toBeLessThanOrEqual(frame.y + frame.height);
  });

  test('the scroll arrow shows above the question field once the player scrolls up, and a click returns to the end', async ({ page }) => {
    await stubLongAnswer(page);
    await openApp(page, { FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions' });
    await openHelp(page);
    await askField(page).fill('How do I make a blueprint?');
    await page.keyboard.press('Enter');
    await expect(conversation(page).getByRole('listitem')).toHaveCount(40);
    await expectScrollArrow(helpWindow(page), askField(page));
  });

  test('a follow-up carries the first exchange, the conversation survives a screen change, and a reload empties it', async ({ page }) => {
    const bodies = await openWithAi(page, '1. Open the **Traits** tab.\n2. Select **New Blueprint**.');
    await openHelp(page);
    await askField(page).fill('How do I make a blueprint?');
    await page.keyboard.press('Enter');
    await expect(conversation(page)).toContainText('Select New Blueprint.');
    await askField(page).fill('and then?');
    await page.keyboard.press('Enter');
    await expect(conversation(page).getByRole('group', { name: 'Sources' })).toHaveCount(2);

    const followUp = bodies.answers[1].messages;
    expect(followUp.map((message) => message.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(followUp[1].content).toBe('How do I make a blueprint?');
    expect(followUp[3].content).toContain('## How to Make a Blueprint');

    await gotoDev(page, 'gameViewer', { fixture: 'whiteRoom' });
    await expect(page.getByPlaceholder(/Type your action/)).toBeVisible();
    await expect(conversation(page)).toContainText('and then?');

    await page.reload();
    await openHelp(page);
    await expect(conversation(page)).toContainText('Ask how to do something in Formamorph');
    await expect(conversation(page)).not.toContainText('How do I make a blueprint?');
  });

  test('while a game turn generates, Send waits and Search works; after the turn, Send works', async ({ page }) => {
    let finishTurn = () => {};
    const turnDone = new Promise<void>((resolve) => { finishTurn = resolve; });
    let helpRequests = 0;
    await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
    await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
    await page.route('**/chat/completions', async (route) => {
      const isHelp = (route.request().postData() ?? '').includes('help writer for Formamorph');
      if (isHelp) helpRequests++;
      else await turnDone;
      const frame = `data: ${JSON.stringify({ choices: [{ delta: { content: isHelp ? 'Select **New Blueprint**.' : 'The console blinks.' }, finish_reason: null }] })}\n\n`;
      await route.fulfill({ contentType: 'text/event-stream', body: `${frame}data: [DONE]\n\n` });
    });
    await openApp(page, {
      FORMAMORPH_endpointUrl: 'http://127.0.0.1:5190/v1/chat/completions',
      FORMAMORPH_thinkingMode: 'off', FORMAMORPH_choicesEnabled: false,
      FORMAMORPH_locationChangeEnabled: false, FORMAMORPH_memoryDigests: false, FORMAMORPH_aiClock: false,
    }, { url: '/#dev?view=gameViewer&fixture=whiteRoom' });
    await page.getByPlaceholder(/Type your action/).fill('I knock on the seam.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();

    await openHelp(page);
    await askField(page).fill('How do I make a blueprint?');
    await page.keyboard.press('Enter');
    const send = helpWindow(page).getByRole('button', { name: 'Send' });
    await expect(send).toBeDisabled();
    await expect(helpWindow(page)).toContainText('Wait for the game turn to finish to send a question');
    await showSearch(page);
    await searchField(page).fill('blueprint');
    await expect(results(page).getByRole('button').first()).toContainText('Blueprint');
    expect(helpRequests).toBe(0);

    finishTurn();
    await expect(page.getByText('The console blinks.').last()).toBeVisible();
    await helpWindow(page).getByRole('tab', { name: 'Ask' }).click();
    await send.click();
    await expect(conversation(page)).toContainText('Select New Blueprint.');
    expect(helpRequests).toBe(1);
  });

  test('with no AI to reach, a question shows the guide sections that match it and sends no request', async ({ page }) => {
    // The app also sends its own capability checks to the endpoint, so the count is of requests that hold the question.
    const question = 'How do I make a blueprint?';
    let sent = 0;
    page.on('request', (request) => {
      if (request.url().includes('/chat/completions') && (request.postData() ?? '').includes(question)) sent++;
    });
    // The seeded endpoint is a closed port.
    await openApp(page);
    await openHelp(page);
    await askField(page).fill('How do I make a blueprint?');
    await page.keyboard.press('Enter');

    const rows = conversation(page).getByRole('list', { name: 'Search Results' }).getByRole('button');
    await expect(rows.first()).toContainText('How to Make a Blueprint');
    await expect(conversation(page)).toContainText('No AI is connected');
    expect(sent).toBe(0);
    await rows.first().click();
    await expect(reader(page).getByRole('heading', { name: 'How to Make a Blueprint', level: 3 })).toBeVisible();
  });
});

test.describe('Formaquestion on a mobile-size screen', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructuring first argument.
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'The sheet is the mobile form');
  });

  const SCREEN = { x: 0, y: 0, width: 375, height: 812 };
  const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  async function openSheet(page: Page): Promise<void> {
    await helpTab(page).click();
    await expect(helpWindow(page)).toHaveAttribute('data-fq-sheet', '');
    await settledBox(page);
  }

  test('the Help tab opens a full-screen sheet and takes focus without a keyboard', async ({ page }) => {
    await openApp(page);
    await openSheet(page);

    expect(await settledBox(page)).toEqual(SCREEN);
    expect(await focusOwner(page)).toBe('window');
    await expect(askField(page)).toBeVisible();
    await expect(askField(page)).not.toBeFocused();
    await expect(helpWindow(page).getByRole('button', { name: 'Wide View' })).toHaveCount(0);
    await expect(helpTab(page)).toHaveCount(0);

    await helpWindow(page).getByRole('button', { name: 'Close Formaquestion' }).click();
    await expect(helpWindow(page)).toHaveCount(0);
    await expect(helpTab(page)).toBeFocused();
  });

  test('the Help tab does not cover the action box', async ({ page }) => {
    // A reachable endpoint, so the AI setup prompt stays closed over the game view.
    await page.route('**/api/v0/models', (route) => route.fulfill({ status: 404 }));
    await page.route('**/v1/models', (route) => route.fulfill({ json: { data: [{ id: 'e2e-model' }] } }));
    await openApp(page);
    await gotoDev(page, 'gameViewer', { fixture: 'whiteRoom' });
    const send = page.getByRole('button', { name: 'Send', exact: true });
    await expect(send).toBeVisible();
    const tab = (await helpTab(page).boundingBox())!;
    for (const control of [send, page.getByPlaceholder(/^Type your action/)]) {
      expect(overlaps(tab, (await control.boundingBox())!)).toBe(false);
    }
  });

  test('the sheet opens above Settings, and Settings is as it was after the close', async ({ page }) => {
    await openApp(page);
    await gotoDev(page, 'mainMenu', { modal: 'settings', tab: 'endpoints' });
    await expect(settings(page)).toBeVisible();
    await settings(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const model = settings(page).locator('#modelName');
    await model.fill('typed-before-help');

    await openSheet(page);
    const sheetZ = await helpWindow(page).evaluate((el) => document.elementFromPoint(187, 400)?.closest('#formaquestion-window') === el);
    expect(sheetZ, 'the sheet is on top at the center of the screen').toBe(true);
    await showSearch(page);
    await searchField(page).fill('endpoint');
    await expect(results(page)).toBeVisible();

    await helpWindow(page).getByRole('button', { name: 'Close Formaquestion' }).click();
    await expect(helpWindow(page)).toHaveCount(0);
    await expect(settings(page)).toBeVisible();
    await expect(model).toHaveValue('typed-before-help');
  });

  /** Whether the sheet waits under a dialog, drawn but inert. */
  const sheetIsInert = (page: Page) => helpWindow(page).evaluate((el) => el.closest('[inert]') !== null);

  test('Settings in the menu slides over the sheet, which waits inert under it, and the sheet comes back as it was', async ({ page }) => {
    await openApp(page);
    await openSheet(page);
    await showSearch(page);
    await searchField(page).fill('endpoint');

    await pickMenuItem(page, 'Settings');
    const help = page.getByRole('dialog', { name: 'Formaquestion Settings' });
    await expect(help).toBeVisible();
    await help.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect(await sheetIsInert(page)).toBe(true);
    const dialogOnTop = await help.evaluate((el) => el.contains(document.elementFromPoint(187, 400)));
    expect(dialogOnTop, 'the settings are on top at the center of the screen').toBe(true);
    const keyword = help.getByRole('checkbox', { name: 'Keyword Search' });
    await keyword.click();
    await expect(keyword).toHaveAttribute('aria-checked', 'false');

    await help.getByRole('button', { name: 'Close' }).click();
    await expect(help).toBeHidden();
    await expect(helpWindow(page)).toBeVisible();
    expect(await sheetIsInert(page)).toBe(false);
    await expect(searchField(page)).toHaveValue('endpoint');
  });

  test('AI Context in the menu slides over the sheet, which waits inert under it, and the sheet comes back as it was', async ({ page }) => {
    await openApp(page);
    await openSheet(page);
    await showSearch(page);
    await searchField(page).fill('endpoint');

    await pickMenuItem(page, 'AI Context');
    const context = page.getByRole('dialog', { name: 'AI Context' });
    await expect(context).toBeVisible();
    await context.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    expect(await sheetIsInert(page)).toBe(true);
    const dialogOnTop = await context.evaluate((el) => el.contains(document.elementFromPoint(187, 400)));
    expect(dialogOnTop, 'AI Context is on top at the center of the screen').toBe(true);

    await context.getByRole('button', { name: 'Close' }).click();
    await expect(context).toBeHidden();
    await expect(helpWindow(page)).toBeVisible();
    expect(await sheetIsInert(page)).toBe(false);
    await expect(searchField(page)).toHaveValue('endpoint');
  });

  test('with the keyboard open, the sheet and its field stay in the visible area', async ({ page }) => {
    await openApp(page);
    await openSheet(page);
    // An on-screen keyboard shrinks the visual viewport, and the app reports it in --app-h.
    await page.evaluate(() => document.documentElement.style.setProperty('--app-h', '450px'));
    await showSearch(page);
    await searchField(page).fill('blueprint');

    const sheet = (await helpWindow(page).boundingBox())!;
    expect(sheet.y + sheet.height).toBe(450);
    await expect(searchField(page)).toBeFocused();
    const field = (await searchField(page).boundingBox())!;
    expect(field.y + field.height).toBeLessThanOrEqual(450);

    // The last result scrolls into the space above the keyboard.
    await helpWindow(page).locator('[data-fq-scroll="results"]').evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const last = (await results(page).getByRole('listitem').last().boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(450);
  });

  test('a touch drag moves the Help tab to another edge and does not scroll the page', async ({ page }) => {
    await openApp(page);
    const tab = helpTab(page);
    expect(await tab.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
    const start = (await tab.boundingBox())!;
    const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
    const scrollBefore = await page.evaluate(() => [window.scrollX, window.scrollY]);

    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
    await touch('touchStart', from.x, from.y);
    for (let i = 1; i <= 8; i++) await touch('touchMove', from.x - i * 20, from.y + i * 40);
    await touch('touchEnd', 0, 0);

    await expect(tab).toHaveAttribute('data-fq-edge', 'bottom');
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual(scrollBefore);
    await expect(helpWindow(page)).toHaveCount(0);
  });

  test('the sheet slides in from the edge that holds the Help tab', async ({ page }) => {
    await openApp(page, { 'formamorph.formaquestion.tab': { edge: 'top', at: 0.5 } });
    await helpTab(page).click();
    const enter = await helpWindow(page).evaluate((el) => getComputedStyle(el).getPropertyValue('--tw-enter-translate-y').trim());
    expect(enter).toBe('-100%');
  });

  test('the title bar does not move the sheet', async ({ page }) => {
    await openApp(page);
    await openSheet(page);
    await page.mouse.move(120, 24);
    await page.mouse.down();
    await page.mouse.move(220, 300, { steps: 5 });
    await page.mouse.up();
    expect(await settledBox(page)).toEqual(SCREEN);
    expect(await page.evaluate(() => localStorage.getItem('formamorph.formaquestion.window'))).toBeNull();
  });
});
