import { test, expect, type Page } from '@playwright/test';
import { openApp, openEditorSection } from './app';
import { IN_TAB_PANEL, ROW, editorGrip, editorRow, rowIndents, rowLabels } from './dragSampling';

/**
 * A long tree mounts only the rows near its viewport. These are the parts jsdom cannot show: a drag that
 * auto-scrolls past the mounted rows still lands where the pointer drops it, at the depth it asks for, and
 * Tab still walks every row as focus scrolls new ones into the window.
 */

const ROOT = IN_TAB_PANEL;
const COUNT = 240;
const INDENT = 24;
const ROOT_PADDING = 8;

interface Dev {
  listWorlds(): Promise<{ id: string; name: string }[]>;
  getWorld(id: string): Promise<Record<string, unknown>>;
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
}

/** Open the Entities tab of a stored world whose entities are `Row 0`…, then one group at the end. */
async function openLongTree(page: Page): Promise<void> {
  await openApp(page);
  await page.getByText('Loaded default worlds').waitFor({ state: 'visible' });
  await page.evaluate(async (count) => {
    const dev = (window as unknown as { __fmDev: Dev }).__fmDev;
    const [first] = await dev.listWorlds();
    const world = await dev.getWorld(first.id);
    const entities = Array.from({ length: count }, (_, i): { id: string; name: string; groupId: string | null; order: number } => (
      { id: `row-${i}`, name: `Row ${i}`, groupId: null, order: i }
    ));
    entities.push({ id: 'inside', name: 'Inside', groupId: 'far', order: 0 });
    const id = await dev.putWorld({
      ...world, id: 'long-tree', entities, entityGroups: [{ id: 'far', name: 'Far Group', parentId: null, order: count }],
    });
    await dev.editWorld(id);
  }, COUNT);
  await openEditorSection(page, 'Entities');
  await expect(editorRow(page, ROOT, 'Row 0')).toBeVisible();
}

test('a long tree mounts only the rows near the viewport', async ({ page }) => {
  await openLongTree(page);
  const mounted = (await rowLabels(page, ROOT)).length;
  expect(mounted).toBeGreaterThan(0);
  expect(mounted).toBeLessThan(60);
});

test('a drag past the visible end auto-scrolls and nests where it drops', async ({ page }) => {
  // Auto-scroll crosses about 14,000 px, which takes 15–30 s.
  test.setTimeout(90_000);
  await openLongTree(page);
  const viewport = page.locator(`${ROOT} [data-radix-scroll-area-viewport]`).first();
  const view = (await viewport.boundingBox())!;
  const grip = (await editorGrip(page, ROOT, 'Row 1').boundingBox())!;
  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 8);
  // Held at the bottom edge, the list auto-scrolls until it reaches its end.
  await page.mouse.move(x, view.y + view.height - 4, { steps: 10 });
  await expect.poll(
    () => viewport.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop),
    { timeout: 60_000, message: 'auto-scroll should reach the end of the list' },
  ).toBeLessThan(2);
  // One indent to the right: the row nests under the group's last child.
  await page.mouse.move(x + INDENT, view.y + view.height - 4, { steps: 4 });
  await page.waitForTimeout(300);
  await page.mouse.up();

  await expect.poll(async () => (await rowLabels(page, ROOT)).slice(-3)).toEqual(['Far Group', 'Inside', 'Row 1']);
  const [labels, indents] = await Promise.all([rowLabels(page, ROOT), rowIndents(page, ROOT)]);
  expect(indents[labels.indexOf('Row 1')], 'the dropped row should nest in the group').toBe(ROOT_PADDING + INDENT);
  expect(indents[labels.indexOf('Inside')]).toBe(ROOT_PADDING + INDENT);
});

test('Tab reaches every row of a long tree', async ({ page }) => {
  test.setTimeout(120_000);
  await openLongTree(page);
  // Each focus records its row's label, or null once focus leaves the tree.
  await page.evaluate(([root, row]) => {
    const w = window as unknown as { __reached: (string | null)[] };
    w.__reached = [];
    document.addEventListener('focusin', () => {
      const el = document.activeElement?.closest(`${root} ${row}`);
      w.__reached.push(el ? el.querySelector('span.truncate')?.textContent?.trim() ?? '' : null);
    });
  }, [ROOT, ROW] as const);
  await editorGrip(page, ROOT, 'Row 0').focus();
  const reached = () => page.evaluate(() => (window as unknown as { __reached: (string | null)[] }).__reached);
  // Three tab stops a row (grip, Duplicate, Delete) and a chevron on the group, so this bound is generous.
  for (let i = 0; i < (COUNT + 2) * 4 && !(await reached()).includes(null); i += 40) {
    for (let k = 0; k < 40; k++) await page.keyboard.press('Tab');
  }
  const all = await reached();
  // The batch keeps pressing Tab after focus leaves, so the walk ends at the first exit.
  const walk = all.slice(0, all.indexOf(null) < 0 ? all.length : all.indexOf(null));
  const rows = walk.filter((label, i) => label !== walk[i - 1]);
  expect(rows).toEqual([...Array.from({ length: COUNT }, (_, i) => `Row ${i}`), 'Far Group', 'Inside']);
});
