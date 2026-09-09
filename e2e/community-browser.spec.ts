import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { openApp, gotoDev } from './app';

/**
 * The in-app path to Community Creations, end to end: the main menu opens the host, the host raises the
 * browser, and the catalog is browsable in it.
 *
 * This is a parity spec. The browser used to be assembled out of fifteen props the main menu held; it is
 * now assembled by a host that reads the same things from the services. Nothing a player does changed,
 * and that is exactly the claim a real browser is needed to keep honest — the jsdom suite proves the
 * host finds its data, but only a real run proves the menu still reaches it and the shell still opens.
 *
 * The catalog is served from here rather than from a live server: what is under test is the app's own
 * path to it, and a spec that skips without a server would never guard this.
 */

/** One listing per kind, so the tab switch has something to show on the other side. */
const CATALOG = [
  {
    _id: 'e2e-world-1', id: 'e2e-world-1', kind: 'world',
    name: 'E2E Sedge Landing', description: 'A canned world for the browse path.',
    author: { id: 'e2e-author', username: 'e2eauthor' },
    tags: ['forest'], likes: 0, updated_at: '2026-02-01T00:00:00.000Z',
  },
  {
    _id: 'e2e-entity-1', id: 'e2e-entity-1', kind: 'entity',
    name: 'E2E Sedge Warden', description: 'A canned character.',
    author: { id: 'e2e-author', username: 'e2eauthor' },
    tags: [], likes: 0, updated_at: '2026-02-01T00:00:00.000Z',
  },
];

/** Answer the catalog and the contest feed locally, so the run needs no server and no network. */
async function stubCatalog(page: Page): Promise<void> {
  await page.route('**/worlds?*', (route) => route.fulfill({
    json: { success: true, data: CATALOG, total: CATALOG.length },
  }));
  await page.route('**/events', (route) => route.fulfill({ json: { data: [] } }));
  await page.route('**/events?*', (route) => route.fulfill({ json: { data: [] } }));
  // Comments and likes behind the details modal; empty is enough for the modal to open on its listing.
  await page.route('**/worlds/*/comments*', (route) => route.fulfill({ json: { success: true, data: [] } }));
}

/**
 * Selects a section the way a reader does on this viewport: a rail row on desktop (landscape), the
 * header dropdown on mobile (portrait). `current` is the section the closed dropdown trigger is showing,
 * needed to find it before the click changes what it says.
 */
async function selectSection(page: Page, testInfo: TestInfo, current: string, target: string): Promise<void> {
  if (testInfo.project.name === 'mobile') {
    // The trigger's accessible name is empty — role="combobox" takes its name only from an explicit
    // label, never its content — so `hasText` is what the rest of this codebase's Select triggers use.
    await page.getByRole('combobox').filter({ hasText: current }).click();
    await page.getByRole('option', { name: target }).click();
  } else {
    await page.getByRole('button', { name: target }).click();
  }
}

test.describe('Community Creations from the main menu', () => {
  test.beforeEach(async ({ page }) => {
    await stubCatalog(page);
    await openApp(page);
  });

  test('opens on the catalog, switches kinds, and opens a listing', async ({ page }, testInfo) => {
    await gotoDev(page, 'mainMenu', { modal: 'community' });

    // The shell the app has always raised, with the catalog inside it.
    const browser = page.getByRole('dialog').filter({ hasText: 'Community Creations' });
    await expect(browser).toBeVisible();
    await expect(page.getByText('E2E Sedge Landing')).toBeVisible();

    // Kinds are rows in the section switcher over one catalog, so switching is a filter rather than a fetch.
    await selectSection(page, testInfo, 'Worlds', 'Entities');
    await expect(page.getByText('E2E Sedge Warden')).toBeVisible();
    await expect(page.getByText('E2E Sedge Landing')).toBeHidden();

    await selectSection(page, testInfo, 'Entities', 'Worlds');
    await page.getByText('E2E Sedge Landing').click();

    // The details modal is its own dialog above the browser's.
    const details = page.getByRole('dialog').filter({ hasText: 'A canned world for the browse path.' });
    await expect(details).toBeVisible();
  });

  test('shows the closed dropdown trigger with its icon beside the label, not stacked above it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the switcher is a rail on desktop; the stacking trap is dropdown-only');
    await gotoDev(page, 'mainMenu', { modal: 'community' });

    const trigger = page.getByRole('combobox').filter({ hasText: 'Worlds' });
    // The trigger carries two icons — the section glyph and the dropdown's own chevron — so the first.
    const icon = trigger.locator('svg').first();
    const label = trigger.getByText('Worlds');
    const [iconBox, labelBox] = await Promise.all([icon.boundingBox(), label.boundingBox()]);
    expect(iconBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    // Stacked (the line-clamp trap) puts the label well below the icon; on the same row their tops match.
    expect(Math.abs(iconBox!.y - labelBox!.y)).toBeLessThan(4);
  });

  test('keeps the first two tour steps on screen, each with an arrow at its control', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'the rail and the inline filter bar are landscape-only anchors');
    // The tour, un-dismissed for this spec only: the rows explanation anchors to a rail as tall as the
    // results, and the filters explanation to a control inside a bar as wide as the row — both shapes a
    // popover can be pushed off or lose its arrow against.
    await openApp(page, { 'formamorph.tutorialsSeen': [] });
    await stubCatalog(page);
    await gotoDev(page, 'mainMenu', { modal: 'community' });

    const viewport = page.viewportSize()!;
    const onScreen = async (dialog: ReturnType<Page['getByRole']>) => {
      const box = (await dialog.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      expect(box.x).toBeGreaterThanOrEqual(0);
      // The arrow is the popover's only svg; Radix hides it when it cannot center on the anchor.
      await expect(dialog.locator('svg').first()).toBeVisible();
    };

    const rows = page.getByRole('dialog', { name: 'Worlds, Entities & Dictionaries' });
    await expect(rows).toBeVisible();
    await onScreen(rows);

    await rows.getByRole('button', { name: 'Next' }).click();
    const filters = page.getByRole('dialog', { name: 'Narrow the Catalog' });
    await expect(filters).toBeVisible();
    await onScreen(filters);
  });

  test('lands on the tab the route asks for', async ({ page }) => {
    await gotoDev(page, 'mainMenu', { modal: 'community', tab: 'entity' });

    await expect(page.getByText('E2E Sedge Warden')).toBeVisible();
    await expect(page.getByText('E2E Sedge Landing')).toBeHidden();
  });

  test('renders the same browser as a full page, with no dialog around it', async ({ page }) => {
    await gotoDev(page, 'mainMenu', { modal: 'community', mode: 'page' });

    // Same browser, same catalog — but nothing raised over the app, which is what a site page needs.
    await expect(page.getByRole('heading', { name: 'Community Creations' })).toBeVisible();
    await expect(page.getByText('E2E Sedge Landing')).toBeVisible();
    await expect(page.getByRole('dialog').filter({ hasText: 'Community Creations' })).toHaveCount(0);

    // Full-bleed: the browser's own header sits at the top of the viewport, not inset by an overlay.
    const box = await page.getByRole('heading', { name: 'Community Creations' }).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(120);
  });
});
