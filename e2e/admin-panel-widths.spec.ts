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
 * Every panel in the dialog fetches on open. Answered empty so a width run needs no server, except the
 * open-report count: at ten or more the Reports tab reads "Reports (9+)", which is the widest label the
 * strip ever draws. Measuring the strip without it would measure the easy case.
 */
async function stubStaffApi(page: import('@playwright/test').Page) {
  // The catch-all goes first: Playwright tries the most recently added route first.
  await page.route(/\/api\//, (route) => route.fulfill({ json: { data: [], count: 0, total: 0 } }));
  await page.route(/\/reports\/open-count/, (route) => route.fulfill({ json: { open: 12 } }));
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

const ADMIN_TABS = ['Users', 'Broadcasts', 'Policies', 'Server', 'Events', 'Feedback', 'Reports (9+)', 'Log'];
const MODERATOR_TABS = ['Users', 'Events', 'Feedback', 'Reports (9+)', 'Log'];

/**
 * The widest label the strip ever draws is "Reports (9+)", 98px in the widest selectable font. Eight
 * equal cells hold that only once the dialog reaches its 900px cap; five hold it from `sm`. So the two
 * roles cannot share one switch width.
 *
 * | viewport | strip | 8 cells | 5 cells |
 * | -------- | ----- | ------- | ------- |
 * | 640      | 590   | 73      | 118     |
 * | 768      | 718   | 89      | 143     |
 * | 900+     | 850   | 105     | 170     |
 *
 * 899 and 900 are the corners of the administrator's switch; 639 and 640 are the moderator's.
 */
for (const width of [375, 639, 640, 768, 899, 900, 1280]) {
  test(`an administrator gets one usable section control at ${width}px`, async ({ page }) => {
    await openPanel(page, 'admin', width);

    const shown = await chooser(page);

    // Clipping first, so a wrong breakpoint fails on the symptom rather than on the number.
    if (shown.strip) {
      for (const name of ADMIN_TABS) {
        const fit = await labelFit(page, name);
        expect(fit.labelLeft, `${name} at ${width}px`).toBeGreaterThanOrEqual(fit.triggerLeft - 1);
        expect(fit.labelRight, `${name} at ${width}px`).toBeLessThanOrEqual(fit.triggerRight + 1);
      }
    }

    expect(shown.strip).toBe(width >= 900);
    expect(shown.select).toBe(width < 900);

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
      for (const name of MODERATOR_TABS) {
        const fit = await labelFit(page, name);
        expect(fit.labelLeft, `${name} at ${width}px`).toBeGreaterThanOrEqual(fit.triggerLeft - 1);
        expect(fit.labelRight, `${name} at ${width}px`).toBeLessThanOrEqual(fit.triggerRight + 1);
      }
      // A moderator's strip carries no administrator tab.
      for (const name of ['Broadcasts', 'Policies', 'Server']) {
        await expect(page.getByRole('tab', { name, exact: true })).toHaveCount(0);
      }
    }

    expect(shown.strip).toBe(width >= 640);
    expect(shown.select).toBe(width < 640);
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
