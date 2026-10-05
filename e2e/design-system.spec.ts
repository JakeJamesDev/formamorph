import { expect, test } from '@playwright/test';
import { HEAD_HEIGHT, READER_GAP } from '../src/lib/formaquestion/windowBox';

test('all design references fit the viewport and remain reachable', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  const showcase = page.locator('[data-design-system-showcase]');
  await expect(showcase).toBeVisible();

  for (const name of ['Settings', 'Markdown', 'Community Cards', 'Find', 'Code Templates', 'Locations', 'Context Menu', 'Rich Lists', 'Footer Actions', 'Panel Tabs', 'Formaquestion', 'Preset Header', 'Landing Pulse']) {
    const tab = page.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    const dimensions = await showcase.evaluate(element => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
    const box = await tab.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const labelDimensions = await tab.evaluate(element => {
      const tabBounds = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const labelBounds = range.getBoundingClientRect();
      return {
        content: element.scrollWidth,
        viewport: element.clientWidth,
        labelLeft: labelBounds.left,
        labelRight: labelBounds.right,
        tabLeft: tabBounds.left,
        tabRight: tabBounds.right,
      };
    });
    expect(labelDimensions.content).toBeLessThanOrEqual(labelDimensions.viewport);
    expect(labelDimensions.labelLeft).toBeGreaterThanOrEqual(labelDimensions.tabLeft - 1);
    expect(labelDimensions.labelRight).toBeLessThanOrEqual(labelDimensions.tabRight + 1);
  }
});

test('the Formaquestion reference draws the minimal chrome as three pieces on one baseline', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  await page.getByRole('tab', { name: 'Formaquestion', exact: true }).click();

  const sample = page.getByRole('region', { name: 'Minimal Chrome' });
  const mascot = sample.locator('[data-fq-piece="mascot"]');
  const column = sample.locator('[data-fq-piece="column"]');
  const reader = sample.locator('[data-fq-piece="reader"]');
  await expect.poll(() => mascot.evaluate((el) => [...el.querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
  await expect.poll(async () => (await mascot.boundingBox())?.width ?? 0).toBeGreaterThan(0);
  await expect(reader).toBeVisible();

  const [m, c, r] = [(await mascot.boundingBox())!, (await column.boundingBox())!, (await reader.boundingBox())!];
  expect(m.x + m.width).toBeCloseTo(c.x, 0);
  expect(r.x).toBeCloseTo(c.x + c.width + READER_GAP, 0);
  expect(m.y + m.height).toBeCloseTo(c.y + c.height, 0);
  expect(r.y + r.height).toBeCloseTo(c.y + c.height, 0);
  expect(r.height).toBeCloseTo(c.height, 0);
  expect(m.height).toBeCloseTo(c.height, 0);

  // The question sits on the primary fill and the answer on the popover fill, in a border.
  const fillOf = (token: string) => page.evaluate((className) => {
    const probe = document.body.appendChild(document.createElement('div'));
    probe.className = className;
    const fill = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return fill;
  }, `bg-${token}`);
  const question = sample.locator('[data-fq-bubble="question"]').first();
  const answer = sample.locator('[data-fq-bubble="answer"]').first();
  expect(await question.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await fillOf('primary'));
  expect(await answer.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await fillOf('popover'));
  expect(await fillOf('primary')).not.toBe(await fillOf('popover'));
  expect(await answer.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('1px');

  // The pill's head button swaps the whole mascot for the head view and back.
  await sample.getByRole('button', { name: 'Show Head Only' }).click();
  await expect(mascot).toHaveAttribute('data-fq-view', 'head');
  await expect.poll(async () => (await mascot.boundingBox())?.height ?? 0).toBeCloseTo(HEAD_HEIGHT, 0);
  await sample.getByRole('button', { name: 'Show Full Mascot' }).click();
  await expect(mascot).toHaveAttribute('data-fq-view', 'full');

  // The reader closes on its own. The column and the mascot stay.
  await reader.getByRole('button', { name: 'Close Reader' }).click();
  await expect(reader).toHaveCount(0);
  await expect(column).toBeVisible();
  await expect(mascot).toBeVisible();
  // A source name opens it again.
  await sample.getByRole('group', { name: 'Sources' }).getByRole('button', { name: /How to Light a Lantern/ }).click();
  await expect(reader).toBeVisible();
});

test('the Preset Header reference shows both widths and fits a phone viewport', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem&tab=preset-header');
  const reference = page.getByRole('region', { name: 'Preset Header Reference' });
  await expect(reference).toBeVisible();

  const wide = reference.getByRole('region', { name: 'Editable, Wide' });
  const narrow = reference.getByRole('region', { name: 'Editable, Narrow' });
  await expect(wide.getByRole('button', { name: 'Export' })).toBeVisible();
  await expect(narrow.getByRole('button', { name: 'Export' })).toHaveCount(0);

  // The ⋯ menu holds every action, and Reset confirms with the preset's name.
  await narrow.getByRole('button', { name: 'Preset Actions' }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(7);
  await page.getByRole('menuitem', { name: 'Reset' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('"Mine"');
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(narrow.getByRole('button', { name: 'Preset Actions' })).toBeFocused();

  // Reset left of Compare, at the right edge of the footer pair.
  const single = reference.getByRole('region', { name: 'Single Prompt' });
  const reset = (await single.getByRole('button', { name: 'Reset Narration Prompt' }).boundingBox())!;
  const compare = (await single.getByRole('button', { name: 'Compare Narration Prompt' }).boundingBox())!;
  expect(reset.x + reset.width).toBeLessThanOrEqual(compare.x);
  const section = (await single.boundingBox())!;
  // The gap to the card edge is its padding and border, 13px.
  expect(section.x + section.width - (compare.x + compare.width)).toBeLessThan(20);

  // At phone width nothing makes the page scroll sideways, and the wide sample scrolls inside its own box.
  await page.setViewportSize({ width: 375, height: 812 });
  const showcase = page.locator('[data-design-system-showcase]');
  const dimensions = await showcase.evaluate((el) => ({ content: el.scrollWidth, viewport: el.clientWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  const stacked = reference.getByRole('region', { name: 'Stacked Prompts' });
  const label = (await stacked.getByText('Opening Message').boundingBox())!;
  const pairBox = (await stacked.getByRole('button', { name: 'Reset Opening Message' }).boundingBox())!;
  // The pair never covers its label, whether it shares the row or wraps under it.
  expect(pairBox.x >= label.x + label.width || pairBox.y >= label.y + label.height).toBe(true);
});

test('the Code Templates reference validates and inserts into its local target', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  await page.getByRole('tab', { name: 'Code Templates', exact: true }).click();

  const reference = page.getByRole('region', { name: 'Stat Code Templates' });
  const opener = reference.getByRole('button', { name: 'Open Code Templates' });
  await opener.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Code Templates' });
  await expect(dialog).toBeVisible();
  expect(await page.locator(':focus').evaluate((element) => Boolean(element.closest('[role="dialog"]')))).toBe(true);

  const insert = dialog.getByRole('button', { name: 'Insert Code' });
  await expect(insert).toBeDisabled();
  await dialog.getByRole('combobox', { name: 'First Stat' }).click();
  await page.getByRole('option', { name: 'Warmth' }).click();
  await dialog.getByRole('combobox', { name: 'Second Stat' }).click();
  await page.getByRole('option', { name: 'Fatigue' }).click();

  const weight = dialog.getByRole('textbox', { name: 'Weight' });
  await weight.fill('invalid');
  await expect(dialog.getByText('Must be a number')).toBeVisible();
  await expect(insert).toBeDisabled();

  await weight.fill('0.25');
  await expect(dialog.getByText('Must be a number')).toBeHidden();
  await expect(dialog).toContainText('const weight = 0.25;');
  await expect(insert).toBeEnabled();
  await insert.click();

  await expect(dialog).toBeHidden();
  await expect(reference).toContainText('const weight = 0.25;');
  await expect(reference.getByText('The local sample stat code is updated.')).toBeVisible();
});

test('the Find reference exposes local search states and keyboard focus', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('FORMAMORPH_introSeen', '1'));
  await page.goto('/#dev?modal=designSystem');
  await page.getByRole('tab', { name: 'Find', exact: true }).click();

  const reference = page.getByRole('region', { name: 'Find Bar Reference' });
  await reference.getByRole('button', { name: 'Find and Replace', exact: true }).click();
  const find = reference.getByRole('textbox', { name: 'Find' });
  await expect(find).toBeFocused();

  await find.fill('harbor');
  await expect(reference.getByText('1 / 5')).toBeVisible();
  await reference.getByRole('button', { name: 'Previous match' }).click();
  await expect(reference.getByText('5 / 5')).toBeVisible();
  await expect(reference.getByRole('textbox', { name: 'Keeper Description' })).toHaveAttribute('data-find-current', 'true');

  await reference.getByRole('button', { name: 'Close find' }).click();
  await expect(reference.getByRole('button', { name: 'Find', exact: true })).toBeFocused();
});
