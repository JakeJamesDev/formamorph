import { test, expect } from '@playwright/test';
import { openLibrary, tiles } from './tileDrag';

for (const action of ['Confirm', 'Cancel'] as const) {
  test(`${action} world deletion leaves the library clickable`, async ({ page }) => {
    await openLibrary(page);
    const initial = await tiles(page).count();
    const worldName = await tiles(page).first().getAttribute('alt');

    await tiles(page).first().click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const confirmation = page.getByRole('alertdialog', { name: 'Delete World' });
    await confirmation.getByRole('button', { name: action, exact: true }).click();

    await expect(confirmation).toHaveCount(0);
    await expect(tiles(page)).toHaveCount(initial - (action === 'Confirm' ? 1 : 0));
    await expect(page.getByRole('img', { name: worldName!, exact: true })).toHaveCount(action === 'Confirm' ? 0 : 1);
    // A real click catches a leaked modal input lock after either way of closing the dialog.
    await tiles(page).first().click({ button: 'right', timeout: 3000 });
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
  });
}
