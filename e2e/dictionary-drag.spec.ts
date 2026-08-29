import { test, expect, type Page } from '@playwright/test';
import { openApp, gotoDev } from './app';

/**
 * Dragging a dictionary entry must animate the displaced neighbors, both directions.
 *
 * Guards a reference-identity trap: useSortable compares its SortableContext's `items` array by
 * reference, and an inline `entries.map(...)` re-created on a mid-drag render downgrades every
 * displaced row's transition to 0ms — rows snap instead of sliding. jsdom cannot see this (no layout,
 * no transitions), so it is proven here by sampling computed transforms per frame during a real drag.
 * With the bug present a displaced row shows no intermediate positions (0 → ±60 in one frame).
 */

const BOOK = 'Drag Anim Book';

/** Import a standalone dictionary through the real file input (no picker in headless). */
async function importBook(page: Page, count: number): Promise<void> {
  await page.evaluate(([n, c]) => {
    const entries = [] as unknown[];
    for (let i = 0; i < (c as number); i++) {
      entries.push({ id: 'e' + i, name: 'Entry ' + i, key: ['kw' + i], value: 'Lore ' + i });
    }
    const json = JSON.stringify({ formamorphKind: 'dictionary', version: '2.0.3', name: n, entries });
    const input = document.querySelector('input[accept=".json,application/json"]') as HTMLInputElement;
    const dt = new DataTransfer();
    dt.items.add(new File([json], n + '.json', { type: 'application/json' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, [BOOK, count] as const);
  await expect(page.getByText(BOOK, { exact: true })).toBeVisible();
}

/** Per-frame sampler of the watched rows' computed transforms (one rAF loop; labels swap per drag). */
function startSampler(page: Page, labels: string[]): Promise<void> {
  return page.evaluate((watch) => {
    const w = window as unknown as { __samples: unknown[]; __watch: string[]; __loop?: boolean };
    w.__samples = [];
    w.__watch = watch;
    if (w.__loop) return;
    w.__loop = true;
    const tick = () => {
      const rec: Record<string, string> = {};
      for (const label of w.__watch) {
        const row = [...document.querySelectorAll('[role="dialog"] div.cursor-pointer')]
          .find((el) => el.querySelector('span.truncate')?.textContent === label) as HTMLElement | undefined;
        rec[label] = row ? getComputedStyle(row).transform : 'gone';
      }
      w.__samples.push(rec);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, labels);
}

const samples = (page: Page) =>
  page.evaluate(() => (window as unknown as { __samples: Record<string, string>[] }).__samples);

function grip(page: Page, label: string) {
  return page
    .locator('[role="dialog"] div.cursor-pointer')
    .filter({ has: page.locator('span.truncate', { hasText: new RegExp(`^${label}$`) }) })
    .locator('span.cursor-grab')
    .first();
}

async function dragBy(page: Page, label: string, dy: number): Promise<void> {
  const g = grip(page, label);
  await g.scrollIntoViewIfNeeded();
  const box = (await g.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + Math.sign(dy) * 8); // clear the sensor's 5px activation distance
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx, cy + Math.sign(dy) * 8 + (dy * i) / steps);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300); // let the displacement transition finish before dropping
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Distinct intermediate translateY positions a row passed through (excludes rest states 0/±60/none). */
function intermediates(recs: Record<string, string>[], label: string): number {
  const seen = new Set<number>();
  for (const rec of recs) {
    const v = rec[label];
    if (!v || v === 'none' || v === 'gone') continue;
    const ty = Number(v.split(',').pop()!.replace(')', '').trim());
    if (Number.isFinite(ty) && ty !== 0 && Math.abs(Math.abs(ty) - 60) > 1) seen.add(Math.round(ty));
  }
  return seen.size;
}

test('displaced entry rows slide, not snap, in both drag directions', async ({ page }) => {
  await openApp(page);
  await gotoDev(page, 'mainMenu', { tab: 'dictionaries' });
  // Over the virtualization threshold, so the windowed path (the riskier one) is what's measured.
  await importBook(page, 600);
  await page.getByText(BOOK, { exact: true }).click();
  await expect(grip(page, 'Entry 3')).toBeVisible();

  // Down: Entry 1 over Entry 2 → Entry 2 slides up through intermediate positions.
  await startSampler(page, ['Entry 2']);
  await dragBy(page, 'Entry 1', 120);
  expect(intermediates(await samples(page), 'Entry 2'), 'down-drag should animate').toBeGreaterThanOrEqual(3);

  // Up: Entry 5 over Entry 4 → Entry 4 slides down through intermediate positions.
  await startSampler(page, ['Entry 4']);
  await dragBy(page, 'Entry 5', -120);
  expect(intermediates(await samples(page), 'Entry 4'), 'up-drag should animate').toBeGreaterThanOrEqual(3);
});
