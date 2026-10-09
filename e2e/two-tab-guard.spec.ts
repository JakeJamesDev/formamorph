import { expect, test, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

/**
 * Two tabs on one profile share world storage, so a save in one lands under the other. jsdom has one
 * window and no real cross-tab channel; here each page is a real tab of the same browser profile.
 */

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

const world = (id: string, name: string) => ({
  id,
  worldOverview: { name, description: '', author: '' },
  stats: [], locations: [], entities: [], traits: [], statUpdates: [],
});
const FACE = 'button[data-tour-anchor="save"]';
const TITLE = 'World Saved in Another Tab';

const putWorld = (page: Page, w: ReturnType<typeof world>) => page.evaluate(
  (wd) => (window as unknown as { __fmDev: DevRouter }).__fmDev.putWorld(wd), w,
);
const editWorld = async (page: Page, id: string) => {
  await page.evaluate((i) => (window as unknown as { __fmDev: DevRouter }).__fmDev.editWorld(i), id);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'overview' });
  await expect(page.locator(FACE)).toBeDisabled();
};
const nameField = (page: Page) => page.getByLabel('World Name');
// Ctrl+S, because the success toast of an earlier save can still cover the Save button.
const saveByHand = async (page: Page) => {
  await page.keyboard.press('Control+s');
  await expect(page.locator(FACE)).toHaveAccessibleName('Saved');
};
const asked = (page: Page) => page.getByRole('alertdialog', { name: TITLE });

/** Opens a second tab of the same profile, both on the Main Menu. */
async function twoTabs(page: Page) {
  const other = await page.context().newPage();
  await openApp(page);
  await openApp(other);
  return other;
}

test.describe('Two-tab guard', () => {
  test('a save in one tab asks the other; Reload and Keep Mine each settle it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one width covers a storage signal');
    const tabB = await twoTabs(page);
    const id = await putWorld(page, world('e2e-two-tabs', 'Fenwatch'));
    await editWorld(page, id);
    await editWorld(tabB, id);

    // Reload: B's unsaved edit gives way to A's save.
    await nameField(tabB).fill('Fenwatch B');
    await nameField(page).fill('Fenwatch A');
    await saveByHand(page);
    await expect(asked(tabB)).toBeVisible();
    await expect(asked(page)).toHaveCount(0);
    await asked(tabB).getByRole('button', { name: 'Reload' }).click();
    await expect(asked(tabB)).toHaveCount(0);
    await expect(nameField(tabB)).toHaveValue('Fenwatch A');
    await expect(tabB.locator(FACE)).toBeDisabled();

    // Keep Mine: B's next save wins, and now A is the tab asked.
    await nameField(tabB).fill('Fenwatch B2');
    await nameField(page).fill('Fenwatch A2');
    await saveByHand(page);
    await asked(tabB).getByRole('button', { name: 'Keep Mine' }).click();
    await expect(asked(tabB)).toHaveCount(0);
    await saveByHand(tabB);
    await expect(asked(page)).toBeVisible();
    await asked(page).getByRole('button', { name: 'Reload' }).click();
    await expect(nameField(page)).toHaveValue('Fenwatch B2');
  });

  test('a delete in one tab asks the other, and Keep Mine saves the world back', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one width covers a storage signal');
    const tabB = await twoTabs(page);
    const id = await putWorld(page, world('e2e-two-tabs-delete', 'Marrowfen'));
    await editWorld(tabB, id);
    await nameField(tabB).fill('Marrowfen B');

    // The Main Menu's delete calls this; the module is the app's own instance.
    await page.evaluate(async (i) => {
      const modulePath = '/src/services/WorldStorageService.ts';
      const { default: svc } = await import(/* @vite-ignore */ modulePath);
      await svc.deleteWorld(i);
    }, id);
    const deleted = tabB.getByRole('alertdialog', { name: 'World Deleted in Another Tab' });
    await expect(deleted).toBeVisible();
    await deleted.getByRole('button', { name: 'Keep Mine' }).click();
    await expect(deleted).toHaveCount(0);
    await expect(tabB.locator(FACE)).toHaveAccessibleName('Saved');
    const names = await page.evaluate(async () => {
      const modulePath = '/src/services/WorldStorageService.ts';
      const { default: svc } = await import(/* @vite-ignore */ modulePath);
      return (await svc.getWorldMetadata()).map((w: { name: string }) => w.name);
    });
    expect(names).toContain('Marrowfen B');
  });

  test('a save of another world asks nothing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one width covers a storage signal');
    const tabB = await twoTabs(page);
    const first = await putWorld(page, world('e2e-two-tabs-x', 'Saltmarsh'));
    const second = await putWorld(page, world('e2e-two-tabs-y', 'Reedholm'));
    await editWorld(page, first);
    await editWorld(tabB, second);

    await nameField(page).fill('Saltmarsh A');
    await saveByHand(page);
    // A tab of the same world would show the question within a frame or two; give it far longer.
    await tabB.waitForTimeout(1000);
    await expect(asked(tabB)).toHaveCount(0);
  });
});
