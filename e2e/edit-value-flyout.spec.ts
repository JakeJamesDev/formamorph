import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

// "Edit Value" hands the caret to the value's own island. jsdom will not focus a contentEditable island,
// so whether the next keystroke lands in the value can only be answered here.

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

const WORLD = {
  id: 'e2e-edit-value-flyout',
  worldOverview: { name: 'E2E Edit Value Flyout', description: '', author: '' },
  locations: [],
  stats: [],
  // Both values are the same, so a random roll never changes the text under test, and both World
  // placements land on one value: the second opens as a mirror of the first.
  entities: [{ id: 'ent-0', name: 'Walker', type: 'Person', aiDescription: 'From {{ph:ph-town:world:e1}} to {{ph:ph-town:world:e2}}.' }],
  traits: [],
  statUpdates: [],
  placeholders: [{ id: 'ph-town', name: 'Town', values: [{ id: 'v0', text: 'Al' }, { id: 'v1', text: 'Al' }] }],
};

const FIELD = '[data-find-field="AI-Facing Description"]';

/** Opens the entity's description on the Edit tab and returns the field. */
async function openField(page: Page): Promise<Locator> {
  // An ended contest's results dialog reads the full list and would cover the editor.
  await page.route(/\/events(\?|$)/, (route) => route.fulfill({ json: { data: [] } }));
  await openApp(page);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'descriptions' });
  await page.getByText('Walker', { exact: true }).first().click();
  const field = page.locator(FIELD);
  await expect(field.getByRole('tab', { name: 'Edit' })).toHaveAttribute('data-state', 'active');
  return field;
}

/** Picks Edit Value from the flyout of the chip at `nth`. */
async function pickEditValue(field: Locator, nth: number) {
  await field.locator('[data-lexical-decorator]').nth(nth).getByText('Town', { exact: true }).click();
  await field.page().getByRole('button', { name: 'Edit Value' }).click();
}

/** Which open value holds the keyboard, or -1. */
const focusedValue = (field: Locator) =>
  field.evaluate((el) => [...el.querySelectorAll('[data-open-value-text]')]
    .findIndex((v) => v.contains(document.activeElement)));

test.beforeEach(({ viewport: _viewport }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Mobile opens the field full screen on a tap');
});

test('Edit Value opens the Values tab with the keyboard inside that chip’s value, so the next key extends it', async ({ page }) => {
  const field = await openField(page);
  await pickEditValue(field, 0);

  await expect(field.getByRole('tab', { name: 'Values' })).toHaveAttribute('data-state', 'active');
  await expect.poll(() => focusedValue(field)).toBe(0);

  // The caret sits at the value's end, so this appends rather than replacing or landing in the field text.
  await page.keyboard.type('bert');
  await expect(field.locator('[data-open-value-text]').first()).toHaveText('Albert');
  // The mirror follows, and the field's own text keeps its chips and its words.
  await expect(field.locator('[data-open-value-text]').nth(1)).toHaveText('Albert');
  await expect(field.locator('[contenteditable="true"]').first()).toContainText('From');
});

test('Edit Value on the read-only copy of a doubled value hands the keyboard to the copy that edits it', async ({ page }) => {
  const field = await openField(page);
  await pickEditValue(field, 1);

  await expect.poll(() => focusedValue(field)).toBe(0);
  await page.keyboard.type('f');
  await expect(field.locator('[data-open-value-text]').first()).toHaveText('Alf');
});
