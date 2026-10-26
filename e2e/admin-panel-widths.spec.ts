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
 * The label's own text box, which spills outside the trigger long before `scrollWidth` reports it: the
 * trigger's overflow is visible, so an over-wide label simply draws over its neighbor.
 */
async function labelFit(page: import('@playwright/test').Page, name: string) {
  return page.getByRole('tab', { name, exact: true }).evaluate((element) => {
    const trigger = element.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(element);
    const label = range.getBoundingClientRect();
    return { triggerLeft: trigger.left, triggerRight: trigger.right, labelLeft: label.left, labelRight: label.right };
  });
}

async function openPanel(page: import('@playwright/test').Page, accountType: 'admin' | 'moderator', width: number) {
  await page.setViewportSize({ width, height: 900 });
  await stubStaffApi(page);
  await openApp(page, staffSeed(accountType));
  await gotoDev(page, 'mainMenu', { modal: 'adminPanel', tab: 'users' });
  await expect(page.getByRole('dialog', { name: 'Admin Panel' })).toBeVisible();
}

/** The section control is one or the other at every width, never both and never neither. */
async function chooser(page: import('@playwright/test').Page) {
  const strip = page.getByRole('tablist');
  const select = page.getByRole('combobox', { name: 'Admin Panel section' });
  return {
    strip: await strip.isVisible(),
    select: await select.isVisible(),
  };
}

const ADMIN_TABS = ['Users', 'Broadcasts', 'Policies', 'Server', 'Events', 'Feedback', 'Moderation', 'Log'];
const MODERATOR_TABS = ['Users', 'Events', 'Feedback', 'Moderation', 'Log'];

/** Each strip label inside its own trigger. */
async function expectLabelsFit(page: import('@playwright/test').Page, names: string[], context: string) {
  for (const name of names) {
    const fit = await labelFit(page, name);
    expect(fit.labelLeft, `${name} ${context}`).toBeGreaterThanOrEqual(fit.triggerLeft - 1);
    expect(fit.labelRight, `${name} ${context}`).toBeLessThanOrEqual(fit.triggerRight + 1);
  }
}

/**
 * The widest label the strip ever draws is "Moderation", 96px in OpenDyslexic. Eight equal cells hold it
 * once the dialog reaches its 1000px cap; five hold it from `md`. So the two roles cannot share one
 * switch width.
 *
 * | viewport | strip | 8 cells | 5 cells |
 * | -------- | ----- | ------- | ------- |
 * | 768      | 718   | 89      | 143     |
 * | 1000+    | 950   | 118     | 190     |
 *
 * 999 and 1000 are the corners of the administrator's switch; 767 and 768 are the moderator's.
 */
for (const width of [375, 767, 768, 999, 1000, 1280]) {
  test(`an administrator gets one usable section control at ${width}px`, async ({ page }) => {
    await openPanel(page, 'admin', width);

    const shown = await chooser(page);

    // Clipping first, so a wrong breakpoint fails on the symptom rather than on the number.
    if (shown.strip) await expectLabelsFit(page, ADMIN_TABS, `at ${width}px`);

    expect(shown.strip).toBe(width >= 1000);
    expect(shown.select).toBe(width < 1000);

    const scroll = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(scroll.content).toBeLessThanOrEqual(scroll.viewport);
  });

  test(`a moderator gets one usable section control at ${width}px`, async ({ page }) => {
    await openPanel(page, 'moderator', width);

    const shown = await chooser(page);

    if (shown.strip) {
      await expectLabelsFit(page, MODERATOR_TABS, `at ${width}px`);
      // A moderator's strip carries no administrator tab.
      for (const name of ['Broadcasts', 'Policies', 'Server']) {
        await expect(page.getByRole('tab', { name, exact: true })).toHaveCount(0);
      }
    }

    expect(shown.strip).toBe(width >= 768);
    expect(shown.select).toBe(width < 768);
  });
}

/** At each role's narrowest strip, every label fits in every font a player can pick. */
test('an administrator’s labels fit in every font at 1000px', async ({ page }) => {
  await openPanel(page, 'admin', 1000);

  await eachFont(page, (font) => expectLabelsFit(page, ADMIN_TABS, `in ${font} at 1000px`));
});

test('a moderator’s labels fit in every font at 768px', async ({ page }) => {
  await openPanel(page, 'moderator', 768);

  await eachFont(page, (font) => expectLabelsFit(page, MODERATOR_TABS, `in ${font} at 768px`));
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

/** The select changes the panel, so a narrow viewport is not a read-only view of the tabs. */
test('the select changes the panel at 375px', async ({ page }) => {
  await openPanel(page, 'admin', 375);

  await page.getByRole('combobox', { name: 'Admin Panel section' }).click();
  await page.getByRole('option', { name: 'Log' }).click();

  await expect(page.getByRole('combobox', { name: 'Admin Panel section' })).toContainText('Log');
  await expect(page.getByRole('tabpanel')).toBeVisible();
});
