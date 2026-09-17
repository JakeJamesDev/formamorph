import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoDev, openApp } from './app';

interface DevRouter {
  putWorld(world: unknown): Promise<string>;
  editWorld(id: string): Promise<void>;
  listWorlds(): Promise<unknown[]>;
}

const values = (id: string, texts: string[]) => texts.map((text, i) => ({ id: `${id}-v${i}`, text }));
const chip = (id: string, placement: string) => `{{ph:${id}:world:${placement}}}`;

/** Every value of one placeholder behaves the same, so a random roll never changes the geometry under test. */
const PLACEHOLDERS = [
  { id: 'ph-ed', name: 'Ed', values: values('ph-ed', ['Al', 'Bo']) },
  { id: 'ph-cy', name: 'Cy', values: values('ph-cy', ['Di', 'Em']) },
  { id: 'ph-trail', name: 'Trail', values: values('ph-trail', ['a winding trail through wet ferns and fallen cedar', 'a narrow ridge path under dripping moss and old pine']) },
  { id: 'ph-coat', name: 'Coat', values: values('ph-coat', ['long silver coat', 'short copper coat']) },
  { id: 'ph-story', name: 'Story', values: values('ph-story', [
    'she walked for three days along the river and slept under the bridge each night until the rain stopped',
    'he rode for four nights along the coast and camped in the dunes each dawn until the wind turned north',
  ]) },
  { id: 'ph-pair', name: 'Pair', values: values('ph-pair', ['Mmmmmmmmmm Mmmmmmmmmm', 'Wwwwwwwwww Wwwwwwwwww']) },
  // Every value opens on a one-letter word, so the value always has a sliver to leave at the line's end.
  { id: 'ph-edge', name: 'Edge', values: values('ph-edge', ['a long silver coat', 'a short copper coat']) },
];

const ENTITIES: Record<string, string> = {
  // Two short values side by side: neither header can slide, so the left one is pushed.
  Push: `Then ${chip('ph-ed', 'e1')} ${chip('ph-cy', 'c1')} left.`,
  // A short value, then a long one: the right header slides to the end of its own line.
  Slide: `Then ${chip('ph-ed', 'e2')} ${chip('ph-trail', 't1')} ended.`,
  // Text before the value on the line above it, so a header that rose too far would cover it.
  Seat: `The wanderer from the eastern marsh arrived late in the season wearing a ${chip('ph-coat', 'k1')} and nothing else of note.`,
  Wrap: `${chip('ph-story', 's1')}.`,
  Split: `A lengthy opening phrase before ${chip('ph-pair', 'p1')} closes it.`,
  // One unbreakable word before the value, so a narrow editor leaves the value only the line's last pixels.
  Edge: `Antidisestablishmentarianism ${chip('ph-edge', 'g1')} ends it.`,
};

const WORLD = {
  id: 'e2e-open-value-layout',
  worldOverview: { name: 'E2E Open Value Layout', description: '', author: '' },
  locations: [],
  stats: [],
  entities: Object.entries(ENTITIES).map(([name, aiDescription], i) => ({ id: `ent-${i}`, name, type: 'Person', aiDescription })),
  traits: [],
  statUpdates: [],
  placeholders: PLACEHOLDERS,
};

const FIELD = '[data-find-field="AI-Facing Description"]';

/** Open one entity's AI-facing description on the Values tab and return its editor root. */
async function openValues(page: Page, entity: string): Promise<Locator> {
  // A live event's poster is modal over the menu and swallows the clicks below. `openApp` answers the
  // active-events call; this answers the API's other events calls too, whichever host it is on. Matched on
  // the path rather than by glob, so the dev server's own `/src/components/events/…` modules still load.
  await page.route(
    (url) => url.pathname.includes('/events/') && !url.pathname.startsWith('/src/'),
    (route) => route.fulfill({ json: [] }),
  );
  await openApp(page);
  // The bundled worlds seed after the menu mounts and re-render it, which closes an editor opened mid-seed.
  // The seeding toast is transient, so the settled world list is what a run can wait on.
  await expect.poll(() => page.evaluate(async () => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    return (await dev.listWorlds()).length;
  }), { timeout: 20_000 }).toBeGreaterThan(5);
  await page.evaluate(async (world) => {
    const dev = (window as unknown as { __fmDev: DevRouter }).__fmDev;
    await dev.editWorld(await dev.putWorld(world));
  }, WORLD);
  await gotoDev(page, 'mainMenu', { modal: 'worldEditor', tab: 'entities', subtab: 'descriptions' });
  await page.getByText(entity, { exact: true }).first().click();
  await page.getByRole('tablist', { name: 'Entity Fields' }).waitFor();
  const field = page.locator(FIELD);
  await field.getByRole('tab', { name: 'Values' }).click();
  const root = field.locator('[contenteditable="true"]').first();
  await expect(root.locator('[data-open-value] path[d]').first()).toBeAttached();
  return root;
}

interface Rect { left: number; top: number; right: number; bottom: number }
interface ValueGeometry {
  header: Rect;
  /** The value label, when the header is showing it rather than keeping it for a reader and a pointer. */
  shownLabel: string | null;
  readerLabel: string | null;
  shape: Rect;
  pieces: number;
  lines: Rect[];
  target: Rect;
  corners: { left: string; right: string };
}
interface Geometry { root: Rect; values: ValueGeometry[]; text: Rect[] }

/**
 * Reads every open value's header, outline and lines, plus the field text outside the values.
 *
 * `merge` groups rects by line here rather than calling the module under test, so the assertions have a
 * measurement of their own to compare the drawn shapes against.
 */
function geometry(root: Locator): Promise<Geometry> {
  return root.evaluate((el) => {
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const merge = (rects: DOMRectList) => {
      const out: { left: number; top: number; right: number; bottom: number }[] = [];
      for (const r of rects) {
        if (r.width <= 0) continue;
        const last = out[out.length - 1];
        if (last && r.top < last.bottom && r.bottom > last.top) {
          last.left = Math.min(last.left, r.left);
          last.right = Math.max(last.right, r.right);
        } else out.push(box(r));
      }
      return out;
    };
    const chips = [...el.querySelectorAll<HTMLElement>('[data-open-value]')];
    const text: Rect[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest('[data-open-value]')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      text.push(...merge(range.getClientRects()));
    }
    return {
      root: box(el.getBoundingClientRect()),
      text,
      values: chips.map((c) => {
        const header = c.querySelector<HTMLElement>(':scope > [data-open-value-header]')!;
        const label = header.querySelector<HTMLElement>('[data-open-value-label]');
        const svg = c.querySelector<SVGSVGElement>(':scope > [data-open-value-shape]')!;
        return {
          header: box(header.getBoundingClientRect()),
          // A compact header keeps its label as screen-reader text, which still has a clipped 1px box.
          shownLabel: label && label.getBoundingClientRect().width > 4 ? label.textContent : null,
          readerLabel: label?.textContent ?? null,
          shape: box(svg.getBoundingClientRect()),
          pieces: (svg.querySelector('path')?.getAttribute('d')?.match(/M/g) ?? []).length,
          lines: merge(c.querySelector('[data-lexical-slot]')!.getClientRects()),
          target: box(c.querySelector('[data-open-value-text]')!.getClientRects()[0]),
          corners: { left: header.style.borderBottomLeftRadius, right: header.style.borderBottomRightRadius },
        };
      }),
    };
  });
}

/** Two reads alike, so the layout pass (which runs off a resize observer) has finished moving things. */
async function settle(page: Page, root: Locator): Promise<Geometry> {
  let last = await geometry(root);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const next = await geometry(root);
    if (JSON.stringify(next) === JSON.stringify(last)) return next;
    last = next;
  }
  throw new Error('the open value layout never settled');
}

/** Sets the editor's own width, for the wraps a viewport cannot produce on its own. */
async function setWidth(page: Page, root: Locator, width: number): Promise<Geometry> {
  await root.evaluate((el, w) => { el.style.width = `${w}px`; }, width);
  return settle(page, root);
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

/** The invariants every layout keeps: headers inside the editor, off each other, and off the field's text. */
function expectClean(g: Geometry) {
  g.values.forEach((v, i) => {
    expect(v.header.left, `header ${i} left edge`).toBeGreaterThanOrEqual(g.root.left);
    expect(v.header.right, `header ${i} right edge`).toBeLessThanOrEqual(g.root.right);
    for (const w of g.values.slice(i + 1)) expect(overlaps(v.header, w.header), 'headers overlap').toBe(false);
    for (const t of g.text) expect(overlaps(v.header, t), `header ${i} covers field text`).toBe(false);
  });
}

test('a one-line value wears a tab header on one outline', async ({ page }) => {
  const root = await openValues(page, 'Seat');
  // Wide enough that the value itself never wraps, with the sentence before it on the line above.
  const g = await setWidth(page, root, 500);
  const [v] = g.values;
  expect(v.pieces).toBe(1);
  expect(v.lines).toHaveLength(1);
  // The tab: flush with the outline's left edge, its bottom on the outline's top.
  expect(Math.abs(v.header.left - v.shape.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(v.header.bottom - v.shape.top)).toBeLessThanOrEqual(2);
  expect(v.corners.left).toBe('0px');
  // The spacer stays on the value's first line: no break opens between them.
  expect(v.target.bottom).toBeGreaterThan(v.lines[0].top);
  expectClean(g);
});

test('a value that wraps across three lines draws one outline', async ({ page }) => {
  const root = await openValues(page, 'Wrap');
  const g = await setWidth(page, root, 260);
  const [v] = g.values;
  expect(v.lines.length).toBeGreaterThanOrEqual(3);
  expect(v.pieces).toBe(1);
  // A wrapped value's chip has one fragment per line, and the outline still lands on the text.
  expect(v.shape.left).toBeCloseTo(Math.min(...v.lines.map((l) => l.left)) - 3, 0);
  expect(v.shape.right).toBeCloseTo(Math.max(...v.lines.map((l) => l.right)) + 3, 0);
  expect(v.shape.top).toBeCloseTo(v.lines[0].top - 1, 0);
  expectClean(g);
});

test('a wrap whose lines do not overlap splits the outline', async ({ page }) => {
  const root = await openValues(page, 'Split');
  // Measured wide, where the phrase and the value's first word share line one whatever the viewport is.
  await setWidth(page, root, 700);
  // Width for the phrase and the first word on line one, with the second word forced onto line two.
  const width = await root.evaluate((el) => {
    const style = getComputedStyle(el);
    const island = el.querySelector('[data-lexical-slot]')!;
    const words = island.textContent!.split(' ');
    const range = document.createRange();
    const walker = document.createTreeWalker(island, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode()!;
    range.setStart(node, 0);
    range.setEnd(node, words[0].length);
    const word = range.getBoundingClientRect().width;
    const target = el.querySelector('[data-open-value-text]')!.getBoundingClientRect();
    const start = target.left - el.getBoundingClientRect().left - parseFloat(style.paddingLeft);
    return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + start + 4 + word * 1.5;
  });
  const g = await setWidth(page, root, width);
  expect(g.values[0].lines).toHaveLength(2);
  const [first, second] = g.values[0].lines;
  expect(second.right).toBeLessThan(first.left);
  expect(g.values[0].pieces).toBe(2);
});

test('only the value that holds the caret shows the full header', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a tap on mobile opens full screen');
  const root = await openValues(page, 'Push');
  let g = await settle(page, root);
  for (const v of g.values) {
    expect(v.shownLabel, 'a header shows its label with no caret in it').toBeNull();
    expect(v.readerLabel, 'the compact header dropped its label instead of keeping it').toMatch(/Value \d/);
  }
  const island = root.locator('[data-open-value] [data-lexical-slot]').nth(1);
  await island.click();
  await expect(root.locator('[data-open-value][data-caret]')).toHaveCount(1);
  g = await settle(page, root);
  expect(g.values[0].shownLabel).toBeNull();
  expect(g.values[1].shownLabel).toMatch(/Value \d/);
  expectClean(g);
});

test('two short values push the left header away', async ({ page }) => {
  const root = await openValues(page, 'Push');
  const g = await settle(page, root);
  expectClean(g);
  const shift = await root.locator('[data-open-value-header]').evaluateAll((els) => els.map((e) => (e as HTMLElement).style.transform));
  expect(shift[0]).toMatch(/translateX\(-/);
  expect(shift[1]).toBe('');
});

test('a long right value takes its header to the end of its line', async ({ page }) => {
  const root = await openValues(page, 'Slide');
  const g = await settle(page, root);
  expectClean(g);
  const [, right] = g.values;
  // The right header ends where the right value's first line ends, with the bottom-left corner rounded past the line.
  expect(Math.abs(right.header.right - right.shape.right)).toBeLessThanOrEqual(1.5);
  expect(g.values[0].header.left).toBeGreaterThanOrEqual(g.values[0].shape.left - 1);
});

test('headers stay apart as chevron steps change the values', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a tap on mobile opens full screen');
  const root = await openValues(page, 'Slide');
  for (let step = 0; step < 3; step++) {
    const before = (await settle(page, root)).values[1].shape;
    await root.locator('[data-open-value]').first().getByRole('button', { name: 'Next Value' }).click();
    const g = await settle(page, root);
    // The left value changes width; the right value's outline is redrawn where the text moved to.
    expect(g.values[1].shape.left).not.toBe(before.left);
    expectClean(g);
    expect(Math.abs(g.values[1].shape.left + 3 - g.values[1].lines[0].left)).toBeLessThanOrEqual(1);
  }
});

test('a header against the right edge is pulled back inside', async ({ page }) => {
  const root = await openValues(page, 'Edge');
  // A width that leaves the value a few pixels at the end of the first line, where its header cannot fit.
  const width = await root.evaluate((el) => {
    const style = getComputedStyle(el);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    range.selectNodeContents(walker.nextNode()!);
    const before = range.getBoundingClientRect();
    return before.right - el.getBoundingClientRect().left + parseFloat(style.paddingRight) + 16;
  });
  const g = await setWidth(page, root, width);
  const [v] = g.values;
  // The value really is at the line's end, and the header really did not fit there.
  expect(v.lines.length).toBeGreaterThan(1);
  expect(v.lines[0].right).toBeGreaterThan(g.root.right - 20);
  // Seated on that sliver the header would hang out of the editor, so the pass pulled it back inside.
  const headerWidth = v.header.right - v.header.left;
  expect(v.lines[0].left + headerWidth, 'the header had room where it was seated').toBeGreaterThan(g.root.right);
  expect(v.header.right).toBeLessThanOrEqual(g.root.right - 3);
  // Pulled left of its own line start, so that bottom corner is no longer on the line.
  expect(v.corners.left).toBe('5px');
  expectClean(g);
});

test('no header leaves the editor at any width', async ({ page }) => {
  const root = await openValues(page, 'Seat');
  for (let width = 160; width <= 560; width += 20) expectClean(await setWidth(page, root, width));
});

test('a compact header gives its value label to a pointer', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a tooltip needs a pointer');
  const root = await openValues(page, 'Push');
  await root.locator('[data-open-value-header]').first().hover();
  // The label the compact header keeps out of the line is what the tip shows.
  await expect(page.getByText(/Value \d · \d\/\d/).last()).toBeVisible();
});

test('closing one value redraws the outlines of the others', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'a tap on mobile opens full screen');
  const root = await openValues(page, 'Push');
  const before = await settle(page, root);
  expect(before.values).toHaveLength(2);
  // Delete the second chip, which closes its value and reflows the one left open. Backspace inside a value
  // reaches nothing outside it, so the deleting caret starts in the field text past the chip and eats
  // " left." on its way back to it.
  const box = (await root.boundingBox())!;
  await root.click({ position: { x: box.width - 8, y: 12 } });
  await page.keyboard.press('End');
  for (let i = 0; i < ' left.'.length + 1; i++) await page.keyboard.press('Backspace');
  await expect(root.locator('[data-open-value]')).toHaveCount(1);
  const after = await settle(page, root);
  const [left] = after.values;
  // The value that stayed open is drawn where its text now sits, not where it sat before the delete.
  expect(left.shape.left).toBeCloseTo(left.lines[0].left - 3, 0);
  expect(left.header.left).toBeCloseTo(left.shape.left, 0);
  expectClean(after);
});

for (const theme of ['light', 'dark'] as const) {
  test(`the outline stands off the editor's own surface in the ${theme} theme`, async ({ page }) => {
    const root = await openValues(page, 'Seat');
    await page.evaluate((t) => {
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(t);
    }, theme);
    await settle(page, root);
    const contrast = await root.evaluate((el) => {
      // A `color-mix` is computed as `oklab(…)`, which a canvas converts to sRGB and a regex cannot.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d')!;
      const channel = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
      const luminance = (...layers: string[]) => {
        for (const color of layers) {
          ctx.fillStyle = color;
          ctx.fillRect(0, 0, 1, 1);
        }
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const path = el.querySelector('[data-open-value-shape] path')!;
      const surface = getComputedStyle(el).backgroundColor;
      // Painted over the editor's own surface, because a translucent line is only as visible as what
      // shows through it.
      return Math.abs(luminance(surface, getComputedStyle(path).stroke) - luminance(surface));
    });
    // The outline is what says where a value starts and ends, so it cannot sit on the surface's own level.
    // Measured: the shipped line reaches 0.64 in light and 0.77 in dark, and the translucent chip wash it
    // replaced reached only 0.13 and 0.21, which was invisible on a light theme.
    expect(contrast, 'the outline barely stands off the editor').toBeGreaterThan(0.4);
  });
}
