import { expect, test } from '@playwright/test';
import { openApp, gotoDev } from './app';

/**
 * A staff session, seeded rather than signed in. These specs measure the tab strip's layout, and the
 * panel reads only the account's role to decide which tabs exist. A real login would need the server,
 * which no width measurement depends on.
 */
function staffSeed(accountType: 'admin' | 'moderator') {
  return {
    token: 'e2e-admin-widths',
    currentUser: {
      id: `e2e-${accountType}`, username: `e2e${accountType}`, email: `${accountType}@example.com`,
      accountType, emailVerified: true,
    },
  };
}

/**
 * Every panel in the dialog fetches on open. Answered empty so a width run needs no server. The counts
 * are high anyway: they belong on the Moderation tab's segments, and a count that leaked onto the strip
 * would widen its widest label.
 */
async function stubStaffApi(page: import('@playwright/test').Page) {
  // The catch-all goes first: Playwright tries the most recently added route first.
  await page.route(/\/api\//, (route) => route.fulfill({ json: { data: [], count: 0, total: 0 } }));
  await page.route(/\/reports\/open-count/, (route) => route.fulfill({ json: { open: 12 } }));
  await page.route(/\/reviews\/meta/, (route) => route.fulfill({ json: { data: { enabled: true } } }));
  await page.route(/\/reviews\/count/, (route) => route.fulfill({ json: { data: { count: 12 } } }));
}

/** Every selectable app font, applied the way the app applies one: the font stack and its x-height. */
async function eachFont(page: import('@playwright/test').Page, check: (font: string) => Promise<void>) {
  const fonts = await page.evaluate(async () => {
    const path = '/src/contexts/settingsDefaults.ts';
    const settings = await import(/* @vite-ignore */ path);
    return (settings.FONT_LIST as { value: string; stack: string }[]).map((font) => ({
      value: font.value,
      family: `${font.stack}, ${settings.SYSTEM_FONT_STACK as string}`,
      adjust: String(settings.fontSizeAdjust(font.value)),
    }));
  });

  await check('system');
  for (const font of fonts) {
    await page.evaluate(async ({ family, adjust }) => {
      const root = document.documentElement;
      root.style.setProperty('--app-font', family);
      root.style.setProperty('font-size-adjust', adjust);
      await document.fonts.load(`500 14px ${family}`, 'Moderation Broadcasts');
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }, font);
    await check(font.value);
  }
}

/**
 * The tab's drawn face: its icon and its label's clipping box, which is zero wide while the strip folds
 * the label away. The trigger's overflow is visible, so an over-wide face draws over its neighbor.
 */
async function labelFit(page: import('@playwright/test').Page, name: string) {
  return page.getByRole('tab', { name, exact: true }).evaluate((element) => {
    const trigger = element.getBoundingClientRect();
    const icon = element.querySelector('svg')!.getBoundingClientRect();
    const label = element.querySelector(':scope > span')!.getBoundingClientRect();
    return {
      triggerLeft: trigger.left, triggerRight: trigger.right,
      labelLeft: Math.min(icon.left, label.left), labelRight: Math.max(icon.right, label.right),
      labelDrawn: label.width > 1,
    };
  });
}

async function openPanel(page: import('@playwright/test').Page, accountType: 'admin' | 'moderator', width: number) {
  await page.setViewportSize({ width, height: 900 });
  await stubStaffApi(page);
  await openApp(page, staffSeed(accountType));
  await gotoDev(page, 'mainMenu', { modal: 'adminPanel', tab: 'users' });
  await expect(page.getByRole('dialog', { name: 'Admin Panel' })).toBeVisible();
}

const sectionsBar = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /^Sections/ });
const strip = (page: import('@playwright/test').Page) => page.getByRole('tablist', { name: 'Admin Panel Sections' });

/** The section control is the strip or the Sections bar at every width, never both and never neither. */
async function chooser(page: import('@playwright/test').Page) {
  const bar = await sectionsBar(page).isVisible();
  return { strip: !bar && await strip(page).isVisible(), bar };
}

const ADMIN_TABS = ['Users', 'Broadcasts', 'Policies', 'Server', 'Usage', 'Events', 'Feedback', 'Moderation', 'Log'];
const MODERATOR_TABS = ['Users', 'Events', 'Feedback', 'Moderation', 'Log'];

/** Every trigger inside the strip, and the strip inside the dialog: a strip too narrow folds labels away rather than overflowing. */
async function expectStripFits(page: import('@playwright/test').Page, context: string) {
  const fit = await strip(page).evaluate((list) => {
    const dialog = list.closest('[role="dialog"]')!.getBoundingClientRect();
    const box = list.getBoundingClientRect();
    const tabs = [...list.querySelectorAll('[role="tab"]')].map((tab) => {
      const rect = tab.getBoundingClientRect();
      return { name: tab.getAttribute('aria-label'), left: rect.left, right: rect.right };
    });
    return { dialog: { left: dialog.left, right: dialog.right }, box: { left: box.left, right: box.right }, tabs };
  });
  expect(fit.box.left, `strip ${context}`).toBeGreaterThanOrEqual(fit.dialog.left - 1);
  expect(fit.box.right, `strip ${context}`).toBeLessThanOrEqual(fit.dialog.right + 1);
  for (const tab of fit.tabs) {
    expect(tab.left, `${tab.name} ${context}`).toBeGreaterThanOrEqual(fit.box.left - 1);
    expect(tab.right, `${tab.name} ${context}`).toBeLessThanOrEqual(fit.box.right + 1);
  }
}

/** Below `md` both roles get the Sections bar; from `md` the strip, folding labels to fit. */
for (const width of [375, 767, 768, 999, 1000, 1280]) {
  test(`an administrator gets one usable section control at ${width}px`, async ({ page }) => {
    await openPanel(page, 'admin', width);

    const shown = await chooser(page);
    if (shown.strip) await expectStripFits(page, `at ${width}px`);

    expect(shown.strip).toBe(width >= 768);
    expect(shown.bar).toBe(width < 768);

    const scroll = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(scroll.content).toBeLessThanOrEqual(scroll.viewport);
  });

  test(`a moderator gets one usable section control at ${width}px`, async ({ page }) => {
    await openPanel(page, 'moderator', width);

    const shown = await chooser(page);
    if (shown.strip) await expectStripFits(page, `at ${width}px`);
    // A moderator's tabs carry no administrator tab, in the strip or the folded Sections list.
    for (const name of ['Broadcasts', 'Policies', 'Server']) {
      await expect(page.getByRole('tab', { name, exact: true, includeHidden: true })).toHaveCount(0);
    }
    for (const name of MODERATOR_TABS) {
      await expect(page.getByRole('tab', { name, exact: true, includeHidden: true })).toHaveCount(1);
    }

    expect(shown.strip).toBe(width >= 768);
    expect(shown.bar).toBe(width < 768);
  });
}

/** At the narrowest strip, every font a player can pick folds labels away rather than overflowing. */
for (const [accountType, names] of [['admin', ADMIN_TABS], ['moderator', MODERATOR_TABS]] as const) {
  test(`a${accountType === 'admin' ? 'n administrator' : ' moderator'}’s strip fits in every font at 768px`, async ({ page }) => {
    await openPanel(page, accountType, 768);
    await eachFont(page, async (font) => {
      await expectStripFits(page, `in ${font} at 768px`);
      expect(await strip(page).getByRole('tab').count()).toBe(names.length);
    });
  });
}

/** At the dialog's 1000px cap, each drawn face sits inside its own trigger in every font, and the selected tab keeps its label. */
test('an administrator’s labels fit in every font at 1280px', async ({ page }) => {
  await openPanel(page, 'admin', 1280);
  await eachFont(page, async (font) => {
    for (const name of ADMIN_TABS) {
      const fit = await labelFit(page, name);
      expect(fit.labelLeft, `${name} in ${font}`).toBeGreaterThanOrEqual(fit.triggerLeft - 1);
      expect(fit.labelRight, `${name} in ${font}`).toBeLessThanOrEqual(fit.triggerRight + 1);
      if (name === 'Users') expect(fit.labelDrawn, `${name} in ${font}`).toBe(true);
    }
  });
});

/**
 * Every label of the Moderation tab's own strip inside its trigger. The strip holds three equal cells
 * ("Reports (9+)", "Review (9+)", "Auto-Approved") and fills the panel, so the narrowest panel is the test.
 */
async function expectModerationSegmentsFit(page: import('@playwright/test').Page, context: string) {
  const strip = page.getByRole('tab', { name: 'Auto-Approved', exact: true }).locator('xpath=ancestor::*[@role="tablist"]');
  await expect(strip.getByRole('tab')).toHaveCount(3);

  const fits = await strip.evaluate((list) => [...list.querySelectorAll('[role="tab"]')].map((element) => {
    const trigger = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const label = range.getBoundingClientRect();
    return { name: element.textContent, triggerLeft: trigger.left, triggerRight: trigger.right, labelLeft: label.left, labelRight: label.right };
  }));

  for (const fit of fits) {
    expect(fit.labelLeft, `${fit.name} ${context}`).toBeGreaterThanOrEqual(fit.triggerLeft - 1);
    expect(fit.labelRight, `${fit.name} ${context}`).toBeLessThanOrEqual(fit.triggerRight + 1);
  }
}

/** The widest labelled segments at each role's narrowest panel: the dialog on a 375px phone, and the 1000px cap. */
for (const [accountType, width] of [['admin', 375], ['admin', 1000], ['moderator', 768]] as const) {
  test(`a${accountType === 'admin' ? 'n administrator' : ' moderator'}’s three Moderation segments fit in every font at ${width}px`, async ({ page }) => {
    await openPanel(page, accountType, width);
    await gotoDev(page, 'mainMenu', { modal: 'adminPanel', tab: 'moderation' });
    await expect(page.getByRole('tab', { name: 'Auto-Approved', exact: true })).toBeVisible();

    await eachFont(page, (font) => expectModerationSegmentsFit(page, `in ${font} at ${width}px`));
  });
}

/** The Sections bar changes the panel, so a narrow viewport is not a read-only view of the tabs. */
test('the Sections bar changes the panel at 375px', async ({ page }) => {
  await openPanel(page, 'admin', 375);

  await sectionsBar(page).click();
  await page.getByRole('tab', { name: 'Log', exact: true }).click();

  await expect(sectionsBar(page)).toContainText('Log');
  await expect(sectionsBar(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('tabpanel')).toBeVisible();
});
